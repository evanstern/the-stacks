from pathlib import Path

import pytest

from app.ingestion import ParserError, parse_document


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


def test_parser_rejects_unsupported_extensions(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    source.write_bytes(b"placeholder")

    with pytest.raises(ParserError, match="No parser is available"):
        parse_document(source, ".pdf")
