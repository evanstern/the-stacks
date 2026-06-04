import json
from collections.abc import Mapping
from pathlib import Path
from typing import cast, get_type_hints, override

import pytest  # pyright: ignore[reportMissingImports]

from app.etl import CONTRACT_VERSION
from app.etl.bundled import (
    BUILTIN_SOURCE_PLUGINS,
    DEFAULT_SOURCE_PLUGIN_BY_TYPE,
    DEFAULT_PLUGIN_REGISTRY,
    ArchivedWebpagePlugin,
    DdbSavedHtmlPlugin,
)
from app.etl.contracts import (
    ArchiveLocator,
    ContractVersionMismatch,
    ExtractorPlugin,
    LoaderIntentType,
    NormalizedDocument,
    NormalizedSection,
    PluginCapability,
    PluginFailure,
    PluginFailureCategory,
    PluginMetadata,
    PluginRegistry,
    PluginResult,
    SourcePlugin,
    loader_intents_for_document,
    serialize_plugin_result,
)
from app.etl.ingestion_compat import normalized_document_from_parsed
from app.ingestion import ParsedDocument, ParsedSection


def test_contract_version_and_metadata_are_explicit() -> None:
    metadata = PluginMetadata(
        name="example",
        version="1.2.3",
        capabilities=(PluginCapability.EXTRACT, PluginCapability.LOAD_INTENT),
        source_types=("html",),
    )

    assert CONTRACT_VERSION == "etl.contracts.v1"
    assert metadata.contract_version == CONTRACT_VERSION
    assert metadata.capabilities == (PluginCapability.EXTRACT, PluginCapability.LOAD_INTENT)
    assert metadata.source_types == ("html",)


def test_normalized_document_filters_empty_sections_and_json_normalizes_metadata(tmp_path: Path) -> None:
    document = NormalizedDocument(
        source_type=" html ",
        parser=" parser ",
        title="Title",
        sections=(
            NormalizedSection(text=" Keep me ", heading="Heading", metadata={"path": tmp_path / "source.html"}),
            NormalizedSection(text="   "),
        ),
        metadata={"raw_path": tmp_path / "source.html"},
    )

    assert document.source_type == "html"
    assert document.parser == "parser"
    assert len(document.sections) == 1
    assert document.sections[0].text == "Keep me"
    assert document.sections[0].metadata["path"] == str(tmp_path / "source.html")
    assert document.metadata["source_type"] == "html"
    assert document.metadata["parser"] == "parser"
    assert document.metadata["raw_path"] == str(tmp_path / "source.html")


def test_loader_intents_describe_host_writes_without_host_resources() -> None:
    document = NormalizedDocument(
        source_type="text",
        parser="text",
        title="Bestiary",
        sections=(NormalizedSection(text="Ancient red dragons prefer volcanic lairs.", heading="Dragons"),),
    )

    intents = loader_intents_for_document(document)

    assert [intent.intent_type for intent in intents] == [
        LoaderIntentType.UPSERT_SOURCE,
        LoaderIntentType.UPSERT_DOCUMENT,
        LoaderIntentType.UPSERT_SECTION,
        LoaderIntentType.UPSERT_CHUNK,
    ]
    assert intents[0].payload["source_type"] == "text"
    extractor_hints = get_type_hints(ExtractorPlugin.extract)
    assert "Session" not in str(extractor_hints)
    assert "Qdrant" not in str(extractor_hints)
    assert "Archive" not in str(extractor_hints)


def test_archive_locator_metadata_is_preserved_as_loader_intent() -> None:
    locator = ArchiveLocator(
        archive_source_id="archive-source",
        archive_entry_path="page.html",
        archive_served_entry_path="page.html",
        archive_manifest_path="/tmp/manifest.json",
        target_chunk_id="archive-target-1",
        target_selector='[data-source-chunk-id="archive-target-1"]',
        viewer_fragment="#source-chunk-archive-target-1",
        quote="Safe archive quote.",
        source_url="https://example.test/archive-source",
        semantic_section={"path_text": ["Archive heading"]},
    )
    document = NormalizedDocument(
        source_type="archived_webpage",
        parser="archived_webpage",
        sections=(NormalizedSection(text="Safe archive quote.", archive_locator=locator),),
    )

    intents = loader_intents_for_document(document)
    locator_intent = next(intent for intent in intents if intent.intent_type == LoaderIntentType.RECORD_ARCHIVE_LOCATOR)
    section_intent = next(intent for intent in intents if intent.intent_type == LoaderIntentType.UPSERT_SECTION)

    assert locator_intent.payload["source_type"] == "archived_webpage"
    assert locator_intent.payload["archive_source_id"] == "archive-source"
    assert locator_intent.payload["archive_entry_path"] == "page.html"
    assert locator_intent.payload["target_chunk_id"] == "archive-target-1"
    assert locator_intent.payload["semantic_section"] == {"path_text": ["Archive heading"]}
    section_metadata = cast(dict[str, object], section_intent.payload["metadata"])
    assert section_metadata["target_selector"] == '[data-source-chunk-id="archive-target-1"]'
    assert "section_path" not in section_metadata


def test_ingestion_compat_keeps_ddb_provenance_metadata() -> None:
    parsed = ParsedDocument(
        parser="ddb_saved_html",
        title="A World of Your Own",
        sections=[
            ParsedSection(
                heading="A World of Your Own",
                text="World text.",
                start_char=0,
                end_char=11,
                metadata={
                    "source_type": "ddb_saved_html",
                    "book_title": "Dungeon Master’s Guide (2014)",
                    "document_title": "A World of Your Own",
                    "heading_id": "AWorldofYourOwn",
                    "section_path": ["A World of Your Own"],
                    "content_chunk_ids": ["chunk-root", "chunk-intro"],
                    "semantic_section": {"heading": {"id": "AWorldofYourOwn"}, "path_text": ["A World of Your Own"]},
                },
            )
        ],
        metadata={"source_type": "ddb_saved_html", "book_title": "Dungeon Master’s Guide (2014)"},
    )

    document = normalized_document_from_parsed(parsed)

    assert document.source_type == "ddb_saved_html"
    assert document.parser == "ddb_saved_html"
    assert document.metadata["book_title"] == "Dungeon Master’s Guide (2014)"
    assert document.sections[0].metadata["heading_id"] == "AWorldofYourOwn"
    assert document.sections[0].metadata["section_path"] == ["A World of Your Own"]
    assert document.sections[0].metadata["content_chunk_ids"] == ["chunk-root", "chunk-intro"]


def test_bundled_source_plugins_keep_ddb_before_generic_html() -> None:
    assert isinstance(BUILTIN_SOURCE_PLUGINS[0], DdbSavedHtmlPlugin)
    assert DEFAULT_SOURCE_PLUGIN_BY_TYPE["ddb_saved_html"] is BUILTIN_SOURCE_PLUGINS[0]
    assert DEFAULT_SOURCE_PLUGIN_BY_TYPE["html"] is BUILTIN_SOURCE_PLUGINS[2]
    assert DEFAULT_PLUGIN_REGISTRY.source_plugin_for("ddb_saved_html") is BUILTIN_SOURCE_PLUGINS[0]
    assert DEFAULT_PLUGIN_REGISTRY.source_plugin_for("html") is BUILTIN_SOURCE_PLUGINS[2]


class ExampleTextPlugin(SourcePlugin):
    metadata: PluginMetadata = PluginMetadata(name="example_text", version="1.0.0", source_types=("example_text",))

    @override
    def extract(self, source_path: Path, source_metadata: Mapping[str, object] | None = None) -> PluginResult:
        return PluginResult(
            document=NormalizedDocument(
                source_type="example_text",
                parser="example_text",
                sections=(NormalizedSection(text=source_path.read_text(encoding="utf-8")),),
            )
        )


def test_plugin_registry_registers_independent_source_plugins_without_mutating_previous_registry(tmp_path: Path) -> None:
    source = tmp_path / "source.txt"
    _ = source.write_text("Registered plugin text.", encoding="utf-8")
    base_registry = PluginRegistry()
    plugin = ExampleTextPlugin()

    updated_registry = base_registry.register_source_plugin(plugin)
    resolved = updated_registry.source_plugin_for("example_text")

    assert base_registry.source_plugin_for("example_text") is None
    assert updated_registry.source_types == ("example_text",)
    assert resolved is plugin
    assert resolved is not None
    result = resolved.extract(source)
    assert result.document is not None
    assert result.document.sections[0].text == "Registered plugin text."


def test_fake_plugin_receives_only_source_path_and_json_safe_metadata(tmp_path: Path) -> None:
    source = tmp_path / "source.txt"
    _ = source.write_text("Plugin text.", encoding="utf-8")
    calls: list[tuple[Path, Mapping[str, object] | None]] = []

    class InspectingPlugin(SourcePlugin):
        metadata: PluginMetadata = PluginMetadata(name="inspecting", version="1.0.0", source_types=("inspecting",))

        @override
        def extract(self, source_path: Path, source_metadata: Mapping[str, object] | None = None) -> PluginResult:
            calls.append((source_path, source_metadata))
            metadata_text = " ".join(sorted(str(key) for key in (source_metadata or {})))
            assert "Session" not in metadata_text
            assert "Qdrant" not in metadata_text
            assert "Archive" not in metadata_text
            return PluginResult(
                document=NormalizedDocument(
                    source_type="inspecting",
                    parser="inspecting",
                    sections=(NormalizedSection(text=source_path.read_text(encoding="utf-8")),),
                )
            )

    plugin = InspectingPlugin()
    result = plugin.extract(source, {"filename": "source.txt", "source_type": "inspecting"})

    assert result.document is not None
    assert calls == [(source, {"filename": "source.txt", "source_type": "inspecting"})]
    extractor_hints = get_type_hints(ExtractorPlugin.extract)
    assert "Session" not in str(extractor_hints)
    assert "Qdrant" not in str(extractor_hints)
    assert "Archive" not in str(extractor_hints)


def test_plugin_registry_rejects_duplicate_source_type() -> None:
    plugin = ExampleTextPlugin()

    with pytest.raises(ValueError, match="example_text"):
        _ = PluginRegistry((plugin, plugin))


def test_plugin_registry_rejects_contract_version_mismatch() -> None:
    class MismatchedPlugin(SourcePlugin):
        metadata: PluginMetadata = PluginMetadata(
            name="future_plugin",
            version="9.0.0",
            contract_version="etl.contracts.v999",
            source_types=("future",),
        )

        @override
        def extract(self, source_path: Path, source_metadata: Mapping[str, object] | None = None) -> PluginResult:
            return PluginResult(failure=PluginFailure(category=PluginFailureCategory.CONTRACT_VIOLATION, message="mismatch"))

    with pytest.raises(ContractVersionMismatch, match="etl.contracts.v999"):
        _ = PluginRegistry((MismatchedPlugin(),))


def test_serialized_plugin_result_round_trips_complete_normalized_output() -> None:
    locator = ArchiveLocator(
        archive_source_id="archive-source",
        archive_entry_path="page.html",
        target_chunk_id="archive-target-1",
        semantic_section={"path_text": ["Archive heading"]},
    )
    document = NormalizedDocument(
        source_type="archived_webpage",
        parser="archived_webpage",
        title="Archive title",
        sections=(NormalizedSection(text="Safe archive quote.", heading="Archive heading", archive_locator=locator),),
        warnings=("Archive anchor map did not contain citation targets",),
    )
    result = PluginResult(document=document, loader_intents=loader_intents_for_document(document), warnings=document.warnings)

    serialized = serialize_plugin_result(result)
    round_tripped = cast(dict[str, object], json.loads(json.dumps(serialized, ensure_ascii=False)))
    round_tripped_document = cast(dict[str, object], round_tripped["document"])
    round_tripped_sections = cast(list[object], round_tripped_document["sections"])
    round_tripped_section = cast(dict[str, object], round_tripped_sections[0])
    round_tripped_section_metadata = cast(dict[str, object], round_tripped_section["metadata"])
    round_tripped_intents = cast(list[object], round_tripped["loader_intents"])
    round_tripped_locator_intent = cast(dict[str, object], round_tripped_intents[-1])
    round_tripped_locator_payload = cast(dict[str, object], round_tripped_locator_intent["payload"])

    assert round_tripped == serialized
    assert round_tripped["contract_version"] == CONTRACT_VERSION
    assert round_tripped_document["contract_version"] == CONTRACT_VERSION
    assert round_tripped_section_metadata["archive_source_id"] == "archive-source"
    assert round_tripped_locator_intent["intent_type"] == LoaderIntentType.RECORD_ARCHIVE_LOCATOR.value
    assert round_tripped_locator_payload["target_chunk_id"] == "archive-target-1"


def test_ddb_plugin_returns_normalized_output_without_writing_artifacts(tmp_path: Path) -> None:
    fixture = Path(__file__).resolve().parent / "fixtures" / "ddb" / "a-world-of-your-own-ddb.html"
    source = tmp_path / fixture.name
    _ = source.write_bytes(fixture.read_bytes())

    result = DdbSavedHtmlPlugin().extract(source)

    assert result.failure is None
    assert result.document is not None
    assert result.document.parser == "ddb_saved_html"
    assert result.document.metadata["book_title"] == "Dungeon Master’s Guide (2014)"
    assert result.document.sections[0].metadata["heading_id"] == "AWorldofYourOwn"
    assert result.loader_intents[0].intent_type == LoaderIntentType.UPSERT_SOURCE
    assert not Path(f"{source}.artifacts").exists()


def test_archived_plugin_preserves_locator_metadata(tmp_path: Path) -> None:
    served = tmp_path / "page.html"
    anchor_map = tmp_path / "anchor-map.json"
    manifest = tmp_path / "manifest.json"
    _ = served.write_text(
        "<html><head><title>Archive title</title></head><body><h1>Archive heading</h1><p>Safe archive quote.</p></body></html>",
        encoding="utf-8",
    )
    _ = anchor_map.write_text(
        """{
  "source_id": "archive-source",
  "source_path": "page.html",
  "anchors": [
    {
      "chunk_id": "archive-target-1",
      "selector": "[data-source-chunk-id=archive-target-1]",
      "heading_path": ["Archive heading"],
      "quote": "Safe archive quote.",
      "viewer_fragment": "#source-chunk-archive-target-1"
    }
  ]
}""",
        encoding="utf-8",
    )
    _ = manifest.write_text("{}", encoding="utf-8")

    result = ArchivedWebpagePlugin().extract(
        served,
        {
            "source_type": "archived_webpage",
            "source_id": "archive-source",
            "archive_manifest_path": str(manifest),
            "archive_anchor_map_path": anchor_map.name,
            "archive_entry_path": "page.html",
            "archive_served_entry_path": "page.html",
            "source_url": "https://example.test/archive-source",
        },
    )

    assert result.failure is None
    assert result.document is not None
    assert result.document.parser == "archived_webpage"
    assert result.document.sections[0].archive_locator is not None
    assert result.document.sections[0].metadata["archive_source_id"] == "archive-source"
    assert result.document.sections[0].metadata["target_chunk_id"] == "archive-target-1"
    semantic_section = cast(dict[str, object], result.document.sections[0].metadata["semantic_section"])
    assert semantic_section["path_text"] == ["Archive heading"]
    assert any(intent.intent_type == LoaderIntentType.RECORD_ARCHIVE_LOCATOR for intent in result.loader_intents)


def test_plugin_failure_model_is_normalized() -> None:
    result = PluginResult(
        failure=PluginFailure(
            category=PluginFailureCategory.UNSUPPORTED_SOURCE_TYPE,
            message="Unsupported",
            diagnostics={"path": Path("source.pdf")},
        )
    )

    assert result.document is None
    assert result.failure is not None
    assert result.failure.category == PluginFailureCategory.UNSUPPORTED_SOURCE_TYPE
    assert result.failure.diagnostics["path"] == "source.pdf"
