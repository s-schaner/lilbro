"""In-memory ring buffer used for capturing recent application logs."""
from __future__ import annotations

import asyncio
import threading
from collections import deque
from dataclasses import dataclass
from itertools import count
from typing import Any, Callable, Deque, Dict, Iterable, List, MutableMapping, Optional


LogEntry = MutableMapping[str, Any]


def _sanitize_entry(entry: MutableMapping[str, Any]) -> Dict[str, Any]:
    """Return a shallow copy of *entry* suitable for storage."""

    if not isinstance(entry, MutableMapping):
        raise TypeError("log entries must be mutable mappings")

    required_keys = {"ts", "level", "source", "msg", "meta"}
    missing = required_keys.difference(entry.keys())
    if missing:
        raise KeyError(f"log entry missing required keys: {sorted(missing)}")

    sanitized: Dict[str, Any] = {}
    for key in required_keys:
        sanitized[key] = entry[key]
    return sanitized


@dataclass
class _Subscriber:
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue
    predicate: Optional[Callable[[Dict[str, Any]], bool]] = None


class LogBuffer:
    """Deque backed log buffer retaining the most recent log entries."""

    def __init__(self, max_entries: int = 2000) -> None:
        self._buffer: Deque[Dict[str, Any]] = deque(maxlen=max_entries)
        self._lock = threading.RLock()
        self._subscribers: Dict[int, _Subscriber] = {}
        self._ids = count()
        self.max_entries = max_entries

    # ------------------------------------------------------------------
    # basic operations
    def append(self, entry: LogEntry) -> None:
        """Store *entry* in the buffer and notify subscribers."""

        sanitized = _sanitize_entry(entry)

        with self._lock:
            self._buffer.append(sanitized)
            subscribers: List[_Subscriber] = list(self._subscribers.values())

        for subscriber in subscribers:
            if subscriber.predicate and not subscriber.predicate(sanitized):
                continue

            try:
                subscriber.loop.call_soon_threadsafe(self._enqueue, subscriber.queue, sanitized)
            except RuntimeError:
                # Event loop has likely been closed; clean up the subscriber.
                self.unregister(subscriber.queue)

    def tail(
        self,
        limit: Optional[int] = 100,
        *,
        filters: Optional[Dict[str, Any]] = None,
        predicate: Optional[Callable[[Dict[str, Any]], bool]] = None,
    ) -> List[Dict[str, Any]]:
        """Return the most recent log entries matching optional criteria."""

        with self._lock:
            snapshot = list(self._buffer)

        def matches(entry: Dict[str, Any]) -> bool:
            if filters:
                for key, expected in filters.items():
                    if expected is None:
                        continue
                    value = entry.get(key)
                    if isinstance(expected, Iterable) and not isinstance(expected, (str, bytes)):
                        if value not in expected:
                            return False
                    else:
                        if value != expected:
                            return False
            if predicate and not predicate(entry):
                return False
            return True

        selected = [item for item in snapshot if matches(item)]
        if limit is not None:
            return selected[-limit:]
        return selected

    # ------------------------------------------------------------------
    # subscriber management
    def register_subscriber(
        self,
        *,
        loop: Optional[asyncio.AbstractEventLoop] = None,
        max_queue: int = 256,
        predicate: Optional[Callable[[Dict[str, Any]], bool]] = None,
    ) -> asyncio.Queue:
        """Register a subscriber that will receive new log entries."""

        if loop is None:
            loop = asyncio.get_event_loop()

        queue: asyncio.Queue = asyncio.Queue(maxsize=max_queue)
        subscriber = _Subscriber(loop=loop, queue=queue, predicate=predicate)
        key = next(self._ids)

        with self._lock:
            self._subscribers[key] = subscriber

        # Attach the key to the queue for easy removal later.
        setattr(queue, "_logbuffer_key", key)
        return queue

    def unregister(self, queue: asyncio.Queue) -> None:
        key = getattr(queue, "_logbuffer_key", None)
        if key is None:
            return
        with self._lock:
            self._subscribers.pop(key, None)

    # ------------------------------------------------------------------
    # helpers
    @staticmethod
    def _enqueue(queue: asyncio.Queue, entry: Dict[str, Any]) -> None:
        try:
            queue.put_nowait(entry)
        except asyncio.QueueFull:
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            try:
                queue.put_nowait(entry)
            except asyncio.QueueFull:
                # Give up if the queue consumer is too slow.
                pass

