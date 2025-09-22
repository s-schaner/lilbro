from __future__ import annotations

from fastapi import APIRouter, Query

from ...models.schemas import StatsPayload
from ...services import mock_data

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@router.get("", response_model=StatsPayload)
async def get_stats(game_id: str = Query(..., description="Game identifier")) -> StatsPayload:
    players = mock_data.generate_players(game_id)
    return StatsPayload(players=players, team={"id": game_id, "name": "Team A"})


ROUTERS = (router,)
