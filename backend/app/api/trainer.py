"""Event trainer endpoints."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/trainer")


class TrainerProposalRequest(BaseModel):
    frame_timestamp: float
    label: str
    selected_player_ids: List[str]


@router.post("/propose")
def propose_training_event(payload: TrainerProposalRequest) -> dict:
    regions = [
        {
            "player_id": player_id,
            "shape": "lasso",
            "points": [
                {"x": index * 12 + 32, "y": index * 8 + 24}
                for index in range(3)
            ],
        }
        for player_id in payload.selected_player_ids
    ]
    return {
        "label": payload.label,
        "frame_timestamp": payload.frame_timestamp,
        "regions": regions,
        "notes": "Anchor coverage lane for right-side read.",
    }


class TrainerCommitRequest(BaseModel):
    proposal_id: str
    accepted: bool


@router.post("/commit")
def commit_training_event(payload: TrainerCommitRequest) -> dict:
    return {
        "proposal_id": payload.proposal_id,
        "status": "applied" if payload.accepted else "discarded",
    }
