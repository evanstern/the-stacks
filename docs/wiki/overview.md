---
name: overview
description: The system's shape at M0 (plus the planned 5e-only, proposal-gate, DM-runtime, VTT-adapter direction and the M2-M9 ladder) — one Node process serving an HTTP API, a WebSocket gateway, and a React SPA, over a single Postgres holding an append-only event log. Read this before any other note; it names the three data planes, the entry points, and which seams exist versus which are still empty.
kind: concept
sources:
  - docs/design/architecture.md
  - docs/design/milestones.md
  - .specify/memory/constitution.md
  - apps/server/src/index.ts
  - docker-compose.yml
  - docker-compose.test.yml
  - package.json
  - .github/workflows/ci.yml
verified_against: 9bc934ea72b8c9fa57f4905eaa5f49104c9326a9
---

# Overview

the-stacks is a self-hosted tabletop RPG platform, built so an agent can sit at the table as
a participant rather than as a bolted-on feature. At this commit the repository is at **M0,
the walking skeleton**: every architectural seam exists and has been demonstrated end to
end, but almost nothing is built on top of them yet.

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
order: `/health`, `/api/echo`, `/auth`, `/library`, `/dm` (operator-only DM controls), and then the web app's middleware
**last** — static assets, then a full SSR render — so it can never shadow the routes above
(see [[static-serving]]). `/ws` is not a Hono route at all — it is handled at the HTTP
upgrade, before Hono routing, by [[websocket-gateway]].

State is divided into **three planes**, a constitutional rule rather than a convention:

| plane | what it holds | at this commit |
|---|---|---|
| library | imported reference content | storage ([[library-schema]]), ingestion ([[ingestion]], TASK-0024: upload → parse → chunk → store → embed), and a read path ([[rules-answerer]], TASK-0027: retrieve → answer → cite over SSE) all land |
| codex | campaign entities | empty — planned for M4 (The Codex); M2 runs from a hand-authored scene seed |
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

## Planned direction (design re-centre, 2026-10-25)

Nothing in this section is built; it is the design the next milestones target
(`docs/design/architecture.md`, decision-0009 to decision-0021). Present-state code is
described in the sections above and in the linked notes.

- **5e only.** The planned system-agnostic core and the Fate conformance module are dropped.
  The engine now exists as a standalone package, [[dnd5e-engine]], not yet called by the
  server. The typed session events and their projections exist as [[session-model]] (TASK-0044); the proposal gate and per-viewer live delivery are [[proposal-gate]] (TASK-0045). Constitution Principle VI (v2.0.0) now requires one pure 5e engine package with the entry
  point `(state, command, rng) -> events | refusal`; it does no I/O and calls no model, and
  the engine owns every number (dice, hit points, conditions, initiative, rests, slots).
- **Proposal gate.** LLM output reaches the event log only as a typed proposal that passes
  the gate and the engine (Principle IV). Each proposal kind runs `auto`, `ask` or `suggest`;
  a refusal appends nothing; pending proposals are hidden information. It is implemented in
  [[proposal-gate]] (TASK-0045): a human DM seat sees `dm` rows, and the write boundary is test-enforced.
- **DM runtime.** Turn jobs run on the same worker loop as ingestion jobs (planned A11);
  talk, action and table modes are planned in A12.
- **VTT ports and adapters.** The in-app PixiJS table view and external VTTs (Foundry or
  Owlbear) sit behind ports (planned A13), at M6.
- **SRD baseline.** SRD 5.2.1 data (CC-BY-4.0, with exact attribution) may ship with the
  engine; it is versioned read-only data, not a fourth plane. The data now exists as [[srd-data]]
  (TASK-0043). Proprietary book content still
  never ships (Principle VIII).
- **Milestone ladder.** M0 and M1 stand. Next: M2 First Scene (AI-run vertical slice,
  target 2026-11-24), M3 The Table (multiplayer), M4 The Codex, M5 Imported Mechanics, M6
  Maps and the Table View, M7 The Dial = V1 (target 2027-03-23), M8 Memory and Pacing, M9
  Solo Campaign (a sketch, re-planned at V1 by TASK-0087). Every milestone from M2 to M9 is
  carded up front (decision-0020: TASK-0042 to TASK-0053 and TASK-0056 to TASK-0091), and
  dropping a card needs a decision record. The 2026-09-21 ladder is superseded.

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
test, boundary check, hook tests, script tests) with `REQUIRE_DATABASE=1`, so the
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
