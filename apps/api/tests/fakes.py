from collections.abc import Sequence
from typing import override

from app.embeddings import EmbeddingBatch, EmbeddingClient
from app.qdrant_index import QdrantIndexer, QdrantPoint, QdrantSearchHit


class FakeEmbeddingClient(EmbeddingClient):
    provider: str = "fake"
    dimensions: int
    model: str

    def __init__(
        self, dimensions: int = 4, model: str = "test-embedding-model"
    ) -> None:
        self.dimensions = dimensions
        self.model = model
        self.requests: list[list[str]] = []

    @override
    def embed_texts(self, texts: Sequence[str]) -> EmbeddingBatch:
        self.requests.append(list(texts))
        vectors = [
            [float(index + 1)] * self.dimensions for index, _ in enumerate(texts)
        ]
        return EmbeddingBatch(
            vectors=vectors,
            model=self.model,
            dimensions=self.dimensions,
            provider=self.provider,
        )


class FakeQdrantIndexer(QdrantIndexer):
    collection: str
    search_hits: list[QdrantSearchHit]
    collection_search_hits: dict[str, list[QdrantSearchHit]]

    def __init__(
        self,
        collection: str = "test_chunks",
        search_hits: list[QdrantSearchHit] | None = None,
        collection_search_hits: dict[str, list[QdrantSearchHit]] | None = None,
    ) -> None:
        self.collection = collection
        self.ensured_dimensions: list[int] = []
        self.points: list[QdrantPoint] = []
        self.search_hits = search_hits or []
        self.collection_search_hits = collection_search_hits or {}
        self.search_requests: list[tuple[list[float], int, str]] = []

    @override
    def ensure_collection(self, dimensions: int) -> None:
        self.ensured_dimensions.append(dimensions)

    @override
    def upsert_points(self, points: Sequence[QdrantPoint]) -> None:
        self.points.extend(points)

    @override
    def search_points(
        self, vector: list[float], limit: int, collection: str | None = None
    ) -> list[QdrantSearchHit]:
        target_collection = collection or self.collection
        self.search_requests.append((vector, limit, target_collection))
        hits = self.collection_search_hits.get(target_collection, self.search_hits)
        return hits[:limit]
