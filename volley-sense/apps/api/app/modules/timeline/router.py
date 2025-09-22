from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ...models.schemas import Event
from ...services import mock_data

router = APIRouter(prefix="/events", tags=["timeline"])


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@router.get("", response_model=list[Event])
async def list_events(game_id: str = Query(..., description="Game identifier")) -> list[Event]:
    if not game_id:
        raise HTTPException(status_code=400, detail="game_id is required")
    return mock_data.generate_events(game_id)


ROUTERS = (router,)
