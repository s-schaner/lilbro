from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class Event(BaseModel):
    t: float
    label: str
    kind: Literal["serve", "kill", "dig", "custom", "error"]
    jersey: Optional[int] = None
    conf: float


class PlayerStat(BaseModel):
    jersey: int
    name: str
    kills: int
    digs: int
    blocks: int
    aces: int


class EventDefinition(BaseModel):
    id: str
    name: str
    template: Literal["Contact", "Injury Risk", "Formation", "General"]
    threshold: float
    enabled: bool
    createdAt: datetime
    version: str


class TrainerExplain(BaseModel):
    rules: list[str]
    features: dict[str, float]


class AnalyzeResponse(BaseModel):
    game_id: str
    status: Literal["started", "queued"]


class StatsPayload(BaseModel):
    players: list[PlayerStat]
    team: dict[str, str]


class PreviewResponse(BaseModel):
    events: list[Event]
