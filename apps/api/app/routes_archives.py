import mimetypes
from pathlib import Path

from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.orm import Session

from app.archive_storage import ARCHIVE_SOURCE_TYPE, SERVED_VIEWER_CSS, ArchiveValidationError, archive_asset_path, archive_served_html_path
from app.auth import current_admin_session
from app.config import Settings, get_settings
from app.database import get_db
from app.models import AdminSession, Source


router = APIRouter(prefix="/records/sources", tags=["archives"])

ARCHIVE_IFRAME_HEADERS = {
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy": "frame-ancestors 'self'",
    "Referrer-Policy": "same-origin",
}


@router.get("/{source_id}/archive/viewer", response_class=HTMLResponse)
def read_archive_viewer(
    source_id: str,
    path: str | None = Query(default=None),
    target: str | None = Query(default=None),
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> HTMLResponse:
    source = _archived_source_or_404(db, source_id)
    served_path = path or _archive_served_html_metadata(source)
    try:
        html_path = archive_served_html_path(source_id=source_id, served_html_path=served_path, settings=settings)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archive viewer not found") from exc
    except ArchiveValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    html = _inject_viewer_highlight(html_path.read_text(encoding="utf-8"), target=target)
    return HTMLResponse(content=html, headers=ARCHIVE_IFRAME_HEADERS)


@router.get("/{source_id}/archive/assets/{asset_path:path}")
def read_archive_asset(
    source_id: str,
    asset_path: str,
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    _archived_source_or_404(db, source_id)
    try:
        path = archive_asset_path(source_id=source_id, asset_path=asset_path, settings=settings)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archive asset not found") from exc
    except ArchiveValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type, headers=ARCHIVE_IFRAME_HEADERS)


def _archived_source_or_404(db: Session, source_id: str) -> Source:
    source = db.get(Source, source_id)
    if source is None or source.source_type != ARCHIVE_SOURCE_TYPE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archive source not found")
    return source


def _archive_served_html_metadata(source: Source) -> str:
    import json

    metadata = json.loads(source.metadata_json or "{}")
    candidate = metadata.get("archive_served_html_path") or metadata.get("archive_served_entry_path")
    if not isinstance(candidate, str) or not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archive viewer not found")
    return candidate


def _inject_viewer_highlight(html: str, *, target: str | None) -> str:
    style = f"<style>{SERVED_VIEWER_CSS}</style>"
    safe_target = _safe_target(target)
    if safe_target:
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find(id=safe_target) or soup.find(attrs={"data-source-chunk-id": safe_target})
        if element is not None:
            existing_class = element.get("class") or []
            element["class"] = [*existing_class, "archive-target-highlight"]
            html = str(soup)
    if safe_target:
        style = f"<meta http-equiv=\"refresh\" content=\"0;url=#{safe_target}\">" + style
    injection = style
    if "</head>" in html.lower():
        index = html.lower().rfind("</head>")
        return html[:index] + injection + html[index:]
    return injection + html


def _safe_target(target: str | None) -> str | None:
    if target is None:
        return None
    cleaned = target.lstrip("#").strip()
    if not cleaned or len(cleaned) > 160:
        return None
    if any(character in cleaned for character in "<>'\"`\\/ "):
        return None
    if Path(cleaned).suffix:
        return None
    return cleaned
