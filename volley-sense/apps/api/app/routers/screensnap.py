from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..models.schemas import ScreenSnapResult
from ..services.mock_data import analyze_screenshot

router = APIRouter(prefix="/screensnap", tags=["screensnap"])


class SnapPayload(BaseModel):
    focus: str
    context: Optional[dict[str, Any]] = None
    system_prompt: Optional[str] = None
    image_b64: str


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@router.post("", response_model=ScreenSnapResult)
async def analyze_snap(payload: SnapPayload) -> ScreenSnapResult:
    return analyze_screenshot(payload.focus, payload.context, payload.system_prompt)
