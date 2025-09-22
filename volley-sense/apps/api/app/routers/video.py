from __future__ import annotations

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from ..models.schemas import AnalyzeResponse, IngestResponse

SUPPORTED_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi"}

router = APIRouter(prefix="/video", tags=["video"])


class AnalyzeRequest(BaseModel):
    game_id: str


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@router.post("/ingest", response_model=IngestResponse)
async def ingest_video(file: UploadFile = File(...)) -> IngestResponse:
    filename = file.filename or "upload.mp4"
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported format")
    stem = Path(filename).stem.replace(" ", "-")
    return IngestResponse(
        filename=filename,
        mezzanine=f"/transcode/{stem}-1080p30.mp4",
        proxy=f"/transcode/{stem}-720p30.mp4",
        thumbnails=[f"/thumbnails/{stem}-{index}.jpg" for index in range(1, 4)],
        status="queued",
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_video(payload: AnalyzeRequest) -> AnalyzeResponse:
    return AnalyzeResponse(game_id=payload.game_id, status="started")
