# the-stacks — grounding wiki

Code-grounded notes for this repository, one per concept, each pinned to the commit it was
verified against. Load this index first and route; load notes just-in-time rather than
bulk-loading the corpus. `CAPSULES.md` carries the same one-liners for whole-corpus
orientation.

**State of the codebase at this pin:** M0, the walking skeleton, plus the first `library`
plane work. Every M0 seam exists and is demonstrated end to end — monorepo, compose stack,
Postgres event log, session auth, a WebSocket gateway, and a React Router 8 SSR app
(doc-0003 / decision-0008, superseding the earlier SPA). The `library` plane
now has a parser ([[ddb-parser]]), its storage ([[library-schema]]: documents, chunks,
embeddings, immutable after ingestion), and an end-to-end ingestion pipeline
([[ingestion]], TASK-0024: streamed upload → zip/HTML/Markdown → parse → chunk → store →
embed, via a `jobs` queue). A read path over that storage now exists too ([[retrieval]]:
vector/fts/hybrid search, fused by RRF) now has its first HTTP caller: the rules answerer
([[rules-answerer]], TASK-0027, `POST /library/ask`) streams a cited, verified answer over SSE,
operator-only. The provider-agnostic AI gateway ([[ai-gateway]]) has landed, with two callers
now — ingestion's `embed()` and the rules answerer's `chat()`/`embed()`. Both now have a UI
([[chat-ui]], TASK-0028): upload-and-watch-it-ingest, ask-and-watch-it-stream with clickable
citations, and a much smaller Table-only view for a player, role-gated at the loader. The pure 5e rules engine ([[dnd5e-engine]], TASK-0042) now exists as a standalone package, not yet called by the server. The SRD 5.2.1 data package ([[srd-data]], TASK-0043) adds 903 validated records with provenance, an id/name loader, a 120-token compact lookup form and the CC-BY attribution shown on `/about`. No
codex, system modules, or agents yet. `main` is now continuously deployed to a real hosted
`dev` environment on vm-104 ([[hosted-dev]]).

## Start here

- [[overview]] — the system's shape, data planes, and entry points. Read before anything else.

## Platform and build

- [[monorepo-and-toolchain]] — pnpm workspaces, Turborepo, TypeScript project references, Biome.
- [[compose-stack]] — the two-container topology, health checks, and the port/URL split that catches everyone.
- [[container-image]] — the multi-stage Dockerfile, what ships in the runtime layer, and why.
- [[runtime-stacks]] — `pnpm env:*`, one labeled compose stack per git worktree, orphan detection, and the local `origin/main` stack.
- [[hosted-dev]] — the vm-104 `dev` environment: CD from `main`, deploy/rollback/drift/backup verbs, and tailnet-only exposure.

## Rules engine

- [[dnd5e-engine]] — the pure 5e engine package: `execute(state, command, rng)` to events or a refusal, seeded/scripted RNG, roll ledger, refuse-before-draw, no-I/O boundary, and the R8 arithmetic ruling.
- [[srd-data]] — the SRD 5.2.1 data package: five Zod record kinds, Open5e conversion pinned to a commit and checked against the PDF, provenance, id/name loader, 120-token compact form, attribution and `/about`, and the no-engine-import boundary.

## Server

- [[server-entrypoint-and-app]] — one Node process, how the HTTP app and WebSocket gateway share a port.
- [[configuration]] — the environment contract: which variable is read where, and the two database URLs.
- [[error-contract]] — the structured error shape every route returns, and the typed errors behind it.
- [[static-serving]] — how the web app is served (static assets, then SSR fallback) and why it must not shadow the API.
- [[health-check]] — what "healthy" means here, and why it parses a body rather than a status code.
- [[ai-gateway]] — the one seam for model calls: named providers/purposes, `chat()`/`embed()`, no vendor SDK or hard-coded vendor name.

## Data

- [[database-access]] — the Drizzle client, the pool, and the reachability probe.
- [[event-log]] — the append-only session log: sequence assignment, the advisory lock, visibility.
- [[database-schema]] — the tables, their constraints, and the append-only trigger.
- [[migrations]] — how schema changes are generated and applied, and the host-vs-container trap.

## Auth

- [[session-auth]] — sign-in, the session cookie, and the `validateSession` seam both transports share.
- [[password-hashing]] — stdlib scrypt, the parameters, and why no dependency was added.
- [[invitations]] — how a second person gets an account, single-use under concurrency.
- [[operator-provisioning]] — the first account, created by script, refusing to clobber.

## Realtime

- [[websocket-gateway]] — upgrade-time authentication, the 401/503 split, and connection lifetime.
- [[ws-protocol]] — the frame shapes, what the server ignores, and what the protocol deliberately omits.
- [[replay-live-boundary]] — the algorithm that delivers missed events then live ones with no gap or duplicate.
- [[subscriber-registry]] — who receives what, session isolation, and visibility filtering.

## Client

- [[react-router-app]] — the React Router 8 framework-mode app (SSR by default), its route tree, and how it is served. Replaces the retired spa-shell note (doc-0003 / decision-0008).
- [[client-identity]] — why the client asks the server who it is instead of storing an answer.
- [[client-session-hook]] — subscribe, cursor tracking, send, and the reconnect preflight.
- [[chat-ui]] — the app-level store, the SSE parser and turn reducer behind streamed answers, the Sheet-based Panel, Daylight theme tokens and UI cookies, and the Ask/Library/Table/Settings route tree.

## Library

- [[ddb-parser]] — turning saved D&D Beyond export HTML into ordered, anchored blocks.
- [[library-schema]] — the library plane's storage: documents/chunks/embeddings, the immutability trigger, and the one write path (storeParsedBook, attachEmbeddings).
- [[ingestion]] — the library plane's write path: streamed upload, zip reader, parse routing, chunker, the jobs queue's claim/lease/fencing/recovery, and the embedding obligation.
- [[retrieval]] — the library plane's read path: vector/fts/hybrid search fused by Reciprocal Rank Fusion.
- [[rules-answerer]] — POST /library/ask: streamed cited answers, citation-marker verification, refusal rules, operator-only auth.

## Testing and verification

- [[test-suite]] — what is covered, the environment-gated integration suites, and the skip trap.
- [[ci-pipeline]] — GitHub Actions CI, the `ci:check` aggregate script, and the boundary-rules check.
- [[benchmarks]] — the retrieval benchmark: the SRD corpus, the question set, the model/dim/chunking/mode matrix, and the deterministic per-commit recall gate.
- [[m0-demo]] — the milestone check: two browsers, one message, and how it is run.
- [[benchmarks]] — the load and stress bench: tiers, the isolated `_load` database, the decision-0005 ingest-scaling measurement, both stress cases, and the dev tier's read-only safety design.
