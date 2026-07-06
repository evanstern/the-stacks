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
