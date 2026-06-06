---
title: ETL Plugin Contracts
status: active
owner: docs
created: 2026-06-03
updated: 2026-06-06
tags:
  - wiki
  - etl
  - contracts
---

# ETL Plugin Contracts

This page documents the current plugin contract in `app.etl.contracts` and the built-in source plugins in `app.etl.bundled`. The contract is versioned, normalized, and host-owned, and it stops at normalized documents and loader intents. Chunking, embedding, and Qdrant indexing happen later in the host runner.

## Contract version

`CONTRACT_VERSION` is `etl.contracts.v1`. Every plugin metadata record must use that version or `PluginRegistry` will reject it.

## Protocol interfaces

The contract file defines three protocol interfaces:

- `ExtractorPlugin`, which exposes `extract(source_path: Path, source_metadata: Mapping[str, object] | None = None) -> PluginResult`
- `TransformerPlugin`, which exposes `transform(document: NormalizedDocument) -> NormalizedDocument`
- `SourcePlugin`, which is an alias-style protocol that currently extends `ExtractorPlugin`

Plugins are matched by the `metadata.source_types` tuple. The host picks the plugin by source type, calls `extract`, and then handles the returned document or failure.

## Input and output contract

`extract(source_path: Path, source_metadata) -> PluginResult` is the only source plugin entry point.

- `source_path` is the file path on disk prepared by the upload or archive handler.
- `source_metadata` is an optional mapping from the host. It carries source-specific context such as archive locator fields.

`PluginResult` must contain exactly one of `document` or `failure`.

- If `document` is present, `failure` must be `None`.
- If `failure` is present, `document` must be `None`.
- It may also carry `loader_intents` and `warnings`.

`PluginResult.__post_init__` enforces the one-or-the-other rule, and the host runner turns a failure into `EtlPluginFailure`.

## NormalizedDocument and NormalizedSection

`NormalizedDocument` is the contract output the host expects from plugins.

Required fields and validation:

- `source_type` must be non-empty after trimming.
- `parser` must be non-empty after trimming.
- `sections` must contain at least one non-empty section after normalization.

Optional fields include `title`, `warnings`, and `metadata`.

`NormalizedSection` carries:

- `text` as stripped content
- optional `heading`
- `start_char` and `end_char` offsets
- `metadata`
- optional `archive_locator`

`NormalizedSection.__post_init__` normalizes text and metadata and rejects negative offsets or reversed ranges. `NormalizedDocument.__post_init__` normalizes every section and rejects empty documents.

## Loader intent types

`LoaderIntentType` currently includes:

- `upsert_source`
- `upsert_document`
- `upsert_section`
- `upsert_chunk`
- `index_chunk`
- `record_artifact`
- `record_archive_locator`

`loader_intents_for_document()` emits the current intent sequence from a `NormalizedDocument`:

1. `upsert_source`
2. `upsert_document`
3. `upsert_section` for each section
4. `upsert_chunk` for each section
5. `record_archive_locator` for any section with an archive locator

The intent payloads are JSON-safe metadata blobs. They are a contract artifact, not a separate persistence path in the runner.

## Plugin failure categories

`PluginFailureCategory` currently includes:

- `invalid_input`
- `unsupported_source_type`
- `parse_error`
- `transform_error`
- `contract_violation`
- `unknown_error`

`PluginFailure` carries the category, a human-readable message, optional diagnostics, and a retryable flag. Diagnostics are normalized to JSON-safe metadata.

The bundled plugins map their host exceptions into these categories. `app.ingestion` later translates plugin failures into job-level failure categories and public-safe messages.

## Plugin registry

`PluginRegistry` stores source plugins and indexes them by `metadata.source_types`.

- It rejects duplicate registrations for the same source type.
- `source_plugin_for(source_type)` returns the first matching plugin or `None`.
- `register_source_plugin()` returns a new registry with the added plugin.

The registry is keyed by source types, not plugin names. That keeps dispatch stable even when multiple implementations exist for the same conceptual source family.

## Built-in plugins

`app.etl.bundled` defines the built-in source plugins:

- `DdbSavedHtmlPlugin` handles D&D Beyond saved HTML. It checks `is_ddb_saved_html(raw_bytes)` first, parses with `parse_ddb_saved_html`, and returns a normalized document with loader intents.
- `ArchivedWebpagePlugin` handles host-stored served archive HTML. It calls `_parse_archived_webpage_html()` and preserves archive metadata in the normalized sections.
- `GenericHtmlPlugin` handles generic HTML after the source-specific handlers decline it.

Each built-in plugin advertises `capabilities=(PluginCapability.EXTRACT, PluginCapability.LOAD_INTENT)` and source types of `ddb_saved_html`, `archived_webpage`, or `html` respectively.

`DEFAULT_PLUGIN_REGISTRY` is `PluginRegistry(BUILTIN_SOURCE_PLUGINS)`, and `DEFAULT_SOURCE_PLUGIN_BY_TYPE` dispatches:

- `DDB_PARSER` to `DdbSavedHtmlPlugin`
- `archived_webpage` to `ArchivedWebpagePlugin`
- `html` to `GenericHtmlPlugin`

## Legacy compatibility

`app.ingestion._LegacyParserPlugin` wraps the legacy `parse_document()` path for source types that are not yet implemented as explicit source plugins.

- It exposes `metadata` with `name="legacy_ingestion_parser"` and `source_types=("legacy",)`.
- Its `extract()` method calls `parse_document()` and converts the parsed result into a normalized document with `normalized_document_from_parsed()`.

That adapter keeps the newer runner and the older parser code compatible while the host still owns the lifecycle and load steps.

## ArchiveLocator

`ArchiveLocator` is the contract object for archived webpage source references.

- It stores `archive_source_id` and `archive_entry_path` as the required fields.
- It can also carry `archive_served_entry_path`, `archive_manifest_path`, `target_chunk_id`, `target_selector`, `viewer_fragment`, `quote`, `source_url`, and `semantic_section`.
- `metadata()` returns the JSON-safe metadata payload inserted into normalized section metadata.

`ingestion_compat._archive_locator_from_metadata()` reconstructs an `ArchiveLocator` when `source_type == "archived_webpage"` and the required archive fields are present. That is how archived webpages keep anchor maps and locator details available through normalization, section persistence, and Qdrant payload generation.

## Chunking boundary

Chunking is not part of the plugin contract.

Plugins output normalized documents and sections. The host runner turns those sections into chunks later, in `app.ingestion.chunk_document()` and the sequential ETL runner. This keeps plugins focused on extraction and normalization, and keeps host-specific chunk sizing and overlap policy out of the plugin API.

## Related notes

- [[Layer Boundaries]] for the layer ownership split.
- [[ETL Architecture]] for the flow context.
- [[LangGraph ETL Decision]] for why the orchestration boundary sits where it does.
- [[RAG Retrieval Architecture]] for the downstream query-time contract that consumes ETL output.
