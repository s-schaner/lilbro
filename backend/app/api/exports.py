"""Export endpoints."""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/export")


@router.get("/{artifact_name}")
def export_artifact(artifact_name: str) -> dict:
    return {
        "artifact": artifact_name,
        "status": "ready",
        "download_url": f"https://example.com/exports/{artifact_name}.zip",
    }
