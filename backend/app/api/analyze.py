"""Routes for match analysis."""
from __future__ import annotations

import random
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

from ..data import LLM_CONTEXT_SNIPPETS, TIMELINE_MARKERS

router = APIRouter()


class AnalyzeRequest(BaseModel):
    video_url: str
    focus_player_ids: List[str] = []


@router.post("/analyze")
def analyze_clip(payload: AnalyzeRequest) -> dict:
    """Return deterministic insights for the supplied clip."""

    random.seed(7)
    sample_focus = payload.focus_player_ids or [marker["id"] for marker in TIMELINE_MARKERS]
    highlights = [
        {
            "event_id": marker["id"],
            "timestamp": marker["timestamp"],
            "note": f"Momentum shift detected for {marker['label'].lower()} sequence.",
        }
        for marker in TIMELINE_MARKERS
    ]
    return {
        "video_url": payload.video_url,
        "focus": sample_focus[:2],
        "summary": "Serve pressure created early run; transition defense held coverage windows.",
        "context": random.sample(LLM_CONTEXT_SNIPPETS, k=2),
        "highlights": highlights,
    }
