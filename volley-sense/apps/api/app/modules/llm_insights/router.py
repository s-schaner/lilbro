from __future__ import annotations

from fastapi import APIRouter, Query

from ...models.schemas import InsightPayload

router = APIRouter(prefix="/insights", tags=["llm-insights"])


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@router.get("", response_model=InsightPayload)
async def insights(game_id: str = Query(...)) -> InsightPayload:
    return InsightPayload(
        summary="Team A surged in Set 2 behind #12’s 3 service aces.",
        momentum=[
            "Set 1 opened evenly before Team B's coverage forced longer rallies.",
            "Team A's serve pressure flipped momentum midway through Set 2.",
            "Final set featured alternating runs with #7 anchoring digs."
        ],
        spotlights=[
            "#12 delivered 3 aces and 2 kills during the 7-1 Set 2 swing.",
            "#7’s defense (7 digs) kept rallies alive in the final set."
        ],
        coach_tips=[
            "Tighten rotation communication to prevent the 104s formation violation.",
            "Mix short serves to disrupt Team B's libero lanes."
        ]
    )


ROUTERS = (router,)
