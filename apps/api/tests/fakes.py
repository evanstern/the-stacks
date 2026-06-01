from collections.abc import Sequence

from app.embeddings import EmbeddingBatch, EmbeddingClient
from app.qdrant_index import QdrantIndexer, QdrantPoint, QdrantSearchHit


class FakeEmbeddingClient(EmbeddingClient):
    def __init__(self, dimensions: int = 4, model: str = "test-embedding-model") -> None:
        self.dimensions = dimensions
        self.model = model
        self.requests: list[list[str]] = []

    def embed_texts(self, texts: Sequence[str]) -> EmbeddingBatch:
        self.requests.append(list(texts))
        vectors = [[float(index + 1)] * self.dimensions for index, _ in enumerate(texts)]
        return EmbeddingBatch(vectors=vectors, model=self.model, dimensions=self.dimensions)


class FakeQdrantIndexer(QdrantIndexer):
    def __init__(self, collection: str = "test_chunks", search_hits: list[QdrantSearchHit] | None = None) -> None:
        self.collection = collection
        self.ensured_dimensions: list[int] = []
        self.points: list[QdrantPoint] = []
        self.search_hits = search_hits or []
        self.search_requests: list[tuple[list[float], int]] = []

    def ensure_collection(self, dimensions: int) -> None:
        self.ensured_dimensions.append(dimensions)

    def upsert_points(self, points: Sequence[QdrantPoint]) -> None:
        self.points.extend(points)

    def search_points(self, vector: list[float], limit: int) -> list[QdrantSearchHit]:
        self.search_requests.append((vector, limit))
        return self.search_hits[:limit]
