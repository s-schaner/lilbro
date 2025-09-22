from __future__ import annotations

import io
import random
import textwrap
import zipfile
from datetime import UTC, datetime
from typing import Any, Iterable, Optional

from fastapi.responses import StreamingResponse

from ..models.schemas import (
    BallTrailPoint,
    Event,
    EventDefinition,
    InsightPayload,
    OverlayBox,
    OverlayPayload,
    PlayerStat,
    ScreenSnapResult,
    TrainerExplain,
)


SEED_PLAYERS = [
    PlayerStat(jersey=7, name="A. Ramos", kills=4, digs=6, blocks=1, aces=2),
    PlayerStat(jersey=12, name="K. Lin", kills=8, digs=3, blocks=2, aces=1),
    PlayerStat(jersey=14, name="J. Ortiz", kills=5, digs=5, blocks=0, aces=0),
    PlayerStat(jersey=3, name="S. Patel", kills=2, digs=7, blocks=1, aces=0),
]

SEED_EVENTS = [
    Event(t=12, label="Serve Ace", kind="serve", jersey=12, conf=0.93),
    Event(t=37, label="Spike Kill", kind="kill", jersey=14, conf=0.88),
    Event(t=64, label="Collision (flag)", kind="custom", jersey=None, conf=0.76),
    Event(t=89, label="Dig", kind="dig", jersey=7, conf=0.81),
    Event(t=104, label="Illegal Formation", kind="custom", jersey=None, conf=0.9),
]

DEFAULT_DEFINITIONS = [
    EventDefinition(
        id="event-contact",
        name="Collision",
        template="Contact",
        threshold=0.7,
        enabled=True,
        createdAt=datetime.now(UTC),
        version="v1",
    ),
    EventDefinition(
        id="event-injury",
        name="Hard Landing",
        template="Injury Risk",
        threshold=0.65,
        enabled=True,
        createdAt=datetime.now(UTC),
        version="v1",
    ),
]


def seeded_random(game_id: str) -> random.Random:
    seed = sum(ord(char) for char in game_id)
    return random.Random(seed)


def generate_events(game_id: str) -> list[Event]:
    rng = seeded_random(game_id)
    base = [event.copy(update={"t": event.t + rng.random() * 2}) for event in SEED_EVENTS]
    additional = [
        Event(
            t=130 + rng.randint(0, 25),
            label="Service Error",
            kind="error",
            jersey=None,
            conf=round(rng.uniform(0.5, 0.8), 2),
        )
    ]
    return sorted(base + additional, key=lambda item: item.t)


def generate_players(game_id: str) -> list[PlayerStat]:
    rng = seeded_random(game_id)
    players: list[PlayerStat] = []
    for player in SEED_PLAYERS:
        modifier = rng.randint(-1, 2)
        players.append(
            PlayerStat(
                jersey=player.jersey,
                name=player.name,
                kills=max(0, player.kills + modifier),
                digs=max(0, player.digs + modifier),
                blocks=max(0, player.blocks + (modifier // 2)),
                aces=max(0, player.aces + (modifier // 3)),
            )
        )
    return players


def generate_preview(event_id: str, game_id: str) -> list[Event]:
    rng = seeded_random(f"{event_id}-{game_id}")
    base_time = 30
    return [
        Event(
            t=base_time + idx * 18 + rng.random() * 3,
            label=f"Shadow {idx + 1}",
            kind="custom",
            conf=round(rng.uniform(0.65, 0.92), 2),
        )
        for idx in range(3)
    ]


def explain_event(event_id: str) -> TrainerExplain:
    rng = seeded_random(event_id)
    rules = [
        "Player acceleration spike detected",
        "Contact radius exceeded threshold",
        "Ball proximity under 1.5m",
    ]
    features = {
        "p_dist": round(rng.uniform(0.3, 0.7), 2),
        "rel_speed": round(rng.uniform(2.5, 4.5), 2),
        "ball_near": round(rng.uniform(1.0, 2.0), 2),
    }
    return TrainerExplain(rules=rules, features=features)


def build_csv(players: Iterable[PlayerStat]) -> str:
    rows = ["jersey,name,kills,digs,blocks,aces"]
    for player in players:
        rows.append(f"{player.jersey},{player.name},{player.kills},{player.digs},{player.blocks},{player.aces}")
    return "\n".join(rows)


def build_pdf(game_id: str) -> StreamingResponse:
    content = textwrap.dedent(
        f"""
        VolleySense Summary — {game_id}
        ================================

        Totals
        ------
        Kills: 23
        Digs: 21
        Blocks: 6

        Generated for demo purposes only.
        """
    ).strip()
    stream = io.BytesIO(content.encode("utf-8"))
    headers = {"Content-Disposition": "attachment; filename=summary.pdf"}
    return StreamingResponse(stream, media_type="application/pdf", headers=headers)


def build_highlights_zip() -> StreamingResponse:
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, mode="w") as archive:
        archive.writestr("highlight-1.mp4", b"00fakevideo")
        archive.writestr("highlight-2.mp4", b"00fakevideo")
    stream.seek(0)
    headers = {"Content-Disposition": "attachment; filename=highlights.zip"}
    return StreamingResponse(stream, media_type="application/zip", headers=headers)


def generate_insights(game_id: str) -> InsightPayload:
    recap = (
        "Team A surged in Set 2 behind #12’s 3 service aces while Team B fought back late with strong defense."
    )
    momentum = [
        "Team A surged in Set 2 behind #12’s 3 service aces.",
        "#7’s defense (7 digs) kept rallies alive in the final set.",
        "Illegal formation flagged at 104s cost Team B a key point.",
    ]
    spotlights = [
        "#12 Lin owned the service line with a +6 run in the second frame.",
        "#7 Ramos turned defense into transition with quick bump sets.",
    ]
    coach_notes = [
        "Lean into the float serve at Zone 1; it created two passing shanks in a row.",
        "Tighten rotations after timeouts—ensure middle blockers reset to base before whistle.",
    ]
    return InsightPayload(
        game_id=game_id,
        recap=recap,
        momentum=momentum,
        spotlights=spotlights,
        coach_notes=coach_notes,
    )


def analyze_screenshot(
    focus: str, context: Optional[dict[str, Any]] = None, system_prompt: Optional[str] = None
) -> ScreenSnapResult:
    _ = context, system_prompt  # placeholder for future logic
    return ScreenSnapResult(
        focus=focus,
        summary="#14’s hands are late closing at the antenna",
        observations=[
            "Right foot staggered behind the attack line",
            "Hands track below the tape at contact",
        ],
        corrections=[
            "Start shuffle earlier to seal the line",
            "Press thumbs over the tape to remove seams",
        ],
        confidence=0.73,
    )


def generate_overlay(game_id: str, t: float) -> OverlayPayload:
    rng = seeded_random(f"{game_id}-{int(t)}")
    boxes = [
        OverlayBox(
            jersey=player.jersey,
            label=player.name,
            x=round(rng.uniform(0.15, 0.75), 2),
            y=round(rng.uniform(0.15, 0.8), 2),
            width=round(rng.uniform(0.08, 0.12), 2),
            height=round(rng.uniform(0.16, 0.22), 2),
            color="#34d399" if idx % 2 == 0 else "#f97316",
        )
        for idx, player in enumerate(SEED_PLAYERS)
    ]
    trail = [
        BallTrailPoint(x=round(0.1 + 0.1 * idx, 2), y=round(0.15 + 0.07 * idx, 2), t=round(t - idx * 0.2, 2))
        for idx in range(5)
    ]
    return OverlayPayload(boxes=boxes, trail=trail)
