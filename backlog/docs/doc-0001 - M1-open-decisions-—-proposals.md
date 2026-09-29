---
id: doc-0001
title: M1 open decisions — proposals
type: specification
created_date: '2026-09-29 02:12'
tags:
  - m-1
  - decisions
---
# M1 open decisions — proposals

Status: proposed 2026-09-28, awaiting operator ruling. Each section backs one decision stub
(decision-0002 … decision-0005). The CLI has no decision-body edit, so the proposal text
lives here; the ruling gets transcribed into the stub on acceptance.

Gate: no M1 spec is authored until all four are accepted.

## decision-0002 — Embedding provider and vector dimension

**Context.** A7 names Anthropic as first provider, but Anthropic ships no embeddings API.
The vector dimension is baked into the pgvector column type, so it must be fixed before the
library schema spec.

**Options.**
1. Voyage AI (`voyage-3.5`, 1024-d, Anthropic's recommended partner). Separate API key.
2. OpenAI-compatible endpoint (`text-embedding-3-small`, 1536-d, or truncated to 1024-d).
   Already A7's second provider shape; local models later reuse the same endpoint.
3. Local sidecar now (e.g. Ollama `nomic-embed-text`, 768-d). Violates A1's "no Python in
   V1" only if the sidecar is Python; adds a third container.

**Proposal.** Option 2's *interface* (OpenAI-compatible embeddings endpoint) with Voyage or
OpenAI configured behind it, dimension fixed at **1024**. Store `model` and `dim` on every
embedding row so a re-embed migration is a job, not a schema change.

## decision-0003 — Parser fixture licensing

**Context.** A9 requires a fixture-tested D&D Beyond parser. Real PHB exports are
copyrighted and cannot be committed to a public repo.

**Proposal.** Two tiers.
- **Committed:** synthetic fixtures that mirror D&D Beyond's HTML structure (headings,
  tables, stat blocks, sidebars) with original or SRD 5.1 (CC-BY-4.0) text. CI runs these.
- **Local only:** a real export under a gitignored path (e.g. `fixtures/private/`). A test
  suite runs against it when present and skips with a visible notice when absent.

The retrieval eval set (M1 card 8) uses SRD text for the same reason.

## decision-0004 — Answer streaming transport

**Context.** Chat answers stream tokens. M0 built a WebSocket gateway whose contract is
event-log append plus cursor replay.

**Options.**
1. Stream over the existing WebSocket gateway as ephemeral (non-logged) frames.
2. SSE from an HTTP route (`POST /library/ask` → `text/event-stream`).

**Proposal.** Option 2. Library Q&A is request/response, single-user, and not session play
state; routing it through the gateway either pollutes the event log or adds a second,
non-logged frame class to a protocol whose invariant is "everything is logged." Hono has
native streaming helpers. Revisit in M6 when in-session rules lookups need to appear at the
table — those become events.

## decision-0005 — Ingestion job execution

**Context.** A2/A3 name Postgres as the job queue (`SKIP LOCKED`) and defer a separate
worker container until ingestion measurably starves the app.

**Proposal.** Confirm A2 as written: a `jobs` table polled with `FOR UPDATE SKIP LOCKED`
by an in-process worker loop inside the existing Node process. Jobs are idempotent per
document (re-run replaces that document's chunks). Split to a worker container only on a
recorded measurement, by decision record.
