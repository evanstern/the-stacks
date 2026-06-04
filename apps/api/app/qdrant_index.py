from collections.abc import Sequence
from dataclasses import dataclass

import httpx

from app.config import Settings


class QdrantIndexError(RuntimeError):
    pass


@dataclass(frozen=True)
class QdrantPoint:
    id: str
    vector: list[float]
    payload: dict[str, object]


@dataclass(frozen=True)
class QdrantSearchHit:
    id: str
    score: float
    payload: dict[str, object]


class QdrantIndexer:
    collection: str = ""

    def ensure_collection(self, dimensions: int) -> None:
        raise NotImplementedError

    def upsert_points(self, points: Sequence[QdrantPoint]) -> None:
        raise NotImplementedError

    def search_points(self, vector: list[float], limit: int, collection: str | None = None) -> list[QdrantSearchHit]:
        raise NotImplementedError


class HttpQdrantIndexer(QdrantIndexer):
    _UPSERT_BATCH_SIZE = 25
    _UPSERT_TIMEOUT = 120

    def __init__(self, settings: Settings) -> None:
        self.url = settings.qdrant_url.rstrip("/")
        self.collection = settings.qdrant_collection

    def ensure_collection(self, dimensions: int) -> None:
        existing = httpx.get(f"{self.url}/collections/{self.collection}", timeout=30)
        if existing.status_code == 200:
            vectors = existing.json().get("result", {}).get("config", {}).get("params", {}).get("vectors", {})
            existing_size = vectors.get("size") if isinstance(vectors, dict) else None
            if existing_size != dimensions:
                raise QdrantIndexError(
                    f"Qdrant collection {self.collection} has vector size {existing_size}, expected {dimensions}"
                )
            return
        if existing.status_code != 404:
            _raise_for_qdrant(existing, "inspect Qdrant collection")

        response = httpx.put(
            f"{self.url}/collections/{self.collection}",
            json={"vectors": {"size": dimensions, "distance": "Cosine"}},
            timeout=30,
        )
        _raise_for_qdrant(response, "ensure Qdrant collection")

    def upsert_points(self, points: Sequence[QdrantPoint]) -> None:
        if not points:
            return
        for start in range(0, len(points), self._UPSERT_BATCH_SIZE):
            batch = points[start : start + self._UPSERT_BATCH_SIZE]
            response = httpx.put(
                f"{self.url}/collections/{self.collection}/points?wait=true",
                json={
                    "points": [
                        {"id": point.id, "vector": point.vector, "payload": point.payload}
                        for point in batch
                    ]
                },
                timeout=self._UPSERT_TIMEOUT,
            )
            _raise_for_qdrant(response, "upsert Qdrant points")

    def search_points(self, vector: list[float], limit: int, collection: str | None = None) -> list[QdrantSearchHit]:
        target_collection = collection or self.collection
        response = httpx.post(
            f"{self.url}/collections/{target_collection}/points/search",
            json={"vector": vector, "limit": limit, "with_payload": True},
            timeout=30,
        )
        _raise_for_qdrant(response, "search Qdrant points")
        return [
            QdrantSearchHit(id=str(item["id"]), score=float(item.get("score", 0.0)), payload=item.get("payload", {}))
            for item in response.json().get("result", [])
        ]


def get_qdrant_indexer(settings: Settings) -> QdrantIndexer:
    return HttpQdrantIndexer(settings)


def _raise_for_qdrant(response: httpx.Response, action: str) -> None:
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise QdrantIndexError(f"Could not {action}: {response.text[:1000]}") from exc
