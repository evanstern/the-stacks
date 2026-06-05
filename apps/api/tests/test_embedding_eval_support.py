# pyright: reportMissingImports=false, reportMissingParameterType=false, reportUnknownMemberType=false, reportUnknownParameterType=false, reportUnknownVariableType=false

import pytest

from embedding_eval_support import (
    collection_identity,
    evaluate_with_fake_provider,
    rank_fixture_with_vectors,
    validate_embedding_dimensions,
)


def test_rank_fixture_with_vectors_calculates_expected_hit_metrics() -> None:
    result = rank_fixture_with_vectors(
        document_vectors=[
            [1.0, 0.0],
            [0.0, 1.0],
            [0.8, 0.2],
        ],
        query_vectors=[
            [0.7, 0.3],
            [1.0, 0.0],
        ],
        top_k=2,
    )

    assert result.metrics == {
        "hit_rate_at_1": 0.0,
        "hit_rate_at_top_k": 0.5,
        "mean_reciprocal_rank": 0.416667,
    }
    assert result.queries[0]["expected_document_ids"] == ["goblin-map"]
    assert result.queries[0]["first_relevant_rank"] == 2
    assert result.queries[0]["hit_at_top_k"] is True
    assert result.queries[1]["expected_document_ids"] == ["healing-potion"]
    assert result.queries[1]["first_relevant_rank"] == 3
    assert result.queries[1]["hit_at_top_k"] is False


def test_collection_identity_is_provider_model_dimension_scoped() -> None:
    collection = collection_identity(
        "eval",
        "huggingface",
        "sentence-transformers/all-MiniLM-L6-v2",
        384,
    )

    assert collection == "eval_huggingface-sentence-transformers_all-minilm-l6-v2-384_d262389f"
    assert collection != "eval"
    assert "384" in collection


def test_validate_embedding_dimensions_rejects_mismatched_vector_lengths(capsys) -> None:
    with pytest.raises(SystemExit) as exc_info:
        validate_embedding_dimensions([[1.0, 0.0], [0.0]], dimensions=2, expected_count=2)

    assert exc_info.value.code == 1
    assert "embeddings embedding index=1 dimensions=1, expected 2" in capsys.readouterr().err


def test_evaluate_with_fake_provider_preserves_identity_and_ensures_collection(monkeypatch) -> None:
    result, ensured, settings_seen = evaluate_with_fake_provider(
        monkeypatch=monkeypatch,
        document_vectors=[
            [1.0, 0.0],
            [0.0, 1.0],
            [0.8, 0.2],
        ],
        query_vectors=[
            [1.0, 0.0],
            [0.0, 1.0],
        ],
        provider="huggingface",
        model="sentence-transformers/test-model",
        dimensions=2,
    )

    expected_collection = "eval_huggingface-sentence-transformers_test-model-2_6f7e6f72"
    assert result.identity == {
        "collection": expected_collection,
        "dimensions": 2,
        "model": "sentence-transformers/test-model",
        "provider": "huggingface",
        "provider_spec": "huggingface:sentence-transformers/test-model:2",
    }
    assert result.metrics == {"hit_rate_at_1": 1.0, "hit_rate_at_top_k": 1.0, "mean_reciprocal_rank": 1.0}
    assert settings_seen == [{"QDRANT_URL": "http://qdrant.test", "QDRANT_COLLECTION": expected_collection}]
    assert ensured == [(expected_collection, 2)]
