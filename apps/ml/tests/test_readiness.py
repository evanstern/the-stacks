from fastapi.testclient import TestClient

from ml.main import create_app
from ml.models import ModelState


def _client_with_state(state: ModelState) -> TestClient:
    app = create_app()
    app.state.model_state = state
    # No `with` block: skips the real lifespan (and therefore the real model
    # download/load) so each test controls readiness directly.
    return TestClient(app)


def test_health_is_ok_before_model_loads() -> None:
    client = _client_with_state(ModelState(status="loading", model_id="test-model"))
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_is_503_loading_before_model_loads() -> None:
    client = _client_with_state(ModelState(status="loading", model_id="test-model"))
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "loading"}


def test_ready_is_200_with_model_and_dimensions_once_loaded() -> None:
    state = ModelState(status="ready", model_id="test-model", dimensions=384)
    client = _client_with_state(state)
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "model": "test-model", "dimensions": 384}


def test_ready_is_503_failed_with_scrubbed_message_on_load_failure() -> None:
    state = ModelState(status="failed", model_id="test-model", error_message="download failed")
    client = _client_with_state(state)
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "failed", "message": "download failed"}
