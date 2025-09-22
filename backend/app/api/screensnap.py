"""ScreenSnap assisted labeling endpoints."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from ..data import SCREEN_SNAP_SUMMARY

router = APIRouter(prefix="/screensnap")


class ScreenSnapRequest(BaseModel):
    frame_base64: str
    system_prompt: str


@router.post("/analyze")
def analyze_frame(payload: ScreenSnapRequest) -> dict:
    return {
        "prompt": payload.system_prompt,
        "analysis": SCREEN_SNAP_SUMMARY,
        "tokens_used": 56,
    }
