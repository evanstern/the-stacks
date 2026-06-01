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


def test_ddb_html_dispatches_before_generic_html(tmp_path: Path) -> None:
    fixture = Path(__file__).resolve().parent / "fixtures" / "ddb" / "a-world-of-your-own-ddb.html"
    source = tmp_path / fixture.name
    source.write_bytes(fixture.read_bytes())

    document = parse_document(source, ".html")

    assert document.parser == "ddb_saved_html"
    assert document.title == "A World of Your Own"
    assert document.metadata["book_title"] == "Dungeon Master's Guide"
    assert document.metadata["document_title"] == "A World of Your Own"
    assert document.metadata["source_type"] == "ddb_saved_html"
    assert document.metadata["parser"] == "ddb_saved_html"
    assert Path(str(source) + ".artifacts", "raw.html").read_bytes() == fixture.read_bytes()
    assert Path(str(source) + ".artifacts", "rendered.html").is_file()
    assert Path(str(source) + ".artifacts", "chunks.jsonl").is_file()
    assert Path(str(source) + ".artifacts", "manifest.json").is_file()
    assert [section.metadata["heading_id"] for section in document.sections] == [
        "AWorldofYourOwn",
        "TheBigPicture",
        "CoreAssumptions",
    ]
    assert document.sections[1].metadata["section_path"] == ["A World of Your Own", "The Big Picture"]
    assert document.sections[2].metadata["heading_level"] == 3
    assert document.sections[2].metadata["section_path"] == ["A World of Your Own", "The Big Picture", "Core Assumptions"]
    assert "chunk-3" in document.sections[1].metadata["content_chunk_ids"]


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
