from pydantic import BaseModel, Field, StrictStr


class EmbedRequest(BaseModel):
    model: str
    # StrictStr so a non-string entry (e.g. an int) fails validation instead of
    # being silently coerced — the contract requires 415 on non-string inputs.
    inputs: list[StrictStr] = Field(min_length=1)


class EmbedResponse(BaseModel):
    model: str
    dimensions: int
    embeddings: list[list[float]]
    duration_ms: int
