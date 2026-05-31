# LangGraph workflow boundary

Ikis treats LangGraph as an optional sidecar for orchestration. SQLite/libSQL remains the canonical store for corpus sources, documents, review suggestions, human decisions, retrieval runs, messages, and citations.

## Contract

- `workflow_runs` records workflow kind, thread ID, status, target ID, input refs, output refs, and errors.
- Workflow input/output refs may contain IDs, titles, short summaries, and metadata refs.
- Workflow refs must not contain full document bodies, chunk text, normalized corpus text, or canonical review decisions.
- Side effects happen through app repositories, so review suggestions and human decisions stay in canonical app tables.
- `LANGGRAPH_ENABLED=false` uses the deterministic fake provider so review orchestration tests and local browser flows do not require a LangGraph service.

## Current prototype

Task 12 proves the review-suggestion sidecar boundary. `normalizeImportForReview` can route a new review item through `runReviewSuggestionWorkflow`, which stores a `workflow_runs` row with a deterministic thread ID and then writes the review suggestion through `createReviewRepository`. Human approval/rejection/defer decisions still use the review queue service and remain authoritative.

The fake provider is deterministic and summary-only. It exists to keep LangGraph optional until a real sidecar service is added behind the same provider interface.

## Operating boundary

Use the fake provider for setup, local QA, and e2e runs by setting
`LANGGRAPH_ENABLED=false`. That path still writes workflow audit rows and review
suggestions through Ikis repositories, but it does not require a separate
LangGraph process.

If a real LangGraph sidecar is introduced, keep the sidecar outside the product
truth boundary:

- Ikis sends review item IDs, target IDs, titles, summary refs, and metadata refs.
- LangGraph returns workflow status, thread IDs, suggestion IDs, and summary
  outputs.
- Ikis persists all canonical sources, documents, review decisions, chunks,
  conversations, retrieval traces, and citations in SQLite/libSQL.

Conversation orchestration can use the same rule later: LangGraph may coordinate
steps, but answer grounding, retrieval traces, no-evidence behavior, and
citations stay in Ikis-owned tables.
