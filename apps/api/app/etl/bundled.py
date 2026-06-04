from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path
from typing import cast, override

from ..ddb_import import DDB_PARSER, is_ddb_saved_html, parse_ddb_saved_html
from .contracts import (
    PluginCapability,
    PluginFailure,
    PluginFailureCategory,
    PluginMetadata,
    PluginRegistry,
    PluginResult,
    SourcePlugin,
    loader_intents_for_document,
)
from .ingestion_compat import normalized_document_from_parsed
from ..ingestion import ParsedDocument, _parse_archived_webpage_html, _parse_html  # pyright: ignore[reportPrivateUsage]


class DdbSavedHtmlPlugin(SourcePlugin):
    metadata: PluginMetadata = PluginMetadata(
        name="ddb_saved_html",
        version="1.0.0",
        capabilities=(PluginCapability.EXTRACT, PluginCapability.LOAD_INTENT),
        source_types=("ddb_saved_html",),
        description="Parse saved D&D Beyond HTML into normalized sections and host-owned loader intents.",
    )

    @override
    def extract(self, source_path: Path, source_metadata: Mapping[str, object] | None = None) -> PluginResult:
        try:
            raw_bytes = source_path.read_bytes()
            if not is_ddb_saved_html(raw_bytes):
                return PluginResult(
                    failure=PluginFailure(
                        category=PluginFailureCategory.UNSUPPORTED_SOURCE_TYPE,
                        message="HTML does not look like a saved D&D Beyond article",
                    )
                )
            imported = parse_ddb_saved_html(raw_bytes)
            parsed_document = cast(ParsedDocument, imported.to_parsed_document())
            document = normalized_document_from_parsed(parsed_document, source_type="ddb_saved_html")
            return PluginResult(document=document, loader_intents=loader_intents_for_document(document), warnings=document.warnings)
        except ValueError as exc:
            return PluginResult(failure=PluginFailure(category=PluginFailureCategory.PARSE_ERROR, message=str(exc)))
        except OSError as exc:
            return PluginResult(failure=PluginFailure(category=PluginFailureCategory.INVALID_INPUT, message=str(exc)))


class ArchivedWebpagePlugin(SourcePlugin):
    metadata: PluginMetadata = PluginMetadata(
        name="archived_webpage",
        version="1.0.0",
        capabilities=(PluginCapability.EXTRACT, PluginCapability.LOAD_INTENT),
        source_types=("archived_webpage",),
        description="Parse host-stored served archive HTML and preserve locator metadata.",
    )

    @override
    def extract(self, source_path: Path, source_metadata: Mapping[str, object] | None = None) -> PluginResult:
        try:
            parsed = _parse_archived_webpage_html(source_path.read_text(encoding="utf-8"), dict(source_metadata or {}))
            document = normalized_document_from_parsed(parsed, source_type="archived_webpage")
            return PluginResult(document=document, loader_intents=loader_intents_for_document(document), warnings=document.warnings)
        except ValueError as exc:
            return PluginResult(failure=PluginFailure(category=PluginFailureCategory.PARSE_ERROR, message=str(exc)))
        except OSError as exc:
            return PluginResult(failure=PluginFailure(category=PluginFailureCategory.INVALID_INPUT, message=str(exc)))


class GenericHtmlPlugin(SourcePlugin):
    metadata: PluginMetadata = PluginMetadata(
        name="html",
        version="1.0.0",
        capabilities=(PluginCapability.EXTRACT, PluginCapability.LOAD_INTENT),
        source_types=("html",),
        description="Parse generic HTML after bundled source-specific parsers decline it.",
    )

    @override
    def extract(self, source_path: Path, source_metadata: Mapping[str, object] | None = None) -> PluginResult:
        try:
            parsed = _parse_html(source_path.read_text(encoding="utf-8"))
            document = normalized_document_from_parsed(parsed, source_type="html")
            return PluginResult(document=document, loader_intents=loader_intents_for_document(document), warnings=document.warnings)
        except ValueError as exc:
            return PluginResult(failure=PluginFailure(category=PluginFailureCategory.PARSE_ERROR, message=str(exc)))
        except OSError as exc:
            return PluginResult(failure=PluginFailure(category=PluginFailureCategory.INVALID_INPUT, message=str(exc)))


BUILTIN_SOURCE_PLUGINS: tuple[SourcePlugin, ...] = (
    DdbSavedHtmlPlugin(),
    ArchivedWebpagePlugin(),
    GenericHtmlPlugin(),
)

DEFAULT_PLUGIN_REGISTRY = PluginRegistry(BUILTIN_SOURCE_PLUGINS)

DEFAULT_SOURCE_PLUGIN_BY_TYPE = {
    DDB_PARSER: BUILTIN_SOURCE_PLUGINS[0],
    "archived_webpage": BUILTIN_SOURCE_PLUGINS[1],
    "html": BUILTIN_SOURCE_PLUGINS[2],
}
