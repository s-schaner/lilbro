"""Routes for storing and applying court calibration."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, Literal, Sequence, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ValidationError

from app.services.homography import apply_h, compute_h, invert_h


DATA_ROOT = Path(os.getenv("DATA_ROOT", "/data")).resolve()
CALIB_DIR = DATA_ROOT / "calib"
CALIB_DIR.mkdir(parents=True, exist_ok=True)

CourtPoint = Tuple[float, float]

COURT_TEMPLATE_POINTS: List[CourtPoint] = [
    (0.0, 0.0),  # left-near
    (18.0, 0.0),  # right-near
    (18.0, 9.0),  # right-far
    (0.0, 9.0),  # left-far
]


class CalibrationPayload(BaseModel):
    frame_t: float = Field(..., description="Timestamp of the frame used for calibration")
    image_size: Tuple[int, int] = Field(..., description="Width/height of the source frame")
    image_points: Sequence[Tuple[float, float]] = Field(
        ..., min_length=4, max_length=4, description="Court corner clicks in image space"
    )
    court_template: Literal["indoor_fivb_18x9"] = Field(
        "indoor_fivb_18x9", description="Court template identifier"
    )
    net_points: Sequence[Tuple[float, float]] = Field(
        ..., min_length=2, max_length=2, description="Net tape clicks in image space"
    )


class TransformRequest(BaseModel):
    pts: Sequence[Tuple[float, float]] = Field(..., min_length=1)


router = APIRouter(prefix="/calibration", tags=["calibration"])


def _calibration_path(upload_id: str) -> Path:
    safe_id = upload_id.replace("/", "_")
    return CALIB_DIR / f"{safe_id}.json"


def _load_calibration(upload_id: str) -> dict:
    path = _calibration_path(upload_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Calibration not found")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


@router.post("/{upload_id}")
def save_calibration(upload_id: str, payload: CalibrationPayload) -> dict:
    image_points = [tuple(point) for point in payload.image_points]
    court_points: List[CourtPoint] = COURT_TEMPLATE_POINTS.copy()

    try:
        homography = compute_h(image_points, court_points)
    except (ValueError, ValidationError) as exc:  # pragma: no cover - validation duplicates
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        homography_inv = invert_h(homography)
    except Exception as exc:  # pragma: no cover - matrix inversion should succeed
        raise HTTPException(status_code=400, detail="Homography inversion failed") from exc

    net_points = [tuple(point) for point in payload.net_points]
    net_court = apply_h(homography, net_points)

    record = {
        "frame_t": payload.frame_t,
        "image_size": list(payload.image_size),
        "image_points": [list(point) for point in image_points],
        "court_template": payload.court_template,
        "court_points": [list(point) for point in court_points],
        "net_points": [list(point) for point in net_points],
        "net_court_points": [list(point) for point in net_court],
        "homography": homography,
        "homography_inv": homography_inv,
    }

    path = _calibration_path(upload_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(record, handle, indent=2)

    return record


@router.get("/{upload_id}")
def get_calibration(upload_id: str) -> dict:
    return _load_calibration(upload_id)


@router.post("/{upload_id}/pixel_to_court")
def pixel_to_court(upload_id: str, payload: TransformRequest) -> dict:
    calibration = _load_calibration(upload_id)
    matrix = calibration.get("homography")
    if not matrix:
        raise HTTPException(status_code=400, detail="Calibration missing homography")
    transformed = apply_h(matrix, payload.pts)
    return {"uv": [list(point) for point in transformed]}


@router.post("/{upload_id}/court_to_pixel")
def court_to_pixel(upload_id: str, payload: TransformRequest) -> dict:
    calibration = _load_calibration(upload_id)
    matrix = calibration.get("homography_inv")
    if not matrix:
        raise HTTPException(status_code=400, detail="Calibration missing inverse homography")
    transformed = apply_h(matrix, payload.pts)
    return {"px": [list(point) for point in transformed]}
