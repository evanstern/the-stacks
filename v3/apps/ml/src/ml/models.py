from dataclasses import dataclass
from typing import Literal, Optional

Status = Literal["loading", "ready", "failed"]


@dataclass
class ModelState:
    status: Status
    model_id: str
    model: Optional[object] = None
    dimensions: Optional[int] = None
    error_message: Optional[str] = None


async def load_model(state: ModelState) -> None:
    """Downloads (into the HF cache) and loads the pinned embedding model,
    then flips readiness. Runs as a background task so /health stays
    reachable while this is in flight (research R4)."""
    try:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(state.model_id)
        state.model = model
        state.dimensions = model.get_sentence_embedding_dimension()
        state.status = "ready"
    except Exception:
        state.status = "failed"
        state.error_message = "Model failed to load."
