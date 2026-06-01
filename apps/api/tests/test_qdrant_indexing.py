import json
from pathlib import Path

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.embeddings import OpenAIEmbeddingClient
from app.ingestion import deterministic_point_id, process_next_job
from app.models import DocumentChunk, IndexedChunk, IngestionEvent, IngestionJob
from app.qdrant_index import HttpQdrantIndexer, QdrantPoint
from tests.fakes import FakeEmbeddingClient, FakeQdrantIndexer
from tests.support import create_upload_and_job, db_session


def test_worker_embeds_indexes_and_completes_job(db_session: Session, tmp_path: Path) -> None:
    job = create_upload_and_job(db_session, tmp_path, "sample.md", "# Bestiary\nAncient red dragons prefer volcanic lairs.")
    embeddings = FakeEmbeddingClient(dimensions=5, model="mock-embedding")
    qdrant = FakeQdrantIndexer(collection="mock_chunks")

    processed = process_next_job(db_session, embedding_client=embeddings, qdrant_indexer=qdrant)

    assert processed is not None
    assert processed.status == "completed"
    assert processed.error_summary is None
    metadata = json.loads(processed.metadata_json)
    assert metadata["embedding_model"] == "mock-embedding"
    assert metadata["embedding_dimensions"] == 5
    assert metadata["qdrant_collection"] == "mock_chunks"
    assert metadata["indexed_chunk_count"] == 1

    chunks = db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).all()
    assert len(chunks) == 1
    assert embeddings.requests == [["Ancient red dragons prefer volcanic lairs."]]
    assert qdrant.ensured_dimensions == [5]
    assert len(qdrant.points) == 1
    assert qdrant.points[0].id == deterministic_point_id(chunks[0])
    assert qdrant.points[0].vector == [1.0] * 5
    assert qdrant.points[0].payload == {
        "source_id": chunks[0].upload_id,
        "chunk_id": chunks[0].id,
        "filename": "sample.md",
        "section": "Bestiary",
        "embedding_model": "mock-embedding",
        "embedding_dimensions": 5,
        "chunk_index": 0,
        "ingestion_job_id": job.id,
    }

    indexed = db_session.scalars(select(IndexedChunk).where(IndexedChunk.ingestion_job_id == job.id)).all()
    assert len(indexed) == 1
    assert indexed[0].document_chunk_id == chunks[0].id
    assert indexed[0].qdrant_point_id == qdrant.points[0].id
    assert indexed[0].embedding_model == "mock-embedding"
    assert indexed[0].embedding_dimensions == 5

    assert _event_types(db_session, job.id) == [
        "queued",
        "processing",
        "parsing_started",
        "parsing_completed",
        "chunking_started",
        "chunking_completed",
        "awaiting_embedding",
        "embedding_started",
        "embedding_completed",
        "indexing_started",
        "indexing_completed",
        "job_completed",
    ]


def test_qdrant_payload_includes_archive_locator_metadata(db_session: Session, tmp_path: Path) -> None:
    job = create_upload_and_job(
        db_session,
        tmp_path,
        "served.html",
        "<html><head><title>Archive</title></head><body><h1>Archive heading</h1><p>Safe archive quote.</p></body></html>",
        extension=".html",
        content_type="text/html",
    )
    job.metadata_json = json.dumps(
        {
            "source_id": "archive-source-qdrant",
            "source_type": "archived_webpage",
            "archive_manifest_path": str(tmp_path / "manifest.json"),
            "archive_entry_path": "page.html",
            "archive_served_entry_path": "page.html",
            "archive_anchor_map_path": "anchor-map.json",
            "source_url": "https://example.test/archive-source",
        }
    )
    (tmp_path / "anchor-map.json").write_text(
        json.dumps(
            {
                "source_id": "archive-source-qdrant",
                "source_path": "page.html",
                "anchors": [
                    {
                        "chunk_id": "archive-target-1",
                        "selector": '[data-source-chunk-id="archive-target-1"]',
                        "heading_path": ["Archive heading"],
                        "quote": "Safe archive quote.",
                        "source_path": "page.html",
                        "viewer_fragment": "#source-chunk-archive-target-1",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    qdrant = FakeQdrantIndexer(collection="mock_chunks")

    processed = process_next_job(db_session, embedding_client=FakeEmbeddingClient(dimensions=5), qdrant_indexer=qdrant)

    assert processed is not None
    assert processed.status == "completed"
    chunks = db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).all()
    assert len(chunks) == 1
    payload = qdrant.points[0].payload
    assert payload["chunk_id"] == chunks[0].id
    assert payload["archive_source_id"] == "archive-source-qdrant"
    assert payload["archive_entry_path"] == "page.html"
    assert payload["archive_served_entry_path"] == "page.html"
    assert payload["archive_manifest_path"] == str(tmp_path / "manifest.json")
    assert payload["target_chunk_id"] == "archive-target-1"
    assert payload["target_selector"] == '[data-source-chunk-id="archive-target-1"]'
    assert payload["viewer_fragment"] == "#source-chunk-archive-target-1"
    assert payload["quote"] == "Safe archive quote."
    assert payload["section_path"] == ["Archive heading"]
    assert payload["source_url"] == "https://example.test/archive-source"


def test_worker_embeds_and_indexes_epub_fixture(db_session: Session, tmp_path: Path) -> None:
    fixture = Path(__file__).resolve().parent / "fixtures" / "sample.epub"
    job = create_upload_and_job(
        db_session,
        tmp_path,
        "sample.epub",
        fixture.read_bytes(),
        extension=".epub",
        content_type="application/epub+zip",
    )
    embeddings = FakeEmbeddingClient(dimensions=5, model="mock-embedding")
    qdrant = FakeQdrantIndexer(collection="mock_chunks")

    processed = process_next_job(db_session, embedding_client=embeddings, qdrant_indexer=qdrant)

    assert processed is not None
    assert processed.status == "completed"
    metadata = json.loads(processed.metadata_json)
    assert metadata["parser"] == "epub"
    assert metadata["title"] == "Bestiary"
    assert metadata["indexed_chunk_count"] >= 1

    chunks = db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).all()
    assert len(chunks) >= 1
    assert embeddings.requests == [[chunk.content for chunk in chunks]]
    assert qdrant.ensured_dimensions == [5]
    assert len(qdrant.points) == len(chunks)


def test_worker_batches_openai_embeddings_for_large_jobs(db_session: Session, tmp_path: Path, monkeypatch) -> None:
    job = create_upload_and_job(
        db_session,
        tmp_path,
        "sample.md",
        "# One\na\n\n# Two\nb\n\n# Three\nc\n\n# Four\nd",
    )
    requests: list[list[str]] = []

    def fake_post(url: str, headers: dict[str, str], json: dict[str, object], timeout: int) -> httpx.Response:
        batch = list(json["input"])
        requests.append(batch)
        data = [
            {"index": index, "embedding": [float(ord(text[0]) - 96)] * 3}
            for index, text in reversed(list(enumerate(batch)))
        ]
        return httpx.Response(200, request=httpx.Request("POST", url), json={"data": data})

    monkeypatch.setattr("app.embeddings.OPENAI_EMBEDDING_REQUEST_TOKEN_LIMIT", 3)
    monkeypatch.setattr(httpx, "post", fake_post)
    embeddings = OpenAIEmbeddingClient(
        Settings(OPENAI_API_KEY="test-key", OPENAI_EMBEDDING_MODEL="mock-embedding", OPENAI_EMBEDDING_DIMENSIONS=3)
    )
    qdrant = FakeQdrantIndexer(collection="mock_chunks")

    processed = process_next_job(db_session, embedding_client=embeddings, qdrant_indexer=qdrant)

    assert processed is not None
    assert processed.status == "completed"
    assert requests == [["a", "b", "c"], ["d"]]
    assert len(qdrant.points) == 4


def test_http_qdrant_indexer_batches_large_upserts(monkeypatch) -> None:
    calls: list[dict[str, object]] = []

    def fake_put(url: str, json: dict[str, object], timeout: int) -> httpx.Response:
        points = list(json["points"])
        calls.append({"url": url, "points": points, "timeout": timeout})
        return httpx.Response(200, request=httpx.Request("PUT", url), json={"result": {"status": "ok"}})

    monkeypatch.setattr(httpx, "put", fake_put)
    indexer = HttpQdrantIndexer(Settings(QDRANT_URL="http://qdrant.local", QDRANT_COLLECTION="monster_manual"))
    points = [
        QdrantPoint(id=str(index), vector=[float(index)], payload={"chunk_index": index, "source_id": "upload-1"})
        for index in range(101)
    ]

    indexer.upsert_points(points)

    assert [call["url"] for call in calls] == [
        "http://qdrant.local/collections/monster_manual/points?wait=true",
        "http://qdrant.local/collections/monster_manual/points?wait=true",
        "http://qdrant.local/collections/monster_manual/points?wait=true",
        "http://qdrant.local/collections/monster_manual/points?wait=true",
        "http://qdrant.local/collections/monster_manual/points?wait=true",
    ]
    assert [len(call["points"]) for call in calls] == [25, 25, 25, 25, 1]
    assert [point["id"] for call in calls for point in call["points"]] == [str(index) for index in range(101)]
    assert [point["payload"] for call in calls for point in call["points"]] == [
        {"chunk_index": index, "source_id": "upload-1"} for index in range(101)
    ]
    assert all(call["timeout"] == 120 for call in calls)


def test_qdrant_failure_marks_job_failed_without_silencing_error(db_session: Session, tmp_path: Path) -> None:
    class FailingQdrantIndexer(FakeQdrantIndexer):
        def upsert_points(self, points):
            raise RuntimeError("qdrant unavailable")

    job = create_upload_and_job(db_session, tmp_path, "sample.md", "# Hooks\nA trap door opens.")

    processed = process_next_job(
        db_session,
        embedding_client=FakeEmbeddingClient(dimensions=2),
        qdrant_indexer=FailingQdrantIndexer(),
    )

    assert processed is not None
    assert processed.status == "failed"
    assert processed.error_summary == "qdrant unavailable"
    assert db_session.scalars(select(IndexedChunk).where(IndexedChunk.ingestion_job_id == job.id)).all() == []
    assert _event_types(db_session, job.id)[-1] == "job_failed"


def test_worker_resumes_existing_awaiting_embedding_job(db_session: Session, tmp_path: Path) -> None:
    job = create_upload_and_job(db_session, tmp_path, "sample.md", "# NPCs\nThe innkeeper knows three secrets.")
    first_pass = process_next_job(db_session, embedding_client=FakeEmbeddingClient(), qdrant_indexer=FakeQdrantIndexer())
    assert first_pass is not None
    first_pass.status = "awaiting_embedding"
    db_session.query(IndexedChunk).delete()
    db_session.commit()

    second_pass = process_next_job(db_session, embedding_client=FakeEmbeddingClient(), qdrant_indexer=FakeQdrantIndexer())

    assert second_pass is not None
    assert second_pass.id == job.id
    assert second_pass.status == "completed"


def _event_types(db: Session, job_id: str) -> list[str]:
    events = db.scalars(
        select(IngestionEvent).where(IngestionEvent.ingestion_job_id == job_id).order_by(IngestionEvent.created_at)
    ).all()
    return [event.event_type for event in events]
