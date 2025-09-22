from pathlib import Path
import sys
import time

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


def test_trainer_examples_and_training_flow():
    example_payload = {
        "name": "Collision drill",
        "clip": {"startT": 100.0, "endT": 103.0, "fps": 30, "src": "demo.mp4"},
        "keyFrame": 15,
        "endFrame": 30,
        "annotations": [
            {
                "id": "ann-1",
                "frame": 15,
                "region": {"x": 0.2, "y": 0.3, "w": 0.25, "h": 0.2},
                "keypoints": [{"x": 0.3, "y": 0.35, "label": "hand"}],
                "tags": [
                    {"kind": "stance", "value": "jump"},
                    {"kind": "hand", "side": "L", "state": "open", "aboveTape": True}
                ],
                "jersey": 12,
            }
        ],
        "naturalLanguage": "Left pin collision with libero",
        "template": "Contact",
        "team": "home",
        "confidence": 0.82,
    }
    created = client.post("/trainer/examples", json=example_payload)
    assert created.status_code == 200
    example_id = created.json()["id"]

    listing = client.get("/trainer/examples")
    assert listing.status_code == 200
    assert any(example["id"] == example_id for example in listing.json())

    training = client.post("/trainer/train", json={"event_id": "event-contact", "example_ids": [example_id]})
    assert training.status_code == 200
    job = training.json()
    assert job["status"] in {"running", "completed"}

    time.sleep(2.1)
    status = client.get(f"/trainer/status/{job['job_id']}")
    assert status.status_code == 200
    status_payload = status.json()
    assert status_payload["status"] == "completed"
    assert "metrics" in status_payload

    vlm = client.post(
        "/trainer/vlm/label",
        json={
            "focus": "Blocking technique",
            "hints": ["left pin", "late close"],
            "image_b64": "data:image/png;base64,ZmFrZQ==",
        },
    )
    assert vlm.status_code == 200
    assist = vlm.json()
    assert assist["confidence"] > 0
