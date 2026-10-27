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
citations, and a much smaller Table-only view for a player, role-gated at the loader. The play route ([[play-route]], TASK-0047) now renders the table at `play/:sessionId` (and operator-only `play/fixtures`): transcript, composer, action cards, ledger and DM approvals slide-outs, all writing through the proposal gate. The pure 5e rules engine ([[dnd5e-engine]], TASK-0042) is a standalone package, called by the DM runtime. The SRD 5.2.1 data package ([[srd-data]], TASK-0043) adds 1020 validated records (903 at TASK-0043, plus 117 rules records from TASK-0123) with provenance, an id/name loader, a 120-token compact lookup form and the CC-BY attribution shown on `/about`. The session model ([[session-model]], TASK-0044) adds the typed event catalog, `canSee` visibility, the pure projection fold and fixtures, with an atomic `appendBatch` in the event log. The proposal gate ([[proposal-gate]], TASK-0045) now stands between producers and the log: typed proposals routed by `auto`/`ask`/`suggest` policy and DM seat, commit authority by table mode, refuse-before-write, atomic approval, an `expectedLastSeq` guard in the log, per-viewer WebSocket delivery (`canSee`), and an import-graph write-boundary test; the legacy uncatalogued `send` path remains until TASK-0099. The AI DM runtime ([[dm-runtime]], [[dm-turn-jobs]], TASK-0046) now plays a scene: `turn`/`companion`/`chronicle` jobs on the shared `jobs` table (migration 0004; ingest rows stay `kind = 'ingest'`), a fixed assemble-director-interpret-adjudicate-resolve-narrate-audit pipeline, resolve as the only writer through the gate with the engine owning every number, digit-free narration audited up to three times with a factual fallback, seven `dm.*` gateway purposes (a failed turn records its failure and bounded model-output excerpts in `jobs.result`; skills, conditions and damage types are closed lists derived from engine enums, while spells and modifier/DC derivation are not gated yet), AI companions, operator `/dm` routes and a hand-authored scene seed. A usage ledger and operator debug routes ([[debug-view]], TASK-0116, migration 0005) now record every DM model call (provider, model, tokens, cost) and serve events, jobs, seed and calls read-only. Narration quality ([[dm-narration-quality]], TASK-0106) now keeps DM-only seed text out of player-facing prompts through a `PlayerSeedView`, names speakers in public-only transcripts, extends the narration facts, derives audit pass/fail in code with blocking and advisory issues, and ships an in-fiction deterministic fallback. The playtest harness ([[playtest-harness]], TASK-0048) plays a scripted seat through a scene in process, audits it (six code checks plus a `playtest.audit` call per segment), and ships `pnpm playtest run|audit|estimate` with a provider-mode spend ceiling. Companion reactions (TASK-0114, specs/036-companion-react) close the stall where a human objected to a companion's action and nothing answered: a human comment on a companion's open action queues a coalesced `react` run ([[dm-turn-jobs]]) in which the companion commits, withdraws (new `action.withdraw` / `action.withdrawn`) or revises ([[dm-runtime]], [[proposal-gate]]), and the play route shows a Withdraw control ([[play-route]]). Presence ([[presence]], TASK-0051, decision-0024) now tells every client who is at the table through an opt-in `presence` frame and a strip in the table header, and logs a `presence.recorded` marker once per DM turn that the Director's assemble node reads. The M2 demo ([[m2-demo]], TASK-0048) is its first use: a human-played scene and a scripted provider run, both audited, every finding resolved and the record signed by the operator. No
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
- [[srd-data]] — the SRD 5.2.1 data package: six Zod record kinds (rules text included), Open5e conversion pinned to a commit and checked against the PDF, provenance, id/name loader, 120-token compact form, attribution and `/about`, and the no-engine-import boundary.

- [[dm-runtime]] — the AI DM: node pipeline, resolve as the only gate writer, digit-free audited narration, `dm.*` purposes, scene seed and doctrine (MIT NOTICE), companions, chronicle, `/dm` routes, the `dm/` import boundary.
- [[dm-turn-jobs]] — DM jobs on the shared `jobs` queue: kinds, enqueue on commit/approval, priority claim per session, fencing, beats, reclaim idempotence, reconcile.
- [[dm-failure-and-gates]] — the failed-turn record in `jobs.result` with bounded model-output excerpts, and the closed rules-term lists (skills, conditions, damage types) with spells and modifiers/DCs not yet gated.
- [[dm-narration-quality]] — narration quality (TASK-0106): the player-facing seed view, named public-only transcripts, facts v2, the blocking/advisory audit with the party-name filter, the in-fiction fallback.
- [[debug-view]] — the operator debug API (TASK-0116): four read-only `/dm` routes (events, jobs, seed, calls), cursors, the job-to-seq link, the `dm_model_calls` ledger as cost authority.
- [[session-model]] — the session event catalog (talk/lifecycle/state-change/marker/record), mechanics envelope, `canSee`, the projection fold, fixtures, and the server append seam.

## Server

- [[server-entrypoint-and-app]] — one Node process, how the HTTP app and WebSocket gateway share a port.
- [[configuration]] — the environment contract: which variable is read where, and the two database URLs.
- [[error-contract]] — the structured error shape every route returns, and the typed errors behind it.
- [[static-serving]] — how the web app is served (static assets, then SSR fallback) and why it must not shadow the API.
- [[health-check]] — what "healthy" means here, and why it parses a body rather than a status code.
- [[ai-gateway]] — the one seam for model calls: named providers/purposes, `chat()`/`embed()`, no vendor SDK or hard-coded vendor name.

## Data

- [[database-access]] — the Drizzle client, the pool, and the reachability probe.
- [[event-log]] — the append-only session log: sequence assignment, the advisory lock, atomic `appendBatch`, visibility.
- [[database-schema]] — the tables, their constraints, and the append-only trigger.
- [[migrations]] — how schema changes are generated and applied, and the host-vs-container trap.

## Auth

- [[session-auth]] — sign-in, the session cookie, and the `validateSession` seam both transports share.
- [[password-hashing]] — stdlib scrypt, the parameters, and why no dependency was added.
- [[invitations]] — how a second person gets an account, single-use under concurrency.
- [[operator-provisioning]] — the first account, created by script, refusing to clobber.

## Realtime

- [[websocket-gateway]] — upgrade-time authentication, the 401/503 split, connection lifetime, and the `send` classification (gate request, refused catalogued type, legacy append).
- [[proposal-gate]] — proposal kinds, policy table and DM seat, commit authority, `createGate`, atomic approval, and the write-boundary test.
- [[ws-protocol]] — the frame shapes (including the opt-in `presence` frame and the heartbeat), what the server ignores, and what the protocol deliberately omits.
- [[presence]] — who is at the table: the in-memory tracker and `PresenceReader`, grace and heartbeat bounds, the `presence.recorded` marker the gate writes per DM turn, and the client strip.
- [[replay-live-boundary]] — the algorithm that delivers missed events then live ones with no gap or duplicate.
- [[subscriber-registry]] — who receives what, session isolation, and visibility filtering.

## Client

- [[react-router-app]] — the React Router 8 framework-mode app (SSR by default), its route tree, and how it is served. Replaces the retired spa-shell note (doc-0003 / decision-0008).
- [[client-identity]] — why the client asks the server who it is instead of storing an answer.
- [[client-session-hook]] — subscribe, cursor tracking, `sendEvent`, `reduceFrame`-folded frames with a refusal notice, and the reconnect preflight.
- [[play-route]] — the table at `play/:sessionId`: one `TableView` over live or fixture sources, pure view-model/frames/reduce-frame modules, gate-request writes with refusal codes, ledger and DM approvals slide-outs, operator-only fixture routes.
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
- [[playtest-harness]] — the playtest harness: scripted in-process play over the real gate and DM worker, the six-check auditor plus `playtest.audit`, the report, provider mode with the spend ceiling, and the `pnpm playtest` CLI.
- [[m2-demo]] — the M2 milestone check: the scripted and human playtest runs, the `pnpm playtest` commands, the fake-gateway CI case, and the signed record of every audit finding.
- [[m0-demo]] — the milestone check: two browsers, one message, and how it is run.
- [[benchmarks]] — the load and stress bench: tiers, the isolated `_load` database, the decision-0005 ingest-scaling measurement, both stress cases, and the dev tier's read-only safety design.
