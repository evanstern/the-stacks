from collections.abc import Sequence
from pathlib import Path
from typing import override

import pytest

from app.embeddings import EmbeddingBatch
from app.qdrant_index import QdrantSearchHit
from tests.embedding_eval_support import derive_evaluation_collection, evaluate_gold_set
from tests.fakes import FakeEmbeddingClient, FakeQdrantIndexer
from fixtures.embedding_eval.gold_fixture import load_embedding_eval_gold_set


FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "embedding_eval" / "gold_set.fixture.json"


def test_evaluate_gold_set_uses_fixture_hits_for_metrics_and_provider_identity() -> None:
    gold_set = load_embedding_eval_gold_set(FIXTURE_PATH)
    qdrant = FakeQdrantIndexer(
        collection_search_hits={
            "eval_huggingface-sentence-transformers-all-minilm-l6-v2-384": [
                QdrantSearchHit(id="point-moonwell", score=0.91, payload={"document_id": "doc-moonwell"}),
                QdrantSearchHit(id="point-orb", score=0.72, payload={"document_id": "doc-glass-orb"}),
            ],
        }
    )
    embedding_client = FakeEmbeddingClient(dimensions=384, model="sentence-transformers/all-MiniLM-L6-v2")

    result = evaluate_gold_set(
        gold_set,
        embedding_client=embedding_client,
        qdrant_indexer=qdrant,
        provider="huggingface",
        collection_prefix="eval",
        top_k=2,
    )

    assert embedding_client.requests == [
        [
            "What item must be placed on the moonwell at dusk to restore spell slots?",
            "Which password opens the iron gate after a torch is put out?",
        ]
    ]
    assert qdrant.ensured_dimensions == [384]
    assert [request[2] for request in qdrant.search_requests] == [result.identity.collection, result.identity.collection]
    assert result.identity.provider == "huggingface"
    assert result.identity.model == "sentence-transformers/all-MiniLM-L6-v2"
    assert result.identity.dimensions == 384
    assert result.identity.collection == "eval_huggingface-sentence-transformers-all-minilm-l6-v2-384"
    assert result.metrics == {
        "hit_rate_at_1": 0.5,
        "hit_rate_at_top_k": 0.5,
        "mean_reciprocal_rank": 0.5,
    }
    assert [metric.query_id for metric in result.query_metrics] == ["query-moonwell-ritual", "query-gate-password"]
    assert result.query_metrics[0].retrieved_ids == ["doc-moonwell", "doc-glass-orb"]
    assert result.query_metrics[0].first_relevant_rank == 1
    assert result.query_metrics[1].first_relevant_rank is None


def test_evaluate_gold_set_computes_reciprocal_rank_when_expected_hit_is_not_first() -> None:
    gold_set = load_embedding_eval_gold_set(FIXTURE_PATH)
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="doc-hard-negative", score=0.99, payload={"document_id": "doc-glass-orb"}),
            QdrantSearchHit(id="doc-expected", score=0.88, payload={"document_id": "doc-moonwell"}),
        ]
    )

    result = evaluate_gold_set(
        gold_set,
        embedding_client=FakeEmbeddingClient(dimensions=4, model="deterministic-fixture"),
        qdrant_indexer=qdrant,
        provider="deterministic",
        collection_prefix="eval",
        top_k=2,
    )

    assert result.metrics == {
        "hit_rate_at_1": 0.0,
        "hit_rate_at_top_k": 0.5,
        "mean_reciprocal_rank": 0.25,
    }
    assert result.query_metrics[0].first_relevant_rank == 2


def test_derive_evaluation_collection_includes_sanitized_model_and_dimensions() -> None:
    collection = derive_evaluation_collection(
        "eval embeddings",
        "hf/local",
        "sentence-transformers/all-MiniLM-L6-v2",
        384,
    )

    assert collection == "eval-embeddings_hf-local-sentence-transformers-all-minilm-l6-v2-384"


def test_derive_evaluation_collection_rejects_shared_collection_without_identity() -> None:
    with pytest.raises(ValueError, match="provider, model, and dimensions"):
        _ = derive_evaluation_collection("eval", "", "", 0)


def test_evaluate_gold_set_fails_before_search_when_vector_dimensions_do_not_match_metadata() -> None:
    class MismatchedEmbeddingClient(FakeEmbeddingClient):
        @override
        def embed_texts(self, texts: Sequence[str]) -> EmbeddingBatch:
            return EmbeddingBatch(vectors=[[1.0], [2.0]], model="bad-dimensions", dimensions=2)

    gold_set = load_embedding_eval_gold_set(FIXTURE_PATH)
    qdrant = FakeQdrantIndexer()

    with pytest.raises(ValueError, match="vector dimensions"):
        _ = evaluate_gold_set(
            gold_set,
            embedding_client=MismatchedEmbeddingClient(),
            qdrant_indexer=qdrant,
            provider="deterministic",
            collection_prefix="eval",
            top_k=2,
        )

    assert qdrant.ensured_dimensions == [2]
    assert qdrant.search_requests == []
