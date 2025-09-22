from fastapi import APIRouter
from pydantic import BaseModel

from ..models.schemas import AnalyzeResponse

router = APIRouter(prefix="/analyze", tags=["analysis"])


class AnalyzeRequest(BaseModel):
    game_id: str


@router.post("", response_model=AnalyzeResponse)
async def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    return AnalyzeResponse(game_id=payload.game_id, status="started")
