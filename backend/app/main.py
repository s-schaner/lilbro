"""VolleySense FastAPI application."""
from __future__ import annotations

import os
import random
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import analyze, events, exports, ingest as legacy_ingest, insights, modules, screensnap, stats, trainer
from .config import get_settings
from .routers import ingest as ingest_router

random.seed(42)

settings = get_settings()

DATA_ROOT = Path(os.getenv("DATA_ROOT", "/data")).resolve()
ORIGINAL_DIR = DATA_ROOT / "original"
ORIGINAL_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title=settings.project_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/assets", StaticFiles(directory=DATA_ROOT), name="assets")

app.include_router(modules.router)
app.include_router(events.router)
app.include_router(stats.router)
app.include_router(analyze.router)

if settings.feature_flags.get("exports", True):
    app.include_router(exports.router)
if settings.feature_flags.get("trainer", True):
    app.include_router(trainer.router)
if settings.feature_flags.get("insights", True):
    app.include_router(insights.router)
if settings.feature_flags.get("ingest", True):
    app.include_router(legacy_ingest.router)
    app.include_router(ingest_router.router)
if settings.feature_flags.get("screen_snap", True):
    app.include_router(screensnap.router)


@app.get("/")
def root() -> dict:
    return {"message": "VolleySense API ready"}
