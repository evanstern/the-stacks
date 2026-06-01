from datetime import timedelta

from fastapi import Cookie, Depends, HTTPException, Response, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import AdminSession, utcnow


password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_admin_password(password: str, settings: Settings) -> bool:
    if not settings.admin_password_hash:
        return False
    return password_context.verify(password, settings.admin_password_hash)


def _serializer(settings: Settings) -> URLSafeTimedSerializer:
    if not settings.session_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session secret is not configured.",
        )
    return URLSafeTimedSerializer(settings.session_secret, salt="thestacks-session")


def create_admin_session(db: Session, response: Response, settings: Settings) -> AdminSession:
    now = utcnow()
    admin_session = AdminSession(expires_at=now + timedelta(seconds=settings.session_ttl_seconds))
    db.add(admin_session)
    db.commit()
    db.refresh(admin_session)

    token = _serializer(settings).dumps(admin_session.id)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_ttl_seconds,
        expires=settings.session_ttl_seconds,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )
    return admin_session


def clear_admin_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


def _is_expired(admin_session: AdminSession) -> bool:
    expires_at = admin_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=utcnow().tzinfo)
    return expires_at <= utcnow()


def current_admin_session(
    signed_session: str | None = Cookie(default=None, alias="thestacks_session"),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AdminSession:
    if not signed_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        session_id = _serializer(settings).loads(signed_session, max_age=settings.session_ttl_seconds)
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated") from None

    admin_session = db.get(AdminSession, session_id)
    if admin_session is None or _is_expired(admin_session):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return admin_session
