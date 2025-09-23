"""Simple in-memory ingest job state management."""
from __future__ import annotations

from copy import deepcopy
from threading import Lock
from typing import Any, Dict, Optional


Job = Dict[str, Any]

_jobs: Dict[str, Job] = {}
_job_meta: Dict[str, Dict[str, Any]] = {}
_lock = Lock()


def _default_assets(original_url: str) -> Dict[str, Optional[str]]:
    return {
        "original_url": original_url,
        "mezzanine_url": None,
        "proxy_url": None,
        "thumbs_glob": None,
        "keyframes_csv": None,
    }


def _clone(job: Job) -> Job:
    cloned = deepcopy(job)
    if cloned.get("message") is None:
        cloned.pop("message", None)
    return cloned


def create_job(upload_id: str, original_path: str, original_url: str) -> Job:
    """Register a new ingest job in memory."""

    with _lock:
        job: Job = {
            "status": "queued",
            "stage": "queued",
            "progress": 0,
            "assets": _default_assets(original_url),
        }
        _jobs[upload_id] = job
        _job_meta[upload_id] = {
            "original_path": original_path,
            "original_url": original_url,
        }
        return _clone(job)


def update_job(upload_id: str, **fields: Any) -> Job:
    """Update a stored job and return the updated snapshot."""

    with _lock:
        if upload_id not in _jobs:
            raise KeyError(upload_id)

        job = _jobs[upload_id]

        assets_update: Optional[Dict[str, Optional[str]]] = fields.pop("assets", None)

        if "message" in fields:
            message = fields.pop("message")
            if message is None:
                job.pop("message", None)
            else:
                job["message"] = message

        for key, value in fields.items():
            job[key] = value

        if assets_update is not None:
            assets = job.setdefault("assets", {})
            for key, value in assets_update.items():
                assets[key] = value

        return _clone(job)


def get_job(upload_id: str) -> Optional[Job]:
    """Return a copy of a stored job, if it exists."""

    with _lock:
        job = _jobs.get(upload_id)
        if not job:
            return None
        return _clone(job)


def get_job_meta(upload_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        meta = _job_meta.get(upload_id)
        if not meta:
            return None
        return deepcopy(meta)


def reset_state() -> None:
    """Clear stored jobs. Intended for tests."""

    with _lock:
        _jobs.clear()
        _job_meta.clear()
