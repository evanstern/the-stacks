# the-stacks — Architecture

**Status:** ratified 2026-09-21 (design session, operator + Claude) — A1–A9 approved as proposed
**Companions:** [vision.md](vision.md), [milestones.md](milestones.md)

## A1. Stack

**Recommendation: TypeScript end-to-end, Postgres for everything, no Python
service in V1.**

Why TS is genuinely the best tool here, not just the familiar one:

- The hard surfaces of this project are the **web client** (chat, codex, and a
  WebGL tabletop) and the **realtime server** (event streams, rooms,
  hidden-information authority). Both are native TS territory.
- The AI layer in this design is **agent orchestration**: tool-calling loops,
  structured output against Zod schemas, streaming into the event log. The
  Anthropic TS SDK is first-class for all of it. There is no model training,
  no tensor work — nothing that needs Python.
- One language means the **content contracts** (A5) are single-source: the same
  Zod schema validates an NPC at the API boundary, in the agent's tool
  definition, and in the client form.
- Where Python earns a place later (local embeddings, local diffusion,
  ComfyUI), it enters as an **optional sidecar behind an existing provider
  seam** (A7, A8) — an additive container, not a rewrite.

Concrete choices:

| Layer | Choice | Note |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | |
| Server | Node 22, **Hono** + `ws` | One process serves REST + WebSocket; Hono is small, typed, and portable |
| Client | React 19 + Vite SPA, TanStack Router/Query | SPA, not SSR — this is an authenticated app; SSR buys nothing |
| VTT canvas | **PixiJS v8** (WebGL) | Tokens, grid, fog; DOM overlays for UI |
| DB | **Postgres 17 + pgvector** | Relational + vectors + job queue (SKIP LOCKED) + event log. One stateful container |
| ORM | Drizzle | |
| Validation | Zod everywhere | Schemas are the content contracts |
| Auth | Lucia-style session auth, self-rolled tables | Operator + invited players; no external IdP |
| Compose | `web` (static via server), `app` (Node), `db` (Postgres) | **Two containers + volume** for V1 |

## A2. Service topology

One Node process (`app`) hosting: REST API, WebSocket gateway, background
worker loop (Postgres job queue), and the agent runtime. Compose splits worker
into its own container **only when** ingestion or image jobs measurably starve
the event loop — the code is structured so that split is a config change.

skipped: microservices; add when a subsystem needs independent scaling, proven by load.

## A3. Three data planes

Everything in the app lives in exactly one of three planes, and the planes
have different write disciplines:

1. **Library** (imported books): immutable after ingestion. Documents →
   chunks → embeddings → citations. The RAG substrate.
2. **Codex** (campaign content): mutable, versioned entities — NPCs, PCs,
   locations, maps, encounters, items, factions. CRUD via API; every entity
   validates against its content contract (A5).
3. **Session** (play): append-only **event log** per game session. Never
   updated, only appended. Client state and AI context are both projections
   of this log.

## A4. Event-sourced sessions

A game session is a stream of typed events (`narration`, `chat`, `roll`,
`token.moved`, `initiative.set`, `damage.applied`, `map.revealed`, …) in a
Postgres table `(session_id, seq, actor, type, payload, ts)`.

- Clients subscribe over WebSocket from a `seq` cursor; reconnect = replay.
- **Authority:** all mutations go through the server; the server validates
  against the structured core (A6) before appending. Hidden information (DM
  notes, unrevealed map regions) lives in events with a `visibility` field;
  projections filter per viewer.
- **The AI DM is just another actor.** The auto-DM consumes the same event
  stream as context and emits the same events as everyone else. This is the
  single most important decision for the end goal: build the table so an
  agent can sit at it.

## A5. Content contracts (agent-loadable content)

Every codex entity type has a Zod schema with three mandatory sections:

- `identity` — mechanical truth (stats, AC, HP, per the active system module)
- `portrayal` — voice, mannerisms, appearance, motivations; written to be
  *performable* by an agent
- `hooks` — relationships to other entities (typed edges), secrets, agendas

Rule: **an entity is complete when an agent given only that entity + its
linked neighbors can generate new in-character content.** This is testable and
becomes a CI-able lint ("portrayal completeness") plus an eval.

## A6. System modules (system-agnostic core, 5e first)

**Recommendation:** the platform is system-agnostic; game mechanics live in a
**system module** interface. Ships with two modules:

- `dnd5e` — the real, full-depth implementation (sheets, d20 resolution,
  initiative, conditions, death saves; spells/abilities via AI + citations).
- `fate-core` — a **conformance module** from the CC-BY Fate Condensed SRD.
  Chosen deliberately: fudge dice, aspects, no initiative order, stress tracks
  instead of HP. If the interface survives both 5e and Fate, it is honestly
  agnostic; a d20 clone would only mirror 5e's assumptions back at us.

A system module declares: character sheet schema, dice/resolution semantics,
turn structure, condition model, and the event types it can validate. The
Fate module is maintained to interface depth only — enough to play a scene,
not a polished product. CI runs the conformance suite against both.

skipped: runtime-pluggable third-party modules; add when someone besides us writes one.

## A7. AI gateway

One internal gateway wraps all model calls: provider config (Anthropic
first; OpenAI-compatible endpoint as the second implementation of the same
interface), per-feature model selection (cheap model for extraction, strong
model for DM-ing), token/cost accounting per campaign, and prompt-template
versioning. Agents (rules-answerer, NPC-smith, map-planner, DM) are defined as
tool-loops over this gateway. Local models arrive later as just another
OpenAI-compatible endpoint — a config entry, not a feature.

## A8. Media pipeline (maps + portraits)

**Maps are data first.** The map-planner agent emits a `MapPlan` JSON (rooms,
walls, doors, terrain, furniture, grid dims — Zod-validated); a deterministic
renderer draws it from a bundled CC0 tile/asset pack. Grid, walls, and fog are
correct by construction. Export: PNG + **Universal VTT** JSON (walls/lights/
grid) so maps work in Foundry et al. even before our own table ships.
Optional diffusion styling pass over the render is a post-V1 flourish.

**Portraits** go through an image-provider seam (same shape as A7): cloud
image APIs first, local ComfyUI later. Every generated asset stores its
prompt + provider + seed alongside — regenerability is part of the contract.

## A9. Rulebook ingestion

BYO content: operator uploads D&D Beyond HTML exports (first-class parser),
plus generic HTML/PDF/Markdown (best-effort). Pipeline: parse → structural
chunking (headings/tables preserved) → embed → hybrid retrieval (vector +
FTS) → **citations carry source anchor** (book, section, exact quote span) so
every answer is verifiable. The eval harness from v1 is re-derived, not
ported: a fixtures-based retrieval QA suite runs in CI.

Licensing posture: content stays in the operator's DB volume; nothing
generated ships book text beyond quoted citations shown to the operator who
supplied the book.
