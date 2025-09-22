from __future__ import annotations

import io
import random
import textwrap
import zipfile
from datetime import UTC, datetime
from typing import Iterable

from fastapi.responses import StreamingResponse

from ..models.schemas import Event, EventDefinition, PlayerStat, TrainerExplain


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
