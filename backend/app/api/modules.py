"""Module registry and health checks."""
from __future__ import annotations

from fastapi import APIRouter

from ..config import get_settings

router = APIRouter()


MODULE_STATUS = {
    "analysis": "healthy",
    "events": "healthy",
    "trainer": "degraded",
    "insights": "healthy",
    "screen_snap": "healthy",
    "ingest": "healthy",
    "exports": "healthy",
}


@router.get("/modules/health")
def get_module_health() -> dict:
    settings = get_settings()
    modules = [
        {"name": name, "status": MODULE_STATUS.get(name, "unknown"), "enabled": settings.feature_flags.get(name, True)}
        for name in MODULE_STATUS
    ]
    return {"modules": modules}


@router.get("/health")
def service_health() -> dict:
    return {"status": "ok"}
