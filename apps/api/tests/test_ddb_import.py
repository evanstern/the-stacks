import hashlib
import json
from pathlib import Path
from typing import cast

import pytest  # pyright: ignore[reportMissingImports]

from app.ddb_import import (  # pyright: ignore[reportImplicitRelativeImport]
    ddb_chunks_to_jsonl,
    extract_ddb_chunks,
    is_ddb_saved_html,
    parse_ddb_saved_html,
    sanitize_ddb_article_html,
    write_ddb_artifacts,
)
from app.etl.ingestion_compat import normalized_document_from_parsed, parsed_document_from_normalized
from app.ingestion import ParsedDocument


def _observable_parsed_document(document: ParsedDocument) -> dict[str, object]:
    return {
        "parser": getattr(document, "parser"),
        "title": getattr(document, "title"),
        "warnings": getattr(document, "warnings"),
        "sections": [
            {
                "heading": section.heading,
                "text": section.text,
                "start_char": section.start_char,
                "end_char": section.end_char,
                "metadata": section.metadata,
            }
            for section in getattr(document, "sections")
        ],
    }


def _assert_round_trips_observable_content(document: ParsedDocument) -> ParsedDocument:
    round_tripped = parsed_document_from_normalized(normalized_document_from_parsed(document))
    assert _observable_parsed_document(round_tripped) == _observable_parsed_document(document)
    assert document.metadata.items() <= round_tripped.metadata.items()
    return round_tripped


SAVED_DDB_HTML = b"""<!doctype html>
<html>
  <head>
    <title>Adult Red Dragon - Monsters - D&amp;D Beyond</title>
    <link rel="canonical" href="https://www.dndbeyond.com/monsters/16771-adult-red-dragon">
    <meta property="og:title" content="Adult Red Dragon">
  </head>
  <body>
    <header>site chrome</header>
    <main>
      <article class="ddb-article" data-source="monster" onclick="alert('bad')">
        <h1 id="AdultRedDragon">Adult Red Dragon</h1>
        <p data-content-chunk-id="intro">Huge dragon, chaotic evil.</p>
        <script>alert('remove me')</script>
        <h2 id="Actions">Actions</h2>
        <p><a href="javascript:alert('bad')" onclick="bad()">Multiattack.</a> The dragon makes three attacks.</p>
        <h3 id="FireBreath">Fire Breath</h3>
        <p>The dragon exhales fire in a 60-foot cone.</p>
      </article>
    </main>
    <footer>more chrome</footer>
  </body>
</html>"""


def test_ddb_detection_is_conservative() -> None:
    assert is_ddb_saved_html(SAVED_DDB_HTML)
    fixture = Path(__file__).resolve().parent / "fixtures" / "ddb" / "a-world-of-your-own-ddb.html"
    assert is_ddb_saved_html(fixture.read_bytes())
    assert not is_ddb_saved_html(b"<html><body><article><h1>Homebrew</h1><p>No source marker.</p></article></body></html>")
    assert not is_ddb_saved_html(b"<html><head><title>dndbeyond.com</title></head><body>No article</body></html>")
    assert not is_ddb_saved_html(
        b"<html><body><div class='p-article-content u-typography-format'><h1>Homebrew</h1></div></body></html>"
    )
    assert not is_ddb_saved_html(
        b"""<html><head><title>Dungeons &amp; Dragons - Sources - D&amp;D Beyond</title></head>
        <body><article><h1>Generic exported page</h1><p>No DDB article markers.</p></article></body></html>"""
    )
    assert not is_ddb_saved_html(
        b"""<html><head><title>DDB link roundup</title></head><body><article><h1>Links</h1>
        <p>See https://www.dndbeyond.com for official rules.</p></article></body></html>"""
    )
    assert not is_ddb_saved_html(
        b"""<html><head><link rel="canonical" href="https://www.dndbeyond.com/forums/example"></head>
        <body><article><h1>Generic exported page</h1><p>No DDB article markers.</p></article></body></html>"""
    )


def test_ddb_detection_accepts_article_selector_with_identity_or_source_signals() -> None:
    saved_from_html = b"""<html><body>
    <article><h1>Genuine Article</h1><p>Saved from https://www.dndbeyond.com/sources/test/article</p></article>
    </body></html>"""
    chunk_html = b"""<html><body>
    <article><h1>Genuine Article</h1><p data-content-chunk-id='intro'>Source signal present.</p></article>
    </body></html>"""

    assert is_ddb_saved_html(saved_from_html)
    assert is_ddb_saved_html(chunk_html)


def test_parse_preserves_raw_bytes_and_exposes_parsed_document() -> None:
    fixture = Path(__file__).resolve().parent / "fixtures" / "ddb" / "a-world-of-your-own-ddb.html"
    fixture_bytes = fixture.read_bytes()

    imported = parse_ddb_saved_html(fixture_bytes)
    document = cast(ParsedDocument, imported.to_parsed_document())

    assert imported.raw_bytes == fixture_bytes
    assert imported.raw_sha256 == hashlib.sha256(fixture_bytes).hexdigest()
    assert imported.source_url == "https://www.dndbeyond.com/sources/dnd/dmg-2014/a-world-of-your-own"
    assert imported.title == "A World of Your Own"
    assert imported.book_title == "Dungeon Master’s Guide (2014)"
    assert imported.document_title == "A World of Your Own"
    assert document.parser == "ddb_saved_html"
    assert document.title == "A World of Your Own"
    assert document.metadata["source_type"] == "ddb_saved_html"
    assert document.metadata["book_title"] == "Dungeon Master’s Guide (2014)"
    assert document.metadata["document_title"] == "A World of Your Own"
    assert [section.heading for section in document.sections] == ["A World of Your Own", "The Big Picture", "Core Assumptions"]
    assert [section.metadata for section in document.sections]
    assert [section.metadata["heading_id"] for section in document.sections] == ["AWorldofYourOwn", "TheBigPicture", "CoreAssumptions"]
    assert [section.metadata["heading_level"] for section in document.sections] == [1, 2, 3]
    assert [section.metadata["section_path"] for section in document.sections] == [
        ["A World of Your Own"],
        ["A World of Your Own", "The Big Picture"],
        ["A World of Your Own", "The Big Picture", "Core Assumptions"],
    ]
    assert [section.metadata["content_chunk_ids"] for section in document.sections] == [
        ["chunk-root", "chunk-intro"],
        ["chunk-big-picture", "chunk-big-picture-body", "chunk-list"],
        ["chunk-core-assumptions", "chunk-table"],
    ]
    assert [section.metadata["source_type"] for section in document.sections] == ["ddb_saved_html", "ddb_saved_html", "ddb_saved_html"]
    first_semantic_section = cast(dict[str, object], document.sections[0].metadata["semantic_section"])
    assert first_semantic_section["kind"] == "heading"
    assert cast(dict[str, object], first_semantic_section["heading"])["id"] == "AWorldofYourOwn"
    assert first_semantic_section["path_text"] == ["A World of Your Own"]
    assert document.sections[0].metadata["citation_anchor"] == "#AWorldofYourOwn"
    assert document.sections[0].metadata["source_url"] == imported.source_url
    first_section_html = cast(str, document.sections[0].metadata["html"])
    assert first_section_html.startswith("<h1")
    assert 'id="AWorldofYourOwn"' in first_section_html
    assert 'data-content-chunk-id="chunk-root"' in first_section_html
    _ = _assert_round_trips_observable_content(document)


def test_extraction_preserves_heading_paths_citations_and_source_url() -> None:
    chunks = extract_ddb_chunks(
        """
        <article>
          <h1 id="AdultRedDragon">Adult Red Dragon</h1>
          <p>Huge dragon, chaotic evil.</p>
          <h2 id="Actions">Actions</h2>
          <p>Multiattack. The dragon makes three attacks.</p>
        </article>
        """,
        source_url="https://www.dndbeyond.com/monsters/16771-adult-red-dragon",
    )

    assert [chunk.heading for chunk in chunks] == ["Adult Red Dragon", "Actions"]
    assert [chunk.id for chunk in chunks] == ["AdultRedDragon", "Actions"]
    assert chunks[0].metadata["content_chunk_id"] == "AdultRedDragon"
    assert chunks[0].metadata["heading_id"] == "AdultRedDragon"
    assert chunks[0].metadata["heading_level"] == 1
    assert chunks[0].metadata["section_path"] == ["Adult Red Dragon"]
    assert chunks[0].metadata["content_chunk_ids"] == []
    assert chunks[0].metadata["semantic_section"]["heading"]["id"] == "AdultRedDragon"
    assert chunks[0].metadata["semantic_section"]["path_text"] == ["Adult Red Dragon"]
    assert chunks[0].citation.label == "Adult Red Dragon"
    assert chunks[0].citation.anchor == "#AdultRedDragon"
    assert chunks[1].metadata["semantic_section"]["path_text"] == ["Adult Red Dragon", "Actions"]
    assert chunks[1].metadata["source_url"] == "https://www.dndbeyond.com/monsters/16771-adult-red-dragon"


def test_extraction_prefers_source_content_chunk_id_with_generated_fallback() -> None:
    chunks = extract_ddb_chunks(
        """
        <article>
          <h1 id="World">World</h1>
          <p data-content-chunk-id="chunk-3">Keep this source id.</p>
          <p data-content-chunk="legacy-id">Keep legacy source id.</p>
          <p>Generate this id.</p>
        </article>
        """
    )

    assert [chunk.id for chunk in chunks] == ["World"]
    assert chunks[0].metadata["content_chunk_id"] == "World"
    assert chunks[0].metadata["content_chunk_ids"] == ["chunk-3", "legacy-id"]
    assert chunks[0].metadata["heading_level"] == 1
    assert chunks[0].metadata["section_path"] == ["World"]


def test_sanitization_preserves_safe_renderable_html_and_strips_unsafe_attributes() -> None:
    rendered = sanitize_ddb_article_html(
        """
        <html>
          <body>
            <nav>nav chrome</nav>
            <aside>aside chrome</aside>
            <article class="ddb-article" onclick="alert('bad')">
              <h1 id="AWorldofYourOwn">A World of Your Own</h1>
              <p data-content-chunk-id="intro">This is <strong>safe</strong> text.</p>
              <h2 id="TheBigPicture">The Big Picture</h2>
              <p><a href="#TheBigPicture" title="anchor">Jump back</a></p>
              <script>alert('remove me')</script>
              <style>.bad { color: red; }</style>
              <iframe src="https://example.com/evil"></iframe>
              <object data="https://example.com/evil"></object>
              <embed src="https://example.com/evil"></embed>
              <form><input value="bad"><button>bad</button></form>
            </article>
          </body>
        </html>
        """
    )

    assert "<article" in rendered
    assert "<strong>safe</strong>" in rendered
    assert '<a href="#TheBigPicture" title="anchor">Jump back</a>' in rendered
    assert 'id="AWorldofYourOwn"' in rendered
    assert 'id="TheBigPicture"' in rendered
    assert 'data-content-chunk-id="intro"' in rendered
    assert "nav chrome" not in rendered
    assert "aside chrome" not in rendered
    assert "<nav" not in rendered
    assert "<aside" not in rendered
    assert "<script" not in rendered
    assert "<style" not in rendered
    assert "<iframe" not in rendered
    assert "<object" not in rendered
    assert "<embed" not in rendered
    assert "<form" not in rendered
    assert "<input" not in rendered
    assert "<button" not in rendered
    assert "onclick" not in rendered
    assert "javascript:" not in rendered
    assert "This is" in rendered
    assert "safe" in rendered


def test_jsonl_records_are_valid_and_include_required_metadata() -> None:
    fixture = Path(__file__).resolve().parent / "fixtures" / "ddb" / "a-world-of-your-own-ddb.html"
    imported = parse_ddb_saved_html(fixture.read_bytes())
    jsonl = ddb_chunks_to_jsonl(imported)
    records = [json.loads(line) for line in jsonl.splitlines()]

    assert len(records) == len(imported.chunks)
    assert imported.chunks[0].id == "AWorldofYourOwn"
    assert any(record["heading_id"] == "CoreAssumptions" for record in records)
    assert all(record["source_type"] == "ddb_saved_html" for record in records)
    assert all(record["book_title"] == "Dungeon Master’s Guide (2014)" for record in records)
    assert all(record["document_title"] == "A World of Your Own" for record in records)
    assert all(record["raw_sha256"] == imported.raw_sha256 for record in records)
    assert all(record["raw_html_path"] is None for record in records)
    assert all(record["rendered_html_path"] is None for record in records)
    assert all(record["jsonl_path"] is None for record in records)
    assert all(record["content_chunk_ids"] for record in records)
    assert all(record["citation"]["label"] == record["heading"] for record in records)
    assert all(record["citation"]["heading_id"] == record["heading_id"] for record in records)
    assert all(record["citation"]["content_chunk_ids"] == record["content_chunk_ids"] for record in records)
    assert all(record["citation"]["raw_sha256"] == imported.raw_sha256 for record in records)
    assert all(record["citation"]["source_url"].endswith(f"#{record['heading_id']}") for record in records)
    assert all(json.loads(json.dumps(record, ensure_ascii=False)) == record for record in records)

    core_assumptions = next(record for record in records if record["heading_id"] == "CoreAssumptions")
    assert core_assumptions["source_type"] == "ddb_saved_html"
    assert core_assumptions["section_path"] == ["A World of Your Own", "The Big Picture", "Core Assumptions"]
    assert core_assumptions["citation"]["source_url"].endswith("#CoreAssumptions")
    assert core_assumptions["content_chunk_ids"] == ["chunk-core-assumptions", "chunk-table"]
    assert core_assumptions["text"]
    assert core_assumptions["html"]


def test_artifact_writer_writes_manifest_and_fails_loudly(tmp_path: Path) -> None:
    fixture = Path(__file__).resolve().parent / "fixtures" / "ddb" / "a-world-of-your-own-ddb.html"
    fixture_bytes = fixture.read_bytes()
    imported = parse_ddb_saved_html(fixture_bytes)
    output_dir = tmp_path / f"{fixture.name}.artifacts"
    artifacts = write_ddb_artifacts(imported, output_dir)

    assert artifacts.raw_html_path.read_bytes() == fixture_bytes
    assert artifacts.rendered_html_path.read_text(encoding="utf-8") == imported.rendered_html
    manifest = json.loads(artifacts.manifest_path.read_text(encoding="utf-8"))
    assert manifest["raw_sha256"] == imported.raw_sha256
    assert manifest["raw_byte_size"] == len(fixture_bytes)
    assert manifest["book_title"] == "Dungeon Master’s Guide (2014)"
    assert manifest["document_title"] == "A World of Your Own"
    assert manifest["original_filename"] == fixture.name
    assert manifest["raw_html_path"] == str(artifacts.raw_html_path)
    assert manifest["rendered_html_path"] == str(artifacts.rendered_html_path)
    assert manifest["jsonl_path"] == str(artifacts.jsonl_path)
    assert "heading_level" not in manifest
    assert "heading_id" not in manifest
    assert "section_path" not in manifest
    assert "content_chunk_ids" not in manifest
    assert "source_content_ids" not in manifest

    records = [json.loads(line) for line in artifacts.jsonl_path.read_text(encoding="utf-8").splitlines()]
    assert records[0]["raw_html_path"] == str(artifacts.raw_html_path)
    assert records[0]["rendered_html_path"] == str(artifacts.rendered_html_path)
    assert records[0]["jsonl_path"] == str(artifacts.jsonl_path)
    assert records[0]["metadata"]["original_filename"] == fixture.name
    assert records[0]["content_chunk_id"] == "AWorldofYourOwn"
    assert records[0]["semantic_section"]["heading"]["id"] == "AWorldofYourOwn"
    assert records[0]["heading_level"] == 1
    assert records[0]["heading_id"] == "AWorldofYourOwn"
    assert records[0]["section_path"] == ["A World of Your Own"]
    assert records[0]["content_chunk_ids"] == ["chunk-root", "chunk-intro"]
    assert records[0]["citation"]["raw_html_path"] == str(artifacts.raw_html_path)
    assert records[0]["citation"]["rendered_html_path"] == str(artifacts.rendered_html_path)
    assert records[0]["citation"]["jsonl_path"] == str(artifacts.jsonl_path)
    assert records[0]["citation"]["raw_sha256"] == imported.raw_sha256

    blocking_file = tmp_path / "not-a-directory"
    blocking_file.write_text("blocking", encoding="utf-8")
    with pytest.raises(FileExistsError):
        write_ddb_artifacts(imported, blocking_file)


def test_structured_import_errors_for_malformed_ddb_saved_html() -> None:
    malformed = b"""
    <html>
      <head><link rel="canonical" href="https://www.dndbeyond.com/sources/test/broken"></head>
      <body><article class="ddb-article"><h1>Broken Article</h1></article></body>
    </html>
    """

    with pytest.raises(ValueError) as exc_info:
        parse_ddb_saved_html(malformed)

    assert str(exc_info.value) == "DDB saved HTML did not contain extractable article text"
