"""T034 (010 US5): /v1/rerank, TDD'd before it exists (contracts/reranker.md).

Same test posture as test_embed: fake scorer via state injection, no model
downloads, guard order proven (not-ready 503 -> wrong model 404 -> oversize
415 -> score). The reranker role is OPTIONAL — an empty ML_RERANKER_MODEL is
'disabled', reported on /ready and answered as 503 dependency_down here (the
TS engine refuses rerank=on at config time before a request ever gets this
far; this path is the belt to that suspender).
"""

from fastapi.testclient import TestClient

from ml.main import create_app
from ml.models import ModelState, RerankerState


class FakeModel:
    def __init__(self, dimensions: int):
        self.dimensions = dimensions

    def encode(self, inputs):
        return [[0.1] * self.dimensions for _ in inputs]


class FakeCrossEncoder:
    """Scores by text length — deterministic, obviously not semantic."""

    def predict(self, pairs):
        return [float(len(text)) for _query, text in pairs]


def _client(reranker: RerankerState) -> TestClient:
    app = create_app()
    app.state.model_state = ModelState(
        status="ready", model_id="embed-model", model=FakeModel(4), dimensions=4
    )
    app.state.reranker_state = reranker
    return TestClient(app)


def _ready_reranker() -> RerankerState:
    return RerankerState(status="ready", model_id="rerank-model", model=FakeCrossEncoder())


PASSAGES = [
    {"id": "c1", "text": "short"},
    {"id": "c2", "text": "a considerably longer passage of text"},
]


def test_rerank_happy_scores_every_passage_by_id() -> None:
    client = _client(_ready_reranker())
    response = client.post(
        "/v1/rerank",
        json={"model": "rerank-model", "query": "q", "passages": PASSAGES},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "rerank-model"
    scores = {entry["id"]: entry["score"] for entry in body["scores"]}
    assert set(scores) == {"c1", "c2"}
    assert scores["c2"] > scores["c1"]  # the fake scores by length


def test_rerank_disabled_role_is_503_dependency_down() -> None:
    client = _client(RerankerState(status="disabled", model_id=""))
    response = client.post(
        "/v1/rerank", json={"model": "x", "query": "q", "passages": PASSAGES}
    )
    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "dependency_down"
    assert "disabled" in body["error"]["message"]


def test_rerank_loading_and_failed_are_503() -> None:
    for status in ("loading", "failed"):
        client = _client(RerankerState(status=status, model_id="rerank-model"))
        response = client.post(
            "/v1/rerank", json={"model": "rerank-model", "query": "q", "passages": PASSAGES}
        )
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "dependency_down"


def test_rerank_wrong_model_is_404_unknown_thing() -> None:
    client = _client(_ready_reranker())
    response = client.post(
        "/v1/rerank", json={"model": "other-model", "query": "q", "passages": PASSAGES}
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "unknown_thing"


def test_rerank_oversize_batch_is_415() -> None:
    client = _client(_ready_reranker())
    too_many = [{"id": f"c{i}", "text": "t"} for i in range(257)]
    response = client.post(
        "/v1/rerank", json={"model": "rerank-model", "query": "q", "passages": too_many}
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_type"


def test_rerank_malformed_payload_is_415() -> None:
    client = _client(_ready_reranker())
    response = client.post(
        "/v1/rerank", json={"model": "rerank-model", "query": "q", "passages": []}
    )
    assert response.status_code == 415


def test_ready_reports_reranker_state_additively() -> None:
    client = _client(_ready_reranker())
    response = client.get("/ready")
    assert response.status_code == 200
    body = response.json()
    # 007's fields stay intact (compose healthchecks depend on them)…
    assert body["status"] == "ready"
    assert body["model"] == "embed-model"
    # …and the reranker reports additively.
    assert body["reranker"] == {"status": "ready", "model": "rerank-model"}


def test_ready_reports_disabled_reranker_without_failing_readiness() -> None:
    client = _client(RerankerState(status="disabled", model_id=""))
    response = client.get("/ready")
    # Overall readiness is the EMBEDDING role's story; a disabled optional
    # role must not fail the stack's healthcheck.
    assert response.status_code == 200
    assert response.json()["reranker"]["status"] == "disabled"
