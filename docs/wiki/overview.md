---
name: overview
description: The system's shape — one Node process serving an HTTP API, a WebSocket gateway, and a React SPA, over a single Postgres holding an append-only event log; M0-M2 delivered, M3 table work partly built. Names the three data planes, entry points, route mount order, which seams exist, and the 2026-11 replan direction (constitution 3.0.0, R1-R8 ladder). Read first.
kind: concept
sources:
  - docs/design/architecture.md
  - docs/design/milestones.md
  - docs/design/replan-2026-11/plan-of-action.md
  - backlog/decisions/decision-0029 - D21-Replan-2026-11-co-equal-goals-foundations-first-ladder-R1-R8-Intent-vocabulary-zones-first-space-codex-model-narration-around-facts-P-01..P-21-supersedes-0009.md
  - .specify/memory/constitution.md
  - apps/server/src/index.ts
  - docker-compose.yml
  - docker-compose.test.yml
  - package.json
  - .github/workflows/ci.yml
verified_against: 753a40d24fb9ad9cf5874a29cca6736ed444a8a5
---

# Overview

the-stacks is a self-hosted tabletop RPG platform, built so an agent can sit at the table as
a participant rather than as a bolted-on feature. Milestones M0 to M2 are delivered
(walking skeleton, the first AI-run scene) and M3, the multiplayer table, is partly built
(`/api/tables`, seats, invitations). Every architectural seam has been demonstrated end to
end; the codex plane and the board are not built.

The shape is deliberately small. **One Node process** serves the HTTP API, the WebSocket
gateway, and the built client. **One Postgres** holds relational data and the append-only
event log — and holds vectors and the shared job queue (ingest and DM jobs), rather than those arriving as new
services. **Two containers and a volume** is the whole deployment.

## How it works

A request arrives at the single Node process defined in `apps/server/src/index.ts`. That file
builds the Hono app (`createApp`), calls `serve()` from `@hono/node-server`, and attaches the
WebSocket gateway to the **same underlying server** that `serve()` returns — not a second
listener. One port carries the API, the client, and the socket. It also constructs the
[[ai-gateway]] and starts the [[ingestion]] worker and (TASK-0046) the DM worker ([[dm-runtime]]) in the same process — no new port,
container, or process.

Inside the app, routes are composed in `apps/server/src/app.ts` and mount in a specific
order: `/health`, `/api/echo`, `/api/tables`, `/auth`, `/library`, `/dm` (operator-only DM controls), and then the web app's middleware
**last** — static assets, then a full SSR render — so it can never shadow the routes above
(see [[static-serving]]). `/ws` is not a Hono route at all — it is handled at the HTTP
upgrade, before Hono routing, by [[websocket-gateway]].

State is divided into **three planes**, a constitutional rule rather than a convention:

| plane | what it holds | at this commit |
|---|---|---|
| library | imported reference content | storage ([[library-schema]]), ingestion ([[ingestion]], TASK-0024: upload → parse → chunk → store → embed), and a read path ([[rules-answerer]], TASK-0027: retrieve → answer → cite over SSE) all land |
| codex | campaign entities | empty — planned as R2 Living Codex; scenes run from a hand-authored seed (`apps/server/src/dm/seed/`) |
| session | what happened at the table | the event log, live; the AI DM ([[dm-runtime]], TASK-0046) writes to it only through the proposal gate |

The session plane is populated at M0, as [[event-log]]; the library plane now has its storage
([[library-schema]]), an end-to-end ingestion path ([[ingestion]], TASK-0024) that writes to
it, and a read path with its first caller ([[rules-answerer]], TASK-0027) that answers
questions from it over `POST /library/ask`. Play state is **event-sourced
with server authority**: a client never writes to the log, it asks the server to append
(see [[ws-protocol]]), and the server assigns position, timestamp, and actor identity.

The client is a React Router 8 app in framework mode ([[react-router-app]]), server-rendered
by default and served by the same container — SSR by default, with realtime and canvas
routes staying client-only, is fixed in the architecture's constraints table (amended
TASK-0040, doc-0003 / decision-0008), along with Hono, `ws`, Drizzle, and Postgres 17.

## Planned direction (replan, 2026-11)

Constitution 3.0.0 (ratified 2026-11-07, decision-0029, replan PR #144) and
`docs/design/replan-2026-11/plan-of-action.md` set the direction. Most of it is not built;
present-state code is in the sections above and the linked notes.

- **Gate and engine.** Principle III (Event-Sourced Play) keeps the write boundary: model
  output reaches the log only as a typed proposal that passes the gate and the engine, each
  kind running `auto`, `ask` or `suggest`. Built as [[proposal-gate]] (TASK-0045). Principle VI
  (5e Only; the Engine Owns the Numbers) requires one pure engine, `(state, command, rng) ->
  events | refusal`, that owns every number, now including positions, reach, range and area
  hits. Built as [[dnd5e-engine]], with [[session-model]] (TASK-0044) holding the typed
  events and projections. SRD 5.2.1 (CC-BY-4.0) ships as read-only data, [[srd-data]]
  (TASK-0043); Principle XI (Operator-Owned Content) keeps proprietary book content out.
- **Other principles.** II One Intent Vocabulary; V Many Views, One State; VII Narration
  Around Facts; VIII Campaign Is Data; IX UX Is a Quality Bar; XII Self-Hostable (structured
  model output required); XIII Plan Just-in-Time.
- **Package seams.** Architecture Constraints name `srd`, `dnd5e-engine`, `space`,
  `intent`, `planner`, `session-model`, `codex-model`. Under `packages/` only `srd`,
  `dnd5e-engine`, `session-model`, `intent` ([[intent-contract]]), `space` ([[space]], TASK-0270), `planner` ([[planner]], TASK-0267) and `shared` exist;
  `codex-model` is planned. The board is PixiJS v8 on a client-only route.
- **DM runtime.** Turn jobs share the worker loop with ingestion ([[dm-runtime]]).
- **VTT.** The own board is a projection of the event log (R5 The Board). External VTT
  adapters are trigger-gated (P-02, P-07), not scheduled.
- **Milestone ladder.** The M-ladder (M2 to M9, carded up front by decision-0020) is
  superseded by the R-ladder: R1 Fast Table, R2 Living Codex, R3 Human Table, R4 Notebook,
  R5 The Board, R6 Generators, R7 Campaign Memory, R8 Release 1.0 (decision-0029). Carding
  is just-in-time (Principle XIII). `docs/design/milestones.md` and `vision.md` still
  describe the old ladder; they are not yet updated.

## Connections

Entry points: [[server-entrypoint-and-app]] for the process, [[compose-stack]] for the
deployment, [[react-router-app]] for the client. The platform beneath them is
[[monorepo-and-toolchain]] and [[container-image]].

The two seams M0 exists to prove are [[session-auth]] — one `validateSession` shared by HTTP
and the socket — and the realtime path: [[websocket-gateway]] into [[event-log]] (gameplay
events via the [[proposal-gate]]) and back out through [[replay-live-boundary]]. The milestone check that ties them together is [[m0-demo]].

## Operational notes

`docker compose up` from a clean clone is a hard requirement, not an aspiration: the
constitution's self-hostability principle makes a setup only the author can reproduce a
failure. The demo path is documented in `specs/007-spa-shell-demo/quickstart.md`.

The environment contract has one trap worth knowing before anything else:
`DATABASE_URL` names the address the **container** uses (`@db:5432`, a compose service name)
while `TEST_DATABASE_URL` names a **separate, throwaway database** on the host
(`@localhost:<TEST_DB_PORT>`) — its own compose stack (spec 020), not the app's `DATABASE_URL`
database. See [[configuration]] and [[runtime-stacks]].

CI now runs on every pull request and push to `main` ([[ci-pipeline]]): one job brings up
that same throwaway test compose stack and runs `pnpm ci:check` (lint, typecheck, build,
test, boundary check, hook tests, script tests, serial timing budget) with `REQUIRE_DATABASE=1`, so the
integration suites are proven rather than loud-skipped. TASK-0017 closed the "gates run by
hand" gap this note previously described.

Each worktree can run its own isolated compose stack (`pnpm env:*`, [[runtime-stacks]]):
labeled containers, derived ports, and a `commit` baked into the image and surfaced at
`/health` so which build is answering is never a guess.

A retrieval benchmark (`pnpm bench:retrieval`, TASK-0029, [[benchmarks]]) measures
[[retrieval]]'s recall across embedding models, dimensions, and chunking strategies against a
licensed corpus, and its `bow`-only cell runs as a per-commit regression gate inside `pnpm
test`.

A playtest harness (`pnpm playtest`, TASK-0048, [[playtest-harness]]) plays a scripted seat through the DM's scene and audits the transcript; its CI case runs in `pnpm test`.
