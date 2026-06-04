from __future__ import annotations

from collections.abc import Mapping
from typing import cast

from .contracts import ArchiveLocator, NormalizedDocument, NormalizedSection, normalize_metadata
from ..ingestion import ARCHIVE_LOCATOR_METADATA_KEYS, ParsedDocument, ParsedSection


def normalized_document_from_parsed(parsed: ParsedDocument, *, source_type: str | None = None) -> NormalizedDocument:
    metadata = normalize_metadata(parsed.metadata)
    normalized_source_type = source_type or str(metadata.get("source_type") or parsed.parser)
    return NormalizedDocument(
        source_type=normalized_source_type,
        parser=parsed.parser,
        title=parsed.title,
        sections=tuple(normalized_section_from_parsed(section) for section in parsed.sections),
        warnings=tuple(parsed.warnings),
        metadata=metadata,
    )


def parsed_document_from_normalized(document: NormalizedDocument) -> ParsedDocument:
    metadata: dict[str, object] = dict(normalize_metadata(document.metadata))
    return ParsedDocument(
        parser=document.parser,
        title=document.title,
        sections=[parsed_section_from_normalized(section) for section in document.sections],
        warnings=list(document.warnings),
        metadata=metadata,
    )


def normalized_section_from_parsed(section: ParsedSection) -> NormalizedSection:
    metadata = normalize_metadata(section.metadata)
    return NormalizedSection(
        heading=section.heading,
        text=section.text,
        start_char=section.start_char,
        end_char=section.end_char,
        metadata=metadata,
        archive_locator=_archive_locator_from_metadata(metadata),
    )


def parsed_section_from_normalized(section: NormalizedSection) -> ParsedSection:
    metadata: dict[str, object] = dict(normalize_metadata(section.metadata))
    if section.archive_locator is not None:
        metadata = {**metadata, **section.archive_locator.metadata()}
    return ParsedSection(
        heading=section.heading,
        text=section.text,
        start_char=section.start_char,
        end_char=int(section.end_char or section.start_char + len(section.text)),
        metadata=metadata,
    )


def _archive_locator_from_metadata(metadata: Mapping[str, object]) -> ArchiveLocator | None:
    if metadata.get("source_type") != "archived_webpage":
        return None
    archive_source_id = str(metadata.get("archive_source_id") or "")
    archive_entry_path = str(metadata.get("archive_entry_path") or "")
    if not archive_source_id or not archive_entry_path:
        return None
    locator_values = {key: metadata.get(key) for key in ARCHIVE_LOCATOR_METADATA_KEYS}
    semantic_section = locator_values.get("semantic_section")
    semantic_section_metadata = normalize_metadata(cast(Mapping[str, object], semantic_section)) if isinstance(semantic_section, Mapping) else {}
    return ArchiveLocator(
        archive_source_id=archive_source_id,
        archive_entry_path=archive_entry_path,
        archive_served_entry_path=_optional_str(locator_values.get("archive_served_entry_path")),
        archive_manifest_path=_optional_str(locator_values.get("archive_manifest_path")),
        target_chunk_id=_optional_str(locator_values.get("target_chunk_id")),
        target_selector=_optional_str(locator_values.get("target_selector")),
        viewer_fragment=_optional_str(locator_values.get("viewer_fragment")),
        quote=_optional_str(locator_values.get("quote")),
        source_url=_optional_str(locator_values.get("source_url")),
        semantic_section=semantic_section_metadata,
    )


def _optional_str(value: object) -> str | None:
    if value in (None, ""):
        return None
    return str(value)
