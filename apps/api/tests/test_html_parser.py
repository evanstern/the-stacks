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


def test_ddb_fixture_routes_to_saved_html_parser_without_weakening_generic_fixture() -> None:
    document = parse_document(FIXTURES / "ddb" / "a-world-of-your-own-ddb.html", ".html")

    assert document.parser == "ddb_saved_html"
    assert document.title == "A World of Your Own"
    assert document.sections[2].metadata["heading_id"] == "CoreAssumptions"
    assert document.sections[2].metadata["heading_level"] == 3
    assert document.sections[2].metadata["section_path"] == ["A World of Your Own", "The Big Picture", "Core Assumptions"]
    assert document.sections[2].metadata["citation_anchor"] == "#CoreAssumptions"
    assert "onclick" not in str(document.sections[2].metadata["html"])
