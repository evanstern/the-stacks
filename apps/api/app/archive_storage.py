import hashlib
import json
import mimetypes
import re
import shutil
import stat
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from urllib.parse import quote, unquote, urlsplit

import bleach
from bs4 import BeautifulSoup, Tag
from bs4.element import Comment

from app.config import Settings


ARCHIVE_SOURCE_TYPE = "archived_webpage"
ARCHIVE_ROOT_NAME = "source-archives"
MAX_COMPRESSION_RATIO = 100

HTML_EXTENSIONS = {".html", ".htm"}
ALLOWED_ASSET_EXTENSIONS = {
    ".avif",
    ".bmp",
    ".css",
    ".eot",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".js",
    ".json",
    ".map",
    ".mjs",
    ".otf",
    ".png",
    ".svg",
    ".ttf",
    ".txt",
    ".wasm",
    ".webp",
    ".woff",
    ".woff2",
    ".xml",
}
ALLOWED_EXTENSIONS = HTML_EXTENSIONS | ALLOWED_ASSET_EXTENSIONS
ALLOWED_MIME_PREFIXES = {"image/", "font/", "text/"}
ALLOWED_MIME_TYPES = {
    "application/font-woff",
    "application/javascript",
    "application/json",
    "application/octet-stream",
    "application/wasm",
    "application/x-font-ttf",
    "application/xml",
    "text/ecmascript",
    "text/javascript",
}
SERVED_VIEWER_CSS = """
:target,
.archive-target-highlight {
  outline: 3px solid #f59e0b;
  outline-offset: 0.25rem;
  background: #fef3c7;
  scroll-margin-block: 2rem;
}
""".strip()


class ArchiveValidationError(ValueError):
    pass


@dataclass(frozen=True)
class ArchiveEntry:
    name: str
    size: int
    compressed_size: int
    sha256: str
    mime_type: str


@dataclass(frozen=True)
class StoredArchive:
    source_id: str
    root_dir: Path
    original_zip_path: Path
    original_dir: Path
    served_dir: Path
    manifest_path: Path
    primary_html_path: Path
    served_html_path: Path
    anchor_map_path: Path
    manifest: dict[str, object]


ARCHIVE_TEXT_BLOCK_TAGS = {"p", "li", "blockquote", "pre", "td", "th", "dt", "dd"}
ARCHIVE_REMOVED_TAGS = {
    "script",
    "noscript",
    "template",
    "iframe",
    "object",
    "embed",
    "form",
    "button",
    "input",
    "select",
    "textarea",
}
ARCHIVE_ALLOWED_TAGS = frozenset(
    {
        "html",
        "head",
        "body",
        "title",
        "meta",
        "link",
        "article",
        "main",
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
        "img",
        "br",
        "hr",
        "dl",
        "dt",
        "dd",
    }
)
ARCHIVE_ALLOWED_PROTOCOLS = frozenset({"http", "https", "mailto"})
ARCHIVE_ASSET_ATTRIBUTES = {
    "img": ("src",),
    "link": ("href",),
}
ARCHIVE_URL_ATTRIBUTES = {"href", "src", "srcset", "action", "formaction", "poster", "background"}


def store_source_archive(
    *,
    source_id: str,
    original_filename: str,
    content: bytes,
    settings: Settings,
) -> StoredArchive:
    validation = _validate_zip_archive(content, settings)
    archive_root = Path(settings.upload_dir) / ARCHIVE_ROOT_NAME / source_id
    if archive_root.exists():
        raise ArchiveValidationError("Archive source storage already exists")

    archive_root.parent.mkdir(parents=True, exist_ok=True)
    temp_root = Path(tempfile.mkdtemp(dir=archive_root.parent))
    try:
        original_dir = temp_root / "original"
        served_dir = temp_root / "served"
        original_dir.mkdir()
        served_dir.mkdir()
        original_zip_path = temp_root / "original.zip"
        original_zip_path.write_bytes(content)

        with zipfile.ZipFile(original_zip_path) as archive:
            for entry in validation.entries:
                target = _safe_target(original_dir, entry.name)
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(entry.name) as source:
                    target.write_bytes(source.read())

        primary_html_path = original_dir / validation.primary_html_entry
        served_html_path = served_dir / validation.primary_html_entry
        anchor_map_path = temp_root / "anchor-map.json"
        served_html_path.parent.mkdir(parents=True, exist_ok=True)
        served_copy = build_served_archive_html(
            source_id=source_id,
            primary_html_entry=validation.primary_html_entry,
            html=primary_html_path.read_text(encoding="utf-8"),
            entries={entry.name for entry in validation.entries},
        )
        served_html_path.write_text(served_copy.html, encoding="utf-8")
        anchor_map_path.write_text(json.dumps(served_copy.anchor_map, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")

        manifest = _build_manifest(
            source_id=source_id,
            original_filename=original_filename,
            content=content,
            entries=validation.entries,
            primary_html_entry=validation.primary_html_entry,
            served_html_entry=validation.primary_html_entry,
            archive_root=archive_root,
            source_url=served_copy.source_url,
        )
        (temp_root / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
        shutil.move(str(temp_root), archive_root)
    except Exception:
        if temp_root.exists():
            shutil.rmtree(temp_root)
        raise

    primary_html_path = archive_root / "original" / validation.primary_html_entry
    served_html_path = archive_root / "served" / validation.primary_html_entry
    return StoredArchive(
        source_id=source_id,
        root_dir=archive_root,
        original_zip_path=archive_root / "original.zip",
        original_dir=archive_root / "original",
        served_dir=archive_root / "served",
        manifest_path=archive_root / "manifest.json",
        primary_html_path=primary_html_path,
        served_html_path=served_html_path,
        anchor_map_path=archive_root / "anchor-map.json",
        manifest=manifest,
    )


@dataclass(frozen=True)
class ServedArchiveHtml:
    html: str
    anchor_map: dict[str, object]
    source_url: str | None = None


def build_served_archive_html(
    *,
    source_id: str,
    primary_html_entry: str,
    html: str,
    entries: set[str],
) -> ServedArchiveHtml:
    soup = BeautifulSoup(html, "html.parser")
    source_url = _detect_source_url(soup)
    root = soup.find("html") or soup
    for tag in list(root.find_all(_removed_tag)):
        tag.decompose()
    for comment in root.find_all(string=lambda value: isinstance(value, Comment)):
        comment.extract()

    primary_path = PurePosixPath(primary_html_entry)
    _sanitize_archive_attributes(root, source_id, primary_path, entries)
    anchors = _add_archive_anchors(root, source_id, primary_html_entry)

    cleaner = bleach.Cleaner(
        tags=ARCHIVE_ALLOWED_TAGS,
        attributes=_allow_archive_attribute,
        protocols=ARCHIVE_ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )
    cleaned = cleaner.clean(str(root)).strip()
    return ServedArchiveHtml(
        html=cleaned,
        anchor_map={
            "source_id": source_id,
            "source_path": primary_html_entry,
            "anchors": anchors,
        },
        source_url=source_url,
    )


def _detect_source_url(soup: BeautifulSoup) -> str | None:
    for tag in soup.find_all(["meta", "link"]):
        name = str(tag.get("name") or tag.get("property") or "").strip().lower()
        rel_values = tag.get("rel") or []
        rel = {str(value).strip().lower() for value in rel_values} if isinstance(rel_values, list) else {str(rel_values).strip().lower()}
        if tag.name == "meta" and name in {"og:url", "twitter:url", "source_url", "source-url", "canonical"}:
            candidate = str(tag.get("content") or "").strip()
        elif tag.name == "link" and "canonical" in rel:
            candidate = str(tag.get("href") or "").strip()
        else:
            continue
        parsed = urlsplit(candidate)
        if parsed.scheme.lower() in {"http", "https"} and parsed.netloc:
            return candidate
    return None


def archive_asset_path(*, source_id: str, asset_path: str, settings: Settings) -> Path:
    decoded_path = unquote(asset_path)
    if not source_id or any(part in {"", ".", ".."} for part in PurePosixPath(source_id).parts):
        raise ArchiveValidationError("Invalid archive source id")
    if not decoded_path or "\\" in decoded_path:
        raise ArchiveValidationError("Invalid archive asset path")
    path = PurePosixPath(decoded_path)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ArchiveValidationError("Invalid archive asset path")
    if Path(path.name).suffix.lower() in HTML_EXTENSIONS:
        raise ArchiveValidationError("Archive HTML is not served as an asset")
    target = Path(settings.upload_dir) / ARCHIVE_ROOT_NAME / source_id / "original" / Path(*path.parts)
    try:
        target.relative_to(Path(settings.upload_dir) / ARCHIVE_ROOT_NAME / source_id / "original")
    except ValueError as exc:
        raise ArchiveValidationError("Invalid archive asset path") from exc
    if not target.exists() or not target.is_file():
        raise FileNotFoundError(decoded_path)
    _validate_served_archive_mime(target, allow_html=False)
    return target


def archive_served_html_path(*, source_id: str, served_html_path: str, settings: Settings) -> Path:
    decoded_path = unquote(served_html_path)
    if not source_id or any(part in {"", ".", ".."} for part in PurePosixPath(source_id).parts):
        raise ArchiveValidationError("Invalid archive source id")
    if not decoded_path or "\\" in decoded_path:
        raise ArchiveValidationError("Invalid archive viewer path")
    path = PurePosixPath(decoded_path)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ArchiveValidationError("Invalid archive viewer path")
    if Path(path.name).suffix.lower() not in HTML_EXTENSIONS:
        raise ArchiveValidationError("Archive viewer path must be HTML")
    target = Path(settings.upload_dir) / ARCHIVE_ROOT_NAME / source_id / "served" / Path(*path.parts)
    served_root = Path(settings.upload_dir) / ARCHIVE_ROOT_NAME / source_id / "served"
    try:
        target.relative_to(served_root)
    except ValueError as exc:
        raise ArchiveValidationError("Invalid archive viewer path") from exc
    if not target.exists() or not target.is_file():
        raise FileNotFoundError(decoded_path)
    _validate_served_archive_mime(target, allow_html=True)
    return target


def _validate_served_archive_mime(path: Path, *, allow_html: bool) -> str:
    mime_type = mimetypes.guess_type(path.name)[0]
    if mime_type is None:
        raise ArchiveValidationError("Archive file has an unknown MIME type")
    if allow_html and mime_type == "text/html":
        return mime_type
    if not allow_html and mime_type == "text/html":
        raise ArchiveValidationError("Archive HTML is not served as an asset")
    if mime_type in ALLOWED_MIME_TYPES or any(mime_type.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES):
        return mime_type
    raise ArchiveValidationError("Archive file has a disallowed MIME type")


def _removed_tag(tag: Tag) -> bool:
    return bool(tag.name and tag.name.lower() in ARCHIVE_REMOVED_TAGS)


def _sanitize_archive_attributes(root: BeautifulSoup | Tag, source_id: str, primary_path: PurePosixPath, entries: set[str]) -> None:
    for tag in root.find_all(True):
        tag_name = tag.name.lower() if tag.name else ""
        for attribute in list(tag.attrs):
            attr_name = attribute.lower()
            if attr_name.startswith("on") or attr_name == "style":
                del tag.attrs[attribute]
                continue
            if attr_name in ARCHIVE_URL_ATTRIBUTES and attr_name not in ARCHIVE_ASSET_ATTRIBUTES.get(tag_name, ()):
                _sanitize_non_asset_url(tag, attribute)

        for attribute in ARCHIVE_ASSET_ATTRIBUTES.get(tag_name, ()):
            value = tag.get(attribute)
            rewritten = _archive_asset_url(source_id, primary_path, entries, str(value) if value is not None else "")
            if rewritten is None:
                tag.attrs.pop(attribute, None)
            else:
                tag[attribute] = rewritten


def _sanitize_non_asset_url(tag: Tag, attribute: str) -> None:
    value = str(tag.get(attribute) or "").strip()
    if not value:
        tag.attrs.pop(attribute, None)
        return
    parsed = urlsplit(value)
    if parsed.scheme.lower() == "mailto" and tag.name and tag.name.lower() == "a":
        return
    if value.startswith("#"):
        return
    tag.attrs.pop(attribute, None)


def _archive_asset_url(source_id: str, primary_path: PurePosixPath, entries: set[str], value: str) -> str | None:
    value = value.strip()
    if not value:
        return None
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or value.startswith("//") or parsed.path.startswith("/"):
        return None
    if parsed.scheme.lower() in {"javascript", "data", "vbscript"}:
        return None
    if not parsed.path:
        return None
    asset_path = _resolve_archive_relative_path(primary_path, parsed.path)
    if asset_path not in entries:
        return None
    if Path(asset_path).suffix.lower() in HTML_EXTENSIONS:
        return None
    quoted_path = quote(asset_path, safe="/")
    return f"/records/sources/{quote(source_id, safe='')}/archive/assets/{quoted_path}"


def _resolve_archive_relative_path(primary_path: PurePosixPath, value: str) -> str:
    base = primary_path.parent
    candidate = PurePosixPath(value)
    parts = [part for part in (*base.parts, *candidate.parts) if part not in {"", "."}]
    resolved: list[str] = []
    for part in parts:
        if part == "..":
            if resolved:
                resolved.pop()
            continue
        resolved.append(part)
    return str(PurePosixPath(*resolved))


def _add_archive_anchors(root: BeautifulSoup | Tag, source_id: str, source_path: str) -> list[dict[str, object]]:
    anchors: list[dict[str, object]] = []
    heading_stack: list[tuple[int, str]] = []
    seen_ids: dict[str, int] = {}
    for element in root.descendants:
        if not isinstance(element, Tag) or not element.name:
            continue
        name = element.name.lower()
        level = _heading_level(name)
        if level is not None:
            heading_text = _normalize_text(element.get_text(" "))
            if heading_text:
                heading_stack = [item for item in heading_stack if item[0] < level]
                heading_stack.append((level, heading_text))
            continue
        if name not in ARCHIVE_TEXT_BLOCK_TAGS or _has_text_block_ancestor(element):
            continue
        quote_text = _normalize_text(element.get_text(" "))
        if not quote_text:
            continue
        heading_path = [item[1] for item in heading_stack]
        chunk_id = _archive_chunk_id(source_id, source_path, heading_path, quote_text, seen_ids)
        element["data-source-chunk-id"] = chunk_id
        element["id"] = f"source-chunk-{chunk_id}"
        anchors.append(
            {
                "chunk_id": chunk_id,
                "selector": f'[data-source-chunk-id="{chunk_id}"]',
                "heading_path": heading_path,
                "quote": quote_text[:240],
                "source_path": source_path,
                "viewer_fragment": f"#source-chunk-{chunk_id}",
            }
        )
    return anchors


def _heading_level(name: str) -> int | None:
    if re.fullmatch(r"h[1-6]", name):
        return int(name[1])
    return None


def _has_text_block_ancestor(element: Tag) -> bool:
    parent = element.parent
    while isinstance(parent, Tag):
        if parent.name and parent.name.lower() in ARCHIVE_TEXT_BLOCK_TAGS:
            return True
        parent = parent.parent
    return False


def _archive_chunk_id(source_id: str, source_path: str, heading_path: list[str], text: str, seen_ids: dict[str, int]) -> str:
    seed = json.dumps([source_id, source_path, heading_path, text], ensure_ascii=False, separators=(",", ":"))
    base = f"archive-{hashlib.sha256(seed.encode('utf-8')).hexdigest()[:16]}"
    count = seen_ids.get(base, 0)
    seen_ids[base] = count + 1
    return base if count == 0 else f"{base}-{count + 1}"


def _normalize_text(text: str) -> str:
    return re.sub(r"[ \t\r\f\v]+", " ", text).strip()


def _allow_archive_attribute(tag: str, name: str, value: str) -> bool:
    if name.startswith("on") or name == "style":
        return False
    allowed_by_tag = {
        "a": {"href", "title", "id", "class", "data-source-chunk-id"},
        "img": {"src", "alt", "title", "width", "height", "id", "class", "data-source-chunk-id"},
        "link": {"rel", "href", "type", "media"},
        "meta": {"charset", "name", "content"},
    }
    common = {"id", "class", "data-source-chunk-id", "title"}
    return name in common or name in allowed_by_tag.get(tag, set())


@dataclass(frozen=True)
class _ArchiveValidation:
    entries: list[ArchiveEntry]
    primary_html_entry: str


def _validate_zip_archive(content: bytes, settings: Settings) -> _ArchiveValidation:
    if len(content) > settings.archive_max_zip_size_bytes:
        raise ArchiveValidationError("Archive ZIP exceeds the maximum allowed size")

    try:
        with tempfile.TemporaryFile() as temp_file:
            temp_file.write(content)
            temp_file.seek(0)
            with zipfile.ZipFile(temp_file) as archive:
                infos = archive.infolist()
                for info in infos:
                    _validate_zip_info(info)
                entries = [info for info in infos if not info.is_dir()]
                if len(entries) > settings.archive_max_file_count:
                    raise ArchiveValidationError("Archive contains too many files")

                validated_entries: list[ArchiveEntry] = []
                html_entries: list[str] = []
                extracted_size = 0
                for info in entries:
                    extension = Path(info.filename).suffix.lower()
                    if extension not in ALLOWED_EXTENSIONS:
                        raise ArchiveValidationError(f"Archive entry has a disallowed extension: {info.filename}")
                    mime_type = _validate_entry_mime(info.filename)
                    extracted_size += info.file_size
                    if extracted_size > settings.archive_max_extracted_size_bytes:
                        raise ArchiveValidationError("Archive extracted content exceeds the maximum allowed size")
                    if _is_zip_bomb_candidate(info):
                        raise ArchiveValidationError("Archive entry has an unsafe compression ratio")
                    digest = hashlib.sha256(archive.read(info.filename)).hexdigest()
                    validated_entries.append(
                        ArchiveEntry(
                            name=info.filename,
                            size=info.file_size,
                            compressed_size=info.compress_size,
                            sha256=digest,
                            mime_type=mime_type,
                        )
                    )
                    if extension in HTML_EXTENSIONS:
                        html_entries.append(info.filename)
    except zipfile.BadZipFile as exc:
        raise ArchiveValidationError("Uploaded archive is not a valid ZIP file") from exc

    if not html_entries:
        raise ArchiveValidationError("Archive must contain exactly one HTML file")
    if len(html_entries) > 1:
        raise ArchiveValidationError("Archive contains multiple HTML files")
    return _ArchiveValidation(entries=validated_entries, primary_html_entry=html_entries[0])


def _validate_zip_info(info: zipfile.ZipInfo) -> None:
    if not info.filename:
        raise ArchiveValidationError("Archive contains an empty entry name")
    if "\\" in info.filename:
        raise ArchiveValidationError("Archive entry paths must use ZIP-safe separators")
    path = PurePosixPath(info.filename)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ArchiveValidationError("Archive contains an unsafe entry path")
    mode = (info.external_attr >> 16) & 0o170000
    if mode == stat.S_IFLNK:
        raise ArchiveValidationError("Archive contains a symbolic link")


def _validate_entry_mime(filename: str) -> str:
    mime_type = mimetypes.guess_type(filename)[0]
    if mime_type is None:
        raise ArchiveValidationError(f"Archive entry has an unknown MIME type: {filename}")
    if mime_type in ALLOWED_MIME_TYPES or any(mime_type.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES):
        return mime_type
    raise ArchiveValidationError(f"Archive entry has a disallowed MIME type: {filename}")


def _is_zip_bomb_candidate(info: zipfile.ZipInfo) -> bool:
    if info.file_size == 0:
        return False
    if info.compress_size == 0:
        return True
    return info.file_size / info.compress_size > MAX_COMPRESSION_RATIO


def _safe_target(root: Path, entry_name: str) -> Path:
    target = root / entry_name
    target.relative_to(root)
    return target


def _build_manifest(
    *,
    source_id: str,
    original_filename: str,
    content: bytes,
    entries: list[ArchiveEntry],
    primary_html_entry: str,
    served_html_entry: str,
    archive_root: Path,
    source_url: str | None = None,
) -> dict[str, object]:
    manifest: dict[str, object] = {
        "source_id": source_id,
        "source_type": ARCHIVE_SOURCE_TYPE,
        "original_filename": original_filename,
        "original_sha256": hashlib.sha256(content).hexdigest(),
        "original_size_bytes": len(content),
        "primary_html_path": primary_html_entry,
        "served_html_path": served_html_entry,
        "anchor_map_path": "anchor-map.json",
        "file_count": len(entries),
        "extracted_size_bytes": sum(entry.size for entry in entries),
        "archive_root": str(archive_root),
        "original_zip_path": str(archive_root / "original.zip"),
        "original_dir": str(archive_root / "original"),
        "entries": [
            {
                "path": entry.name,
                "size_bytes": entry.size,
                "compressed_size_bytes": entry.compressed_size,
                "sha256": entry.sha256,
                "mime_type": entry.mime_type,
            }
            for entry in entries
        ],
    }
    if source_url:
        manifest["source_url"] = source_url
    return manifest
