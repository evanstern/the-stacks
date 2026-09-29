---
name: overview
description: The system's shape at M0 — one Node process serving an HTTP API, a WebSocket gateway, and a React SPA, over a single Postgres holding an append-only event log. Read this before any other note; it names the three data planes, the entry points, and which seams exist versus which are still empty.
kind: concept
sources:
  - docs/design/architecture.md
  - docs/design/milestones.md
  - .specify/memory/constitution.md
  - apps/server/src/index.ts
  - docker-compose.yml
  - package.json
  - .github/workflows/ci.yml
verified_against: 69b6f01a903f1b9189da332b362f2bd3cc601e71
---

# Overview

the-stacks is a self-hosted tabletop RPG platform, built so an agent can sit at the table as
a participant rather than as a bolted-on feature. At this commit the repository is at **M0,
the walking skeleton**: every architectural seam exists and has been demonstrated end to
end, but almost nothing is built on top of them yet.

The shape is deliberately small. **One Node process** serves the HTTP API, the WebSocket
gateway, and the built client. **One Postgres** holds relational data and the append-only
event log — and will later hold vectors and the job queue, rather than those arriving as new
services. **Two containers and a volume** is the whole deployment.

## How it works

A request arrives at the single Node process defined in `apps/server/src/index.ts`. That file
builds the Hono app (`createApp`), calls `serve()` from `@hono/node-server`, and attaches the
WebSocket gateway to the **same underlying server** that `serve()` returns — not a second
listener. One port carries the API, the client, and the socket. It also constructs the
[[ai-gateway]] and starts the [[ingestion]] worker in the same process — no new port,
container, or process.

Inside the app, routes are composed in `apps/server/src/app.ts` and mount in a specific
order: `/health`, `/api/echo`, `/auth`, and then the SPA's static middleware **last**, so it
can never shadow the routes above (see [[static-serving]]). `/ws` is not a Hono route at all —
it is handled at the HTTP upgrade, before Hono routing, by [[websocket-gateway]].

State is divided into **three planes**, a constitutional rule rather than a convention:

| plane | what it holds | at this commit |
|---|---|---|
| library | imported reference content | storage ([[library-schema]]), ingestion ([[ingestion]], TASK-0024: upload → parse → chunk → store → embed), and a read path ([[rules-answerer]], TASK-0027: retrieve → answer → cite over SSE) all land |
| codex | campaign entities | empty — M2 |
| session | what happened at the table | the event log, live |

The session plane is populated at M0, as [[event-log]]; the library plane now has its storage
([[library-schema]]), an end-to-end ingestion path ([[ingestion]], TASK-0024) that writes to
it, and a read path with its first caller ([[rules-answerer]], TASK-0027) that answers
questions from it over `POST /library/ask`. Play state is **event-sourced
with server authority**: a client never writes to the log, it asks the server to append
(see [[ws-protocol]]), and the server assigns position, timestamp, and actor identity.

The client is a Vite-built React SPA ([[spa-shell]]) served by the same container. It is not
SSR — that choice is fixed in the architecture's constraints table, along with Hono, `ws`,
Drizzle, and Postgres 17.

## Connections

Entry points: [[server-entrypoint-and-app]] for the process, [[compose-stack]] for the
deployment, [[spa-shell]] for the client. The platform beneath them is
[[monorepo-and-toolchain]] and [[container-image]].

The two seams M0 exists to prove are [[session-auth]] — one `validateSession` shared by HTTP
and the socket — and the realtime path: [[websocket-gateway]] into [[event-log]] and back out
through [[replay-live-boundary]]. The milestone check that ties them together is [[m0-demo]].

## Operational notes

`docker compose up` from a clean clone is a hard requirement, not an aspiration: the
constitution's self-hostability principle makes a setup only the author can reproduce a
failure. The demo path is documented in `specs/007-spa-shell-demo/quickstart.md`.

The environment contract has one trap worth knowing before anything else:
`DATABASE_URL` names the address the **container** uses (`@db:5432`, a compose service name)
while `TEST_DATABASE_URL` names the **host's** (`@localhost:<DB_PORT>`). See [[configuration]].

CI now runs on every pull request and push to `main` ([[ci-pipeline]]): one job provisions a
Postgres service and runs `pnpm ci:check` (lint, typecheck, build, test, boundary check, hook
tests, script tests) with `REQUIRE_DATABASE=1`, so the integration suites are proven rather
than loud-skipped. TASK-0017 closed the "gates run by hand" gap this note previously
described.

Each worktree can run its own isolated compose stack (`pnpm env:*`, [[runtime-stacks]]):
labeled containers, derived ports, and a `commit` baked into the image and surfaced at
`/health` so which build is answering is never a guess.
