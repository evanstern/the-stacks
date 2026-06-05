from pathlib import Path

from fixtures.embedding_eval.gold_fixture import load_embedding_eval_gold_set


FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "embedding_eval" / "gold_set.fixture.json"


def test_embedding_eval_gold_fixture_loads_with_explicit_hits_and_hard_negatives() -> None:
    gold_set = load_embedding_eval_gold_set(FIXTURE_PATH)
    document_ids = {document["id"] for document in gold_set["documents"]}

    assert gold_set["schema_version"] == 1
    assert gold_set["corpus_id"] == "tiny-embedding-eval-gold-v1"
    assert [document["id"] for document in gold_set["documents"]] == [
        "doc-moonwell",
        "doc-iron-gate",
        "doc-river-market",
        "doc-glass-orb",
    ]
    assert [query["id"] for query in gold_set["queries"]] == ["query-moonwell-ritual", "query-gate-password"]

    for query in gold_set["queries"]:
        assert query["expected_hits"]
        assert query["hard_negatives"]
        assert set(query["expected_hits"]).issubset(document_ids)
        assert set(query["hard_negatives"]).issubset(document_ids)
        assert set(query["expected_hits"]).isdisjoint(query["hard_negatives"])


def test_embedding_eval_gold_fixture_keeps_hard_negative_explicit() -> None:
    gold_set = load_embedding_eval_gold_set(FIXTURE_PATH)

    assert gold_set["queries"][0]["expected_hits"] == ["doc-moonwell"]
    assert gold_set["queries"][0]["hard_negatives"] == ["doc-glass-orb"]
    assert gold_set["queries"][1]["expected_hits"] == ["doc-iron-gate"]
    assert gold_set["queries"][1]["hard_negatives"] == ["doc-river-market"]
