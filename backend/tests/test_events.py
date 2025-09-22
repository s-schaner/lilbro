from fastapi.testclient import TestClient

from app.main import app


def test_get_events_returns_seeded_players():
    client = TestClient(app)
    response = client.get("/events")
    assert response.status_code == 200
    payload = response.json()
    assert any(player["name"] == "Avery Lang" for player in payload["players"])
