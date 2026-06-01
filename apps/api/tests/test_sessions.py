import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$AVhh6Snv3FcaevOnJ0dwR.SfBrkaPp036/Nt/wwdVTsVQNuR1XKx2"
os.environ["SESSION_SECRET"] = "test-session-secret"
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from app.config import Settings, get_settings
from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)

    def override_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_settings() -> Settings:
        return Settings(
            ADMIN_PASSWORD_HASH=os.environ["ADMIN_PASSWORD_HASH"],
            SESSION_SECRET=os.environ["SESSION_SECRET"],
            DATABASE_URL="sqlite+pysqlite:///:memory:",
        )

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_settings] = override_settings
    with TestClient(app) as test_client:
        assert test_client.post("/auth/login", json={"password": "admin-password"}).status_code == 200
        yield test_client
    app.dependency_overrides.clear()


def test_sessions_require_authentication() -> None:
    with TestClient(app) as unauthenticated_client:
        response = unauthenticated_client.get("/sessions")

    assert response.status_code == 401


def test_create_list_latest_and_get_session(client: TestClient) -> None:
    first = client.post("/sessions", json={"title": "First session"})
    second = client.post("/sessions", json={"title": "Second session"})

    assert first.status_code == 201
    assert second.status_code == 201
    first_payload = first.json()
    second_payload = second.json()
    assert first_payload["title"] == "First session"
    assert first_payload["metadata"] == {}
    assert set(first_payload) == {"id", "title", "created_at", "updated_at", "metadata"}

    list_response = client.get("/sessions")
    assert list_response.status_code == 200
    assert [session["id"] for session in list_response.json()] == [second_payload["id"], first_payload["id"]]

    latest_response = client.get("/sessions/latest")
    assert latest_response.status_code == 200
    assert latest_response.json()["id"] == second_payload["id"]

    get_response = client.get(f"/sessions/{first_payload['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == first_payload["id"]


def test_latest_returns_null_when_no_sessions(client: TestClient) -> None:
    response = client.get("/sessions/latest")

    assert response.status_code == 200
    assert response.json() is None


def test_get_session_returns_404_for_missing_session(client: TestClient) -> None:
    response = client.get("/sessions/not-found")

    assert response.status_code == 404
