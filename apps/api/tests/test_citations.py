import os
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from app.chat_session_rag import NO_EVIDENCE_RESPONSE, answer_session_message, message_citations
from app.config import Settings
from app.models import Citation, RetrievalRun
from app.qdrant_index import QdrantSearchHit
from tests.fakes import FakeEmbeddingClient, FakeQdrantIndexer
from tests.rag_support import CapturingGraphInvoker, FakeChatClient, create_indexed_chunk, create_session
from tests.support import db_session


def test_only_valid_retrieved_chunk_ids_become_citations(db_session: Session) -> None:
    session = create_session(db_session)
    first_chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs.", filename="first.md")
    second_chunk = create_indexed_chunk(db_session, "Ancient red dragons hoard treasure obsessively.", filename="second.md")
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.92, payload={"chunk_id": first_chunk.id}),
            QdrantSearchHit(id="point-2", score=0.88, payload={"chunk_id": second_chunk.id}),
        ]
    )
    chat = FakeChatClient(
        "Ancient red dragons prefer volcanic lairs [1] and hoard treasure obsessively [2].",
        [second_chunk.id, first_chunk.id, "invented-chunk"],
    )

    assistant = answer_session_message(
        db_session,
        session.id,
        "Where do Ancient red dragons lair?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=CapturingGraphInvoker(chat),
        settings=Settings(RETRIEVAL_MIN_SCORE=0.2),
    )

    citations = db_session.scalars(select(Citation).where(Citation.assistant_message_id == assistant.id)).all()
    persisted_citations = message_citations(db_session, assistant.id)

    assert [citation.document_chunk_id for citation in citations] == [first_chunk.id, second_chunk.id]
    assert [citation.label for citation in persisted_citations] == ["[1]", "[2]"]
    assert [citation.document_chunk_id for citation in persisted_citations] == [first_chunk.id, second_chunk.id]
    assert [json.loads(citation.metadata_json)["cited_text"] for citation in citations] == [
        "Ancient red dragons prefer volcanic lairs.",
        "Ancient red dragons hoard treasure obsessively.",
    ]
    assert json.loads(citations[0].metadata_json)["cited_text"] == "Ancient red dragons prefer volcanic lairs."
    assert json.loads(citations[1].metadata_json)["cited_text"] == "Ancient red dragons hoard treasure obsessively."
    assert json.loads(citations[0].metadata_json)["source_filename"] == "first.md"


def test_invalid_only_citations_fall_back_to_no_evidence(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs.")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.88, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("This answer cites something unavailable. [1]", ["invented-chunk"])

    assistant = answer_session_message(
        db_session,
        session.id,
        "Where do Ancient red dragons lair?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=CapturingGraphInvoker(chat),
        settings=Settings(RETRIEVAL_MIN_SCORE=0.2),
    )

    assert assistant.content == NO_EVIDENCE_RESPONSE
    assert "[" not in assistant.content
    assert db_session.scalars(select(Citation).where(Citation.assistant_message_id == assistant.id)).all() == []
    run = db_session.scalars(select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)).one()
    assert run.status == "no_evidence"


def test_chunk_id_prefixed_citations_are_normalized(db_session: Session) -> None:
    session = create_session(db_session)
    first_chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs.", filename="first.md")
    second_chunk = create_indexed_chunk(db_session, "Ancient red dragons hoard treasure obsessively.", filename="second.md")
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.92, payload={"chunk_id": first_chunk.id}),
            QdrantSearchHit(id="point-2", score=0.88, payload={"chunk_id": second_chunk.id}),
        ]
    )
    chat = FakeChatClient(
        "Ancient red dragons prefer volcanic lairs. [1] Ancient red dragons hoard treasure obsessively. [2]",
        [f"chunk_id={first_chunk.id}", f"chunk_id={second_chunk.id}"],
    )

    assistant = answer_session_message(
        db_session,
        session.id,
        "Where do Ancient red dragons lair?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=CapturingGraphInvoker(chat),
        settings=Settings(RETRIEVAL_MIN_SCORE=0.2),
    )

    citations = db_session.scalars(select(Citation).where(Citation.assistant_message_id == assistant.id)).all()

    assert assistant.content == "Ancient red dragons prefer volcanic lairs. [1] Ancient red dragons hoard treasure obsessively. [2]"
    assert [citation.document_chunk_id for citation in citations] == [first_chunk.id, second_chunk.id]
    assert [citation.label for citation in citations] == ["[1]", "[2]"]


def test_hash_style_answer_markers_are_rewritten_for_unique_cited_chunk_prefixes(db_session: Session) -> None:
    session = create_session(db_session)
    first_chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs.", filename="first.md")
    second_chunk = create_indexed_chunk(db_session, "Ancient red dragons hoard treasure obsessively.", filename="second.md")
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.92, payload={"chunk_id": first_chunk.id}),
            QdrantSearchHit(id="point-2", score=0.88, payload={"chunk_id": second_chunk.id}),
        ]
    )
    chat = FakeChatClient(
        f"Ancient red dragons prefer volcanic lairs. [{first_chunk.id[:8]}] Ancient red dragons hoard treasure obsessively. [{second_chunk.id[:8]}]",
        [first_chunk.id, second_chunk.id],
    )

    assistant = answer_session_message(
        db_session,
        session.id,
        "Where do Ancient red dragons lair?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=CapturingGraphInvoker(chat),
        settings=Settings(RETRIEVAL_MIN_SCORE=0.2),
    )

    citations = db_session.scalars(select(Citation).where(Citation.assistant_message_id == assistant.id)).all()

    assert assistant.content == "Ancient red dragons prefer volcanic lairs. [1] Ancient red dragons hoard treasure obsessively. [2]"
    assert [citation.document_chunk_id for citation in citations] == [first_chunk.id, second_chunk.id]
    assert [citation.label for citation in citations] == ["[1]", "[2]"]

def test_numeric_markers_select_subset_of_retrieved_contexts(db_session: Session) -> None:
    session = create_session(db_session)
    first_chunk = create_indexed_chunk(db_session, "Magic item auctions are hard to find.", filename="first.md")
    second_chunk = create_indexed_chunk(db_session, "Magic items can be identified with careful study.", filename="second.md")
    third_chunk = create_indexed_chunk(db_session, "Magic items include armor, potions, and wands.", filename="third.md")
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.92, payload={"chunk_id": first_chunk.id}),
            QdrantSearchHit(id="point-2", score=0.91, payload={"chunk_id": second_chunk.id}),
            QdrantSearchHit(id="point-3", score=0.9, payload={"chunk_id": third_chunk.id}),
        ]
    )
    chat = FakeChatClient(
        "Magic items include armor, potions, and wands. [3] Magic item auctions are hard to find. [1]",
        [third_chunk.id, first_chunk.id],
    )

    assistant = answer_session_message(
        db_session,
        session.id,
        "What are magic items?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=CapturingGraphInvoker(chat),
        settings=Settings(RETRIEVAL_TOP_K=3, RETRIEVAL_MIN_SCORE=0.2),
    )

    citations = db_session.scalars(select(Citation).where(Citation.assistant_message_id == assistant.id)).all()

    assert assistant.content == "Magic items include armor, potions, and wands. [1] Magic item auctions are hard to find. [2]"
    assert [citation.document_chunk_id for citation in citations] == [third_chunk.id, first_chunk.id]
    assert [citation.label for citation in citations] == ["[1]", "[2]"]


def test_zero_based_numeric_markers_select_retrieved_contexts(db_session: Session) -> None:
    session = create_session(db_session)
    chunks = [
        create_indexed_chunk(db_session, f"Goblin fact {index}.", filename=f"goblin-{index}.md")
        for index in range(8)
    ]
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id=f"point-{index}", score=0.95 - (index * 0.01), payload={"chunk_id": chunk.id})
            for index, chunk in enumerate(chunks)
        ]
    )
    chat = FakeChatClient(
        "Goblins are reckless. [0] Goblins serve disruptive leaders. [1] Goblins can aid conquest. [2][6][7]",
        [chunks[0].id, chunks[1].id, chunks[5].id, chunks[3].id],
    )

    assistant = answer_session_message(
        db_session,
        session.id,
        "What can you tell me about goblins?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=CapturingGraphInvoker(chat),
        settings=Settings(RETRIEVAL_TOP_K=8, RETRIEVAL_MIN_SCORE=0.2),
    )

    citations = db_session.scalars(select(Citation).where(Citation.assistant_message_id == assistant.id)).all()

    assert assistant.content == "Goblins are reckless. [1] Goblins serve disruptive leaders. [1] Goblins can aid conquest. [2][3][4]"
    assert [citation.document_chunk_id for citation in citations] == [
        chunks[0].id,
        chunks[1].id,
        chunks[5].id,
        chunks[6].id,
    ]
    assert [citation.label for citation in citations] == ["[1]", "[2]", "[3]", "[4]"]


def test_markerless_answer_appends_valid_json_citations(db_session: Session) -> None:
    session = create_session(db_session)
    first_chunk = create_indexed_chunk(db_session, "Goblins delight in chaos.", filename="first.md")
    second_chunk = create_indexed_chunk(db_session, "Goblin bosses lead through disruption.", filename="second.md")
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.92, payload={"chunk_id": first_chunk.id}),
            QdrantSearchHit(id="point-2", score=0.91, payload={"chunk_id": second_chunk.id}),
        ]
    )
    chat = FakeChatClient("Goblins are disruptive tricksters who follow bold leaders.", [first_chunk.id, second_chunk.id])

    assistant = answer_session_message(
        db_session,
        session.id,
        "What can you tell me about goblins?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=CapturingGraphInvoker(chat),
        settings=Settings(RETRIEVAL_TOP_K=2, RETRIEVAL_MIN_SCORE=0.2),
    )

    citations = db_session.scalars(select(Citation).where(Citation.assistant_message_id == assistant.id)).all()

    assert assistant.content == "Goblins are disruptive tricksters who follow bold leaders. [1][2]"
    assert [citation.document_chunk_id for citation in citations] == [first_chunk.id, second_chunk.id]
    assert [citation.label for citation in citations] == ["[1]", "[2]"]
