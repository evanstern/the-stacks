from collections.abc import Sequence
from dataclasses import dataclass
import time

import httpx

from app.config import Settings


OPENAI_EMBEDDING_REQUEST_TOKEN_LIMIT = 2_500
OPENAI_EMBEDDING_REQUEST_MAX_RETRIES = 3
OPENAI_EMBEDDING_RETRY_BACKOFF_SECONDS = 12.0


class EmbeddingError(RuntimeError):
    pass


@dataclass(frozen=True)
class EmbeddingBatch:
    vectors: list[list[float]]
    model: str
    dimensions: int


class EmbeddingClient:
    model: str
    dimensions: int

    def embed_texts(self, texts: Sequence[str]) -> EmbeddingBatch:
        raise NotImplementedError


class OpenAIEmbeddingClient(EmbeddingClient):
    def __init__(self, settings: Settings) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_embedding_model
        self.dimensions = settings.openai_embedding_dimensions

    def embed_texts(self, texts: Sequence[str]) -> EmbeddingBatch:
        if not self.api_key:
            raise EmbeddingError("OPENAI_API_KEY is required for embedding")
        if not texts:
            return EmbeddingBatch(vectors=[], model=self.model, dimensions=self.dimensions)

        vectors: list[list[float]] = []
        for batch in _batch_texts(texts, OPENAI_EMBEDDING_REQUEST_TOKEN_LIMIT):
            response = _post_openai_embedding_batch(self.api_key, self.model, self.dimensions, batch)

            payload = response.json()
            batch_vectors = [item["embedding"] for item in sorted(payload.get("data", []), key=lambda item: item["index"])]
            if len(batch_vectors) != len(batch):
                raise EmbeddingError("OpenAI embeddings response did not match requested input count")
            for vector in batch_vectors:
                if len(vector) != self.dimensions:
                    raise EmbeddingError("OpenAI embeddings response dimensions did not match configuration")
            vectors.extend(batch_vectors)

        return EmbeddingBatch(vectors=vectors, model=self.model, dimensions=self.dimensions)


def _batch_texts(texts: Sequence[str], token_limit: int) -> list[list[str]]:
    batches: list[list[str]] = []
    current_batch: list[str] = []
    current_tokens = 0

    for text in texts:
        estimated_tokens = _estimate_text_tokens(text)
        if current_batch and current_tokens + estimated_tokens > token_limit:
            batches.append(current_batch)
            current_batch = []
            current_tokens = 0

        current_batch.append(text)
        current_tokens += estimated_tokens

    if current_batch:
        batches.append(current_batch)

    return batches


def _estimate_text_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, (len(text) + 3) // 4)


def _post_openai_embedding_batch(api_key: str, model: str, dimensions: int, batch: Sequence[str]) -> httpx.Response:
    for attempt in range(OPENAI_EMBEDDING_REQUEST_MAX_RETRIES + 1):
        response = httpx.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "input": batch,
                "dimensions": dimensions,
                "encoding_format": "float",
            },
            timeout=60,
        )
        try:
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as exc:
            if response.status_code != 429 or attempt == OPENAI_EMBEDDING_REQUEST_MAX_RETRIES:
                raise EmbeddingError(f"OpenAI embeddings request failed: {response.text[:1000]}") from exc
            time.sleep(_retry_delay_seconds(response.headers.get("retry-after"), attempt))


def _retry_delay_seconds(retry_after: str | None, attempt: int) -> float:
    if retry_after is not None:
        try:
            return max(0.0, float(retry_after))
        except ValueError:
            pass
    return OPENAI_EMBEDDING_RETRY_BACKOFF_SECONDS * (attempt + 1)


def get_embedding_client(settings: Settings) -> EmbeddingClient:
    return OpenAIEmbeddingClient(settings)
