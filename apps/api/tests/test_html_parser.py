from pathlib import Path

from app.ingestion import parse_document


FIXTURES = Path(__file__).resolve().parent / "fixtures"


def test_html_fixture_strips_boilerplate_and_preserves_metadata() -> None:
    document = parse_document(FIXTURES / "sample.html", ".html")

    assert document.parser == "html"
    assert document.title == "Bestiary"
    assert [section.heading for section in document.sections] == ["Dragons"]
    assert document.sections[0].text == "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively."
    assert any("boilerplate" in warning for warning in document.warnings)
