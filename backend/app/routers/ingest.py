"""Ingest routes for handling direct video uploads."""
from __future__ import annotations

import os
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".mts", ".m2ts"}
DATA_ROOT = Path(os.getenv("DATA_ROOT", "/data")).resolve()
ORIGINAL_DIR = DATA_ROOT / "original"
ORIGINAL_DIR.mkdir(parents=True, exist_ok=True)

HEALTH_UPLOAD_ID = "healthcheck"


@dataclass
class StageTiming:
    """Represents a phase within the ingest simulation."""

    name: str
    start: datetime
    end: datetime


@dataclass
class UploadJob:
    """In-memory representation of an upload job."""

    upload_id: str
    extension: str
    started_at: datetime
    stages: List[StageTiming]

    @property
    def total_duration(self) -> float:
        """Return the total duration of the simulated pipeline."""

        active_stages = [stage for stage in self.stages if stage.end > stage.start]
        if not active_stages:
            return 0.0
        return (active_stages[-1].end - active_stages[0].start).total_seconds()


_upload_store: Dict[str, UploadJob] = {}

router = APIRouter(prefix="/ingest", tags=["ingest"])


def _schedule_job(upload_id: str, extension: str) -> UploadJob:
    """Create timing metadata for a new ingest job."""

    started_at = datetime.now(timezone.utc)
    total_duration = random.uniform(3.0, 5.0)
    validate_duration = max(1.0, total_duration * 0.35)
    proxy_duration = max(1.0, total_duration - validate_duration)

    validate_end = started_at + timedelta(seconds=validate_duration)
    proxy_end = validate_end + timedelta(seconds=proxy_duration)

    stages = [
        StageTiming(name="validate", start=started_at, end=validate_end),
        StageTiming(name="proxy", start=validate_end, end=proxy_end),
        StageTiming(name="ready", start=proxy_end, end=proxy_end),
    ]

    job = UploadJob(
        upload_id=upload_id,
        extension=extension,
        started_at=started_at,
        stages=stages,
    )
    _upload_store[upload_id] = job
    return job


def _ensure_health_job() -> None:
    """Seed a ready job used for health checks."""

    if HEALTH_UPLOAD_ID in _upload_store:
        return

    ready_time = datetime.now(timezone.utc) - timedelta(seconds=5)
    stages = [
        StageTiming(name="ready", start=ready_time, end=ready_time),
    ]
    _upload_store[HEALTH_UPLOAD_ID] = UploadJob(
        upload_id=HEALTH_UPLOAD_ID,
        extension="",
        started_at=ready_time,
        stages=stages,
    )


def _compute_status(job: UploadJob) -> Dict[str, object]:
    """Return the computed status payload for a job."""

    now = datetime.now(timezone.utc)

    if job.total_duration <= 0 or now >= job.stages[-1].end:
        return {"status": "ready", "stage": "ready", "progress": 100}

    total_duration = job.total_duration
    elapsed = max(0.0, (now - job.started_at).total_seconds())
    progress = min(99, int(round((elapsed / total_duration) * 100)))

    for stage in job.stages:
        if stage.name == "ready":
            break
        if now < stage.end:
            return {"status": "processing", "stage": stage.name, "progress": progress}
    return {"status": "ready", "stage": "ready", "progress": 100}


async def _write_file(destination: Path, upload: UploadFile) -> None:
    """Persist the uploaded file to disk in chunks."""

    try:
        with destination.open("wb") as buffer:
            while True:
                chunk = await upload.read(4 * 1024 * 1024)
                if not chunk:
                    break
                buffer.write(chunk)
    finally:
        await upload.close()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_video(file: UploadFile = File(...)) -> Dict[str, object]:
    """Accept a video upload and stash it on disk."""

    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")

    extension = Path(file.filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Please upload one of: .mp4, .mov, .mkv, .webm, .avi, .mts, .m2ts.",
        )

    upload_id = str(uuid4())
    destination = ORIGINAL_DIR / f"{upload_id}{extension}"

    try:
        await _write_file(destination, file)
    except OSError as exc:  # pragma: no cover - guard for filesystem errors
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to save upload") from exc

    _schedule_job(upload_id, extension)

    asset_path = f"/assets/original/{upload_id}{extension}"
    return {
        "upload_id": upload_id,
        "original_url": asset_path,
        "proxy_url": asset_path,
        "mezzanine_url": None,
    }


@router.get("/status")
def get_status(upload_id: str = Query(..., description="Upload identifier")) -> Dict[str, object]:
    """Return the simulated status for an upload job."""

    _ensure_health_job()

    job = _upload_store.get(upload_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")

    return _compute_status(job)
