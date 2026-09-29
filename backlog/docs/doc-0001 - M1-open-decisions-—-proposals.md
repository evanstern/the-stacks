---
id: doc-0001
title: M1 open decisions — proposals
type: specification
created_date: '2026-09-29 02:12'
updated_date: '2026-09-29 02:34'
tags:
  - m-1
  - decisions
---
# M1 open decisions — rulings

Status: **ratified 2026-09-28** — operator accepted all four proposals as written, with one
added requirement (below). Each section backs one decision stub (decision-0002 … 0005).

## Added requirement (operator, 2026-09-28): benchmarks

Every choice below must be measurable, not assumed. The test suite gains a benchmark system
that compares configurations apples to apples:

- **Retrieval benchmark** — same corpus, same question set, same metrics across embedding
  models, dimensions, chunking strategies, and retrieval modes (vector / FTS / hybrid).
  Backs decision-0002. Card: TASK-0029.
- **Load and stress benchmark** — ingest throughput and latency on the jobs table as volume
  grows, concurrent users on HTTP and WebSocket, and further stress cases. Produces the
  "recorded measurement" that decision-0005 requires before any worker split. Card: TASK-0030.
- **Tiering** — cheap cases run on every commit; heavy cases run on demand or on a schedule
  against the hosted `dev` environment (doc-0002). Cases meaningless in local dev mode are
  marked as such and skip visibly.

## decision-0002 — Embedding provider and vector dimension — ACCEPTED

OpenAI-compatible embeddings interface, with Voyage or OpenAI configured behind it; vector
dimension fixed at **1024**. Every embedding row stores `model` and `dim`, so a re-embed is a
job, not a schema change. Model choice is revisited with retrieval-benchmark results.

## decision-0003 — Parser fixture licensing — ACCEPTED

- **Committed:** synthetic fixtures that mirror D&D Beyond's HTML structure, with original
  or SRD 5.1 (CC-BY-4.0) text. CI runs these.
- **Local only:** a real export under a gitignored path. Its suite runs when present and
  skips with a visible notice when absent.

The retrieval benchmark corpus uses SRD text for the same reason.

## decision-0004 — Answer streaming transport — ACCEPTED

SSE from an HTTP route (`POST /library/ask` → `text/event-stream`). Library Q&A is not
session play state, so it stays out of the event-logged WebSocket gateway. Revisit in M6,
when in-session rules lookups become events.

## decision-0005 — Ingestion job execution — ACCEPTED

A `jobs` table polled with `FOR UPDATE SKIP LOCKED` by an in-process worker loop in the
existing Node process. Jobs are idempotent per document. A worker-container split (or a real
queue) happens only on a recorded measurement from the load benchmark (TASK-0030), by
decision record.
