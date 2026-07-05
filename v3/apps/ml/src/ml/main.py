import asyncio
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .models import ModelState, load_model
from .schemas import EmbedRequest, EmbedResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_id = os.environ["ML_EMBEDDING_MODEL"]
    state = ModelState(status="loading", model_id=model_id)
    app.state.model_state = state

    task = asyncio.create_task(load_model(state))
    try:
        yield
    finally:
        task.cancel()


def _error(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)

    @app.exception_handler(RequestValidationError)
    async def on_validation_error(_request: Request, _exc: RequestValidationError) -> JSONResponse:
        # Malformed/empty/non-string inputs are "payload the system doesn't
        # handle" (contracts/ml-sidecar.md) — 415, not FastAPI's default 422.
        return JSONResponse(status_code=415, content=_error("unsupported_type", "Invalid request payload."))

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    @app.get("/ready")
    async def ready(response: Response) -> dict:
        state: ModelState = app.state.model_state

        if state.status == "ready":
            return {"status": "ready", "model": state.model_id, "dimensions": state.dimensions}

        response.status_code = 503
        if state.status == "failed":
            return {"status": "failed", "message": state.error_message}
        return {"status": "loading"}

    @app.post("/v1/embed")
    async def embed(body: EmbedRequest, response: Response):
        state: ModelState = app.state.model_state

        if state.status != "ready":
            response.status_code = 503
            return _error("dependency_down", "Model is not ready.")

        if body.model != state.model_id:
            response.status_code = 404
            return _error("unknown_thing", f"Model '{body.model}' is not the loaded model.")

        max_batch = int(os.environ.get("EMBED_MAX_BATCH", "64"))
        if len(body.inputs) > max_batch:
            response.status_code = 415
            return _error("unsupported_type", f"inputs exceeds EMBED_MAX_BATCH ({max_batch}).")

        try:
            start = time.perf_counter()
            raw_embeddings = state.model.encode(body.inputs)  # type: ignore[union-attr]
            embeddings = [list(map(float, row)) for row in raw_embeddings]
            duration_ms = int((time.perf_counter() - start) * 1000)
        except Exception:
            response.status_code = 500
            return _error("internal_fault", "Embedding inference failed.")

        return EmbedResponse(
            model=state.model_id,
            dimensions=state.dimensions,  # type: ignore[arg-type]
            embeddings=embeddings,
            duration_ms=duration_ms,
        )

    return app


app = create_app()
