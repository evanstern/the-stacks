---
title: Ingestion
status: active
owner: docs
created: 2026-07-07
updated: 2026-07-07
tags:
  - wiki
  - v3
  - architecture
  - ingestion
---

# Ingestion

The extensible pipeline that turns uploaded material into a searchable, traceable
corpus: intake → detect → extract → transform → chunk → embed → index, entirely on
the walking skeleton's proven seams (Postgres job queue, append-only events,
`DomainError` taxonomy, env-first embedding role). Full detail lives in
`specs/008-ingestion-service/` (plan, research R1–R13, data-model, contracts,
quickstart); this page is the durable summary.

## The pipeline

```text
POST /api/uploads  ──sync──▶  claim ticket (< 2s, SC-002)
        │
        ▼ (Postgres jobs table, D12 — everything past this line is async)
   ingest_batch_expand (ZIP only)  ──▶  per-entry ingest_source jobs
        │
        ▼
   ingest_source: detect → extract → transform → chunk → embed → index → commit
```

Every stage transition writes an append-only `ingestion_events` row
(contracts/events.md) — the operator can inspect a ticket's full history, including
retries, at any time (`GET /api/uploads/:kind/:id`, US2).

## The plugin seam — the pivotal design decision

Past `transform`, the pipeline sees exactly one shape: **NormalizedDocument**
(`@stacks/ingestion-contract`) — ordered sections classified by kind (`prose`,
`stat_block`, `table`, `spell_entry`, `unclassified`), source anchors for citation
deep-linking, sanitized display artifacts. Plugins are pure transforms: bytes in,
NormalizedDocument out. They are structurally forbidden from touching the database,
embedding, or calling model providers (`scripts/check-boundaries.mjs` enforces this —
FR-014 is a build-time impossibility, not a review convention).

- `@stacks/ingestion-contract` — the contract + a shared **conformance suite**
  (`describeConformance()`) every plugin runs in its own test file. All four plugins
  (three shipped + one test-only) pass the same obligations (SC-010).
- `@stacks/ingestion-plugins` — the shipped ingesters, each `<name>/index.ts` +
  `<name>.test.ts`:
  - **ddb-saved-html** — the flagship. v2's `ddb_import.py` domain knowledge (~760
    lines, doc 05's "most valuable code in the repo") ported as reviewable, data-driven
    TS rules (`specs/008-ingestion-service/ddb-rules.md`), never as executed Python.
  - **markdown** — fallback for `text/markdown` + `text/plain`; ATX-heading-trail
    walker, no markdown-rendering dependency (only heading lines matter for structure).
  - **generic-html** — fallback for any `text/html` nothing more specific claims; a
    DDB-signal-free heading/section walk.
  - **demo-format** (test-only) — proves the extensibility promise (SC-007): passes
    conformance, is never registered in `shipped.ts`. A reviewer diffing the commit
    that added it sees zero lines changed under `packages/ingestion/src`.
- `@stacks/ingestion` — pipeline core: registry/detection dispatch, chunking, the
  embed client, idempotent indexing, the stage driver. Owns everything DB/queue/
  model-facing; plugins may only *inform* chunking via hints.

### Detection dispatch

Every plugin whose `accepts` list includes the sniffed media type declares a
confidence in `[0, 1]`; the registry (`packages/ingestion/src/registry.ts`) picks the
highest, breaking ties by **registration order** (`shipped.ts`: ddb-saved-html first,
then the fallbacks). Fallback plugins float at a flat **0.1 confidence floor** — high
enough to win when nothing more specific claims a source, never high enough to outbid
a real detector. The winning decision (plugin, version, confidence, and every
consulted candidate's score) is recorded on the source and in the `detect` event —
an operator can see *why* a plugin won, not just that it did.

## Generation-flip: how re-ingestion stays safe

Every source carries `current_generation`. A run writes sections/chunks stamped with
its **target** generation; only on success does the final stage flip
`sources.current_generation` in one UPDATE and sweep rows of older generations.
Readers always filter on `generation = sources.current_generation`, so replacement is
atomic from their perspective — no half-old/half-new source is ever visible.

This one integer column separates two "run it again" semantics:

- **Retry** (queue re-runs a failed job): same target generation. Deterministic
  chunk/section identities (`sha256(corpus : fingerprint : plugin@version :
  generation : index : content)`) make every write idempotent — a retry changes
  nothing that already succeeded (SC-004).
- **Re-ingest** (`reingestSource()`, US5): a NEW job at `generation + 1`. New
  identities (generation is part of the hash), so old and new rows never collide;
  the sweep removes the old generation's rows once the new one commits. The source's
  original archive is never touched (FR-023) — re-ingestion only ever re-derives.

`sourcesByPluginVersion()` / `reingestSource()` (`packages/ingestion/src/reingest.ts`)
are plain domain functions, **not HTTP endpoints** — mutation verbs belong to the
corpus-lifecycle spec's own dry-run/confirm guardrails (Principle IV). This cycle
ships the tested primitives; that spec wraps them in a guarded endpoint.

## Storage

One Postgres database, no new services (Principle VI, D5): source archives as
content-addressed `bytea` (dedupe is a primary-key lookup, FR-003), `document_sections`
+ `chunks` per generation, `chunks.embedding` (un-dimensioned pgvector, stamped with
provider/model/dimensions so mixed vector spaces are structurally detectable) and a
generated `tsvector` + GIN column for full-text — hybrid search from one row, one
write.

## What's next

Retrieval (query-side search, ranking, fusion) and the corpus-lifecycle spec
(seed/reset/re-embed/verify, plus the guarded re-ingest endpoint this spec's domain
operations prepare) are explicitly out of scope here (FR-025/FR-026) and build on
what this pipeline produces: correctly indexed, traceable passages.
