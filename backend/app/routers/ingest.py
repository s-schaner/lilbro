"""Ingest routes orchestrating background media processing."""
from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from app.services import ingest_state, ingest_worker


ALLOWED_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".mts", ".m2ts"}

DATA_ROOT = Path(os.getenv("DATA_ROOT", "/data")).resolve()
ORIGINAL_DIR = DATA_ROOT / "original"
MEZZ_DIR = DATA_ROOT / "mezz"
PROXY_DIR = DATA_ROOT / "proxy"
THUMBS_DIR = DATA_ROOT / "thumbs"
META_DIR = DATA_ROOT / "meta"

for directory in (ORIGINAL_DIR, MEZZ_DIR, PROXY_DIR, THUMBS_DIR, META_DIR):
    directory.mkdir(parents=True, exist_ok=True)


router = APIRouter(prefix="/ingest", tags=["ingest"])


class StartIngestRequest(BaseModel):
    upload_id: str


def _build_original_url(upload_id: str, extension: str) -> str:
    suffix = extension if extension.startswith(".") else f".{extension}"
    return f"/assets/original/{upload_id}{suffix}"


def _empty_assets() -> Dict[str, Optional[str]]:
    return {
        "original_url": None,
        "proxy_url": None,
        "mezzanine_url": None,
        "thumbs_glob": None,
        "keyframes_csv": None,
    }


def _locate_original(upload_id: str) -> Optional[Path]:
    meta = ingest_state.get_job_meta(upload_id)
    if meta and meta.get("original_path"):
        candidate = Path(meta["original_path"])
        if candidate.exists():
            return candidate

    for extension in ALLOWED_EXTENSIONS:
        candidate = ORIGINAL_DIR / f"{upload_id}{extension}"
        if candidate.exists():
            return candidate
    return None


async def _ensure_worker(upload_id: str, src_path: Path) -> bool:
    if await ingest_worker.is_job_running(upload_id):
        return False

    task = asyncio.create_task(
        ingest_worker.run_ingest(upload_id, str(src_path), src_path.suffix.lower())
    )
    await ingest_worker.register_task(upload_id, task)
    return True


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_video(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")

    extension = Path(file.filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Please upload one of: .mp4, .mov, .mkv, .webm, .avi, .mts, .m2ts.",
        )

    upload_id = str(uuid.uuid4())
    destination = ORIGINAL_DIR / f"{upload_id}{extension}"

    try:
        with destination.open("wb") as buffer:
            while True:
                chunk = await file.read(4 * 1024 * 1024)
                if not chunk:
                    break
                buffer.write(chunk)
    finally:
        await file.close()

    original_url = _build_original_url(upload_id, extension)
    ingest_state.create_job(upload_id, str(destination), original_url)

    return {
        "upload_id": upload_id,
        "original_url": original_url,
        "proxy_url": None,
        "mezzanine_url": None,
        "thumbs_glob": None,
        "keyframes_csv": None,
    }


@router.post("/start")
async def start_ingest(payload: StartIngestRequest = Body(...)) -> Dict[str, str]:
    upload_id = payload.upload_id
    job = ingest_state.get_job(upload_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown upload_id")

    if job.get("status") == "ready":
        return {"status": "ready"}

    original_path = _locate_original(upload_id)
    if not original_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original file missing")

    started = await _ensure_worker(upload_id, original_path)
    return {"status": "started" if started else "running"}


@router.get("/status")
async def get_status(upload_id: str = Query(..., description="Upload identifier")) -> Dict[str, Any]:
    job = ingest_state.get_job(upload_id)
    if job:
        return job

    original_path = _locate_original(upload_id)
    if original_path:
        original_url = _build_original_url(upload_id, original_path.suffix)
        assets = _empty_assets()
        assets.update({"original_url": original_url, "proxy_url": original_url})
        return {
            "status": "ready",
            "stage": "ready",
            "progress": 100,
            "assets": assets,
        }

    return {
        "status": "queued",
        "stage": "queued",
        "progress": 0,
        "assets": _empty_assets(),
    }


@router.get("/health")
async def get_health() -> Dict[str, Any]:
    return {"ok": True, "module": "ingest"}
