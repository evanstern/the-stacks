from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    admin_password_hash: str = Field(default="", alias="ADMIN_PASSWORD_HASH")
    session_secret: str = Field(default="", alias="SESSION_SECRET")
    session_cookie_name: str = Field(default="thestacks_session", alias="SESSION_COOKIE_NAME")
    session_cookie_secure: bool = Field(default=False, alias="SESSION_COOKIE_SECURE")
    session_ttl_seconds: int = Field(default=7 * 24 * 60 * 60, alias="SESSION_TTL_SECONDS")
    database_url: str = Field(
        default="postgresql+psycopg://thestacks:thestacks@postgres:5432/thestacks",
        alias="DATABASE_URL",
    )
    cors_origins: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")
    upload_dir: str = Field(default="/data/uploads", alias="UPLOAD_DIR")
    archive_max_zip_size_bytes: int = Field(default=50 * 1024 * 1024, alias="ARCHIVE_MAX_ZIP_SIZE_BYTES")
    archive_max_extracted_size_bytes: int = Field(default=200 * 1024 * 1024, alias="ARCHIVE_MAX_EXTRACTED_SIZE_BYTES")
    archive_max_file_count: int = Field(default=2000, alias="ARCHIVE_MAX_FILE_COUNT")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_chat_model: str = Field(default="gpt-4.1-mini", alias="OPENAI_CHAT_MODEL")
    embedding_provider: str = Field(default="openai", alias="EMBEDDING_PROVIDER")
    openai_embedding_model: str = Field(default="text-embedding-3-small", alias="OPENAI_EMBEDDING_MODEL")
    openai_embedding_dimensions: int = Field(default=1536, alias="OPENAI_EMBEDDING_DIMENSIONS")
    huggingface_embedding_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2",
        alias="HUGGINGFACE_EMBEDDING_MODEL",
    )
    huggingface_embedding_dimensions: int = Field(default=384, alias="HUGGINGFACE_EMBEDDING_DIMENSIONS")
    qdrant_url: str = Field(default="http://qdrant:6333", alias="QDRANT_URL")
    qdrant_collection: str = Field(default="thestacks_chunks", alias="QDRANT_COLLECTION")
    retrieval_top_k: int = Field(default=8, alias="RETRIEVAL_TOP_K")
    retrieval_min_score: float = Field(default=0.2, alias="RETRIEVAL_MIN_SCORE")

    model_config = SettingsConfigDict(env_file=None, populate_by_name=True)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
