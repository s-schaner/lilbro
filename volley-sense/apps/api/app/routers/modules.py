from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..models.schemas import ModuleStatusPayload
from ..modules.manager import ModuleRegistry

router = APIRouter(prefix="/modules", tags=["modules"])


class TogglePayload(BaseModel):
    enabled: bool


@router.get("", response_model=list[ModuleStatusPayload])
async def list_modules(request: Request) -> list[ModuleStatusPayload]:
    registry: ModuleRegistry = request.app.state.module_registry
    await registry.refresh_health(request.app)
    return list(registry.list_statuses())


@router.post("/{module_id}", response_model=ModuleStatusPayload)
async def toggle_module(module_id: str, payload: TogglePayload, request: Request) -> ModuleStatusPayload:
    registry: ModuleRegistry = request.app.state.module_registry
    return registry.set_enabled(module_id, payload.enabled)
