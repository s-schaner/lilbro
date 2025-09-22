from fastapi import APIRouter, Query

from ..models.schemas import Event
from ..services.mock_data import generate_events

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[Event])
async def list_events(game_id: str = Query(..., description="Unique game identifier")) -> list[Event]:
    return generate_events(game_id)


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}
