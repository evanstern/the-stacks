# pyright: reportMissingImports=false, reportUnknownArgumentType=false, reportUnknownMemberType=false, reportUnknownVariableType=false

from embedding_eval_support import FIXTURE_PATH, load_gold_fixture


def test_embedding_eval_fixture_loads_with_expected_hits() -> None:
    fixture = load_gold_fixture(FIXTURE_PATH)
    documents = fixture["documents"]
    queries = fixture["queries"]
    assert isinstance(documents, list)
    assert isinstance(queries, list)
    document_ids = {document["id"] for document in documents}

    assert fixture["schema_version"] == 1
    assert fixture["name"] == "embedding-eval-smoke"
    assert [document["id"] for document in documents] == ["goblin-map", "healing-potion", "winter-rations"]
    assert [query["id"] for query in queries] == ["find-mapmaker", "find-healing"]
    assert [query["relevant_document_ids"] for query in queries] == [["goblin-map"], ["healing-potion"]]

    for query in queries:
        assert query["relevant_document_ids"]
        assert set(query["relevant_document_ids"]).issubset(document_ids)


def test_embedding_eval_fixture_keeps_documents_and_queries_deterministic() -> None:
    first = load_gold_fixture(FIXTURE_PATH)
    second = load_gold_fixture(FIXTURE_PATH)

    assert first == second
    assert first["documents"][0]["text"].startswith("A goblin cartographer")
    assert first["queries"][1]["text"] == "Which note describes a potion that helps after a fight?"
