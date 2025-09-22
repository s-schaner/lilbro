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
