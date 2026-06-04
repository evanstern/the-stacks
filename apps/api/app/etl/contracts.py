from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field, replace
from enum import StrEnum
from pathlib import Path
from typing import Protocol, TypeAlias, cast, runtime_checkable


CONTRACT_VERSION = "etl.contracts.v1"

Scalar: TypeAlias = str | int | float | bool | None
MetadataValue: TypeAlias = Scalar | list["MetadataValue"] | dict[str, "MetadataValue"]
Metadata: TypeAlias = dict[str, MetadataValue]


def _empty_raw_metadata() -> Mapping[str, object]:
    return {}


class PluginCapability(StrEnum):
    EXTRACT = "extract"
    TRANSFORM = "transform"
    LOAD_INTENT = "load_intent"


class LoaderIntentType(StrEnum):
    UPSERT_SOURCE = "upsert_source"
    UPSERT_DOCUMENT = "upsert_document"
    UPSERT_SECTION = "upsert_section"
    UPSERT_CHUNK = "upsert_chunk"
    INDEX_CHUNK = "index_chunk"
    RECORD_ARTIFACT = "record_artifact"
    RECORD_ARCHIVE_LOCATOR = "record_archive_locator"


class PluginFailureCategory(StrEnum):
    INVALID_INPUT = "invalid_input"
    UNSUPPORTED_SOURCE_TYPE = "unsupported_source_type"
    PARSE_ERROR = "parse_error"
    TRANSFORM_ERROR = "transform_error"
    CONTRACT_VIOLATION = "contract_violation"
    UNKNOWN_ERROR = "unknown_error"


class ContractVersionMismatch(ValueError):
    pass


@dataclass(frozen=True)
class PluginMetadata:
    name: str
    version: str
    contract_version: str = CONTRACT_VERSION
    capabilities: tuple[PluginCapability, ...] = (PluginCapability.EXTRACT,)
    source_types: tuple[str, ...] = ()
    description: str | None = None


@dataclass(frozen=True)
class PluginFailure:
    category: PluginFailureCategory
    message: str
    diagnostics: Mapping[str, object] = field(default_factory=_empty_raw_metadata)
    retryable: bool = False

    def __post_init__(self) -> None:
        object.__setattr__(self, "diagnostics", normalize_metadata(self.diagnostics))


@dataclass(frozen=True)
class ArchiveLocator:
    archive_source_id: str
    archive_entry_path: str
    archive_served_entry_path: str | None = None
    archive_manifest_path: str | None = None
    target_chunk_id: str | None = None
    target_selector: str | None = None
    viewer_fragment: str | None = None
    quote: str | None = None
    source_url: str | None = None
    semantic_section: Mapping[str, object] = field(default_factory=_empty_raw_metadata)

    def metadata(self) -> Metadata:
        payload: Metadata = {
            "source_type": "archived_webpage",
            "archive_source_id": self.archive_source_id,
            "archive_entry_path": self.archive_entry_path,
        }
        optional: dict[str, MetadataValue] = {
            "archive_served_entry_path": self.archive_served_entry_path,
            "archive_manifest_path": self.archive_manifest_path,
            "target_chunk_id": self.target_chunk_id,
            "target_selector": self.target_selector,
            "viewer_fragment": self.viewer_fragment,
            "quote": self.quote,
            "source_url": self.source_url,
            "semantic_section": normalize_metadata(self.semantic_section),
        }
        payload.update({key: value for key, value in optional.items() if value not in (None, "", [])})
        return payload


@dataclass(frozen=True)
class NormalizedSection:
    text: str
    heading: str | None = None
    start_char: int = 0
    end_char: int | None = None
    metadata: Mapping[str, object] = field(default_factory=_empty_raw_metadata)
    archive_locator: ArchiveLocator | None = None

    def __post_init__(self) -> None:
        normalized_text = self.text.strip()
        end_char = self.end_char if self.end_char is not None else self.start_char + len(normalized_text)
        if self.start_char < 0 or end_char < self.start_char:
            raise ValueError("Section character offsets must be non-negative and ordered")
        object.__setattr__(self, "text", normalized_text)
        object.__setattr__(self, "end_char", end_char)
        object.__setattr__(self, "metadata", normalize_metadata(self.metadata))


@dataclass(frozen=True)
class NormalizedDocument:
    source_type: str
    parser: str
    sections: tuple[NormalizedSection, ...]
    title: str | None = None
    warnings: tuple[str, ...] = ()
    metadata: Mapping[str, object] = field(default_factory=_empty_raw_metadata)

    def __post_init__(self) -> None:
        if not self.source_type.strip():
            raise ValueError("Document source_type is required")
        if not self.parser.strip():
            raise ValueError("Document parser is required")
        sections = tuple(normalize_section(section) for section in self.sections if section.text.strip())
        if not sections:
            raise ValueError("Document must contain at least one non-empty section")
        object.__setattr__(self, "source_type", self.source_type.strip())
        object.__setattr__(self, "parser", self.parser.strip())
        object.__setattr__(self, "sections", sections)
        object.__setattr__(self, "warnings", tuple(str(warning) for warning in self.warnings if str(warning).strip()))
        object.__setattr__(self, "metadata", normalize_metadata({"source_type": self.source_type, "parser": self.parser, **self.metadata}))


@dataclass(frozen=True)
class LoaderIntent:
    intent_type: LoaderIntentType
    payload: Mapping[str, object]
    metadata: Mapping[str, object] = field(default_factory=_empty_raw_metadata)

    def __post_init__(self) -> None:
        object.__setattr__(self, "payload", normalize_metadata(self.payload))
        object.__setattr__(self, "metadata", normalize_metadata(self.metadata))


@dataclass(frozen=True)
class PluginResult:
    document: NormalizedDocument | None = None
    loader_intents: tuple[LoaderIntent, ...] = ()
    warnings: tuple[str, ...] = ()
    failure: PluginFailure | None = None

    def __post_init__(self) -> None:
        if self.document is None and self.failure is None:
            raise ValueError("PluginResult requires either a document or a failure")
        if self.document is not None and self.failure is not None:
            raise ValueError("PluginResult cannot contain both a document and a failure")
        object.__setattr__(self, "loader_intents", tuple(self.loader_intents))
        object.__setattr__(self, "warnings", tuple(str(warning) for warning in self.warnings if str(warning).strip()))


@runtime_checkable
class ExtractorPlugin(Protocol):
    metadata: PluginMetadata

    def extract(self, source_path: Path, source_metadata: Mapping[str, object] | None = None) -> PluginResult:
        ...


@runtime_checkable
class TransformerPlugin(Protocol):
    metadata: PluginMetadata

    def transform(self, document: NormalizedDocument) -> NormalizedDocument:
        ...


@runtime_checkable
class SourcePlugin(ExtractorPlugin, Protocol):
    pass


@dataclass(frozen=True)
class PluginRegistry:
    _source_plugins: tuple[SourcePlugin, ...] = ()

    def __init__(self, source_plugins: Sequence[SourcePlugin] = ()) -> None:
        registered: list[SourcePlugin] = []
        source_types: set[str] = set()
        for plugin in source_plugins:
            _validate_plugin_contract(plugin.metadata)
            duplicate_types = source_types.intersection(plugin.metadata.source_types)
            if duplicate_types:
                duplicated = ", ".join(sorted(duplicate_types))
                raise ValueError(f"Source plugin already registered for: {duplicated}")
            source_types.update(plugin.metadata.source_types)
            registered.append(plugin)
        object.__setattr__(self, "_source_plugins", tuple(registered))

    @property
    def source_plugins(self) -> tuple[SourcePlugin, ...]:
        return self._source_plugins

    @property
    def source_types(self) -> tuple[str, ...]:
        return tuple(source_type for plugin in self._source_plugins for source_type in plugin.metadata.source_types)

    def register_source_plugin(self, plugin: SourcePlugin) -> PluginRegistry:
        return PluginRegistry((*self._source_plugins, plugin))

    def source_plugin_for(self, source_type: str) -> SourcePlugin | None:
        normalized = source_type.strip()
        for plugin in self._source_plugins:
            if normalized in plugin.metadata.source_types:
                return plugin
        return None


def normalize_document(document: NormalizedDocument) -> NormalizedDocument:
    return replace(document)


def normalize_section(section: NormalizedSection) -> NormalizedSection:
    metadata = normalize_metadata(section.metadata)
    if section.archive_locator is not None:
        metadata = {**metadata, **section.archive_locator.metadata()}
    return replace(section, metadata=metadata)


def loader_intents_for_document(document: NormalizedDocument) -> tuple[LoaderIntent, ...]:
    normalized = normalize_document(document)
    intents = [
        LoaderIntent(
            intent_type=LoaderIntentType.UPSERT_SOURCE,
            payload={
                "source_type": normalized.source_type,
                "title": normalized.title,
                "parser": normalized.parser,
                "metadata": normalized.metadata,
            },
        ),
        LoaderIntent(
            intent_type=LoaderIntentType.UPSERT_DOCUMENT,
            payload={
                "title": normalized.title,
                "parser": normalized.parser,
                "section_count": len(normalized.sections),
                "metadata": normalized.metadata,
            },
        ),
    ]
    for ordinal, section in enumerate(normalized.sections):
        section_payload: Metadata = {
            "ordinal": ordinal,
            "heading": section.heading,
            "text": section.text,
            "start_char": section.start_char,
            "end_char": section.end_char,
            "metadata": normalize_metadata(section.metadata),
        }
        intents.append(LoaderIntent(intent_type=LoaderIntentType.UPSERT_SECTION, payload=section_payload))
        intents.append(LoaderIntent(intent_type=LoaderIntentType.UPSERT_CHUNK, payload=section_payload))
        if section.archive_locator is not None:
            intents.append(LoaderIntent(intent_type=LoaderIntentType.RECORD_ARCHIVE_LOCATOR, payload=section.archive_locator.metadata()))
    return tuple(intents)


def serialize_normalized_section(section: NormalizedSection) -> Metadata:
    return {
        "heading": section.heading,
        "text": section.text,
        "start_char": section.start_char,
        "end_char": section.end_char,
        "metadata": normalize_metadata(section.metadata),
    }


def serialize_normalized_document(document: NormalizedDocument) -> Metadata:
    normalized = normalize_document(document)
    return {
        "contract_version": CONTRACT_VERSION,
        "source_type": normalized.source_type,
        "parser": normalized.parser,
        "title": normalized.title,
        "warnings": list(normalized.warnings),
        "metadata": normalize_metadata(normalized.metadata),
        "sections": [serialize_normalized_section(section) for section in normalized.sections],
    }


def serialize_loader_intent(intent: LoaderIntent) -> Metadata:
    return {
        "contract_version": CONTRACT_VERSION,
        "intent_type": intent.intent_type.value,
        "payload": normalize_metadata(intent.payload),
        "metadata": normalize_metadata(intent.metadata),
    }


def serialize_plugin_failure(failure: PluginFailure) -> Metadata:
    return {
        "contract_version": CONTRACT_VERSION,
        "category": failure.category.value,
        "message": failure.message,
        "diagnostics": normalize_metadata(failure.diagnostics),
        "retryable": failure.retryable,
    }


def serialize_plugin_result(result: PluginResult) -> Metadata:
    payload: Metadata = {
        "contract_version": CONTRACT_VERSION,
        "warnings": list(result.warnings),
        "loader_intents": [serialize_loader_intent(intent) for intent in result.loader_intents],
    }
    if result.document is not None:
        payload["document"] = serialize_normalized_document(result.document)
    if result.failure is not None:
        payload["failure"] = serialize_plugin_failure(result.failure)
    return payload


def normalize_metadata(metadata: Mapping[str, object] | None) -> Metadata:
    if not metadata:
        return {}
    return {str(key): _normalize_metadata_value(value) for key, value in metadata.items()}


def _validate_plugin_contract(metadata: PluginMetadata) -> None:
    if metadata.contract_version != CONTRACT_VERSION:
        raise ContractVersionMismatch(
            f"Plugin {metadata.name} uses contract {metadata.contract_version}; expected {CONTRACT_VERSION}"
        )


def _normalize_metadata_value(value: object) -> MetadataValue:
    if isinstance(value, str | int | float | bool) or value is None:
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, Mapping):
        return normalize_metadata(cast(Mapping[str, object], value))
    if isinstance(value, Sequence) and not isinstance(value, str | bytes | bytearray):
        return [_normalize_metadata_value(item) for item in value]
    try:
        _ = json.dumps(value)
    except TypeError:
        return str(value)
    return cast(MetadataValue, value)
