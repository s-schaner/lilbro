"""VolleySense FastAPI application."""
from __future__ import annotations

import random

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import analyze, events, exports, ingest, insights, modules, screensnap, stats, trainer
from .config import get_settings

random.seed(42)

settings = get_settings()

app = FastAPI(title=settings.project_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    app.include_router(ingest.router)
if settings.feature_flags.get("screen_snap", True):
    app.include_router(screensnap.router)


@app.get("/")
def root() -> dict:
    return {"message": "VolleySense API ready"}
