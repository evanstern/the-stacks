from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.auth import clear_admin_cookie, create_admin_session, current_admin_session, verify_admin_password
from app.config import Settings, get_settings
from app.database import get_db
from app.models import AdminSession
from app.schemas import AuthStatus, LoginRequest


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthStatus)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthStatus:
    if not verify_admin_password(payload.password, settings):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
    create_admin_session(db, response, settings)
    return AuthStatus(authenticated=True)


@router.post("/logout", response_model=AuthStatus)
def logout(
    response: Response,
    admin_session: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthStatus:
    db.execute(delete(AdminSession).where(AdminSession.id == admin_session.id))
    db.commit()
    clear_admin_cookie(response, settings)
    return AuthStatus(authenticated=False)


@router.get("/me", response_model=AuthStatus)
def me(_: AdminSession = Depends(current_admin_session)) -> AuthStatus:
    return AuthStatus(authenticated=True)
