from fastapi import APIRouter, Query

from ..models.schemas import InsightPayload
from ..services.mock_data import generate_insights

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("", response_model=InsightPayload)
async def insights(game_id: str = Query(..., description="Unique game identifier")) -> InsightPayload:
    return generate_insights(game_id)


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}
