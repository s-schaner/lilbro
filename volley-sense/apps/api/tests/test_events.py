from pathlib import Path
import sys

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.main import app

client = TestClient(app)


def test_list_events():
    response = client.get("/events", params={"game_id": "demo-1"})
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert payload[0]["label"]


def test_trainer_preview_and_explain():
    event_id = "event-contact"
    preview = client.get("/trainer/preview", params={"eventId": event_id, "game_id": "demo-1"})
    assert preview.status_code == 200
    events = preview.json()
    assert events and events[0]["kind"] == "custom"

    explain = client.get("/trainer/explain", params={"event_id": event_id})
    assert explain.status_code == 200
    data = explain.json()
    assert "features" in data and "rules" in data


def test_modules_toggle_and_health():
    modules_resp = client.get("/modules")
    assert modules_resp.status_code == 200
    payload = modules_resp.json()
    assert any(module["id"] == "timeline" for module in payload)

    disable = client.post("/modules/timeline", json={"enabled": False})
    assert disable.status_code == 200
    blocked = client.get("/events", params={"game_id": "demo-1"})
    assert blocked.status_code == 503

    enable = client.post("/modules/timeline", json={"enabled": True})
    assert enable.status_code == 200
    restored = client.get("/events", params={"game_id": "demo-1"})
    assert restored.status_code == 200


def test_insights_and_screensnap():
    insights = client.get("/insights", params={"game_id": "demo-1"})
    assert insights.status_code == 200
    data = insights.json()
    assert "recap" in data and len(data["momentum"]) >= 1

    snap = client.post(
        "/screensnap",
        json={
            "focus": "Blocking technique",
            "context": {"timestamp": 104.2},
            "image_b64": "ZmFrZQ==",
        },
    )
    assert snap.status_code == 200
    snap_data = snap.json()
    assert snap_data["summary"]
    assert snap_data["confidence"] > 0


def test_video_and_overlays():
    ingest = client.post("/video/ingest", files={"file": ("clip.mp4", b"fake", "video/mp4")})
    assert ingest.status_code == 200
    ingest_data = ingest.json()
    assert ingest_data["proxy"].endswith("720p30.mp4")

    overlays = client.get("/overlays", params={"game_id": "demo-1", "t": 12})
    assert overlays.status_code == 200
    overlay_data = overlays.json()
    assert overlay_data["boxes"] and overlay_data["trail"]
