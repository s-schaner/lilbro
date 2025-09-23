"""Simple in-memory ingest job state management."""
from __future__ import annotations

import json
import os
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
from threading import Lock
from typing import Any, Dict, Optional


Job = Dict[str, Any]

DATA_ROOT = Path(os.getenv("DATA_ROOT", "/data")).resolve()
META_DIR = DATA_ROOT / "meta"
INDEX_PATH = META_DIR / "ingest_index.json"

ASSET_KEYS = {
    "original_url",
    "mezzanine_url",
    "proxy_url",
    "thumbs_glob",
    "keyframes_csv",
}

_jobs: Dict[str, Job] = {}
_job_meta: Dict[str, Dict[str, Any]] = {}
_lock = Lock()


def _ensure_index_parent() -> None:
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _default_assets(original_url: Optional[str]) -> Dict[str, Optional[str]]:
    return {
        "original_url": original_url,
        "mezzanine_url": None,
        "proxy_url": None,
        "thumbs_glob": None,
        "keyframes_csv": None,
    }


def _normalize_assets(upload_id: str, assets: Optional[Dict[str, Optional[str]]]) -> Dict[str, Optional[str]]:
    meta = _job_meta.get(upload_id, {})
    original_url = (assets or {}).get("original_url") or meta.get("original_url")
    normalized = _default_assets(original_url)
    if assets:
        for key, value in assets.items():
            normalized[key] = value
    for key in ASSET_KEYS:
        normalized.setdefault(key, None)
    return normalized


def _persist_locked() -> None:
    _ensure_index_parent()
    snapshot = {
        "jobs": {upload_id: deepcopy(job) for upload_id, job in _jobs.items()},
        "meta": deepcopy(_job_meta),
    }
    with NamedTemporaryFile("w", delete=False, dir=str(INDEX_PATH.parent), encoding="utf-8") as tmp:
        json.dump(snapshot, tmp, indent=2, sort_keys=True)
        tmp.flush()
        os.fsync(tmp.fileno())
        temp_name = tmp.name
    os.replace(temp_name, INDEX_PATH)


def _clone(job: Job) -> Job:
    return deepcopy(job)


def load_from_disk() -> None:
    """Load job cache from disk, if persisted state is available."""

    with _lock:
        _ensure_index_parent()
        if not INDEX_PATH.exists():
            return
        try:
            with INDEX_PATH.open("r", encoding="utf-8") as stream:
                payload = json.load(stream)
        except (OSError, json.JSONDecodeError):
            return

        jobs_section = payload.get("jobs", {})
        meta_section = payload.get("meta", {})

        _jobs.clear()
        _job_meta.clear()

        if isinstance(meta_section, dict):
            for upload_id, meta in meta_section.items():
                if isinstance(meta, dict):
                    _job_meta[upload_id] = deepcopy(meta)

        if isinstance(jobs_section, dict):
            for upload_id, raw_job in jobs_section.items():
                if not isinstance(raw_job, dict):
                    continue
                job: Job = {
                    "upload_id": upload_id,
                    "status": raw_job.get("status", "queued"),
                    "stage": raw_job.get("stage", "queued"),
                    "progress": raw_job.get("progress", 0),
                    "message": raw_job.get("message"),
                    "assets": _normalize_assets(upload_id, raw_job.get("assets")),
                    "started_at": raw_job.get("started_at"),
                    "updated_at": raw_job.get("updated_at"),
                }
                if job["updated_at"] is None:
                    job["updated_at"] = _now()
                _jobs[upload_id] = job


def all_jobs() -> Dict[str, Job]:
    """Return a snapshot of all jobs."""

    with _lock:
        return {upload_id: _clone(job) for upload_id, job in _jobs.items()}


def create_job(upload_id: str, original_path: str, original_url: str) -> Job:
    """Register a new ingest job in memory."""

    with _lock:
        now = _now()
        job: Job = {
            "upload_id": upload_id,
            "status": "queued",
            "stage": "queued",
            "progress": 0,
            "message": None,
            "assets": _default_assets(original_url),
            "started_at": None,
            "updated_at": now,
        }
        _jobs[upload_id] = job
        _job_meta[upload_id] = {
            "original_path": original_path,
            "original_url": original_url,
        }
        _persist_locked()
        return _clone(job)


def update_job(upload_id: str, **fields: Any) -> Job:
    """Update a stored job and return the updated snapshot."""

    with _lock:
        if upload_id not in _jobs:
            raise KeyError(upload_id)

        job = _jobs[upload_id]
        previous_status = job.get("status")
        previous_stage = job.get("stage")

        assets_update: Optional[Dict[str, Optional[str]]] = fields.pop("assets", None)

        if "message" in fields:
            job["message"] = fields.pop("message")

        for key, value in fields.items():
            job[key] = value

        if assets_update is not None:
            assets = _normalize_assets(upload_id, job.get("assets"))
            for key, value in assets_update.items():
                if key in ASSET_KEYS:
                    assets[key] = value
            job["assets"] = assets
        else:
            job["assets"] = _normalize_assets(upload_id, job.get("assets"))

        now = _now()
        status = job.get("status", previous_status)
        stage = job.get("stage", previous_stage)
        if job.get("started_at") is None and (
            (status and status != "queued") or (stage and stage != "queued")
        ):
            job["started_at"] = now
        job["updated_at"] = now

        _persist_locked()

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
        _persist_locked()


load_from_disk()
