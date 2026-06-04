from pathlib import Path
from typing import cast

from app.ingestion import parse_document  # pyright: ignore[reportImplicitRelativeImport]


FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _semantic_section(section: object) -> dict[str, object]:
    return cast(dict[str, object], getattr(section, "metadata")["semantic_section"])


def test_html_fixture_strips_boilerplate_and_preserves_metadata() -> None:
    document = parse_document(FIXTURES / "sample.html", ".html")

    assert document.parser == "html"
    assert document.title == "Bestiary"
    assert [section.heading for section in document.sections] == ["Dragons"]
    assert document.sections[0].text == "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively."
    assert any("boilerplate" in warning for warning in document.warnings)
    assert _semantic_section(document.sections[0]) == {
        "kind": "heading",
        "heading": {
            "text": "Dragons",
            "level": 1,
            "id": "dragons",
            "slug": "dragons",
        },
        "parent": None,
        "path": [
            {
                "text": "Dragons",
                "level": 1,
                "id": "dragons",
                "slug": "dragons",
            }
        ],
        "path_text": ["Dragons"],
        "depth": 1,
    }


def test_html_fixture_tracks_duplicate_ids_inline_markup_and_empty_headings(tmp_path: Path) -> None:
    source = tmp_path / "semantic-edge-cases.html"
    source.write_text(
        """<!doctype html>
<html lang="en">
  <head>
    <title>Edge Cases</title>
  </head>
  <body>
    <p>Root preface.</p>
    <h2>Overview</h2>
    <p>Overview body.</p>
    <h4>Deep dive</h4>
    <p>Deep dive body.</p>
    <h2 id="Intro">Intro <span>Section</span></h2>
    <p>Intro body.</p>
    <h3 id="Intro">Intro</h3>
    <p>Duplicate id body.</p>
    <h3>   </h3>
    <p>Ignored empty heading body.</p>
    <h3>Overview</h3>
    <p>Sibling body.</p>
  </body>
</html>""",
        encoding="utf-8",
    )

    document = parse_document(source, ".html")

    assert document.parser == "html"
    assert _semantic_section(document.sections[0]) == {
        "kind": "root",
        "heading": None,
        "parent": None,
        "path": [],
        "path_text": [],
        "depth": 0,
    }
    assert [section.heading for section in document.sections] == [None, "Overview", "Deep dive", "Intro Section", "Intro", "Overview"]
    assert cast(dict[str, object], _semantic_section(document.sections[1])["heading"]) == {
        "text": "Overview",
        "level": 2,
        "id": "overview",
        "slug": "overview",
    }
    assert cast(list[str], _semantic_section(document.sections[2])["path_text"]) == ["Overview", "Deep dive"]
    assert cast(int, cast(dict[str, object], _semantic_section(document.sections[2])["heading"])["level"]) == 4
    assert cast(dict[str, object], _semantic_section(document.sections[3])["heading"]) == {
        "text": "Intro Section",
        "level": 2,
        "id": "Intro",
        "slug": "intro-section",
    }
    assert cast(list[str], _semantic_section(document.sections[3])["path_text"]) == ["Overview", "Intro Section"]
    assert cast(dict[str, object], _semantic_section(document.sections[4])["heading"]) == {
        "text": "Intro",
        "level": 3,
        "id": "intro-2",
        "slug": "intro",
    }
    assert cast(str, cast(dict[str, object], _semantic_section(document.sections[4])["parent"])["id"]) == "Intro"
    assert cast(list[str], _semantic_section(document.sections[5])["path_text"]) == ["Overview", "Intro Section", "Overview"]
    assert cast(str, cast(dict[str, object], _semantic_section(document.sections[5])["heading"])["id"]) == "overview-2"


def test_ddb_fixture_routes_to_saved_html_parser_without_weakening_generic_fixture() -> None:
    document = parse_document(FIXTURES / "ddb" / "a-world-of-your-own-ddb.html", ".html")
    semantic_section = cast(dict[str, object], document.sections[2].metadata["semantic_section"])

    assert document.parser == "ddb_saved_html"
    assert document.title == "A World of Your Own"
    assert cast(dict[str, object], semantic_section["heading"])["id"] == "CoreAssumptions"
    assert cast(dict[str, object], semantic_section["heading"])["level"] == 3
    assert semantic_section["path_text"] == [
        "A World of Your Own",
        "The Big Picture",
        "Core Assumptions",
    ]
    assert document.sections[2].metadata["citation_anchor"] == "#CoreAssumptions"
    assert "onclick" not in str(document.sections[2].metadata["html"])
