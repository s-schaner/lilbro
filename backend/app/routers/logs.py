"""Endpoints for exposing recent application logs."""
from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncGenerator, Callable, Dict, Iterable, Optional

from fastapi import APIRouter, HTTPException, Query, Request

from ..services.logbuffer import LogBuffer
from fastapi.responses import JSONResponse, StreamingResponse


router = APIRouter(prefix="/logs", tags=["logs"])

KEEPALIVE_SECONDS = 15.0
DEFAULT_LIMIT = 200


def _get_buffer(request: Request) -> LogBuffer:
    log_buffer = getattr(request.app.state, "log_buffer", None)
    if log_buffer is None:
        raise HTTPException(status_code=503, detail="Log buffer not available")
    return log_buffer


def _build_predicate(
    level: Optional[str], source: Optional[str], search: Optional[str]
) -> Callable[[Dict[str, Any]], bool]:
    normalized_level = level.upper() if level else None
    needle = search.lower() if search else None

    def predicate(entry: Dict[str, Any]) -> bool:
        if normalized_level and entry.get("level") != normalized_level:
            return False
        if source and entry.get("source") != source:
            return False
        if needle:
            message = str(entry.get("msg", "")).lower()
            if needle not in message:
                meta = entry.get("meta") or {}
                extra = meta.get("extra") if isinstance(meta, dict) else None
                haystacks: Iterable[str] = []
                if isinstance(extra, dict):
                    haystacks = [json.dumps(extra).lower()]
                if all(needle not in hay for hay in haystacks):
                    return False
        return True

    return predicate


@router.get("", response_class=JSONResponse)
def read_logs(
    request: Request,
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=2000),
    level: Optional[str] = Query(None, description="Filter by log level"),
    source: Optional[str] = Query(None, description="Filter by logger name"),
    search: Optional[str] = Query(None, description="Substring match for messages"),
):
    log_buffer = _get_buffer(request)
    predicate = _build_predicate(level, source, search)
    entries = log_buffer.tail(limit=limit, filters={"level": level.upper() if level else None, "source": source}, predicate=predicate)
    return {"logs": entries, "count": len(entries)}


def _format_sse(data: Dict[str, Any]) -> str:
    return f"data: {json.dumps(data)}\n\n"


@router.get("/stream")
async def stream_logs(
    request: Request,
    level: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    log_buffer = _get_buffer(request)
    predicate = _build_predicate(level, source, search)

    loop = asyncio.get_event_loop()
    queue = log_buffer.register_subscriber(loop=loop, predicate=predicate)

    async def event_source() -> AsyncGenerator[str, None]:
        try:
            backlog = log_buffer.tail(limit=DEFAULT_LIMIT, filters={"level": level.upper() if level else None, "source": source}, predicate=predicate)
            for item in backlog:
                yield _format_sse(item)

            while True:
                try:
                    entry = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SECONDS)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    if await request.is_disconnected():
                        break
                    continue

                yield _format_sse(entry)
                if await request.is_disconnected():
                    break
        finally:
            log_buffer.unregister(queue)

    return StreamingResponse(event_source(), media_type="text/event-stream")


@router.get("/download")
async def download_logs(
    request: Request,
    limit: Optional[int] = Query(None, ge=1, le=2000),
    level: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    log_buffer = _get_buffer(request)
    predicate = _build_predicate(level, source, search)
    entries = log_buffer.tail(limit=limit, filters={"level": level.upper() if level else None, "source": source}, predicate=predicate)

    async def body() -> AsyncGenerator[bytes, None]:
        for entry in entries:
            yield json.dumps(entry).encode("utf-8") + b"\n"

    headers = {"Content-Disposition": "attachment; filename=\"logs.jsonl\""}
    return StreamingResponse(body(), media_type="application/x-ndjson", headers=headers)
