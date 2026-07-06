"""Model lifecycle for the ml sidecar: shared state + background loader.

The whole readiness story (research R4, contracts/ml-sidecar.md) hangs on one
mutable ModelState instance created in main.lifespan and hung on app.state.
load_model mutates it in place; the /ready and /v1/embed handlers only read it.
Single-writer, single event loop — no locking needed.
"""

from dataclasses import dataclass
from typing import Literal, Optional

# One-way progression: loading -> ready | failed. There is no retry state;
# a failed load stays failed until the container restarts.
Status = Literal["loading", "ready", "failed"]


@dataclass
class ModelState:
    """The sidecar's only mutable state (it is otherwise stateless, D2).

    model is typed `object` (not SentenceTransformer) so importing this module
    never pulls in the heavyweight ML stack — see the deferred import below.
    dimensions is discovered from the loaded model, not configured, so /ready
    can advertise the true vector width to callers.
    """

    status: Status
    model_id: str
    model: Optional[object] = None
    dimensions: Optional[int] = None
    error_message: Optional[str] = None


async def load_model(state: ModelState) -> None:
    """Downloads (into the HF cache) and loads the pinned embedding model,
    then flips readiness. Runs as a background task so /health stays
    reachable while this is in flight (research R4).

    Ordering matters: status flips to "ready" LAST, only after model and
    dimensions are populated, so a reader that sees "ready" can trust both.
    """
    try:
        # Deferred import: keeps app startup (and tests that stub this out)
        # from paying the torch/transformers import cost up front.
        from sentence_transformers import SentenceTransformer

        # Downloads to HF_HOME (/hf-cache volume in Docker) on first run;
        # subsequent starts are a cache hit (SC-001).
        model = SentenceTransformer(state.model_id)
        state.model = model
        state.dimensions = model.get_sentence_embedding_dimension()
        state.status = "ready"
    except Exception:
        # Scrubbed on purpose: /ready surfaces this message verbatim, and raw
        # loader exceptions can embed URLs, paths, or tokens. Details belong
        # in logs, not the HTTP response.
        state.status = "failed"
        state.error_message = "Model failed to load."
