import hashlib
import importlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import bleach
from bs4 import BeautifulSoup, Tag
from bs4.element import Comment


DDB_HOST_MARKERS = ("dndbeyond.com", "www.dndbeyond.com")
DDB_PARSER = "ddb_saved_html"
DDB_IDENTITY_SELECTORS = (
    "link[rel='canonical']",
    "meta[property='og:url']",
    "meta[name='twitter:url']",
)
DDB_SAVED_FROM_PATTERN = re.compile(r"saved\s+from(?:\s+url=\(\d+\))?\s*(https?://(?:www\.)?dndbeyond\.com/\S+)", re.IGNORECASE)
DDB_ARTICLE_SELECTORS = (
    "div.p-article-content.u-typography-format",
    "div#p-article-content.u-typography-format",
    "article",
    "main article",
    "main .ddb-statblock",
    "main .mon-stat-block",
    "main .compendium-content",
    "main .more-info-content",
    "main .primary-content",
    "main",
)
DDB_BOILERPLATE_SELECTOR = ", ".join(
    (
        "script",
        "style",
        "template",
        "iframe",
        "object",
        "embed",
        "nav",
        "header",
        "footer",
        "aside",
        "form",
        "button",
        "svg",
        "[role='navigation']",
        "[aria-hidden='true']",
        ".site-bar",
        ".site-footer",
        ".site-header",
        ".ddb-campaigns-character-card-footer",
    )
)
DDB_TEXT_BLOCK_TAGS = {"p", "li", "blockquote", "pre", "td", "th", "dt", "dd"}
DDB_ALLOWED_TAGS = frozenset(
    {
        "article",
        "section",
        "div",
        "span",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "ul",
        "ol",
        "li",
        "blockquote",
        "strong",
        "em",
        "b",
        "i",
        "u",
        "code",
        "pre",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "a",
        "br",
    }
)
DDB_ALLOWED_PROTOCOLS = frozenset({"http", "https"})


class DdbMetadata(dict[str, Any]):
    def __call__(self) -> dict[str, Any]:
        return dict(self)


@dataclass(frozen=True)
class DdbCitation:
    label: str | None
    anchor: str | None

    def metadata(self) -> dict[str, str | None]:
        return {"citation_label": self.label, "citation_anchor": self.anchor}


@dataclass(frozen=True)
class DdbChunk:
    id: str
    content: str
    heading: str | None
    semantic_section: dict[str, Any]
    html: str
    source_url: str | None
    citation: DdbCitation
    metadata: dict[str, Any] = field(default_factory=dict)

    def jsonl_record(self, import_result: Any | None = None, chunk_index: int = 0) -> dict[str, Any]:
        import_metadata = dict(import_result.metadata()) if import_result is not None else {}
        chunk_metadata = dict(self.metadata)
        citation_anchor = self.citation.anchor or chunk_metadata.get("citation_anchor")
        citation_label = self.citation.label or chunk_metadata.get("citation_label") or self.heading
        source_url = self.source_url or import_metadata.get("source_url")
        heading_id = chunk_metadata.get("heading_id")
        content_chunk_ids = list(chunk_metadata.get("content_chunk_ids") or [])
        citation = {
            "label": citation_label,
            "source_url": f"{source_url}{citation_anchor}" if source_url and citation_anchor else source_url,
            "raw_html_path": import_metadata.get("raw_html_path"),
            "rendered_html_path": import_metadata.get("rendered_html_path"),
            "jsonl_path": import_metadata.get("jsonl_path"),
            "raw_sha256": import_metadata.get("raw_sha256"),
            "heading_id": heading_id,
            "content_chunk_ids": content_chunk_ids,
        }
        return {
            "source_type": import_metadata.get("source_type", "ddb_saved_html"),
            "book_title": import_metadata.get("book_title"),
            "document_title": import_metadata.get("document_title") or import_metadata.get("title"),
            "source_url": source_url,
            "raw_sha256": import_metadata.get("raw_sha256"),
            "raw_byte_size": import_metadata.get("raw_byte_size"),
            "raw_html_path": import_metadata.get("raw_html_path"),
            "rendered_html_path": import_metadata.get("rendered_html_path"),
            "jsonl_path": import_metadata.get("jsonl_path"),
            "content_chunk_id": self.id,
            "chunk_index": chunk_index,
            "heading_id": heading_id,
            "heading_level": chunk_metadata.get("heading_level"),
            "section_path": chunk_metadata.get("section_path"),
            "content_chunk_ids": content_chunk_ids,
            "heading": self.heading,
            "semantic_section": self.semantic_section,
            "text": self.content,
            "html": self.html,
            "citation": citation,
            "metadata": {
                **import_metadata,
                **chunk_metadata,
                "content_chunk_id": self.id,
                "heading": self.heading,
                "source_url": source_url,
                "citation_label": citation_label,
                "citation_anchor": citation_anchor,
            },
        }


@dataclass(frozen=True)
class DdbSection:
    heading: str | None
    text: str
    start_char: int
    end_char: int
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class DdbSectionRecord:
    heading: str | None
    heading_id: str | None
    heading_level: int | None
    section_path: list[str]
    text: str
    html: str
    source_url: str | None
    content_chunk_ids: list[str]
    semantic_section: dict[str, Any]
    chunk_id: str
    start_char: int
    end_char: int
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class DdbArtifacts:
    raw_html_path: Path
    rendered_html_path: Path
    jsonl_path: Path
    manifest_path: Path


@dataclass(frozen=True)
class DdbImport:
    title: str | None
    book_title: str | None
    document_title: str | None
    source_url: str | None
    original_filename: str | None
    raw_bytes: bytes
    raw_sha256: str
    rendered_html: str
    chunks: list[DdbChunk]
    warnings: list[str] = field(default_factory=list)
    raw_html_path: Path | None = None
    rendered_html_path: Path | None = None
    jsonl_path: Path | None = None
    metadata: DdbMetadata = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "metadata", DdbMetadata(_import_metadata(self)))

    @property
    def sections(self) -> list[DdbSection]:
        return _extract_ddb_sections(self.rendered_html, dict(self.metadata))

    def to_parsed_document(self) -> Any:
        ingestion = importlib.import_module("app.ingestion")

        return ingestion.ParsedDocument(
            parser=DDB_PARSER,
            title=self.title,
            sections=[
                ingestion.ParsedSection(section.heading, section.text, section.start_char, section.end_char, section.metadata)
                for section in self.sections
            ],
            warnings=list(self.warnings),
            metadata=dict(self.metadata),
        )


def is_ddb_saved_html(raw_html: bytes | str) -> bool:
    text = _decode_html(raw_html)
    soup = BeautifulSoup(text, "html.parser")
    article = _select_article(soup)
    if article is None:
        return False
    return _has_ddb_identity_or_source_signal(soup, article, text)


def parse_ddb_saved_html(raw_html: bytes | str, raw_bytes: bytes | None = None) -> DdbImport:
    preserved_bytes = raw_bytes if raw_bytes is not None else raw_html if isinstance(raw_html, bytes) else raw_html.encode("utf-8")
    text = _decode_html(raw_html)
    soup = BeautifulSoup(text, "html.parser")
    source_url = _source_url_from_soup(soup) or _saved_from_url(text)
    if not is_ddb_saved_html(text):
        raise ValueError("HTML does not look like a saved D&D Beyond article")
    article = _select_article(soup)
    if article is None:
        raise ValueError("DDB saved HTML did not contain an article-like body")

    rendered_html = sanitize_ddb_article_html(str(article))
    chunks = extract_ddb_chunks(rendered_html, source_url=source_url)
    if not chunks:
        raise ValueError("DDB saved HTML did not contain extractable article text")
    return DdbImport(
        title=_title_from_soup(soup, article),
        book_title=_book_title_from_soup(soup),
        document_title=_document_title_from_soup(soup, article),
        source_url=source_url,
        original_filename=None,
        raw_bytes=preserved_bytes,
        raw_sha256=hashlib.sha256(preserved_bytes).hexdigest(),
        rendered_html=rendered_html,
        chunks=chunks,
    )


def extract_ddb_chunks(article_html: str, source_url: str | None = None) -> list[DdbChunk]:
    return [
        DdbChunk(
            id=record.chunk_id,
            content=record.text,
            heading=record.heading,
            semantic_section=record.semantic_section,
            html=record.html,
            source_url=record.source_url,
            citation=DdbCitation(label=record.heading, anchor=f"#{record.heading_id}" if record.heading_id else None),
            metadata=record.metadata,
        )
        for record in _extract_ddb_section_records(article_html, source_url=source_url)
    ]


def _extract_ddb_sections(article_html: str, import_metadata: dict[str, Any]) -> list[DdbSection]:
    return [
        DdbSection(
            heading=record.heading,
            text=record.text,
            start_char=record.start_char,
            end_char=record.end_char,
            metadata={
                **{key: value for key, value in import_metadata.items() if value is not None},
                **record.metadata,
            },
        )
        for record in _extract_ddb_section_records(article_html, source_url=import_metadata.get("source_url"), import_metadata=import_metadata)
    ]


def sanitize_ddb_article_html(article_html: str) -> str:
    soup = BeautifulSoup(article_html, "html.parser")
    root = _select_article(soup) or soup
    for tag in root.select(DDB_BOILERPLATE_SELECTOR):
        tag.decompose()
    for comment in root.find_all(string=lambda value: isinstance(value, Comment)):
        comment.extract()
    cleaner = bleach.Cleaner(
        tags=DDB_ALLOWED_TAGS,
        attributes=_allow_ddb_attribute,
        protocols=DDB_ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )
    return cleaner.clean(str(root)).strip()


def ddb_chunks_to_jsonl(import_result: DdbImport) -> str:
    lines = [json.dumps(chunk.jsonl_record(import_result, index), ensure_ascii=False, sort_keys=True) for index, chunk in enumerate(import_result.chunks)]
    return "\n".join(lines) + ("\n" if lines else "")


def write_ddb_artifacts(ddb_import: DdbImport, output_dir: Path) -> DdbArtifacts:
    output_dir.mkdir(parents=True, exist_ok=True)
    raw_path = output_dir / "raw.html"
    rendered_path = output_dir / "rendered.html"
    jsonl_path = output_dir / "chunks.jsonl"
    manifest_path = output_dir / "manifest.json"
    original_filename = ddb_import.original_filename or output_dir.name.removesuffix(".artifacts")

    raw_path.write_bytes(ddb_import.raw_bytes)
    rendered_path.write_text(ddb_import.rendered_html, encoding="utf-8")
    object.__setattr__(ddb_import, "original_filename", original_filename)
    object.__setattr__(ddb_import, "raw_html_path", raw_path)
    object.__setattr__(ddb_import, "rendered_html_path", rendered_path)
    object.__setattr__(ddb_import, "jsonl_path", jsonl_path)
    object.__setattr__(ddb_import, "metadata", DdbMetadata(_import_metadata(ddb_import)))
    metadata = {
        **ddb_import.metadata(),
        "original_filename": original_filename,
        "raw_html_path": str(raw_path),
        "rendered_html_path": str(rendered_path),
        "jsonl_path": str(jsonl_path),
    }
    jsonl_path.write_text(ddb_chunks_to_jsonl(ddb_import), encoding="utf-8")
    manifest = {**metadata, "chunk_count": len(ddb_import.chunks), "manifest_path": str(manifest_path)}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return DdbArtifacts(raw_html_path=raw_path, rendered_html_path=rendered_path, jsonl_path=jsonl_path, manifest_path=manifest_path)


def _import_metadata(ddb_import: DdbImport) -> dict[str, Any]:
    return {
        "source_type": "ddb_saved_html",
        "parser": DDB_PARSER,
        "title": ddb_import.title,
        "book_title": ddb_import.book_title,
        "document_title": ddb_import.document_title,
        "source_url": ddb_import.source_url,
        "original_filename": ddb_import.original_filename,
        "raw_sha256": ddb_import.raw_sha256,
        "raw_byte_size": len(ddb_import.raw_bytes),
        "rendered_html": ddb_import.rendered_html,
        "raw_html_path": str(ddb_import.raw_html_path) if ddb_import.raw_html_path else None,
        "rendered_html_path": str(ddb_import.rendered_html_path) if ddb_import.rendered_html_path else None,
        "jsonl_path": str(ddb_import.jsonl_path) if ddb_import.jsonl_path else None,
    }


def _decode_html(raw_html: bytes | str) -> str:
    if isinstance(raw_html, str):
        return raw_html
    return raw_html.decode("utf-8-sig")


def _source_url_from_soup(soup: BeautifulSoup) -> str | None:
    for selector in DDB_IDENTITY_SELECTORS:
        tag = soup.select_one(selector)
        if not tag:
            continue
        value = tag.get("href") or tag.get("content")
        if not isinstance(value, str):
            continue
        cleaned = value.strip()
        if not any(marker in cleaned.lower() for marker in DDB_HOST_MARKERS):
            continue
        path = urlparse(cleaned).path.lower()
        if path and not path.startswith("/forums"):
            return cleaned
    return None


def _saved_from_url(text: str) -> str | None:
    match = DDB_SAVED_FROM_PATTERN.search(text[:20_000])
    if match:
        return match.group(1).rstrip('"\'<>')
    return None


def _select_article(soup: BeautifulSoup | Tag) -> Tag | None:
    for selector in DDB_ARTICLE_SELECTORS:
        article = soup.select_one(selector)
        if article and _normalize_text(article.get_text(" ")):
            return article
    return None


def _has_ddb_identity_or_source_signal(soup: BeautifulSoup, article: Tag, text: str) -> bool:
    if _saved_from_url(text) is not None:
        return True
    if _source_url_from_soup(soup) is not None:
        return True
    return bool(article.select_one("[data-content-chunk-id], [data-content-chunk]"))


def _has_ddb_article_marker(article: Tag) -> bool:
    marker_classes = {
        "p-article-content",
        "u-typography-format",
        "ddb-article",
        "ddb-statblock",
        "mon-stat-block",
        "compendium-content",
        "more-info-content",
        "primary-content",
    }
    classes = article.get("class")
    if isinstance(classes, list) and marker_classes.intersection(classes):
        return True
    article_id = _attribute_value(article.get("id"))
    return article_id == "p-article-content"


def _title_from_soup(soup: BeautifulSoup, article: Tag) -> str | None:
    return _document_title_from_soup(soup, article) or _book_title_from_soup(soup)


def _book_title_from_soup(soup: BeautifulSoup) -> str | None:
    for selector in ("meta[property='og:site_name']", "meta[name='ddb:book-title']", "meta[name='book-title']"):
        tag = soup.select_one(selector)
        if tag and isinstance(tag.get("content"), str):
            title = _normalize_text(str(tag.get("content")))
            if title:
                return title
    if soup.title:
        title = _normalize_text(soup.title.get_text(" "))
        parts = [part.strip() for part in re.split(r"\s+[-—|]\s+", title) if part.strip()]
        if len(parts) >= 2:
            generic_suffixes = {
                "ddb",
                "d&d beyond",
                "dungeons & dragons beyond",
                "dungeons and dragons beyond",
                "dungeons & dragons",
                "dungeons and dragons",
                "sources",
            }
            for part in parts[1:]:
                if part.lower() not in generic_suffixes:
                    return part
    return None


def _document_title_from_soup(soup: BeautifulSoup, article: Tag) -> str | None:
    heading = article.select_one("h1")
    if heading:
        heading_text = _normalize_text(heading.get_text(" "))
        if heading_text:
            return heading_text
    meta = soup.select_one("meta[property='og:title']")
    if meta and isinstance(meta.get("content"), str):
        return _normalize_text(str(meta.get("content")))
    if soup.title:
        return _normalize_text(soup.title.get_text(" "))
    return None


def _heading_level(tag: Tag) -> int | None:
    name = tag.name.lower() if tag.name else ""
    if len(name) == 2 and name.startswith("h") and name[1].isdigit():
        return int(name[1])
    return None


def _section_nodes_until_next_heading(heading: Tag, next_heading: Tag | None) -> list[Tag]:
    nodes: list[Tag] = []
    for sibling in heading.next_siblings:
        if sibling is next_heading:
            break
        if isinstance(sibling, Tag):
            if _heading_level(sibling) is not None:
                break
            nodes.append(sibling)
    return nodes


def _section_nodes_until_next_same_or_higher_heading(heading: Tag, following_headings: list[Tag], level: int) -> list[Tag]:
    next_boundary = None
    for candidate in following_headings:
        candidate_level = _heading_level(candidate)
        if candidate_level is not None and candidate_level <= level:
            next_boundary = candidate
            break
    nodes: list[Tag] = []
    for sibling in heading.next_siblings:
        if sibling is next_boundary:
            break
        if isinstance(sibling, Tag):
            nodes.append(sibling)
    return nodes


def _content_chunk_candidates(node: Tag) -> list[Tag]:
    candidates: list[Tag] = [node]
    for candidate in node.find_all(attrs={"data-content-chunk-id": True}):
        if isinstance(candidate, Tag):
            candidates.append(candidate)
    for candidate in node.find_all(attrs={"data-content-chunk": True}):
        if isinstance(candidate, Tag):
            candidates.append(candidate)
    return candidates


def _semantic_section_root() -> dict[str, Any]:
    return {
        "kind": "root",
        "heading": None,
        "parent": None,
        "path": [],
        "path_text": [],
        "depth": 0,
    }


def _semantic_heading_slug(text: str) -> str:
    slug = re.sub(r"[^0-9a-z]+", "-", _normalize_text(text).lower()).strip("-")
    return slug or "section"


def _semantic_heading_id(heading_text: str, existing_ids: set[str], dom_id: str | None = None) -> str:
    candidate = (dom_id or "").strip()
    if candidate:
        candidate_key = _semantic_heading_slug(candidate)
        if candidate_key not in existing_ids:
            existing_ids.add(candidate_key)
            return candidate

    base_source = candidate or heading_text
    base = _semantic_heading_slug(base_source)
    identifier = base
    suffix = 1
    while _semantic_heading_slug(identifier) in existing_ids:
        suffix += 1
        identifier = f"{base}-{suffix}"
    existing_ids.add(_semantic_heading_slug(identifier))
    return identifier


def _semantic_heading_node(heading_text: str, heading_level: int, heading_id: str) -> dict[str, Any]:
    normalized_text = _normalize_text(heading_text)
    return {
        "text": normalized_text,
        "level": heading_level,
        "id": heading_id,
        "slug": _semantic_heading_slug(normalized_text),
    }


def _semantic_section_heading_from_stack(
    heading_text: str,
    heading_level: int,
    heading_id: str,
    heading_stack: list[dict[str, Any]],
) -> dict[str, Any]:
    heading = _semantic_heading_node(heading_text, heading_level, heading_id)
    path = [*heading_stack, heading]
    return {
        "kind": "heading",
        "heading": heading,
        "parent": heading_stack[-1] if heading_stack else None,
        "path": path,
        "path_text": [str(item["text"]) for item in path],
        "depth": len(path),
    }


def _semantic_section_from_stack(heading_stack: list[dict[str, Any]]) -> dict[str, Any]:
    if not heading_stack:
        return _semantic_section_root()
    return {
        "kind": "heading",
        "heading": heading_stack[-1],
        "parent": heading_stack[-2] if len(heading_stack) > 1 else None,
        "path": list(heading_stack),
        "path_text": [str(item["text"]) for item in heading_stack],
        "depth": len(heading_stack),
    }


def _semantic_heading_level(heading: dict[str, Any]) -> int:
    level = heading.get("level")
    return level if isinstance(level, int) else 0


def _primary_content_chunk_id(nodes: list[Tag], fallback: str | None) -> str | None:
    for node in nodes:
        for candidate in _content_chunk_candidates(node):
            value = _attribute_value(candidate.get("data-content-chunk-id")) or _attribute_value(candidate.get("data-content-chunk"))
            if value:
                return value
    return fallback


def _extract_ddb_section_records(article_html: str, source_url: str | None = None, import_metadata: dict[str, Any] | None = None) -> list[DdbSectionRecord]:
    soup = BeautifulSoup(article_html, "html.parser")
    root = _select_article(soup) or soup
    headings = [element for element in root.descendants if isinstance(element, Tag) and _heading_level(element) is not None]
    heading_stack: list[dict[str, Any]] = []
    heading_ids: set[str] = set()
    seen_ids: dict[str, int] = {}
    base_metadata = {key: value for key, value in (import_metadata or {}).items() if value is not None}
    records: list[DdbSectionRecord] = []

    for index, heading in enumerate(headings):
        level = _heading_level(heading)
        if level is None:
            continue
        heading_text = _normalize_text(heading.get_text(" "))
        if not heading_text:
            continue

        heading_stack = [item for item in heading_stack if _semantic_heading_level(item) < level]
        heading_id = _semantic_heading_id(heading_text, heading_ids, _attribute_value(heading.get("id")))
        semantic_section = _semantic_section_heading_from_stack(heading_text, level, heading_id, heading_stack)
        heading_stack = list(semantic_section["path"])

        next_heading = headings[index + 1] if index + 1 < len(headings) else None
        nodes = _section_nodes_until_next_heading(heading, next_heading)
        fragment_nodes = [heading, *nodes]
        body_text = _normalize_text(" ".join(node.get_text(" ") for node in nodes if _heading_level(node) is None))
        if not body_text:
            continue
        section_text = body_text or heading_text
        section_html = "".join(str(node) for node in fragment_nodes)
        section_path = [str(item["text"]) for item in semantic_section["path"]]
        content_chunk_ids = _section_content_chunk_ids(fragment_nodes)
        chunk_id = heading_id
        start_char = article_html.find(str(heading))
        if start_char == -1:
            start_char = article_html.find(heading_text)
        if start_char == -1:
            start_char = 0
        end_char = start_char + len(str(heading))
        if nodes:
            last_markup = str(nodes[-1])
            last_start = article_html.find(last_markup, start_char)
            if last_start != -1:
                end_char = last_start + len(last_markup)

        metadata = {
            **base_metadata,
            "content_chunk_id": chunk_id,
            "heading_id": heading_id,
            "heading_level": level,
            "section_path": section_path,
            "content_chunk_ids": content_chunk_ids,
            "source_url": source_url,
            "semantic_section": semantic_section,
            "html": sanitize_ddb_article_html(section_html),
            "citation_label": heading_text,
            "citation_anchor": f"#{heading_id}" if heading_id else None,
        }
        records.append(
            DdbSectionRecord(
                heading=heading_text,
                heading_id=heading_id,
                heading_level=level,
                section_path=section_path,
                text=section_text,
                html=sanitize_ddb_article_html(section_html),
                source_url=source_url,
                content_chunk_ids=content_chunk_ids,
                semantic_section=semantic_section,
                chunk_id=chunk_id,
                start_char=start_char,
                end_char=end_char,
                metadata=metadata,
            )
        )
    return records


def _section_content_chunk_ids(nodes: list[Tag]) -> list[str]:
    ids: list[str] = []
    seen: set[str] = set()
    for node in nodes:
        for candidate in _content_chunk_candidates(node):
            value = _attribute_value(candidate.get("data-content-chunk-id")) or _attribute_value(candidate.get("data-content-chunk"))
            if value and value not in seen:
                seen.add(value)
                ids.append(value)
    return ids


def _chunk_id_for_element(element: Tag, section_path: list[str], text: str, seen_ids: dict[str, int]) -> str:
    source_id = _attribute_value(element.get("data-content-chunk-id")) or _attribute_value(element.get("data-content-chunk"))
    if source_id:
        seen = seen_ids.get(source_id, 0)
        seen_ids[source_id] = seen + 1
        return source_id if seen == 0 else f"{source_id}-{seen + 1}"
    return _stable_chunk_id(section_path, text, seen_ids)


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _attribute_value(value: str | list[str] | None) -> str | None:
    if isinstance(value, list):
        return " ".join(value).strip() or None
    if isinstance(value, str):
        return value.strip() or None
    return None


def _has_block_ancestor(element: Tag, root: Tag | BeautifulSoup) -> bool:
    parent = element.parent
    while isinstance(parent, Tag) and parent is not root:
        if parent.name and parent.name.lower() in DDB_TEXT_BLOCK_TAGS:
            return True
        parent = parent.parent
    return False


def _stable_chunk_id(section_path: list[str], text: str, seen_ids: dict[str, int]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", "-".join(section_path + [text[:48]]).lower()).strip("-") or "chunk"
    base = base[:96]
    seen = seen_ids.get(base, 0)
    seen_ids[base] = seen + 1
    return f"{base}-{seen + 1}" if seen else base


def _allow_ddb_attribute(tag: str, name: str, value: str) -> bool:
    del value
    if name.startswith("on") or name == "style":
        return False
    if name in {"id", "class", "title", "data-content-chunk-id", "data-citation-id"}:
        return True
    if tag == "a" and name == "href":
        return True
    return False
