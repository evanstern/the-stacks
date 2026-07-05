from fastapi.testclient import TestClient

from ml.main import create_app
from ml.models import ModelState


class FakeModel:
    def __init__(self, dimensions: int):
        self.dimensions = dimensions

    def encode(self, inputs):
        return [[0.1] * self.dimensions for _ in inputs]


def _ready_client(model_id: str = "test-model", dimensions: int = 4) -> TestClient:
    state = ModelState(status="ready", model_id=model_id, model=FakeModel(dimensions), dimensions=dimensions)
    app = create_app()
    app.state.model_state = state
    return TestClient(app)


def test_embed_happy_batch_aligns_dims_and_inputs() -> None:
    client = _ready_client()
    response = client.post("/v1/embed", json={"model": "test-model", "inputs": ["a", "b", "c"]})

    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "test-model"
    assert body["dimensions"] == 4
    assert len(body["embeddings"]) == 3
    assert all(len(row) == 4 for row in body["embeddings"])
    assert isinstance(body["duration_ms"], int)


def test_embed_model_mismatch_is_404() -> None:
    client = _ready_client(model_id="test-model")
    response = client.post("/v1/embed", json={"model": "other-model", "inputs": ["a"]})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "unknown_thing"


def test_embed_empty_inputs_is_415() -> None:
    client = _ready_client()
    response = client.post("/v1/embed", json={"model": "test-model", "inputs": []})

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_type"


def test_embed_oversized_batch_is_415(monkeypatch) -> None:
    monkeypatch.setenv("EMBED_MAX_BATCH", "2")
    client = _ready_client()
    response = client.post("/v1/embed", json={"model": "test-model", "inputs": ["a", "b", "c"]})

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_type"


def test_embed_non_string_input_is_415() -> None:
    client = _ready_client()
    response = client.post("/v1/embed", json={"model": "test-model", "inputs": ["a", 123]})

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_type"


def test_embed_before_ready_is_503() -> None:
    state = ModelState(status="loading", model_id="test-model")
    app = create_app()
    app.state.model_state = state
    client = TestClient(app)

    response = client.post("/v1/embed", json={"model": "test-model", "inputs": ["a"]})

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "dependency_down"
