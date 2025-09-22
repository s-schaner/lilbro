from __future__ import annotations

from fastapi import APIRouter

from ...models.schemas import ScreenSnapRequest, ScreenSnapResponse

router = APIRouter(prefix="/screensnap", tags=["screensnap"])


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@router.post("", response_model=ScreenSnapResponse)
async def analyze_snap(payload: ScreenSnapRequest) -> ScreenSnapResponse:
    focus = payload.focus.lower()
    summary = "#14’s hands are late closing at the antenna; suggests blocking drill."
    observations = [
        "Right foot staggered behind line",
        "Hands below tape at contact"
    ]
    corrections = [
        "Start shuffle earlier to seal line",
        "Hands over tape with thumbs pressed"
    ]
    if "serve" in focus:
        summary = "Toss height drifts behind head; balance tips backward."
        observations = ["Ball release starts from chest height", "Plant foot opens early"]
        corrections = ["Extend toss arm fully to stabilize toss", "Keep hips square through contact"]
    return ScreenSnapResponse(
        summary=summary,
        observations=observations,
        corrections=corrections,
        confidence=0.73
    )


ROUTERS = (router,)
