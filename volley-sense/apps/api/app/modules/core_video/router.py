from __future__ import annotations

import asyncio
import mimetypes
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from pydantic import BaseModel

from ...models.schemas import AnalyzeResponse

router = APIRouter(prefix="/ingest", tags=["core-video"])

SUPPORTED_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi"}
JOBS: dict[str, "IngestJob"] = {}


class IngestJob(BaseModel):
    job_id: str
    filename: str
    status: Literal["queued", "processing", "complete", "error"]
    mezzanine_url: str | None = None
    proxy_url: str | None = None
    thumbnails: list[str] = []
    history: list[dict[str, str]] = []


class IngestResponse(BaseModel):
    job_id: str
    status: str
    filename: str
    mezzanine_url: str | None
    proxy_url: str | None
    thumbnails: list[str]


async def _simulate_transcode(job_id: str) -> None:
    await asyncio.sleep(0.05)
    job = JOBS[job_id]
    job.status = "processing"
    job.history.append({"step": "transcode", "status": "running"})
    await asyncio.sleep(0.05)
    job.mezzanine_url = f"/media/{job.job_id}/mezzanine-1080p.mp4"
    job.history.append({"step": "transcode", "status": "completed"})
    await asyncio.sleep(0.05)
    job.history.append({"step": "proxy", "status": "running"})
    job.proxy_url = f"/media/{job.job_id}/proxy-720p.mp4"
    await asyncio.sleep(0.05)
    job.history.append({"step": "proxy", "status": "completed"})
    job.history.append({"step": "thumbnails", "status": "running"})
    await asyncio.sleep(0.05)
    job.thumbnails = [
        f"/media/{job.job_id}/thumb-1.jpg",
        f"/media/{job.job_id}/thumb-2.jpg",
        f"/media/{job.job_id}/thumb-3.jpg",
    ]
    job.history.append({"step": "thumbnails", "status": "completed"})
    job.status = "complete"


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@router.post("", response_model=IngestResponse)
async def ingest_video(background: BackgroundTasks, file: UploadFile = File(...)) -> IngestResponse:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported format. Upload mp4, mov, mkv, webm, or avi.")
    guessed_type, _ = mimetypes.guess_type(file.filename)
    if guessed_type and not guessed_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Provided file is not recognised as a video stream.")
    job_id = uuid4().hex
    job = IngestJob(job_id=job_id, filename=file.filename or "upload", status="queued")
    JOBS[job_id] = job
    background.add_task(_simulate_transcode, job_id)
    return IngestResponse(
        job_id=job.job_id,
        status=job.status,
        filename=job.filename,
        mezzanine_url=job.mezzanine_url,
        proxy_url=job.proxy_url,
        thumbnails=job.thumbnails,
    )


@router.get("/{job_id}", response_model=IngestResponse)
async def get_job(job_id: str) -> IngestResponse:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return IngestResponse(
        job_id=job.job_id,
        status=job.status,
        filename=job.filename,
        mezzanine_url=job.mezzanine_url,
        proxy_url=job.proxy_url,
        thumbnails=job.thumbnails,
    )


analysis_router = APIRouter(prefix="/analyze", tags=["analysis"])


class AnalyzeRequest(BaseModel):
    game_id: str


@analysis_router.post("", response_model=AnalyzeResponse)
async def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    return AnalyzeResponse(game_id=payload.game_id, status="started")

ROUTERS = (router, analysis_router)
