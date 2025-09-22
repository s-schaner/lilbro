from datetime import datetime
from typing import Any, Literal, Optional

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


class OverlayBox(BaseModel):
    jersey: int
    label: str
    x: float
    y: float
    width: float
    height: float


class OverlayPoint(BaseModel):
    x: float
    y: float


class OverlayPayload(BaseModel):
    frame: float
    players: list[OverlayBox]
    ball: OverlayPoint
    trail: list[OverlayPoint]


class InsightPayload(BaseModel):
    summary: str
    momentum: list[str]
    spotlights: list[str]
    coach_tips: list[str]


class ScreenSnapRequest(BaseModel):
    focus: str
    context: dict[str, Any] | None = None
    image_b64: str


class ScreenSnapResponse(BaseModel):
    summary: str
    observations: list[str]
    corrections: list[str]
    confidence: float


class ModuleState(BaseModel):
    id: str
    name: str
    version: str
    status: Literal["healthy", "degraded", "error", "disabled"]
    enabled: bool
    optional: bool
    last_error: str | None = None
