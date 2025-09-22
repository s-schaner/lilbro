from fastapi import APIRouter, Query

from ..models.schemas import PlayerStat, StatsPayload
from ..services.mock_data import generate_players

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsPayload)
async def stats(game_id: str = Query(..., description="Unique game identifier")) -> StatsPayload:
    players = generate_players(game_id)
    return StatsPayload(players=players, team={"name": "VolleySense Demo"})


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}
