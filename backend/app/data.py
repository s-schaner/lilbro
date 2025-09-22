"""Seed data for VolleySense mocked API responses."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List

# Deterministic timeline for a sample three-set match
BASE_MATCH_START = datetime(2024, 3, 2, 18, 30)

SEED_PLAYERS: List[Dict[str, str]] = [
    {"id": "p1", "name": "Avery Lang", "position": "Setter"},
    {"id": "p2", "name": "Noah Patel", "position": "Outside Hitter"},
    {"id": "p3", "name": "Marin Ortega", "position": "Libero"},
    {"id": "p4", "name": "Theo Wells", "position": "Middle Blocker"},
    {"id": "p5", "name": "Isla Chen", "position": "Opposite"},
    {"id": "p6", "name": "River James", "position": "Middle Blocker"},
]

SEED_EVENTS: List[Dict[str, object]] = [
    {
        "id": "e1",
        "timestamp": 12.4,
        "label": "Serve",
        "player_id": "p2",
        "outcome": "ace",
        "video_time": (BASE_MATCH_START + timedelta(seconds=12)).isoformat(),
    },
    {
        "id": "e2",
        "timestamp": 38.7,
        "label": "Block",
        "player_id": "p4",
        "outcome": "point",
        "video_time": (BASE_MATCH_START + timedelta(seconds=39)).isoformat(),
    },
    {
        "id": "e3",
        "timestamp": 55.2,
        "label": "Dig",
        "player_id": "p3",
        "outcome": "save",
        "video_time": (BASE_MATCH_START + timedelta(seconds=55)).isoformat(),
    },
]

FORMATION_SNAPSHOT: Dict[str, List[str]] = {
    "front_row": ["p2", "p4", "p5"],
    "back_row": ["p1", "p3", "p6"],
}

MATCH_STATS: Dict[str, object] = {
    "serves": {"attempts": 27, "aces": 5, "faults": 2},
    "attacks": {"attempts": 31, "kills": 14, "errors": 4},
    "blocks": {"solo": 3, "assisted": 7},
    "dig_success_rate": 0.82,
}

TIMELINE_MARKERS: List[Dict[str, object]] = [
    {"timestamp": event["timestamp"], "label": event["label"], "id": event["id"]}
    for event in SEED_EVENTS
]

LLM_CONTEXT_SNIPPETS: List[str] = [
    "Setter tempo held steady across rotations.",
    "Serve receive adjustments reduced error rate in set two.",
    "Middle blockers responded well to quick tempo cues.",
]

SCREEN_SNAP_SUMMARY: Dict[str, object] = {
    "rotation": "Serve Receive",
    "focus_player": "Avery Lang",
    "detected_formations": [
        {"type": "W", "confidence": 0.92},
        {"type": "Stack", "confidence": 0.41},
    ],
}
