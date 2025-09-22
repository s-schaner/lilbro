"""Video ingest pipeline routes."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..services.ingest import job_store

router = APIRouter()

PROGRESS_MAP = {
    "queued": 0.05,
    "analyzing": 0.35,
    "mezzanine": 0.6,
    "trainer-ready": 0.85,
    "completed": 1.0,
}


class IngestRequest(BaseModel):
    source_url: str


@router.post("/ingest")
def start_ingest(payload: IngestRequest) -> dict:
    job = job_store.create_job(payload.source_url)
    state = job["state"]
    return {
        "job_id": job["job_id"],
        "state": state,
        "progress": PROGRESS_MAP[state],
        "states": list(job_store.sequence),
    }


@router.get("/ingest/{job_id}")
def get_ingest_status(job_id: str, advance: bool = Query(True)) -> dict:
    try:
        job = job_store.advance_job(job_id) if advance else job_store.peek_job(job_id)
    except KeyError as exc:  # pragma: no cover - defensive guard
        raise HTTPException(status_code=404, detail="job not found") from exc
    state = job["state"]
    return {
        "job_id": job_id,
        "state": state,
        "progress": PROGRESS_MAP[state],
        "states": list(job_store.sequence),
    }
