import json
from pathlib import Path
from typing import TypedDict, cast


class GoldDocument(TypedDict):
    id: str
    title: str
    text: str


class GoldQuery(TypedDict):
    id: str
    text: str
    expected_hits: list[str]
    hard_negatives: list[str]


class EmbeddingEvalGoldSet(TypedDict):
    schema_version: int
    corpus_id: str
    documents: list[GoldDocument]
    queries: list[GoldQuery]


FIXTURE_PATH = Path(__file__).with_name("gold_set.fixture.json")


def load_embedding_eval_gold_set(path: Path = FIXTURE_PATH) -> EmbeddingEvalGoldSet:
    return cast(EmbeddingEvalGoldSet, json.loads(path.read_text(encoding="utf-8")))
