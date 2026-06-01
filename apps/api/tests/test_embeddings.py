import httpx

from app.config import Settings
from app import embeddings as embeddings_module
from app.embeddings import EmbeddingError, OpenAIEmbeddingClient


def test_openai_embedding_client_uses_configured_model_and_dimensions(monkeypatch) -> None:
    requests: list[dict[str, object]] = []

    def fake_post(url: str, headers: dict[str, str], json: dict[str, object], timeout: int) -> httpx.Response:
        requests.append({"url": url, "headers": headers, "json": json, "timeout": timeout})
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "data": [
                    {"index": 1, "embedding": [0.3, 0.4, 0.5]},
                    {"index": 0, "embedding": [0.0, 0.1, 0.2]},
                ]
            },
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    client = OpenAIEmbeddingClient(
        Settings(OPENAI_API_KEY="test-key", OPENAI_EMBEDDING_MODEL="text-embedding-3-small", OPENAI_EMBEDDING_DIMENSIONS=3)
    )

    batch = client.embed_texts(["alpha", "beta"])

    assert batch.model == "text-embedding-3-small"
    assert batch.dimensions == 3
    assert batch.vectors == [[0.0, 0.1, 0.2], [0.3, 0.4, 0.5]]
    assert requests == [
        {
            "url": "https://api.openai.com/v1/embeddings",
            "headers": {"Authorization": "Bearer test-key"},
            "json": {
                "model": "text-embedding-3-small",
                "input": ["alpha", "beta"],
                "dimensions": 3,
                "encoding_format": "float",
            },
            "timeout": 60,
        }
    ]


def test_openai_embedding_client_batches_large_requests_and_preserves_order(monkeypatch) -> None:
    requests: list[list[str]] = []
    texts = ["a" * 10_000, "b" * 10_000, "c" * 10_000, "d" * 10_000]

    def fake_post(url: str, headers: dict[str, str], json: dict[str, object], timeout: int) -> httpx.Response:
        batch = list(json["input"])
        requests.append(batch)
        data = [
            {"index": index, "embedding": [float(texts.index(text))] * 3}
            for index, text in reversed(list(enumerate(batch)))
        ]
        return httpx.Response(200, request=httpx.Request("POST", url), json={"data": data})

    monkeypatch.setattr(httpx, "post", fake_post)
    client = OpenAIEmbeddingClient(
        Settings(OPENAI_API_KEY="test-key", OPENAI_EMBEDDING_MODEL="text-embedding-3-small", OPENAI_EMBEDDING_DIMENSIONS=3)
    )

    batch = client.embed_texts(texts)

    assert requests == [["a" * 10_000], ["b" * 10_000], ["c" * 10_000], ["d" * 10_000]]
    assert batch.vectors == [[0.0, 0.0, 0.0], [1.0, 1.0, 1.0], [2.0, 2.0, 2.0], [3.0, 3.0, 3.0]]
    assert batch.model == "text-embedding-3-small"
    assert batch.dimensions == 3


def test_openai_embedding_client_retries_rate_limited_requests(monkeypatch) -> None:
    requests: list[dict[str, object]] = []
    sleeps: list[float] = []

    def fake_sleep(seconds: float) -> None:
        sleeps.append(seconds)

    def fake_post(url: str, headers: dict[str, str], json: dict[str, object], timeout: int) -> httpx.Response:
        requests.append({"url": url, "json": json, "timeout": timeout})
        if len(requests) == 1:
            return httpx.Response(
                429,
                request=httpx.Request("POST", url),
                headers={"retry-after": "12"},
                text='{"error":{"message":"rate_limit_exceeded"}}',
            )
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={"data": [{"index": 0, "embedding": [0.0, 0.1, 0.2]}]},
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    monkeypatch.setattr(embeddings_module.time, "sleep", fake_sleep)
    client = OpenAIEmbeddingClient(Settings(OPENAI_API_KEY="test-key", OPENAI_EMBEDDING_DIMENSIONS=3))

    batch = client.embed_texts(["alpha"])

    assert len(requests) == 2
    assert requests[0]["json"] == requests[1]["json"]
    assert sleeps == [12.0]
    assert batch.vectors == [[0.0, 0.1, 0.2]]


def test_openai_embedding_client_returns_empty_batch_without_request(monkeypatch) -> None:
    def fake_post(*args, **kwargs):
        raise AssertionError("OpenAI should not be called for empty input")

    monkeypatch.setattr(httpx, "post", fake_post)
    client = OpenAIEmbeddingClient(Settings(OPENAI_API_KEY="test-key"))

    batch = client.embed_texts([])

    assert batch == embeddings_module.EmbeddingBatch(vectors=[], model=client.model, dimensions=client.dimensions)


def test_openai_embedding_client_raises_for_http_error(monkeypatch) -> None:
    def fake_post(url: str, headers: dict[str, str], json: dict[str, object], timeout: int) -> httpx.Response:
        return httpx.Response(400, request=httpx.Request("POST", url), text="bad request")

    monkeypatch.setattr(httpx, "post", fake_post)
    client = OpenAIEmbeddingClient(Settings(OPENAI_API_KEY="test-key"))

    try:
        client.embed_texts(["alpha"])
    except EmbeddingError as exc:
        assert "OpenAI embeddings request failed" in str(exc)
    else:
        raise AssertionError("Expected EmbeddingError")


def test_openai_embedding_client_does_not_retry_non_rate_limit_errors(monkeypatch) -> None:
    requests: list[dict[str, object]] = []

    def fake_post(url: str, headers: dict[str, str], json: dict[str, object], timeout: int) -> httpx.Response:
        requests.append({"url": url, "json": json, "timeout": timeout})
        return httpx.Response(500, request=httpx.Request("POST", url), text="server error")

    monkeypatch.setattr(httpx, "post", fake_post)
    client = OpenAIEmbeddingClient(Settings(OPENAI_API_KEY="test-key"))

    try:
        client.embed_texts(["alpha"])
    except EmbeddingError as exc:
        assert "OpenAI embeddings request failed" in str(exc)
    else:
        raise AssertionError("Expected EmbeddingError")

    assert len(requests) == 1
