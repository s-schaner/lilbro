from __future__ import annotations

import asyncio
import importlib
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.routing import APIRouter
from pydantic import BaseModel, Field

from ..models.schemas import ModuleState

LOGGER = logging.getLogger(__name__)


class FrontendMount(BaseModel):
    mount: str | None = None
    routes: list[str] = Field(default_factory=list)


class BackendMount(BaseModel):
    router: str
    env: list[str] = Field(default_factory=list)


class HealthSpec(BaseModel):
    endpoint: str
    interval_sec: int = 30


class ModuleManifest(BaseModel):
    id: str
    name: str
    version: str
    frontend: FrontendMount | None = None
    backend: BackendMount | None = None
    permissions: list[str] = Field(default_factory=list)
    health: HealthSpec | None = None
    optional: bool = True
    enabled_by_default: bool = True


@dataclass
class LoadedModule:
    manifest: ModuleManifest
    included: bool = False


class ModuleManager:
    def __init__(self, modules_root: Path, config_path: Path) -> None:
        self._modules_root = modules_root
        self._config_path = config_path
        self._config: dict[str, dict[str, bool]] = self._read_config()
        self._manifests: dict[str, LoadedModule] = {}
        self._states: dict[str, ModuleState] = {}
        self._app: FastAPI | None = None
        self._lock = asyncio.Lock()
        self._health_tasks: dict[str, asyncio.Task[None]] = {}
        self._stop_event = asyncio.Event()

    def _read_config(self) -> dict[str, dict[str, bool]]:
        if self._config_path.exists():
            try:
                with self._config_path.open("r", encoding="utf-8") as handle:
                    return json.load(handle)
            except json.JSONDecodeError:
                LOGGER.warning("modules.json malformed, starting with empty config")
        return {}

    def _write_config(self) -> None:
        self._config_path.parent.mkdir(parents=True, exist_ok=True)
        with self._config_path.open("w", encoding="utf-8") as handle:
            json.dump(self._config, handle, indent=2, sort_keys=True)

    def load(self, app: FastAPI) -> None:
        self._app = app
        manifest_paths = sorted(self._modules_root.glob("**/module.manifest.json"))
        for manifest_path in manifest_paths:
            manifest = ModuleManifest.parse_raw(manifest_path.read_text(encoding="utf-8"))
            if manifest.id in self._manifests:
                LOGGER.warning("Duplicate module id %s ignored", manifest.id)
                continue
            self._manifests[manifest.id] = LoadedModule(manifest=manifest)
            config_enabled = self._config.get(manifest.id, {}).get("enabled")
            env_override = self._env_override(manifest.id)
            if env_override is not None:
                enabled = env_override
            elif config_enabled is not None:
                enabled = config_enabled
            else:
                enabled = manifest.enabled_by_default
            status = "healthy" if enabled else "disabled"
            self._states[manifest.id] = ModuleState(
                id=manifest.id,
                name=manifest.name,
                version=manifest.version,
                optional=manifest.optional,
                status=status,
                enabled=enabled,
                last_error=None,
            )
            if enabled:
                try:
                    self._mount_module(manifest)
                    self._states[manifest.id].status = "healthy"
                except Exception as exc:  # pragma: no cover - defensive
                    LOGGER.exception("Failed to mount module %s", manifest.id)
                    self._states[manifest.id].status = "error"
                    self._states[manifest.id].last_error = str(exc)

    def _env_override(self, module_id: str) -> bool | None:
        env_key = f"MODULES_{module_id.replace('-', '_').upper()}"
        value = os.getenv(env_key)
        if value is None:
            return None
        if value.lower() in {"1", "true", "yes", "on"}:
            return True
        if value.lower() in {"0", "false", "no", "off"}:
            return False
        LOGGER.warning("Ignoring invalid value for %s: %s", env_key, value)
        return None

    def _mount_module(self, manifest: ModuleManifest) -> None:
        if not self._app:
            raise RuntimeError("Module manager not initialised")
        backend = manifest.backend
        if not backend:
            return
        routers = self._load_routers(backend.router)
        dependencies = [Depends(self.guard(manifest.id))]
        for router in routers:
            self._app.include_router(router, dependencies=dependencies)
        self._manifests[manifest.id].included = True

    def _load_routers(self, router_path: str) -> Sequence[APIRouter]:
        path = Path(router_path)
        module_name = ".".join(path.with_suffix("").parts)
        module = importlib.import_module(module_name)
        routers = getattr(module, "ROUTERS", None)
        if routers is None:
            router = getattr(module, "router")
            routers = (router,)
        return tuple(routers)

    async def startup(self) -> None:
        if not self._app:
            return
        self._stop_event.clear()
        for module_id, loaded in self._manifests.items():
            manifest = loaded.manifest
            state = self._states[module_id]
            if not state.enabled or not manifest.health:
                continue
            task = asyncio.create_task(self._monitor_health(manifest))
            self._health_tasks[module_id] = task

    async def shutdown(self) -> None:
        self._stop_event.set()
        for task in self._health_tasks.values():
            task.cancel()
        self._health_tasks.clear()

    async def _monitor_health(self, manifest: ModuleManifest) -> None:
        assert self._app is not None
        failures = 0
        interval = max(5, manifest.health.interval_sec if manifest.health else 30)
        while True:
            try:
                async with httpx.AsyncClient(app=self._app, base_url="http://module.local") as client:
                    response = await client.get(manifest.health.endpoint, timeout=5.0)
                if response.status_code == 200:
                    failures = 0
                    await self._update_state(manifest.id, status="healthy", error=None)
                else:
                    raise RuntimeError(f"Health returned {response.status_code}")
            except asyncio.CancelledError:  # pragma: no cover - cancellation path
                raise
            except Exception as exc:  # pragma: no cover - network failure
                failures += 1
                if failures >= 3:
                    await self._update_state(manifest.id, status="degraded", error=str(exc))
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=interval)
                break
            except asyncio.TimeoutError:
                continue

    async def _update_state(self, module_id: str, *, status: str, error: str | None) -> None:
        async with self._lock:
            state = self._states.get(module_id)
            if not state:
                return
            if status == "healthy" and not state.enabled:
                return
            state.status = status if state.enabled else "disabled"
            state.last_error = error

    def guard(self, module_id: str):
        async def _guard() -> None:
            state = self._states[module_id]
            if not state.enabled or state.status == "disabled":
                raise HTTPException(status_code=503, detail="Module disabled")
            if state.status == "error":
                raise HTTPException(status_code=503, detail="Module errored")
        return _guard

    async def set_enabled(self, module_id: str, enabled: bool) -> ModuleState:
        if module_id not in self._manifests:
            raise HTTPException(status_code=404, detail="Unknown module")
        async with self._lock:
            state = self._states[module_id]
            state.enabled = enabled
            state.status = "healthy" if enabled else "disabled"
            state.last_error = None if enabled else state.last_error
            self._config[module_id] = {"enabled": enabled}
            self._write_config()
            manifest = self._manifests[module_id].manifest
            if enabled and not self._manifests[module_id].included:
                self._mount_module(manifest)
            if not enabled and module_id in self._health_tasks:
                self._health_tasks[module_id].cancel()
                self._health_tasks.pop(module_id, None)
        if enabled and module_id not in self._health_tasks:
            manifest = self._manifests[module_id].manifest
            if manifest.health:
                self._health_tasks[module_id] = asyncio.create_task(self._monitor_health(manifest))
        return self._states[module_id]

    def states(self) -> list[ModuleState]:
        return list(self._states.values())


__all__ = ["ModuleManager", "ModuleManifest"]
