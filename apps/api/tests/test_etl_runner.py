from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any, cast, override

import pytest

from app.etl.contracts import (
    NormalizedDocument,
    NormalizedSection,
    PluginFailure,
    PluginFailureCategory,
    PluginMetadata,
    PluginResult,
    SourcePlugin,
    TransformerPlugin,
)
from app.etl.load_services import PostgresLoadResult, PostgresLoadService
from app.etl.runner import DirectSequentialEtlRunner, EtlEmptyOutputError, EtlPluginFailure, EtlPluginUnexpectedError
from app.ingestion import Chunk, ParsedDocument, ParsedSection
from app.models import IngestionJob, Upload


class FakeSourcePlugin(SourcePlugin):
    metadata: PluginMetadata = PluginMetadata(name="fake_source", version="1.0.0", source_types=("fake",))

    def __init__(self, result: PluginResult | None = None, error: Exception | None = None) -> None:
        self.result: PluginResult = result or PluginResult(document=_document())
        self.error: Exception | None = error
        self.calls: list[tuple[Path, dict[str, object]]] = []

    @override
    def extract(self, source_path: Path, source_metadata: Mapping[str, object] | None = None) -> PluginResult:
        self.calls.append((source_path, dict(source_metadata or {})))
        if self.error is not None:
            raise self.error
        return self.result


class EmptyTransformer(TransformerPlugin):
    metadata: PluginMetadata = PluginMetadata(name="empty_transformer", version="1.0.0", source_types=("fake",))

    @override
    def transform(self, document: NormalizedDocument) -> NormalizedDocument:
        del document
        return NormalizedDocument(source_type="fake", parser="empty_transformer", sections=(NormalizedSection(text=" "),))


class RecordingLoadService(PostgresLoadService):
    def __init__(self, error: Exception | None = None) -> None:
        self.error: Exception | None = error
        self.calls: list[tuple[object, tuple[object, ...], dict[str, object]]] = []

    @override
    def persist_document(
        self,
        db: Any,
        *,
        job: IngestionJob,
        upload: Upload,
        document: object,
        chunks: Sequence[object],
        job_metadata: dict[str, object],
    ) -> PostgresLoadResult:
        del db, job, upload
        if self.error is not None:
            raise self.error
        chunk_tuple = tuple(chunks)
        self.calls.append((document, chunk_tuple, dict(job_metadata)))
        return PostgresLoadResult(source=cast(Any, object()), document=cast(Any, object()), chunks=cast(Any, list(chunk_tuple)))


def test_direct_runner_success_returns_explicit_state() -> None:
    source = FakeSourcePlugin()
    load_service = RecordingLoadService()
    runner = DirectSequentialEtlRunner(
        extractor=source,
        document_adapter=_to_parsed_document,
        chunker=_chunk_document,
        postgres_load_service=load_service,
    )

    state = runner.run(
        cast(Any, None),
        job=_fake_job(),
        upload=_fake_upload(),
        source_path=Path("source.md"),
        source_metadata={"source_id": "fake-source"},
    )

    assert state.stage == "loaded"
    assert state.history == ("initialized", "extracting", "extracted", "transformed", "chunking", "chunked", "loaded")
    assert source.calls == [(Path("source.md"), {"source_id": "fake-source"})]
    assert state.parsed_document is not None
    assert state.parsed_document.parser == "fake_parser"
    assert [chunk.content for chunk in state.chunks] == ["Fake text"]
    assert len(load_service.calls) == 1
    assert load_service.calls[0][2]["source_id"] == "fake-source"
    assert load_service.calls[0][2]["source_type"] == "fake"


def test_direct_runner_typed_plugin_failure_is_distinct() -> None:
    failure = PluginFailure(category=PluginFailureCategory.PARSE_ERROR, message="typed failure")
    runner = DirectSequentialEtlRunner(
        extractor=FakeSourcePlugin(result=PluginResult(failure=failure)),
        document_adapter=_to_parsed_document,
        chunker=_chunk_document,
        postgres_load_service=RecordingLoadService(),
    )

    with pytest.raises(EtlPluginFailure) as exc_info:
        _ = runner.run(cast(Any, None), job=_fake_job(), upload=_fake_upload(), source_path=Path("source.md"))

    assert exc_info.value.failure is failure


def test_direct_runner_unexpected_plugin_exception_is_distinct() -> None:
    runner = DirectSequentialEtlRunner(
        extractor=FakeSourcePlugin(error=RuntimeError("boom")),
        document_adapter=_to_parsed_document,
        chunker=_chunk_document,
        postgres_load_service=RecordingLoadService(),
    )

    with pytest.raises(EtlPluginUnexpectedError, match="boom"):
        _ = runner.run(cast(Any, None), job=_fake_job(), upload=_fake_upload(), source_path=Path("source.md"))


def test_direct_runner_empty_transform_output_is_deterministic() -> None:
    load_service = RecordingLoadService()
    runner = DirectSequentialEtlRunner(
        extractor=FakeSourcePlugin(),
        transformers=(EmptyTransformer(),),
        document_adapter=_to_parsed_document,
        chunker=_chunk_document,
        postgres_load_service=load_service,
    )

    with pytest.raises(EtlEmptyOutputError, match="Transformer produced no sections"):
        _ = runner.run(cast(Any, None), job=_fake_job(), upload=_fake_upload(), source_path=Path("source.md"))
    assert load_service.calls == []


def test_direct_runner_load_failure_propagates() -> None:
    runner = DirectSequentialEtlRunner(
        extractor=FakeSourcePlugin(),
        document_adapter=_to_parsed_document,
        chunker=_chunk_document,
        postgres_load_service=RecordingLoadService(error=RuntimeError("load failed")),
    )

    with pytest.raises(RuntimeError, match="load failed"):
        _ = runner.run(cast(Any, None), job=_fake_job(), upload=_fake_upload(), source_path=Path("source.md"))


def _document() -> NormalizedDocument:
    return NormalizedDocument(
        source_type="fake",
        parser="fake_parser",
        title="Fake title",
        sections=(NormalizedSection(text="Fake text", heading="Fake heading"),),
    )


def _to_parsed_document(document: NormalizedDocument) -> ParsedDocument:
    return ParsedDocument(
        parser=document.parser,
        title=document.title,
        sections=[
            ParsedSection(
                heading=section.heading,
                text=section.text,
                start_char=section.start_char,
                end_char=int(section.end_char or section.start_char + len(section.text)),
                metadata=dict(section.metadata),
            )
            for section in document.sections
        ],
        warnings=list(document.warnings),
        metadata=dict(document.metadata),
    )


def _chunk_document(document: ParsedDocument, upload: object, job: object) -> Sequence[Chunk]:
    del upload, job
    return tuple(Chunk(content=section.text, metadata={"section_heading": section.heading}) for section in document.sections)


def _fake_job() -> IngestionJob:
    return cast(IngestionJob, object())


def _fake_upload() -> Upload:
    return cast(Upload, object())
