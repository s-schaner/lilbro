"""VolleySense FastAPI application."""
from __future__ import annotations

import logging
import os
import random
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Callable, Awaitable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from .api import analyze, events, exports, ingest as legacy_ingest, insights, modules, screensnap, stats, trainer
from .config import get_settings
from .routers import annotations, calibration, ingest, logs
from .services import ingest_state
from .services.logbuffer import LogBuffer
from .services.loghandler import LogBufferHandler

logger = logging.getLogger(__name__)

random.seed(42)

settings = get_settings()

DATA_ROOT = Path(os.getenv("DATA_ROOT", "/data")).resolve()
ORIGINAL_DIR = DATA_ROOT / "original"
ORIGINAL_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    ingest_state.load_from_disk()
    logger.info("Ingest state loaded from disk")
    yield


app = FastAPI(title=settings.project_name, lifespan=app_lifespan)

log_buffer = LogBuffer()
log_handler = LogBufferHandler(log_buffer)
log_handler.setLevel(logging.DEBUG)


def _attach(handler: logging.Handler, logger_name: str) -> None:
    logger = logging.getLogger(logger_name)
    if not any(isinstance(existing, LogBufferHandler) for existing in logger.handlers):
        logger.addHandler(handler)


for logger_name in ("", "uvicorn", "uvicorn.error", "uvicorn.access", "uvicorn.asgi", "fastapi"):
    _attach(log_handler, logger_name)

app.state.log_buffer = log_buffer
app.state.log_handler = log_handler

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
app.include_router(logs.router)
app.include_router(ingest.router)
app.include_router(annotations.router)
app.include_router(calibration.router)

if settings.feature_flags.get("exports", True):
    app.include_router(exports.router)
if settings.feature_flags.get("trainer", True):
    app.include_router(trainer.router)
if settings.feature_flags.get("insights", True):
    app.include_router(insights.router)
if settings.feature_flags.get("ingest", True):
    app.include_router(legacy_ingest.router)
if settings.feature_flags.get("screen_snap", True):
    app.include_router(screensnap.router)


@app.get("/")
def root() -> dict:
    return {"message": "VolleySense API ready"}


@app.middleware("http")
async def request_logging_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    request_logger = logging.getLogger("app.requests")
    started = time.perf_counter()
    base_extra = {
        "http": {
            "method": request.method,
            "path": request.url.path,
            "query": request.url.query,
            "client": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        }
    }

    try:
        response = await call_next(request)
    except Exception:  # pylint: disable=broad-except
        elapsed = (time.perf_counter() - started) * 1000
        failure_extra = {
            **base_extra,
            "status_code": 500,
            "latency_ms": round(elapsed, 3),
        }
        request_logger.error("Unhandled exception during request", extra=failure_extra, exc_info=True)
        raise

    elapsed = (time.perf_counter() - started) * 1000
    success_extra = {
        **base_extra,
        "status_code": getattr(response, "status_code", None),
        "latency_ms": round(elapsed, 3),
    }
    request_logger.info("Request completed", extra=success_extra)
    return response
