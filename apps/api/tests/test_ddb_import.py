import hashlib
import json
from pathlib import Path

import pytest

from app.ddb_import import (
    ddb_chunks_to_jsonl,
    extract_ddb_chunks,
    is_ddb_saved_html,
    parse_ddb_saved_html,
    sanitize_ddb_article_html,
    write_ddb_artifacts,
)


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
        b"""<html><head><title>DDB link roundup</title></head><body><article><h1>Links</h1>
        <p>See https://www.dndbeyond.com for official rules.</p></article></body></html>"""
    )
    assert not is_ddb_saved_html(
        b"""<html><head><link rel="canonical" href="https://www.dndbeyond.com/forums/example"></head>
        <body><article><h1>Generic exported page</h1><p>No DDB article markers.</p></article></body></html>"""
    )


def test_parse_preserves_raw_bytes_and_exposes_parsed_document() -> None:
    imported = parse_ddb_saved_html(SAVED_DDB_HTML)
    document = imported.to_parsed_document()

    assert imported.raw_bytes == SAVED_DDB_HTML
    assert imported.raw_sha256 == hashlib.sha256(SAVED_DDB_HTML).hexdigest()
    assert imported.source_url == "https://www.dndbeyond.com/monsters/16771-adult-red-dragon"
    assert imported.title == "Adult Red Dragon"
    assert imported.book_title == "Monsters"
    assert imported.document_title == "Adult Red Dragon"
    assert document.parser == "ddb_saved_html"
    assert document.title == "Adult Red Dragon"
    assert document.metadata["book_title"] == "Monsters"
    assert document.metadata["document_title"] == "Adult Red Dragon"
    assert [section.heading for section in document.sections] == ["Adult Red Dragon", "Actions", "Fire Breath"]


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

    assert chunks[0].id == "adult-red-dragon-huge-dragon-chaotic-evil"
    assert chunks[0].heading_id == "AdultRedDragon"
    assert chunks[0].section_path == ["Adult Red Dragon"]
    assert chunks[0].citation.label == "Adult Red Dragon"
    assert chunks[0].citation.anchor == "#AdultRedDragon"
    assert chunks[1].section_path == ["Adult Red Dragon", "Actions"]
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

    assert [chunk.id for chunk in chunks] == ["chunk-3", "legacy-id", "world-generate-this-id"]
    assert chunks[0].metadata["content_chunk_id"] == "chunk-3"


def test_sanitization_preserves_safe_renderable_html_and_strips_unsafe_attributes() -> None:
    rendered = sanitize_ddb_article_html(SAVED_DDB_HTML.decode("utf-8"))

    assert "<article" in rendered
    assert 'id="AdultRedDragon"' in rendered
    assert 'data-content-chunk-id="intro"' in rendered
    assert "site chrome" not in rendered
    assert "<script" not in rendered
    assert "onclick" not in rendered
    assert "javascript:" not in rendered
    assert "Multiattack" in rendered


def test_jsonl_records_are_valid_and_include_required_metadata() -> None:
    imported = parse_ddb_saved_html(SAVED_DDB_HTML)
    jsonl = ddb_chunks_to_jsonl(imported.chunks, imported.metadata())
    records = [json.loads(line) for line in jsonl.splitlines()]

    assert len(records) == 3
    assert imported.chunks[0].id == "intro"
    assert records[0]["source_type"] == "ddb_saved_html"
    assert records[0]["book_title"] == "Monsters"
    assert records[0]["document_title"] == "Adult Red Dragon"
    assert records[0]["section_path"] == ["Adult Red Dragon"]
    assert records[0]["heading_level"] == 1
    assert records[0]["heading_id"] == "AdultRedDragon"
    assert records[0]["content_chunk_id"] == "intro"
    assert records[0]["content_chunk_ids"] == ["intro"]
    assert records[0]["chunk_index"] == 0
    assert records[0]["text"] == "Huge dragon, chaotic evil."
    assert 'data-content-chunk-id="intro"' in records[0]["html"]
    assert records[0]["citation"] == {
        "label": "Adult Red Dragon",
        "anchor": "#AdultRedDragon",
        "source_url": imported.source_url,
    }
    assert records[0]["metadata"]["content_chunk_id"] == "intro"
    assert records[0]["metadata"]["raw_sha256"] == imported.raw_sha256


def test_artifact_writer_writes_manifest_and_fails_loudly(tmp_path: Path) -> None:
    imported = parse_ddb_saved_html(SAVED_DDB_HTML)
    artifacts = write_ddb_artifacts(imported, tmp_path / "ddb")

    assert artifacts.raw_html_path.read_bytes() == SAVED_DDB_HTML
    assert artifacts.rendered_html_path.read_text(encoding="utf-8") == imported.rendered_html
    manifest = json.loads(artifacts.manifest_path.read_text(encoding="utf-8"))
    assert manifest["raw_sha256"] == imported.raw_sha256
    assert manifest["book_title"] == "Monsters"
    assert manifest["document_title"] == "Adult Red Dragon"
    assert manifest["raw_html_path"] == str(artifacts.raw_html_path)
    assert manifest["rendered_html_path"] == str(artifacts.rendered_html_path)
    assert manifest["jsonl_path"] == str(artifacts.jsonl_path)

    records = [json.loads(line) for line in artifacts.jsonl_path.read_text(encoding="utf-8").splitlines()]
    assert records[0]["raw_html_path"] == str(artifacts.raw_html_path)
    assert records[0]["rendered_html_path"] == str(artifacts.rendered_html_path)
    assert records[0]["jsonl_path"] == str(artifacts.jsonl_path)

    blocking_file = tmp_path / "not-a-directory"
    blocking_file.write_text("blocking", encoding="utf-8")
    with pytest.raises(FileExistsError):
        write_ddb_artifacts(imported, blocking_file)
