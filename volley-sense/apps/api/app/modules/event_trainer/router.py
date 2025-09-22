from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ...models.schemas import Event, EventDefinition, TrainerExplain
from ...services import mock_data

router = APIRouter(prefix="/trainer", tags=["event-trainer"])
explain_router = APIRouter(prefix="/explain", tags=["event-trainer"])

_DEFINITIONS: dict[str, EventDefinition] = {definition.id: definition for definition in mock_data.DEFAULT_DEFINITIONS}


class EventDefinitionPayload(BaseModel):
    id: str
    name: str
    template: Literal["Contact", "Injury Risk", "Formation", "General"]
    threshold: float
    enabled: bool
    createdAt: datetime
    version: str


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


@router.get("/preview", response_model=list[Event])
async def preview_events(eventId: str = Query(..., alias="eventId"), game_id: str = Query(...)) -> list[Event]:
    if eventId not in _DEFINITIONS:
        raise HTTPException(status_code=404, detail="Definition not found")
    return mock_data.generate_preview(eventId, game_id)


@explain_router.get("", response_model=TrainerExplain)
async def explain(event_id: str = Query(..., alias="event_id")) -> TrainerExplain:
    return mock_data.explain_event(event_id)


ROUTERS = (router, explain_router)
