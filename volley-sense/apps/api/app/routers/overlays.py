from fastapi import APIRouter, Query

from ..models.schemas import OverlayPayload
from ..services.mock_data import generate_overlay

router = APIRouter(prefix="/overlays", tags=["overlays"])


@router.get("", response_model=OverlayPayload)
async def overlay_snapshot(
    game_id: str = Query(..., description="Unique game identifier"),
    t: float = Query(0.0, description="Timestamp in seconds"),
) -> OverlayPayload:
    return generate_overlay(game_id, t)


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}
