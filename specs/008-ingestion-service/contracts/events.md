# Contract: Ingestion Event Vocabulary

The append-only trail (FR-007/FR-010, Principle IV). Table and construction:
data-model.md `ingestion_events` — sole writer `recordIngestionEvent()`; corrections are
new events, never edits (the skeleton's doctrine, copied).

## Stages × events

| stage | scope | emitted events | detail keys (scrubbed — counts and reasons, never content/secrets) |
|---|---|---|---|
| `intake` | source or batch | `completed` | `byteSize`, `mediaType`, `duplicate` |
| `expand` | batch | `started`, `completed`, `failed`, per-entry `skipped` | `entries`, `ingestible`; skipped: `entryName`, `reason` |
| `detect` | source | `started`, `completed`, `failed` | `plugin`, `version`, `confidence`, `candidates` (name→confidence map) |
| `extract` | source | `started`, `completed`, `failed` | failure: `category` (PluginFailureCategory) |
| `transform` | source | `started`, `completed`, `failed` | `sections`, `artifacts`, `warnings` (count), `contractVersion` |
| `chunk` | source | `started`, `completed`, `failed` | `chunks`, `oversized` (count), params snapshot (`targetChars`, `maxChars`, `overlapChars`) |
| `embed` | source | `started`, `completed`, `failed` | `embedded`, `skippedExisting`, `batches`, `model` (role identity, not secrets) |
| `index` | source | `started`, `completed`, `failed` | `inserted`, `conflictNoops` |
| `commit` | source | `completed`, `failed` | `generation`, `sweptSections`, `sweptChunks` |

Notes:

- `extract` and `transform` are one plugin call (`transform()`) but two contract stages;
  the driver emits `extract:started` before invoking the plugin and
  `transform:completed` after invariant validation passes — the split keeps the doc-05
  stage vocabulary observable even though the seam is a single function.
- Every `failed` event carries `class` (DomainError class), `message` (scrubbed), and
  stage-specific keys above. The job's `last_error` and the source's `lastError` are
  derived conveniences; this trail is authoritative.
- `skipped` appears only where skipping is a real outcome: per-entry expand skips and
  embed-stage `skippedExisting` (idempotent retry, R10).
- The chunk-stage params snapshot is what makes eval-program runs (doc 06)
  reconstructable: the trail says which knobs produced which index.

## Ordering & identity guarantees

- Events for one source are totally ordered by `created_at` (single worker per job —
  claims are exclusive, D12).
- A retried job re-emits its stage events; consumers MUST treat the trail as
  event-sourced history ("this happened"), not as current-state (that's
  `sources.status`). SC-006 reads the full trail, retries included — retries are
  history worth seeing.
