"""Stats endpoints."""
from __future__ import annotations

from fastapi import APIRouter

from ..data import MATCH_STATS

router = APIRouter()


@router.get("/stats")
def get_stats() -> dict:
    return {"metrics": MATCH_STATS}
