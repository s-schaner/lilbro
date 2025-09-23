"""Annotation persistence for overlays."""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


DATA_ROOT = Path(os.getenv("DATA_ROOT", "/data")).resolve()
ANN_DIR = DATA_ROOT / "ann"
ANN_DIR.mkdir(parents=True, exist_ok=True)


class Rect(BaseModel):
    x: float
    y: float
    w: float
    h: float


class Poly(BaseModel):
    pts: Sequence[Tuple[float, float]] = Field(..., min_length=3)


class AnnotationPayload(BaseModel):
    frame_t: float
    rect: Optional[Rect] = None
    poly: Optional[Poly] = None
    jersey: Optional[int] = None
    label: Optional[str] = None
    notes: Optional[str] = None

    def validate_geometry(self) -> None:
        if not self.rect and not self.poly:
            raise HTTPException(status_code=400, detail="Annotation requires rect or poly geometry")


router = APIRouter(prefix="/annotations", tags=["annotations"])


def _annotation_path(upload_id: str) -> Path:
    safe_id = upload_id.replace("/", "_")
    return ANN_DIR / f"{safe_id}.jsonl"


def _load_annotations(upload_id: str) -> List[dict]:
    path = _annotation_path(upload_id)
    if not path.exists():
        return []
    records: List[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return records


@router.get("/{upload_id}")
def list_annotations(upload_id: str) -> List[dict]:
    return _load_annotations(upload_id)


@router.post("/{upload_id}")
def create_annotation(upload_id: str, payload: AnnotationPayload) -> dict:
    payload.validate_geometry()

    record = payload.model_dump()
    record["id"] = str(uuid.uuid4())
    record["created_at"] = datetime.now(timezone.utc).isoformat()

    path = _annotation_path(upload_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record))
        handle.write("\n")

    return record
