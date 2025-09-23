"""Logging handler that feeds structured records into :mod:`logbuffer`."""
from __future__ import annotations

import datetime as _dt
import json
import logging
from typing import Any, Dict

from .logbuffer import LogBuffer


_RESERVED_ATTRS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "message",
    "asctime",
    "stacklevel",
    "taskName",
    "sinfo",
}


def _safe_json(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {str(k): _safe_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_safe_json(v) for v in value]
    try:
        json.dumps(value)
    except TypeError:
        return repr(value)
    return value


class LogBufferHandler(logging.Handler):
    """Handler that normalizes log records into a :class:`LogBuffer`."""

    def __init__(self, buffer: LogBuffer) -> None:
        super().__init__()
        self._buffer = buffer

    # ------------------------------------------------------------------
    def emit(self, record: logging.LogRecord) -> None:  # pragma: no cover - thin wrapper
        try:
            entry = self._format_entry(record)
            self._buffer.append(entry)
        except Exception:  # pylint: disable=broad-except
            self.handleError(record)

    # ------------------------------------------------------------------
    def _format_entry(self, record: logging.LogRecord) -> Dict[str, Any]:
        timestamp = _dt.datetime.fromtimestamp(record.created, tz=_dt.timezone.utc).isoformat()
        message = record.getMessage()

        meta: Dict[str, Any] = {
            "logger": record.name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "process": record.process,
            "thread": record.thread,
        }

        if record.exc_info:
            meta["exc_type"] = getattr(record.exc_info[0], "__name__", str(record.exc_info[0]))
        if record.exc_text:
            meta["exc_text"] = record.exc_text

        extras = {
            key: _safe_json(value)
            for key, value in record.__dict__.items()
            if key not in _RESERVED_ATTRS
        }
        if extras:
            meta["extra"] = extras

        return {
            "ts": timestamp,
            "level": record.levelname,
            "source": record.name,
            "msg": message,
            "meta": meta,
        }

