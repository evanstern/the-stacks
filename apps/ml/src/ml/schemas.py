"""Wire shapes for POST /v1/embed (contracts/ml-sidecar.md).

Validation failures here surface as 415 unsupported_type, not FastAPI's
default 422 — main.py's RequestValidationError handler does the conversion.
"""

from pydantic import BaseModel, Field, StrictStr


class EmbedRequest(BaseModel):
    """Batch embed request. `model` is the caller's asserted model identity —
    checked against the loaded model on every call (mismatch -> 404) so two
    services can never silently mix vector spaces."""

    model: str
    # StrictStr so a non-string entry (e.g. an int) fails validation instead of
    # being silently coerced — the contract requires 415 on non-string inputs.
    # min_length=1 makes an empty batch a validation error (-> 415) too.
    inputs: list[StrictStr] = Field(min_length=1)


class EmbedResponse(BaseModel):
    """Batch-out mirror of the request: embeddings[i] belongs to inputs[i].
    `model`/`dimensions` echo the served model so callers can double-check
    what produced the vectors; duration_ms is inference time only."""

    model: str
    dimensions: int
    embeddings: list[list[float]]
    duration_ms: int


class RerankPassage(BaseModel):
    """One candidate for rescoring; `id` is the caller's correlation key —
    the sidecar never interprets it (contracts/reranker.md: the caller owns
    ordering, the sidecar owns scoring)."""

    id: StrictStr = Field(min_length=1)
    text: StrictStr = Field(min_length=1)


class RerankRequest(BaseModel):
    """Cross-encoder rescoring request (spec 010 US5). The 256 cap is the
    contract's hard per-call bound — engine-side RETRIEVAL_RERANK_DEPTH is
    validated to fit under it at config time."""

    model: str
    query: StrictStr = Field(min_length=1, max_length=1024)
    passages: list[RerankPassage] = Field(min_length=1, max_length=256)


class RerankScore(BaseModel):
    id: str
    score: float


class RerankResponse(BaseModel):
    """Raw cross-encoder logits per passage — comparable within ONE response
    only; callers re-sort and must never normalize across runs."""

    model: str
    scores: list[RerankScore]
    duration_ms: int
