from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal, Sequence
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ...models.schemas import (
    Annotation,
    ClipWindow,
    Event,
    EventDefinition,
    EventExample,
    TrainerExplain,
    TrainingJobStatus,
)
from ...services import mock_data

router = APIRouter(prefix="/trainer", tags=["event-trainer"])
explain_router = APIRouter(prefix="/explain", tags=["event-trainer"])

_DEFINITIONS: dict[str, EventDefinition] = {
    definition.id: definition for definition in mock_data.DEFAULT_DEFINITIONS
}
_EXAMPLES: dict[str, EventExample] = {}
_TRAIN_JOBS: dict[str, TrainingJobStatus] = {}


class EventDefinitionPayload(BaseModel):
    id: str
    name: str
    template: Literal["Contact", "Injury Risk", "Formation", "General"]
    threshold: float
    enabled: bool
    createdAt: datetime
    version: str


class ClipPayload(BaseModel):
    startT: float
    endT: float
    fps: float = Field(ge=1.0)
    src: str


class EventExamplePayload(BaseModel):
    id: str | None = None
    name: str
    clip: ClipPayload
    keyFrame: int
    endFrame: int
    annotations: Sequence[Annotation] = ()
    naturalLanguage: str | None = None
    template: Literal["Contact", "Injury Risk", "Formation", "General"]
    team: Literal["home", "away"] | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)


class TrainRequest(BaseModel):
    event_id: str
    example_ids: list[str] | None = None


class PublishRequest(BaseModel):
    event_id: str
    version: str


class VlmRequest(BaseModel):
    focus: str
    hints: list[str] | None = None
    image_b64: str


class VlmResponse(BaseModel):
    stance: str | None
    hand_state: str | None
    court_zone: int | None
    above_tape: bool | None
    contact_type: str | None
    notes: list[str]
    confidence: float


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@router.get("/events", response_model=list[EventDefinition])
async def list_definitions() -> list[EventDefinition]:
    return list(_DEFINITIONS.values())


@router.post("/events", response_model=EventDefinition)
async def upsert_definition(payload: EventDefinitionPayload) -> EventDefinition:
    definition = EventDefinition(**payload.dict())
    _DEFINITIONS[definition.id] = definition
    return definition


@router.post("/examples", response_model=EventExample)
async def create_example(payload: EventExamplePayload) -> EventExample:
    example_id = payload.id or str(uuid4())
    clip = ClipWindow(**payload.clip.dict())
    example = EventExample(
        id=example_id,
        name=payload.name,
        clip=clip,
        keyFrame=payload.keyFrame,
        endFrame=payload.endFrame,
        annotations=list(payload.annotations),
        naturalLanguage=payload.naturalLanguage,
        template=payload.template,
        team=payload.team,
        confidence=payload.confidence,
    )
    _EXAMPLES[example_id] = example
    return example


@router.get("/examples", response_model=list[EventExample])
async def list_examples(type: str | None = Query(default=None, alias="type")) -> list[EventExample]:
    if not type:
        return list(_EXAMPLES.values())
    return [
        example
        for example in _EXAMPLES.values()
        if example.template.lower() == type.lower()
    ]


@router.get("/preview", response_model=list[Event])
async def preview_events(
    eventId: str = Query(..., alias="eventId"),
    game_id: str = Query(...),
) -> list[Event]:
    if eventId not in _DEFINITIONS:
        raise HTTPException(status_code=404, detail="Definition not found")
    return mock_data.generate_preview(eventId, game_id)


@router.post("/train", response_model=TrainingJobStatus)
async def train(payload: TrainRequest) -> TrainingJobStatus:
    if payload.event_id not in _DEFINITIONS:
        raise HTTPException(status_code=404, detail="Definition not found")
    job_id = str(uuid4())
    job = TrainingJobStatus(
        job_id=job_id,
        event_id=payload.event_id,
        status="running",
        started_at=datetime.utcnow(),
        metrics=None,
        message="Hybrid trainer warming up with structured features and VLM hints.",
    )
    _TRAIN_JOBS[job_id] = job
    return job


@router.get("/status/{job_id}", response_model=TrainingJobStatus)
async def job_status(job_id: str) -> TrainingJobStatus:
    if job_id not in _TRAIN_JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    job = _TRAIN_JOBS[job_id]
    if job.status != "completed" and datetime.utcnow() - job.started_at > timedelta(seconds=2):
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.metrics = {"f1": 0.78, "precision": 0.81, "recall": 0.75}
        job.message = "Model distilled. Rules + classifier primed for deployment."
    return job


@router.post("/vlm/label", response_model=VlmResponse)
async def vlm_label(payload: VlmRequest) -> VlmResponse:
    notes = [
        "Hands slightly late sealing the antenna",
        "Consider earlier shuffle to close the gap",
    ]
    return VlmResponse(
        stance="jump",
        hand_state="block",
        court_zone=4,
        above_tape=True,
        contact_type=None,
        notes=notes,
        confidence=0.72,
    )


@router.post("/publish", response_model=dict[str, str])
async def publish(payload: PublishRequest) -> dict[str, str]:
    if payload.event_id not in _DEFINITIONS:
        raise HTTPException(status_code=404, detail="Definition not found")
    return {"event_id": payload.event_id, "version": payload.version, "status": "published"}


@router.get("/explain", response_model=TrainerExplain)
async def explain_via_trainer(event_id: str = Query(..., alias="event_id")) -> TrainerExplain:
    return mock_data.explain_event(event_id)


@explain_router.get("", response_model=TrainerExplain)
async def explain(event_id: str = Query(..., alias="event_id")) -> TrainerExplain:
    return mock_data.explain_event(event_id)


ROUTERS = (router, explain_router)
