from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import ingest as legacy_ingest_service
from app.services import ingest_state


@pytest.fixture(autouse=True)
def reset_ingest_state():
    """Ensure ingest state stores do not leak between tests."""

    ingest_state.reset_state()
    legacy_ingest_service.job_store._jobs.clear()
    yield
    ingest_state.reset_state()
    legacy_ingest_service.job_store._jobs.clear()


def test_ingest_status_endpoint_returns_payload():
    client = TestClient(app)
    upload_id = str(uuid4())

    response = client.get("/ingest/status", params={"upload_id": upload_id})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"]
    assert set(payload["assets"].keys()) == {
        "original_url",
        "proxy_url",
        "mezzanine_url",
        "thumbs_glob",
        "keyframes_csv",
    }


def test_ingest_health_endpoint_reports_ok():
    client = TestClient(app)

    response = client.get("/ingest/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload == {"ok": True, "module": "ingest"}


def test_legacy_ingest_job_endpoints_remain_accessible():
    client = TestClient(app)

    creation = client.post(
        "/legacy-ingest", json={"source_url": "http://example.com/video.mp4"}
    )
    assert creation.status_code == 200
    job_id = creation.json()["job_id"]

    status_response = client.get(
        f"/legacy-ingest/{job_id}", params={"advance": False}
    )

    assert status_response.status_code == 200
    assert status_response.json()["job_id"] == job_id
