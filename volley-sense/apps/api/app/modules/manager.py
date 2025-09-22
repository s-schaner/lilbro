from __future__ import annotations

import importlib
import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Dict, Iterable, Literal, Optional

import httpx
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

from ..models.schemas import ModuleStatusPayload

ModuleStatusType = Literal["healthy", "degraded", "error", "disabled"]


class ModuleFrontend(BaseModel):
    mount: Optional[str] = None
    routes: list[str] = []


class ModuleBackend(BaseModel):
    router: str
    env: list[str] = []


class ModuleHealth(BaseModel):
    endpoint: str
    interval_sec: int = 30


class ModuleManifest(BaseModel):
    id: str
    name: str
    version: str
    optional: bool = True
    enabled_by_default: bool = True
    frontend: Optional[ModuleFrontend] = None
    backend: Optional[ModuleBackend] = None
    permissions: list[str] = []
    health: Optional[ModuleHealth] = None


@dataclass
class ModuleState:
    manifest: ModuleManifest
    enabled: bool
    status: ModuleStatusType = "healthy"
    last_error: Optional[str] = None
    failure_count: int = 0
    last_checked: Optional[datetime] = None

    def payload(self) -> ModuleStatusPayload:
        return ModuleStatusPayload(
            id=self.manifest.id,
            name=self.manifest.name,
            version=self.manifest.version,
            optional=self.manifest.optional,
            enabled=self.enabled,
            status=self.status,
            last_error=self.last_error,
            last_checked=self.last_checked.isoformat() if self.last_checked else None,
            failure_count=self.failure_count,
        )


class ModuleRegistry:
    def __init__(self) -> None:
        self._manifests: Dict[str, ModuleManifest] = {}
        self._states: Dict[str, ModuleState] = {}
        self._config_path: Optional[Path] = None

    def load(self, app: FastAPI, modules_dir: Path, config_path: Optional[Path] = None) -> None:
        self._config_path = config_path
        config = self._load_config(config_path)
        for manifest_path in sorted(modules_dir.glob("*/module.manifest.json")):
            manifest = ModuleManifest.parse_raw(manifest_path.read_text())
            self._manifests[manifest.id] = manifest
            enabled = self._should_enable(manifest, config)
            state = ModuleState(manifest=manifest, enabled=enabled)
            if not enabled:
                state.status = "disabled"
            self._states[manifest.id] = state
            if not enabled or not manifest.backend:
                continue
            try:
                module = importlib.import_module(manifest.backend.router)
                router = getattr(module, "router")
                dependency = Depends(self.require_enabled(manifest.id))
                app.include_router(router, dependencies=[dependency])
            except Exception as exc:  # pragma: no cover - defensive
                state.status = "error"
                state.enabled = False
                state.last_error = str(exc)

    def _load_config(self, path: Optional[Path]) -> Dict[str, bool]:
        if not path or not path.exists():
            return {}
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError:
            return {}
        if not isinstance(data, dict):
            return {}
        return {str(key): bool(value) for key, value in data.items()}

    def _save_config(self, config: Dict[str, bool]) -> None:
        if not self._config_path:
            return
        self._config_path.parent.mkdir(parents=True, exist_ok=True)
        self._config_path.write_text(json.dumps(config, indent=2, sort_keys=True))

    def _should_enable(self, manifest: ModuleManifest, config: Dict[str, bool]) -> bool:
        env_key = f"MODULES_{manifest.id.upper().replace('-', '_')}"
        env_override = os.getenv(env_key)
        if env_override is not None:
            return env_override.lower() in {"1", "true", "yes", "on"}
        if manifest.optional:
            if manifest.id in config:
                return config[manifest.id]
            return manifest.enabled_by_default
        return True

    def list_statuses(self) -> Iterable[ModuleStatusPayload]:
        return [state.payload() for state in self._states.values()]

    def require_enabled(self, module_id: str):
        def dependency() -> None:
            state = self._states.get(module_id)
            if state is None:
                raise HTTPException(status_code=503, detail=f"Module '{module_id}' unavailable")
            if not state.enabled:
                raise HTTPException(status_code=503, detail=f"Module '{module_id}' disabled")
            if state.status == "error":
                raise HTTPException(
                    status_code=503,
                    detail=f"Module '{module_id}' failed: {state.last_error or 'unknown error'}",
                )
            if state.status == "degraded":
                raise HTTPException(status_code=503, detail=f"Module '{module_id}' degraded - retry later")

        return dependency

    def set_enabled(self, module_id: str, enabled: bool) -> ModuleStatusPayload:
        state = self._states.get(module_id)
        if state is None:
            raise HTTPException(status_code=404, detail="Module not found")
        if not state.manifest.optional and not enabled:
            raise HTTPException(status_code=400, detail="Core modules cannot be disabled")
        state.enabled = enabled
        state.status = "healthy" if enabled else "disabled"
        state.failure_count = 0
        state.last_error = None
        config = self._load_config(self._config_path)
        config[module_id] = enabled
        self._save_config(config)
        return state.payload()

    async def refresh_health(self, app: FastAPI) -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://modules.local") as client:
            for state in self._states.values():
                manifest = state.manifest
                if not state.enabled or not manifest.health or state.status == "error":
                    continue
                try:
                    response = await client.get(manifest.health.endpoint, timeout=5.0)
                    state.last_checked = datetime.now(UTC)
                    if response.status_code == 200 and response.json().get("ok"):
                        state.failure_count = 0
                        if state.status != "healthy":
                            state.status = "healthy"
                        state.last_error = None
                    else:
                        raise RuntimeError(f"status {response.status_code}")
                except Exception as exc:  # pragma: no cover - defensive
                    state.failure_count += 1
                    state.last_error = str(exc)
                    state.last_checked = datetime.now(UTC)
                    if state.failure_count >= 3:
                        state.status = "degraded"


__all__ = ["ModuleRegistry", "ModuleManifest", "ModuleStatusType"]
