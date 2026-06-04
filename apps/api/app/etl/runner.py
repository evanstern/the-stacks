from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Generic, TypeVar

from sqlalchemy.orm import Session

from app.models import IngestionJob, Upload

from .contracts import LoaderIntent, NormalizedDocument, PluginFailure, PluginResult, SourcePlugin, TransformerPlugin
from .load_services import ChunkLike, ParsedDocumentLike, PostgresLoadResult, PostgresLoadService


ParsedDocumentT = TypeVar("ParsedDocumentT", bound=ParsedDocumentLike)
ChunkT = TypeVar("ChunkT", bound=ChunkLike)


class EtlRunnerError(RuntimeError):
    pass


class EtlPluginFailure(EtlRunnerError):
    def __init__(self, failure: PluginFailure) -> None:
        super().__init__(failure.message)
        self.failure: PluginFailure = failure


class EtlPluginUnexpectedError(EtlRunnerError):
    pass


class EtlEmptyOutputError(EtlRunnerError):
    pass


@dataclass(frozen=True)
class SequentialEtlState(Generic[ParsedDocumentT, ChunkT]):
    source_path: Path
    source_metadata: Mapping[str, object]
    plugin_name: str | None = None
    document: NormalizedDocument | None = None
    loader_intents: tuple[LoaderIntent, ...] = ()
    warnings: tuple[str, ...] = ()
    parsed_document: ParsedDocumentT | None = None
    chunks: tuple[ChunkT, ...] = ()
    load_result: PostgresLoadResult | None = None
    failure: PluginFailure | None = None
    stage: str = "initialized"
    history: tuple[str, ...] = field(default_factory=lambda: ("initialized",))

    def advance(self, stage: str, **updates: object) -> SequentialEtlState[ParsedDocumentT, ChunkT]:
        return replace(self, stage=stage, history=(*self.history, stage), **updates)


class DirectSequentialEtlRunner(Generic[ParsedDocumentT, ChunkT]):
    def __init__(
        self,
        *,
        extractor: SourcePlugin,
        document_adapter: Callable[[NormalizedDocument], ParsedDocumentT],
        chunker: Callable[[ParsedDocumentT, Upload, IngestionJob], Sequence[ChunkT]],
        postgres_load_service: PostgresLoadService | None = None,
        transformers: Sequence[TransformerPlugin] = (),
        passthrough_exception_types: tuple[type[BaseException], ...] = (),
    ) -> None:
        self.extractor: SourcePlugin = extractor
        self.document_adapter: Callable[[NormalizedDocument], ParsedDocumentT] = document_adapter
        self.chunker: Callable[[ParsedDocumentT, Upload, IngestionJob], Sequence[ChunkT]] = chunker
        self.postgres_load_service: PostgresLoadService = postgres_load_service or PostgresLoadService()
        self.transformers: tuple[TransformerPlugin, ...] = tuple(transformers)
        self.passthrough_exception_types: tuple[type[BaseException], ...] = passthrough_exception_types

    def run(
        self,
        db: Session,
        *,
        job: IngestionJob,
        upload: Upload,
        source_path: Path,
        source_metadata: Mapping[str, object] | None = None,
    ) -> SequentialEtlState[ParsedDocumentT, ChunkT]:
        metadata = dict(source_metadata or {})
        state: SequentialEtlState[ParsedDocumentT, ChunkT] = SequentialEtlState(
            source_path=source_path,
            source_metadata=metadata,
            plugin_name=self.extractor.metadata.name,
        ).advance("extracting")

        try:
            result = self.extractor.extract(source_path, metadata)
        except self.passthrough_exception_types:
            raise
        except EtlRunnerError:
            raise
        except Exception as exc:
            raise EtlPluginUnexpectedError(str(exc) or type(exc).__name__) from exc

        state = self._apply_plugin_result(state, result)
        document = state.document
        if document is None:
            raise EtlEmptyOutputError("Extractor produced no document")

        for transformer in self.transformers:
            state = state.advance("transforming", plugin_name=transformer.metadata.name)
            try:
                document = transformer.transform(document)
            except ValueError as exc:
                if "at least one non-empty section" in str(exc):
                    raise EtlEmptyOutputError("Transformer produced no sections") from exc
                raise EtlPluginUnexpectedError(str(exc) or type(exc).__name__) from exc
            except Exception as exc:
                raise EtlPluginUnexpectedError(str(exc) or type(exc).__name__) from exc
            if not document.sections:
                raise EtlEmptyOutputError("Transformer produced no sections")
        state = state.advance("transformed", document=document)

        parsed_document = self.document_adapter(document)
        state = state.advance("chunking", parsed_document=parsed_document)
        chunks = tuple(self.chunker(parsed_document, upload, job))
        if not chunks:
            raise EtlEmptyOutputError("ETL runner produced no chunks")
        state = state.advance("chunked", chunks=chunks)

        load_metadata = {**dict(document.metadata), **metadata}
        load_result = self.postgres_load_service.persist_document(
            db,
            job=job,
            upload=upload,
            document=parsed_document,
            chunks=chunks,
            job_metadata=load_metadata,
        )
        return state.advance("loaded", load_result=load_result)

    def _apply_plugin_result(
        self,
        state: SequentialEtlState[ParsedDocumentT, ChunkT],
        result: PluginResult,
    ) -> SequentialEtlState[ParsedDocumentT, ChunkT]:
        if result.failure is not None:
            state = state.advance("failed", failure=result.failure, warnings=result.warnings)
            raise EtlPluginFailure(result.failure)
        if result.document is None:
            raise EtlEmptyOutputError("Extractor produced no document")
        return state.advance(
            "extracted",
            document=result.document,
            loader_intents=result.loader_intents,
            warnings=(*result.document.warnings, *result.warnings),
        )
