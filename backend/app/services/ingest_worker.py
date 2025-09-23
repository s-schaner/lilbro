"""Asynchronous ingest worker responsible for media processing."""
from __future__ import annotations

import asyncio
import json
import logging
import os
from collections import deque
from pathlib import Path
from typing import Deque, Dict, Iterable, List, Optional

from . import ingest_state


LOGGER = logging.getLogger("app.ingest")

DATA_ROOT = Path(os.getenv("DATA_ROOT", "/data")).resolve()
ORIGINAL_DIR = DATA_ROOT / "original"
MEZZ_DIR = DATA_ROOT / "mezz"
PROXY_DIR = DATA_ROOT / "proxy"
THUMBS_DIR = DATA_ROOT / "thumbs"
META_DIR = DATA_ROOT / "meta"

for directory in (ORIGINAL_DIR, MEZZ_DIR, PROXY_DIR, THUMBS_DIR, META_DIR):
    directory.mkdir(parents=True, exist_ok=True)


STAGE_PROGRESS = {
    "validate": 5,
    "transcode_mezz": 60,
    "make_proxy": 80,
    "thumbs": 95,
    "ready": 100,
}

_tasks: Dict[str, asyncio.Task[None]] = {}
_tasks_lock = asyncio.Lock()


class CommandError(RuntimeError):
    """Exception raised when ffmpeg/ffprobe command fails."""

    def __init__(self, command: Iterable[str], returncode: int, stderr: Iterable[str]):
        super().__init__(f"Command {' '.join(command)} failed with exit code {returncode}")
        self.command = list(command)
        self.returncode = returncode
        self.stderr = list(stderr)


async def _drain_stderr(stream: Optional[asyncio.StreamReader], upload_id: str, stage: str) -> List[str]:
    if stream is None:
        return []
    tail: Deque[str] = deque(maxlen=40)
    while True:
        line = await stream.readline()
        if not line:
            break
        text = line.decode(errors="replace").rstrip()
        if text:
            LOGGER.debug("[%s][%s] %s", upload_id, stage, text)
            tail.append(text)
    return list(tail)


async def _drain_stdout(stream: Optional[asyncio.StreamReader]) -> bytes:
    if stream is None:
        return b""
    chunks: List[bytes] = []
    while True:
        chunk = await stream.read(32 * 1024)
        if not chunk:
            break
        chunks.append(chunk)
    return b"".join(chunks)


async def _run_command(
    command: List[str],
    upload_id: str,
    stage: str,
    *,
    capture_stdout: bool = False,
) -> bytes:
    stdout_pipe = asyncio.subprocess.PIPE if capture_stdout else asyncio.subprocess.DEVNULL
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=stdout_pipe,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout_task = (
        asyncio.create_task(_drain_stdout(process.stdout)) if capture_stdout else None
    )
    stderr_task = asyncio.create_task(_drain_stderr(process.stderr, upload_id, stage))

    returncode = await process.wait()
    stderr_lines = await stderr_task
    stdout_bytes = await stdout_task if stdout_task else b""

    if returncode != 0:
        raise CommandError(command, returncode, stderr_lines)

    return stdout_bytes


def _gpu_enabled() -> bool:
    return os.getenv("USE_GPU", "false").lower() in {"1", "true", "yes", "on"}


def _build_asset_urls(upload_id: str) -> Dict[str, str]:
    return {
        "mezzanine_url": f"/assets/mezz/{upload_id}.mp4",
        "proxy_url": f"/assets/proxy/{upload_id}.mp4",
        "thumbs_glob": f"/assets/thumbs/{upload_id}/thumb_%04d.jpg",
        "keyframes_csv": f"/assets/meta/{upload_id}/keyframes.csv",
    }


async def is_job_running(upload_id: str) -> bool:
    async with _tasks_lock:
        task = _tasks.get(upload_id)
        return bool(task) and not task.done()


async def register_task(upload_id: str, task: asyncio.Task[None]) -> None:
    async with _tasks_lock:
        _tasks[upload_id] = task

    def _cleanup(_task: asyncio.Task[None]) -> None:
        async def _inner() -> None:
            async with _tasks_lock:
                existing = _tasks.get(upload_id)
                if existing is _task:
                    _tasks.pop(upload_id, None)

        asyncio.create_task(_inner())

    task.add_done_callback(_cleanup)


async def run_ingest(upload_id: str, src_path: str, ext: str) -> None:
    """Execute ingest pipeline for a given upload identifier."""

    LOGGER.info("Starting ingest for %s", upload_id)

    progress = 0
    use_gpu = _gpu_enabled()

    try:
        ingest_state.update_job(upload_id, status="running", stage="validate", progress=1, message=None)
        progress = 1

        probe_cmd = [
            "ffprobe",
            "-v",
            "error",
            "-show_streams",
            "-of",
            "json",
            src_path,
        ]
        probe_output = await _run_command(probe_cmd, upload_id, "validate", capture_stdout=True)
        streams = json.loads(probe_output.decode() or "{}").get("streams", [])
        video_streams = [stream for stream in streams if stream.get("codec_type") == "video"]
        if not video_streams:
            raise RuntimeError("No video streams detected during validation")

        progress = STAGE_PROGRESS["validate"]
        ingest_state.update_job(upload_id, status="running", stage="transcode_mezz", progress=progress)

        mezz_path = MEZZ_DIR / f"{upload_id}.mp4"
        proxy_path = PROXY_DIR / f"{upload_id}.mp4"
        thumbs_path = THUMBS_DIR / upload_id
        meta_path = META_DIR / upload_id
        thumbs_path.mkdir(parents=True, exist_ok=True)
        meta_path.mkdir(parents=True, exist_ok=True)

        hw_accel = ["-hwaccel", "cuda"] if use_gpu else []
        if use_gpu:
            vcodec_args = ["-c:v", "h264_nvenc"]
        else:
            vcodec_args = ["-c:v", "libx264", "-pix_fmt", "yuv420p"]

        mezz_cmd = [
            "ffmpeg",
            "-y",
            *hw_accel,
            "-i",
            src_path,
            "-vf",
            "scale=-2:1080,fps=30,format=yuv420p",
            *vcodec_args,
            "-preset",
            "p5",
            "-profile:v",
            "high",
            "-b:v",
            "10M",
            "-maxrate",
            "12M",
            "-bufsize",
            "20M",
            "-g",
            "60",
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            "-ar",
            "48000",
            "-ac",
            "1",
            str(mezz_path),
        ]
        await _run_command(mezz_cmd, upload_id, "transcode_mezz")

        assets = _build_asset_urls(upload_id)
        progress = STAGE_PROGRESS["transcode_mezz"]
        ingest_state.update_job(
            upload_id,
            status="running",
            stage="make_proxy",
            progress=progress,
            assets={"mezzanine_url": assets["mezzanine_url"]},
        )

        proxy_cmd = [
            "ffmpeg",
            "-y",
            *hw_accel,
            "-i",
            src_path,
            "-vf",
            "scale=-2:720,fps=30,format=yuv420p",
            *vcodec_args,
            "-preset",
            "p5",
            "-b:v",
            "4M",
            "-g",
            "60",
            "-an",
            str(proxy_path),
        ]
        await _run_command(proxy_cmd, upload_id, "make_proxy")

        progress = STAGE_PROGRESS["make_proxy"]
        ingest_state.update_job(
            upload_id,
            status="running",
            stage="thumbs",
            progress=progress,
            assets={"proxy_url": assets["proxy_url"]},
        )

        thumbs_cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(mezz_path),
            "-vf",
            "fps=1,scale=-2:180",
            str(thumbs_path / "thumb_%04d.jpg"),
        ]
        await _run_command(thumbs_cmd, upload_id, "thumbs")

        progress = STAGE_PROGRESS["thumbs"]
        ingest_state.update_job(upload_id, status="running", stage="thumbs", progress=progress)

        keyframe_cmd = [
            "ffprobe",
            "-select_streams",
            "v",
            "-show_frames",
            "-show_entries",
            "frame=pkt_pts_time,pict_type",
            "-of",
            "csv",
            str(mezz_path),
        ]
        keyframe_output = await _run_command(keyframe_cmd, upload_id, "thumbs", capture_stdout=True)
        (meta_path / "keyframes.csv").write_bytes(keyframe_output)

        progress = STAGE_PROGRESS["ready"]
        ingest_state.update_job(
            upload_id,
            status="ready",
            stage="ready",
            progress=progress,
            assets={
                "mezzanine_url": assets["mezzanine_url"],
                "proxy_url": assets["proxy_url"],
                "thumbs_glob": assets["thumbs_glob"],
                "keyframes_csv": assets["keyframes_csv"],
            },
        )
        LOGGER.info("Ingest complete for %s", upload_id)
    except Exception as exc:  # pylint: disable=broad-except
        error_message = None
        if isinstance(exc, CommandError):
            tail = "\n".join(exc.stderr[-10:])
            error_message = tail or str(exc)
        else:
            error_message = str(exc)
        LOGGER.error("Ingest failed for %s: %s", upload_id, error_message)
        ingest_state.update_job(
            upload_id,
            status="error",
            stage="error",
            progress=progress,
            message=error_message,
        )
        raise
