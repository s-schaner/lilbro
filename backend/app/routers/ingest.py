"""Ingest routes for handling direct video uploads."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".mts", ".m2ts"}
DATA_ROOT = Path(os.getenv("DATA_ROOT", "/data")).resolve()
ORIGINAL_DIR = DATA_ROOT / "original"
ORIGINAL_DIR.mkdir(parents=True, exist_ok=True)

HEALTH_UPLOAD_ID = "healthcheck"

STAGE_NORMALIZATION = {
    "ready": "ready",
    "validate": "validate",
    "validation": "validate",
    "validating": "validate",
    "queued": "validate",
    "proxy": "make_proxy",
    "make_proxy": "make_proxy",
    "mezzanine": "transcode_mezz",
    "transcode": "transcode_mezz",
    "transcode_mezz": "transcode_mezz",
    "thumbs": "thumbs",
    "thumbnails": "thumbs",
    "thumbnail": "thumbs",
    "error": "error",
}

DEFAULT_STAGE = "ready"

router = APIRouter(prefix="/ingest", tags=["ingest"])

_upload_store: Dict[str, Dict[str, Any]] = {}


def _empty_assets() -> Dict[str, Optional[str]]:
    """Return empty asset placeholders for a status payload."""

    return {"original_url": None, "proxy_url": None, "mezzanine_url": None}


def _normalize_stage(stage: Optional[str]) -> str:
    """Normalize a stage name to the supported vocabulary."""

    if not stage:
        return DEFAULT_STAGE
    normalized = STAGE_NORMALIZATION.get(stage.lower())
    return normalized or ("error" if stage else DEFAULT_STAGE)


def _clamp_progress(value: int) -> int:
    """Clamp progress values to a sane 0-100 range."""

    return max(0, min(100, int(value)))


def _build_status_payload(
    status: str,
    stage: str,
    progress: int,
    assets: Dict[str, Optional[str]],
    message: Optional[str] = None,
) -> Dict[str, Any]:
    """Construct a normalized status payload."""

    normalized_assets = {
        "original_url": assets.get("original_url"),
        "proxy_url": assets.get("proxy_url"),
        "mezzanine_url": assets.get("mezzanine_url"),
    }
    payload: Dict[str, Any] = {
        "status": status,
        "stage": _normalize_stage(stage),
        "progress": _clamp_progress(progress),
        "assets": normalized_assets,
    }
    if message:
        payload["message"] = message
    return payload


def _clone_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Return a shallow copy suitable for responses or storage."""

    cloned = {
        "status": payload["status"],
        "stage": payload["stage"],
        "progress": payload["progress"],
        "assets": {
            "original_url": payload["assets"].get("original_url"),
            "proxy_url": payload["assets"].get("proxy_url"),
            "mezzanine_url": payload["assets"].get("mezzanine_url"),
        },
    }
    if "message" in payload:
        cloned["message"] = payload["message"]
    return cloned


def _store_status(
    upload_id: str,
    status: str,
    stage: str,
    progress: int,
    assets: Dict[str, Optional[str]],
    message: Optional[str] = None,
) -> Dict[str, Any]:
    """Persist a status payload in memory and return a response copy."""

    payload = _build_status_payload(status, stage, progress, assets, message)
    _upload_store[upload_id] = _clone_payload(payload)
    return _clone_payload(payload)


def _asset_urls(upload_id: str, extension: Optional[str]) -> Dict[str, Optional[str]]:
    """Generate asset URLs for a stored upload."""

    if not extension:
        return _empty_assets()
    suffix = extension if extension.startswith(".") else f".{extension}"
    asset_path = f"/assets/original/{upload_id}{suffix}"
    return {"original_url": asset_path, "proxy_url": asset_path, "mezzanine_url": None}


def _locate_existing_extension(upload_id: str) -> Optional[str]:
    """Look for an on-disk upload and return its extension if present."""

    for extension in sorted(ALLOWED_EXTENSIONS):
        candidate = ORIGINAL_DIR / f"{upload_id}{extension}"
        if candidate.exists():
            return extension
    return None


def _is_uuid_like(value: str) -> bool:
    """Determine if a value resembles a UUID string."""

    try:
        UUID(value)
    except (TypeError, ValueError):
        return False
    return True


def _ensure_health_seed() -> None:
    """Ensure a healthcheck job exists in the in-memory store."""

    if HEALTH_UPLOAD_ID not in _upload_store:
        _store_status(HEALTH_UPLOAD_ID, "ready", "ready", 100, _empty_assets())


def _resolve_status(upload_id: str) -> Dict[str, Any]:
    """Resolve status information for a given upload identifier."""

    if upload_id in _upload_store:
        return _clone_payload(_upload_store[upload_id])

    extension = _locate_existing_extension(upload_id)
    if extension:
        return _store_status(upload_id, "ready", "ready", 100, _asset_urls(upload_id, extension))

    if upload_id == HEALTH_UPLOAD_ID or _is_uuid_like(upload_id):
        return _build_status_payload("queued", "validate", 0, _empty_assets())

    message = f"Unknown upload_id '{upload_id}'"
    return _build_status_payload("error", "error", 0, _empty_assets(), message=message)


async def _write_file(destination: Path, upload: UploadFile) -> None:
    """Persist the uploaded file to disk in chunks."""

    try:
        with destination.open("wb") as buffer:
            while True:
                chunk = await upload.read(4 * 1024 * 1024)
                if not chunk:
                    break
                buffer.write(chunk)
    finally:
        await upload.close()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_video(file: UploadFile = File(...)) -> Dict[str, object]:
    """Accept a video upload and stash it on disk."""

    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")

    extension = Path(file.filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Please upload one of: .mp4, .mov, .mkv, .webm, .avi, .mts, .m2ts.",
        )

    upload_id = str(uuid4())
    destination = ORIGINAL_DIR / f"{upload_id}{extension}"

    try:
        await _write_file(destination, file)
    except OSError as exc:  # pragma: no cover - guard for filesystem errors
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to save upload") from exc

    assets = _asset_urls(upload_id, extension)
    _store_status(upload_id, "ready", "ready", 100, assets)

    return {
        "upload_id": upload_id,
        "original_url": assets["original_url"],
        "proxy_url": assets["proxy_url"],
        "mezzanine_url": assets["mezzanine_url"],
    }


@router.get("/status")
def get_status(upload_id: str = Query(..., description="Upload identifier")) -> Dict[str, Any]:
    """Return the status for an upload job."""

    _ensure_health_seed()
    return _resolve_status(upload_id)


@router.get("/health")
def get_health(upload_id: Optional[str] = Query(None, description="Optional upload identifier")) -> Dict[str, Any]:
    """Report ingest module readiness."""

    _ensure_health_seed()

    if upload_id:
        status_payload = _resolve_status(upload_id)
        ok = status_payload["status"] != "error"
    else:
        ok = any(payload["status"] != "error" for payload in _upload_store.values())

    return {"ok": bool(ok), "module": "ingest"}
