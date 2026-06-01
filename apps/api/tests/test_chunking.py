from app.ingestion import ParsedDocument, ParsedSection, chunk_document
from app.models import IngestionJob, Upload


def test_chunk_document_adds_retrieval_metadata() -> None:
    upload = Upload(
        id="upload-1",
        original_filename="dragons.md",
        stored_path="/data/uploads/upload-1.md",
        content_type="text/markdown",
        extension=".md",
        sha256="abc123",
        size_bytes=42,
    )
    job = IngestionJob(id="job-1", upload_id="upload-1", status="chunking")
    document = ParsedDocument(
        parser="markdown",
        title="Dragons",
        sections=[ParsedSection(heading="Lairs", text="Ancient red dragons prefer volcanic lairs.", start_char=10, end_char=52)],
    )

    chunks = chunk_document(document, upload, job)

    assert len(chunks) == 1
    assert chunks[0].content == "Ancient red dragons prefer volcanic lairs."
    assert chunks[0].metadata == {
        "upload_id": "upload-1",
        "job_id": "job-1",
        "source_filename": "dragons.md",
        "source_sha256": "abc123",
        "source_extension": ".md",
        "parser": "markdown",
        "title": "Dragons",
        "section_heading": "Lairs",
        "start_char": 10,
        "end_char": 52,
        "token_count_estimate": 6,
    }


def test_chunk_document_splits_long_sections_with_stable_indices() -> None:
    upload = Upload(
        id="upload-1",
        original_filename="long.txt",
        stored_path="/data/uploads/upload-1.txt",
        content_type="text/plain",
        extension=".txt",
        sha256="abc123",
        size_bytes=2600,
    )
    job = IngestionJob(id="job-1", upload_id="upload-1", status="chunking")
    text = " ".join(["dragon"] * 500)
    document = ParsedDocument(parser="text", title=None, sections=[ParsedSection(None, text, 0, len(text))])

    chunks = chunk_document(document, upload, job)

    assert len(chunks) > 1
    assert all(len(chunk.content) <= 1200 for chunk in chunks)
    assert chunks[0].metadata["start_char"] == 0
    assert chunks[-1].metadata["end_char"] == len(text)
