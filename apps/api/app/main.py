from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes_archives import router as archives_router
from app.routes_auth import router as auth_router
from app.routes_ingestion import router as ingestion_router
from app.routes_records import router as records_router
from app.routes_sessions import router as sessions_router
from app.routes_uploads import router as uploads_router


settings = get_settings()


app = FastAPI(title="The Stacks API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(archives_router)
app.include_router(ingestion_router)
app.include_router(records_router)
app.include_router(sessions_router)
app.include_router(uploads_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
