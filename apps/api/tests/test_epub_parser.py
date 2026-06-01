from pathlib import Path

import pytest

from app.ingestion import ParserError, parse_document


FIXTURES = Path(__file__).resolve().parent / "fixtures"


def test_epub_fixture_extracts_a_chunk_with_title_and_heading() -> None:
    document = parse_document(FIXTURES / "sample.epub", ".epub")

    assert document.parser == "epub"
    assert document.title == "Bestiary"
    assert len(document.sections) >= 1
    assert document.sections[0].heading == "Dragons"
    assert document.sections[0].text == "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively."


def test_epub_parser_rejects_invalid_archives(tmp_path: Path) -> None:
    source = tmp_path / "broken.epub"
    source.write_bytes(b"not a zip archive")

    with pytest.raises(ParserError, match="valid EPUB archive"):
        parse_document(source, ".epub")
