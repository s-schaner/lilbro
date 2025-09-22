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


class IngestResponse(BaseModel):
    filename: str
    mezzanine: str
    proxy: str
    thumbnails: list[str]
    status: Literal["queued", "completed"] = "queued"


class InsightPayload(BaseModel):
    game_id: str
    recap: str
    momentum: list[str]
    spotlights: list[str]
    coach_notes: list[str]


class ScreenSnapResult(BaseModel):
    focus: str
    summary: str
    observations: list[str]
    corrections: list[str]
    confidence: float


class OverlayBox(BaseModel):
    jersey: int
    label: str
    x: float
    y: float
    width: float
    height: float
    color: str


class BallTrailPoint(BaseModel):
    x: float
    y: float
    t: float


class OverlayPayload(BaseModel):
    boxes: list[OverlayBox]
    trail: list[BallTrailPoint]


class ModuleStatusPayload(BaseModel):
    id: str
    name: str
    version: str
    optional: bool
    enabled: bool
    status: Literal["healthy", "degraded", "error", "disabled"]
    last_error: Optional[str] = None
    last_checked: Optional[str] = None
    failure_count: int = 0
