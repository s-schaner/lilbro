"""Event retrieval routes."""
from __future__ import annotations

from fastapi import APIRouter

from ..data import FORMATION_SNAPSHOT, SEED_EVENTS, SEED_PLAYERS

router = APIRouter()


@router.get("/events")
def get_events() -> dict:
    return {"players": SEED_PLAYERS, "events": SEED_EVENTS}


@router.get("/events/formation")
def get_current_formation() -> dict:
    return {"formation": FORMATION_SNAPSHOT}
