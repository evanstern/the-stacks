"""FastAPI entry point for the ml sidecar — the only Python in v3 (decision D2).

A stateless, inference-only embedding service: no DB access, no queue, no auth.
The TS api/worker call POST /v1/embed over the compose network; orchestration
gates on GET /ready. Contract: specs/007-v3-skeleton/contracts/ml-sidecar.md.

Design seams worth knowing before reading the handlers:
- The served model is pinned by ML_EMBEDDING_MODEL (Principle VII: config over
  hardcoding). Loading happens in a background task (see lifespan) so /health
  answers immediately even while a multi-hundred-MB first download is in flight.
- Errors use the same envelope as the TS API — {"error": {"code", "message"}} —
  so callers have one error shape across the whole stack.
"""

import asyncio
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .models import ModelState, RerankerState, load_model, load_reranker
from .schemas import EmbedRequest, EmbedResponse, RerankRequest, RerankResponse, RerankScore


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Kick off model loading WITHOUT blocking startup (research R4).

    If we loaded synchronously here, uvicorn wouldn't bind until the model was
    downloaded, so /health (the liveness probe) would be unreachable and the
    orchestrator could kill the container mid-download. Instead we mark state
    "loading", start load_model as a background task, and let /ready report
    progress. First start pays the download into the hf-cache volume once;
    warm starts load from cache (SC-001).
    """
    # Intentionally os.environ[...] (not .get): a missing model id should crash
    # loudly at startup, never fall back to a hardcoded default (Principle VII).
    model_id = os.environ["ML_EMBEDDING_MODEL"]
    state = ModelState(status="loading", model_id=model_id)
    app.state.model_state = state

    # The reranker role is OPTIONAL (spec 010 R9): .get, not [...] — an empty
    # or absent id means "disabled", reported honestly on /ready, never an
    # error. Contrast with the embedding role above, which must exist.
    reranker_id = os.environ.get("ML_RERANKER_MODEL", "").strip()
    reranker_state = (
        RerankerState(status="loading", model_id=reranker_id)
        if reranker_id
        else RerankerState(status="disabled", model_id="")
    )
    app.state.reranker_state = reranker_state

    task = asyncio.create_task(load_model(state))
    reranker_task = (
        asyncio.create_task(load_reranker(reranker_state)) if reranker_id else None
    )
    try:
        yield
    finally:
        # Shutdown: cancel in-flight loads so uvicorn can exit promptly.
        task.cancel()
        if reranker_task is not None:
            reranker_task.cancel()


def _error(code: str, message: str) -> dict:
    """Build the stack-wide error envelope: {"error": {"code", "message"}}."""
    return {"error": {"code": code, "message": message}}


def create_app() -> FastAPI:
    """App factory — tests build fresh instances; uvicorn serves the module-level `app`."""
    app = FastAPI(lifespan=lifespan)

    @app.exception_handler(RequestValidationError)
    async def on_validation_error(_request: Request, _exc: RequestValidationError) -> JSONResponse:
        # Malformed/empty/non-string inputs are "payload the system doesn't
        # handle" (contracts/ml-sidecar.md) — 415, not FastAPI's default 422.
        return JSONResponse(status_code=415, content=_error("unsupported_type", "Invalid request payload."))

    @app.get("/health")
    async def health() -> dict:
        # Liveness only: "the process is up". Deliberately ignores model state
        # so orchestrators don't restart-loop us during a long first download.
        return {"status": "ok"}

    @app.get("/ready")
    async def ready(response: Response) -> dict:
        # Readiness: 503 {"loading"} -> 200 {"ready", model, dimensions} once the
        # background load finishes, or 503 {"failed"} with a scrubbed message
        # (load_model never leaks the raw exception). Compose healthchecks and
        # api-side callers gate on this endpoint, not /health.
        state: ModelState = app.state.model_state
        # Additive since 010: the reranker role's state rides along, but the
        # stack's overall readiness stays the EMBEDDING role's story — a
        # disabled/loading optional role must not fail compose healthchecks.
        reranker: RerankerState = app.state.reranker_state
        reranker_report = {"status": reranker.status, "model": reranker.model_id or None}
        if reranker.status == "disabled":
            reranker_report = {"status": "disabled"}

        if state.status == "ready":
            return {
                "status": "ready",
                "model": state.model_id,
                "dimensions": state.dimensions,
                "reranker": reranker_report,
            }

        response.status_code = 503
        if state.status == "failed":
            return {"status": "failed", "message": state.error_message, "reranker": reranker_report}
        return {"status": "loading", "reranker": reranker_report}

    @app.post("/v1/embed")
    async def embed(body: EmbedRequest, response: Response):
        # Batch-in/batch-out embedding. Guard order mirrors the contract:
        # not-ready (503) -> model mismatch (404) -> oversize (415) -> infer.
        # Shape errors (empty batch, non-string entries) never reach here —
        # Pydantic rejects them and the handler above converts to 415.
        state: ModelState = app.state.model_state

        if state.status != "ready":
            response.status_code = 503
            return _error("dependency_down", "Model is not ready.")

        # The seam-level guard against silent vector-space mixing: callers must
        # assert the model they were configured for on EVERY call. If it isn't
        # the loaded model, that's a request for a thing we don't have -> 404.
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
            # numpy float32 rows -> plain Python floats so JSON serialization
            # is exact and callers never see numpy types.
            embeddings = [list(map(float, row)) for row in raw_embeddings]
            duration_ms = int((time.perf_counter() - start) * 1000)
        except Exception:
            # Any inference failure is an internal fault; details stay in logs,
            # never in the response body.
            response.status_code = 500
            return _error("internal_fault", "Embedding inference failed.")

        return EmbedResponse(
            model=state.model_id,
            dimensions=state.dimensions,  # type: ignore[arg-type]
            embeddings=embeddings,
            duration_ms=duration_ms,
        )

    @app.post("/v1/rerank")
    async def rerank(body: RerankRequest, response: Response):
        # Cross-encoder rescoring (spec 010, contracts/reranker.md). Guard
        # order mirrors /v1/embed: not-ready (503) -> model mismatch (404) ->
        # infer. Shape errors (empty/oversized batch, blank query) never
        # reach here — Pydantic rejects them and the handler above converts
        # to 415. ONE error taxonomy across the stack: dependency_down /
        # unknown_thing / unsupported_type, same as every other seam.
        state: RerankerState = app.state.reranker_state

        if state.status == "disabled":
            response.status_code = 503
            return _error(
                "dependency_down",
                "Reranker role is disabled (ML_RERANKER_MODEL is unset).",
            )
        if state.status != "ready":
            response.status_code = 503
            return _error("dependency_down", f"Reranker model is not ready ({state.status}).")

        if body.model != state.model_id:
            response.status_code = 404
            return _error("unknown_thing", f"Model '{body.model}' is not the loaded reranker.")

        try:
            start = time.perf_counter()
            pairs = [(body.query, passage.text) for passage in body.passages]
            raw_scores = state.model.predict(pairs)  # type: ignore[union-attr]
            duration_ms = int((time.perf_counter() - start) * 1000)
        except Exception:
            response.status_code = 500
            return _error("internal_fault", "Rerank inference failed.")

        return RerankResponse(
            model=state.model_id,
            scores=[
                RerankScore(id=passage.id, score=float(score))
                for passage, score in zip(body.passages, raw_scores)
            ],
            duration_ms=duration_ms,
        )

    return app


app = create_app()
