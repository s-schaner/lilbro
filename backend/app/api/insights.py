"""LLM insight endpoints."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import get_settings

router = APIRouter()


class InsightRequest(BaseModel):
    prompt: str
    context: List[str] = []


@router.post("/insights")
def generate_insight(payload: InsightRequest) -> dict:
    settings = get_settings()
    return {
        "provider": settings.llm_base_url,
        "prompt": payload.prompt,
        "insight": (
            "Tempo differential suggests earlier setter release on serve receive. "
            "Use quick-back variation to stretch blockers."
        ),
        "context": payload.context,
    }
