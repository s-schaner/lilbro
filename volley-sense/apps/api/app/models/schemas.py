from datetime import datetime
from typing import Any, Literal, Optional, Union

from pydantic import BaseModel


class Rect(BaseModel):
    x: float
    y: float
    w: float
    h: float


class Poly(BaseModel):
    pts: list[tuple[float, float]]


class Keypoint(BaseModel):
    x: float
    y: float
    label: str | None = None


class StanceTag(BaseModel):
    kind: Literal["stance"]
    value: Literal["neutral", "split", "approach", "jump"]


class HandTag(BaseModel):
    kind: Literal["hand"]
    side: Literal["L", "R"]
    state: Literal["platform", "open", "closed"]
    aboveTape: bool | None = None


class GazeTag(BaseModel):
    kind: Literal["gaze"]
    vec: tuple[float, float]


class CourtZoneTag(BaseModel):
    kind: Literal["courtZone"]
    zone: Literal[1, 2, 3, 4, 5, 6]
    row: Literal["front", "back"]


class ContactTag(BaseModel):
    kind: Literal["contact"]
    value: Literal["serve", "reception", "set", "attack", "block", "dig", "tip"]


class CollisionTag(BaseModel):
    kind: Literal["collision"]
    severity: Literal["low", "med", "high"] | None = None


class BallTag(BaseModel):
    kind: Literal["ball"]
    prox: Literal["near", "far"]
    side: Literal["ours", "theirs"]
    aboveTape: bool | None = None


Tag = Union[StanceTag, HandTag, GazeTag, CourtZoneTag, ContactTag, CollisionTag, BallTag]


class Annotation(BaseModel):
    id: str
    frame: int
    region: Union[Rect, Poly]
    keypoints: list[Keypoint] | None = None
    tags: list[Tag] = []
    trackRef: str | None = None
    jersey: int | None = None


class ClipWindow(BaseModel):
    startT: float
    endT: float
    fps: float
    src: str


class EventExample(BaseModel):
    id: str
    name: str
    clip: ClipWindow
    keyFrame: int
    endFrame: int
    annotations: list[Annotation]
    naturalLanguage: str | None = None
    template: Literal["Contact", "Injury Risk", "Formation", "General"]
    team: Literal["home", "away"] | None = None
    confidence: float | None = None


class TrainingJobStatus(BaseModel):
    job_id: str
    event_id: str
    status: Literal["queued", "running", "completed"]
    started_at: datetime
    completed_at: datetime | None = None
    metrics: dict[str, float] | None = None
    message: str | None = None


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
