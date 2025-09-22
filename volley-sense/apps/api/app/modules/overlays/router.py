from __future__ import annotations

from fastapi import APIRouter, Query

from ...models.schemas import OverlayPayload, OverlayBox, OverlayPoint
from ...services import mock_data

router = APIRouter(prefix="/overlays", tags=["overlays"])


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@router.get("", response_model=OverlayPayload)
async def overlays(game_id: str = Query(...), ts: float = Query(0.0)) -> OverlayPayload:
    rng = mock_data.seeded_random(f"{game_id}-{int(ts)}")
    players = [
        OverlayBox(
            jersey=player.jersey,
            label=player.name,
            x=0.1 + idx * 0.25 + rng.random() * 0.05,
            y=0.2 + (idx % 2) * 0.3 + rng.random() * 0.05,
            width=0.12,
            height=0.18,
        )
        for idx, player in enumerate(mock_data.SEED_PLAYERS[:4])
    ]
    ball = OverlayPoint(x=0.48 + rng.random() * 0.04, y=0.32 + rng.random() * 0.04)
    trail = [
        OverlayPoint(x=ball.x - i * 0.015, y=ball.y - i * 0.01) for i in range(1, 5)
    ]
    return OverlayPayload(frame=ts, players=players, ball=ball, trail=trail)


ROUTERS = (router,)
