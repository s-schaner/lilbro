from datetime import UTC, datetime
from typing import Optional

from fastapi import APIRouter, Query

from ..models.schemas import Event, EventDefinition
from ..services.mock_data import DEFAULT_DEFINITIONS, generate_preview

router = APIRouter(prefix="/trainer", tags=["trainer"])


definitions_db: list[EventDefinition] = [definition.copy() for definition in DEFAULT_DEFINITIONS]


@router.get("/events", response_model=list[EventDefinition])
async def list_definitions() -> list[EventDefinition]:
    return definitions_db


@router.post("/events", response_model=EventDefinition)
async def save_definition(definition: EventDefinition) -> EventDefinition:
    existing: Optional[EventDefinition] = next(
        (item for item in definitions_db if item.id == definition.id), None
    )
    payload = definition.copy(update={"createdAt": definition.createdAt or datetime.now(UTC)})
    if existing:
        definitions_db[:] = [payload if item.id == definition.id else item for item in definitions_db]
    else:
        definitions_db.append(payload)
    return payload


@router.get("/preview", response_model=list[Event])
async def preview(eventId: str = Query(...), game_id: str = Query("demo-1")) -> list[Event]:
    return generate_preview(eventId, game_id)
