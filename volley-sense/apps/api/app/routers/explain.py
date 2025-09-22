from fastapi import APIRouter, Query

from ..models.schemas import TrainerExplain
from ..services.mock_data import explain_event

router = APIRouter(tags=["trainer"])


@router.get("/explain", response_model=TrainerExplain)
async def explain(event_id: str = Query(...)) -> TrainerExplain:
    return explain_event(event_id)
