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

    explain = client.get("/explain", params={"event_id": event_id})
    assert explain.status_code == 200
    data = explain.json()
    assert "features" in data and "rules" in data


def test_module_registry_and_toggle():
    modules = client.get("/modules")
    assert modules.status_code == 200
    payload = modules.json()
    assert any(item["id"] == "timeline" for item in payload)

    toggle = client.patch("/modules/overlays", json={"enabled": True})
    assert toggle.status_code == 200
    assert toggle.json()["id"] == "overlays"


def test_screensnap_analysis():
    payload = {
        "focus": "Blocking technique",
        "context": {"timestamp": 104.2},
        "image_b64": "data:image/png;base64,ZmFrZQ==",
    }
    response = client.post("/screensnap", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]
    assert body["confidence"]
