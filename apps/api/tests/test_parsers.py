from pathlib import Path
from typing import cast

import pytest  # pyright: ignore[reportMissingImports]

import app.ingestion as ingestion  # pyright: ignore[reportImplicitRelativeImport]
from app.ingestion import ParserError, parse_document  # pyright: ignore[reportImplicitRelativeImport]


def _semantic_section(section: object) -> dict[str, object]:
    return cast(dict[str, object], getattr(section, "metadata")["semantic_section"])


def test_markdown_parser_preserves_headings(tmp_path: Path) -> None:
    source = tmp_path / "source.md"
    source.write_text("# Dragons\nAncient red dragons prefer volcanic lairs.\n\n## Hoards\nThey hoard treasure.", encoding="utf-8")

    document = parse_document(source, ".md")

    assert document.parser == "markdown"
    assert document.title == "Dragons"
    assert [section.heading for section in document.sections] == ["Dragons", "Hoards"]
    assert document.sections[0].text == "Ancient red dragons prefer volcanic lairs."


def test_text_parser_reads_plain_text(tmp_path: Path) -> None:
    source = tmp_path / "source.txt"
    source.write_text("Ancient red dragons prefer volcanic lairs.\n", encoding="utf-8")

    document = parse_document(source, ".txt")

    assert document.parser == "text"
    assert document.title is None
    assert len(document.sections) == 1
    assert document.sections[0].heading is None
    assert document.sections[0].text == "Ancient red dragons prefer volcanic lairs."


def test_html_parser_extracts_title_headings_and_blocks(tmp_path: Path) -> None:
    source = tmp_path / "source.html"
    source.write_text(
        "<html><head><title>Bestiary</title></head><body><h1>Dragons</h1><p>Ancient red dragons prefer volcanic lairs.</p></body></html>",
        encoding="utf-8",
    )

    document = parse_document(source, ".html")

    assert document.parser == "html"
    assert document.title == "Bestiary"
    assert len(document.sections) == 1
    assert document.sections[0].heading == "Dragons"
    assert document.sections[0].text == "Ancient red dragons prefer volcanic lairs."


def test_html_parser_builds_semantic_sections_for_root_and_nested_headings(tmp_path: Path) -> None:
    source = tmp_path / "semantic-hierarchy.html"
    source.write_text(
        """<!doctype html>
<html lang="en">
  <head>
    <title>Guide</title>
  </head>
  <body>
    <p>Preface note.</p>
    <h1>Guide</h1>
    <p>Intro paragraph.</p>
    <h3>Linux</h3>
    <p>Linux steps.</p>
    <h2>Install</h2>
    <p>Install steps.</p>
    <h3>Windows</h3>
    <p>Windows steps.</p>
  </body>
</html>""",
        encoding="utf-8",
    )

    document = parse_document(source, ".html")

    assert document.title == "Guide"
    assert [section.heading for section in document.sections] == [None, "Guide", "Linux", "Install", "Windows"]
    assert document.sections[0].text == "Preface note."
    assert _semantic_section(document.sections[0]) == {
        "kind": "root",
        "heading": None,
        "parent": None,
        "path": [],
        "path_text": [],
        "depth": 0,
    }
    assert cast(dict[str, object], _semantic_section(document.sections[1])["heading"]) == {
        "text": "Guide",
        "level": 1,
        "id": "guide",
        "slug": "guide",
    }
    assert cast(list[str], _semantic_section(document.sections[1])["path_text"]) == ["Guide"]
    assert cast(dict[str, object], _semantic_section(document.sections[2])["parent"]) == {
        "text": "Guide",
        "level": 1,
        "id": "guide",
        "slug": "guide",
    }
    assert cast(list[str], _semantic_section(document.sections[2])["path_text"]) == ["Guide", "Linux"]
    assert cast(int, cast(dict[str, object], _semantic_section(document.sections[2])["heading"])["level"]) == 3
    assert cast(list[str], _semantic_section(document.sections[3])["path_text"]) == ["Guide", "Install"]
    assert cast(int, cast(dict[str, object], _semantic_section(document.sections[3])["heading"])["level"]) == 2
    assert cast(list[str], _semantic_section(document.sections[4])["path_text"]) == ["Guide", "Install", "Windows"]
    assert cast(str, cast(dict[str, object], _semantic_section(document.sections[4])["parent"])["text"]) == "Install"


def test_ddb_html_dispatches_before_generic_html(tmp_path: Path) -> None:
    fixture = Path(__file__).resolve().parent / "fixtures" / "ddb" / "a-world-of-your-own-ddb.html"
    source = tmp_path / fixture.name
    source.write_bytes(fixture.read_bytes())

    def fail_generic_html_parser(text: str) -> object:
        raise AssertionError("DDB saved HTML must not fall through to the generic HTML parser")

    original_generic_parser = ingestion._parse_html
    ingestion._parse_html = fail_generic_html_parser  # type: ignore[method-assign]

    try:
        document = parse_document(source, ".html")
    finally:
        ingestion._parse_html = original_generic_parser  # type: ignore[method-assign]

    assert document.parser == "ddb_saved_html"
    assert document.title == "A World of Your Own"
    assert document.metadata["book_title"] == "Dungeon Master’s Guide (2014)"
    assert document.metadata["document_title"] == "A World of Your Own"
    assert document.metadata["source_type"] == "ddb_saved_html"
    assert document.metadata["parser"] == "ddb_saved_html"
    assert Path(str(source) + ".artifacts", "raw.html").read_bytes() == fixture.read_bytes()
    assert Path(str(source) + ".artifacts", "rendered.html").is_file()
    assert Path(str(source) + ".artifacts", "chunks.jsonl").is_file()
    assert Path(str(source) + ".artifacts", "manifest.json").is_file()
    assert [cast(dict[str, object], _semantic_section(section)["heading"])["id"] for section in document.sections] == [
        "AWorldofYourOwn",
        "TheBigPicture",
        "CoreAssumptions",
    ]
    assert cast(list[str], _semantic_section(document.sections[1])["path_text"]) == [
        "A World of Your Own",
        "The Big Picture",
    ]
    assert cast(int, cast(dict[str, object], _semantic_section(document.sections[2])["heading"])["level"]) == 3
    assert cast(list[str], _semantic_section(document.sections[2])["path_text"]) == [
        "A World of Your Own",
        "The Big Picture",
        "Core Assumptions",
    ]
    assert document.sections[0].metadata["semantic_section"]["heading"]["id"] == "AWorldofYourOwn"
    assert document.sections[0].metadata["semantic_section"]["path_text"] == ["A World of Your Own"]
    assert document.sections[0].metadata["citation_anchor"] == "#AWorldofYourOwn"
    assert document.sections[0].metadata["source_url"] == document.metadata["source_url"]
    assert document.sections[2].metadata["heading_id"] == "CoreAssumptions"
    assert document.sections[2].metadata["heading_level"] == 3
    assert document.sections[2].metadata["section_path"] == ["A World of Your Own", "The Big Picture", "Core Assumptions"]
    assert document.sections[2].metadata["content_chunk_ids"] == ["chunk-core-assumptions", "chunk-table"]


def test_generic_html_still_uses_existing_html_parser_path(tmp_path: Path) -> None:
    source = tmp_path / "generic.html"
    source.write_text("<html><head><title>Bestiary</title></head><body><h1>Dragons</h1><p>Ancient red dragons prefer volcanic lairs.</p></body></html>", encoding="utf-8")

    calls: list[str] = []
    original_generic_parser = ingestion._parse_html

    def recording_generic_html_parser(text: str) -> object:
        calls.append(text)
        return original_generic_parser(text)

    ingestion._parse_html = recording_generic_html_parser  # type: ignore[method-assign]

    try:
        document = parse_document(source, ".html")
    finally:
        ingestion._parse_html = original_generic_parser  # type: ignore[method-assign]

    assert document.parser == "html"
    assert calls == [source.read_text(encoding="utf-8")]


def test_archived_html_parser_emits_semantic_section_without_section_path(tmp_path: Path) -> None:
    source = tmp_path / "archived.html"
    source.write_text(
        "<html><head><title>Archive title</title></head><body><h1>Archive heading</h1><p>Safe archive quote.</p></body></html>",
        encoding="utf-8",
    )
    anchor_map = tmp_path / "anchor-map.json"
    manifest = tmp_path / "manifest.json"
    anchor_map.write_text(
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

    document = parse_document(
        source,
        ".html",
        {
            "source_type": "archived_webpage",
            "source_id": "archive-source",
            "archive_manifest_path": str(manifest),
            "archive_anchor_map_path": anchor_map.name,
            "archive_entry_path": "page.html",
            "source_url": "https://example.test/archive-source",
        },
    )

    assert document.parser == "archived_webpage"
    assert len(document.sections) == 1
    metadata = document.sections[0].metadata
    assert metadata["target_chunk_id"] == "archive-target-1"
    assert metadata["semantic_section"] == {
        "kind": "heading",
        "heading": {"text": "Archive heading", "level": 1, "id": "archive-heading", "slug": "archive-heading"},
        "parent": None,
        "path": [{"text": "Archive heading", "level": 1, "id": "archive-heading", "slug": "archive-heading"}],
        "path_text": ["Archive heading"],
        "depth": 1,
    }
    assert "section_path" not in metadata


def test_generic_html_with_ddb_mention_stays_generic(tmp_path: Path) -> None:
    source = tmp_path / "ddb-link-roundup.html"
    source.write_text(
        """<html><head><title>Links</title></head><body><article><h1>Links</h1>
        <p>Use https://www.dndbeyond.com as one reference.</p></article></body></html>""",
        encoding="utf-8",
    )

    document = parse_document(source, ".html")

    assert document.parser == "html"
    assert not Path(str(source) + ".artifacts").exists()


def test_parser_rejects_unsupported_extensions(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    source.write_bytes(b"placeholder")

    with pytest.raises(ParserError, match="No parser is available"):
        parse_document(source, ".pdf")
