from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .models.schemas import ModuleState
from .modules.loader import ModuleManager

APP_ROOT = Path(__file__).resolve().parent
MODULES_ROOT = APP_ROOT / "modules"
CONFIG_PATH = APP_ROOT.parent / "modules.json"

module_manager = ModuleManager(MODULES_ROOT, CONFIG_PATH)

app = FastAPI(title="VolleySense API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

module_manager.load(app)


class ModuleToggle(BaseModel):
    enabled: bool


@app.on_event("startup")
async def _startup() -> None:
    await module_manager.startup()


@app.on_event("shutdown")
async def _shutdown() -> None:
    await module_manager.shutdown()


@app.get("/")
async def root() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/modules", response_model=list[ModuleState])
async def list_modules() -> list[ModuleState]:
    return module_manager.states()


@app.patch("/modules/{module_id}", response_model=ModuleState)
async def toggle_module(module_id: str, payload: ModuleToggle) -> ModuleState:
    return await module_manager.set_enabled(module_id, payload.enabled)
