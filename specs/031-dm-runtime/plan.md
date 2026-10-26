# Implementation Plan: First Scene — DM runtime (turn jobs, pipeline nodes, Director, companions)

**Branch**: `task-0046-dm-runtime` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/031-dm-runtime/spec.md` (board card TASK-0046).

## Summary

Add the DM runtime to the server as `apps/server/src/dm/`. A gate listener enqueues a turn job
on the existing `jobs` table whenever an action commits. A DM worker loop claims DM jobs with
the queue's claim, lease and fencing, serialized per session. A turn job runs seven plain
async nodes in a fixed order: assemble, director, interpret, adjudicate (when needed),
resolve, narrate, audit. Only resolve calls the gate. Interpret and adjudicate emit mechanics
inputs as data; the engine rolls and compares; resolve branches on engine events. Narrate
receives facts and writes digit-free prose; code renders the dice lines. Audit runs
deterministic checks and a cheap model, regenerates at most twice, and otherwise ships a
code-built factual summary with a DM-only flag. The Director's decisions (scene, trackers,
table mode, beat hold) become proposals in resolve. AI companions and chronicle run as their
own job kinds and submit through the gate as their own actors. A Zod-validated scene seed,
"The Bell at Greyhollow Ford", supplies the scene. Doctrine prompts adapt tabletop-dm's
right/wrong pairs under an MIT notice. A purpose-keyed fake-gateway script plus scripted dice
drives every test, and a full scene script is published for TASK-0048.

One migration (`0004`, jobs table). No new third-party dependency. One new workspace link
(`@the-stacks/srd` into `apps/server`).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), ES2022, Node 22.

**Primary Dependencies**: Zod 4, Drizzle (installed); `@the-stacks/dnd5e-engine`,
`@the-stacks/session-model` (workspace, installed); `@the-stacks/srd` (workspace, newly
linked into `apps/server`); the AI gateway (`apps/server/src/ai/`), M1 retrieval
(`library/retrieve.ts`), citation verification (`library/cite.ts`), the gate
(`apps/server/src/gate/`).

**Storage**: the `jobs` table (migration `0004`); the session log through the gate only.

**Testing**: Vitest. Pure tests for schemas, facts, the dice-line renderer, deterministic
audit checks, the seed loader, the doctrine guard and the script loader. Database suites on
the worktree's own stack with `REQUIRE_DATABASE=1`: the queue, the gate-integrated nodes, the
worker, companions, chronicle, routes, and the full-turn merge-condition run. Every model
call in tests goes to the fake gateway.

**Target Platform**: the one Node process (constitution topology). A second DM worker loop
runs beside the ingest worker.

**Project Type**: monorepo; server modules only. `apps/web` is untouched (TASK-0047 renders
the rows this writes).

**Performance Goals**: a free-mode turn makes at most six hot-path model calls (SC-007); a
fake-gateway turn runs in well under a second of server time beyond the database.

**Constraints**: AC #5 write boundary (no log writer imported under `dm/`); AC #6 narrate
isolation; refuse-before-write is the gate's; no vendor name in source (decision-0007); no
LangChain package (decision-0019); prompt text, model output and retrieved passages never
reach logs, job rows or public events.

**Scale/Scope**: 7 nodes, 3 job kinds, 7 purposes, 1 migration, 1 seed, 24 doctrine pairs,
7 fixture scripts, 4 operator routes.

## Constitution Check

*Pre-research gate: pass. Post-design re-check: pass.* Against constitution 2.0.0.

- [x] **I. Agent-operable** — the DM runtime is itself an agent acting through the same gate
      a human uses; companions submit `talk`, `action.*` proposals like a player. Operators
      and the harness drive scenes through `/dm/sessions/:id/{start,turn,turns}` and the
      existing WebSocket gate requests. No human-only path is added.
- [x] **II. Content contract** — seed NPCs and characters carry `identity`, `portrayal`,
      `hooks` (A5), complete enough for `dm.narrate` and `dm.companion` to voice them. The
      seed is not a codex entity; TASK-0056/TASK-0060 replace it.
- [x] **III. Data planes** — session state is written only through the gate. The library is
      read only through `retrieve` (its read seam) and `cite.ts` (pure). The `jobs` table is
      operational state, as for ingestion. A new Biome override on `apps/server/src/dm/**`
      forbids `**/events/**`, `**/library/ingest/**`, `**/library/store*`, `**/codex/**` and
      `**/ws/**`, with a violating fixture under `fixtures/boundary-violations/`.
- [x] **IV. Event sourcing, server authority** — LLM output reaches the log only as parsed
      proposals; trackers, rulings and flags are `dm` rows; no new event type; the beat,
      the seed choice (`scene.sceneId`) and resumption are all derived from the log plus
      operational job rows.
- [x] **V. Citations** — adjudicate verifies every library quote with M1's `locateQuote`;
      unverifiable citations are dropped; a ruling with none says it is improvised (FR-072).
- [x] **VI. 5e engine boundary** — no model outputs a total, amount or verdict (schema has no
      field for one); every number comes from `execute` through the gate; narrate cannot
      import the engine or RNG (test).
- [x] **VII. Structured first** — N/A (no generated assets).
- [x] **VIII. Operator-owned content** — the seed is original plus SRD 5.2.1 ids; doctrine
      is adapted MIT text with its notice; retrieved passages go only into `dm.adjudicate`
      prompts and `dm` ruling entries (quotes with anchors, constitution V), never public
      rows or logs.
- [x] **IX. Self-hostable** — no service, container or third-party dependency; purposes are
      config entries; with no `AI_PURPOSES` the server still boots and DM turns fail with a
      DM-visible notice.

**Stack conformance**: TypeScript, Zod, Drizzle with a versioned migration, Postgres job
queue, one process. No departure.

## Project Structure

### Documentation (this feature)

```text
specs/031-dm-runtime/
├── spec.md
├── plan.md                    # this file
├── research.md                # R1–R16
├── data-model.md
├── quickstart.md
├── data/greyhollow-ford.seed.json   # the shipped seed (copied verbatim into apps/server/seeds/)
├── contracts/
│   ├── node-seam.md           # TurnContext, NodeResult, the runner, callJson
│   ├── nodes.md               # each node's input/output/purpose; steps; token caps
│   ├── resolve.md             # proposals, step chains, gate outcomes, idempotent reclaim
│   ├── director.md            # Director output, legality, decision → proposals, the hold
│   ├── audit.md               # checks, bounded regenerate loop, fallback, audit record
│   ├── turn-jobs.md           # kinds, payloads, migration, claim, fencing, checkpoint, enqueue, beats
│   ├── companions.md          # companion and chronicle jobs
│   ├── purposes.md            # the seven purposes; config; model and cost notes
│   ├── scene-seed.md          # schema, loader, SRD combatants, the shipped seed
│   ├── fake-gateway-script.md # DmScript; FakeProvider purpose queues (binding for TASK-0048)
│   ├── doctrine.md            # pairs, notice text, guard test
│   └── dm-api.md              # operator routes
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/server/
├── drizzle/0004_<generated>.sql + meta/          # NEW: jobs kinds, session_id, indexes
├── seeds/greyhollow-ford.json                    # NEW: the seed (data)
├── src/
│   ├── schema/jobs.ts                            # kinds, stages, session_id, indexes
│   ├── jobs/queue.ts                             # NEW: kind-generic fenced writes (heartbeat, setStage, saveResult, finishJob)
│   ├── library/ingest/jobs.ts                    # kind='ingest' in claim/list/get; delegates fenced writes
│   ├── ai/adapters/fake.ts                       # + scriptChatFor, strict
│   ├── dm/
│   │   ├── purposes.ts                           # DM_PURPOSES, PURPOSE_OF
│   │   ├── jobs.ts                               # DM claim, enqueue*, checkpoint, reconcile, list
│   │   ├── enqueue.ts                            # createDmEnqueuer (gate.onAppended)
│   │   ├── worker.ts                             # startDmWorker: loop, heartbeat, abort, after-turn jobs
│   │   ├── pipeline/{context,runner,call}.ts     # TurnContext, runTurn, callJson/callText
│   │   ├── nodes/{assemble,director,interpret,adjudicate,resolve,narrate,audit,schemas}.ts
│   │   ├── facts.ts                              # NarrationFacts from rows; dice-line renderer
│   │   ├── fallback.ts                           # factualSummary
│   │   ├── audit-words.ts                        # word lists for deterministic checks
│   │   ├── companion.ts, chronicle.ts            # the two actor job kinds
│   │   ├── seed/{schema,load,combatants}.ts
│   │   ├── doctrine/{doctrine.ts,NOTICE.md}
│   │   ├── prompts/{director,interpret,adjudicate,narrate,audit,chronicle,companion}.ts
│   │   └── script/{schema,load}.ts               # DmScript, createScriptedDm (tests + TASK-0048)
│   ├── routes/dm.ts                              # NEW: /dm/sessions/:id/{start,turn,turns}
│   ├── app.ts                                    # mount /dm
│   └── index.ts                                  # startDmWorker, gate.onAppended(enqueuer)
├── package.json                                  # + "@the-stacks/srd": "workspace:*"
└── test/dm/
    ├── scripts/*.json                            # the seven fixture scripts
    ├── *.test.ts                                 # pure suites
    └── *.integration.test.ts                     # database suites

biome.json                                         # + override for apps/server/src/dm/**
fixtures/boundary-violations/apps/server/src/dm/bad.ts   # proves the override fires
apps/server/tsconfig.json                          # + reference to packages/srd
Dockerfile                                         # + COPY apps/server/seeds; NOTICE.md beside dist
.env.example                                       # + commented AI_PURPOSES example with the seven dm.* purposes
```

**Structure Decision**: one server module tree, `dm/`, because the runtime orchestrates the
gate, the gateway, retrieval and the queue, all of which live in `apps/server`. Nothing is
pure enough to move into a package except the schemas, and keeping them beside their nodes
avoids a fourth package for M2. TASK-0060 swaps `dm/seed/` for codex loading.

## Gateway purposes and config

Seven code-constant purposes (contracts/purposes.md). `.env.example` documents an
`AI_PURPOSES` example for all seven. `ai/config.ts` is unchanged: purposes are data. The
boot log names unconfigured `dm.*` purposes.

**Model and cost notes.** Strong models for `dm.director`, `dm.adjudicate`, `dm.narrate`;
mid for `dm.interpret`, `dm.companion`; cheap for `dm.audit`, `dm.chronicle`. A free-mode
turn: four to six hot-path calls, prompts capped per contracts/nodes.md (about 4–7k input
tokens per call at the caps). The gateway's usage records carry per-call cost. **Real-provider
runs are an operator checkpoint**: stop with the provider, model list and an estimate before
the first one. Every test and the merge-condition run use the fake gateway.

## Dependencies and migrations

- **New runtime dependency**: none from npm. `apps/server` gains the workspace dependency
  `@the-stacks/srd` (already built and shipped in the image).
- **Migration**: yes, `0004`. The `jobs` table gains kinds `turn`, `companion`,
  `chronicle`, node stages, a nullable `session_id`, a nullable `book` guarded by a CHECK, and
  three partial unique indexes plus one index (contracts/turn-jobs.md). Generate it with
  `drizzle-kit generate`. After any `origin/main` merge that brings another migration,
  regenerate instead of hand-merging `meta/_journal.json`.
- **Image**: the Dockerfile copies `apps/server/seeds/` and `dm/doctrine/NOTICE.md`.

## Phases (one implementer dispatch each; see tasks.md)

1. **Queue for DM jobs** — schema and migration `0004`; `jobs/queue.ts`; ingest kind
   filters; DM claim, enqueue, forced upsert, checkpoint, reconcile, list. DB suites:
   fencing, reclaim, per-session serialization, one queued beat, ingest regression.
2. **Seed, doctrine, purposes, scripts** — seed schema, loader, SRD combatants, the seed
   file; doctrine pairs, `NOTICE.md`, guard test; `purposes.ts`; FakeProvider purpose queues
   and strict mode; `DmScript` and `createScriptedDm`; `.env.example`; Dockerfile.
3. **Seam and planning nodes** — `TurnContext`, runner, `callJson`/`callText`, prompt
   builders with token caps; assemble, director, interpret, adjudicate (retrieval and
   citation verification). Pure and DB tests.
4. **Resolve, narrate, audit** — resolve's groups, step chains, gate outcomes, markers and
   checkpoint replay; facts and the dice-line renderer; narrate; deterministic checks;
   `dm.audit`; the bounded loop; factual summary; `submitNarration`. Tests incl. the narrate
   import boundary.
5. **Worker, actors and routes** — `startDmWorker` (loop, heartbeat, abort, after-turn
   jobs), the enqueuer, companion and chronicle jobs, `/dm` routes, `index.ts` wiring, the
   `dm/` Biome override and its fixture, write-boundary assertion for `dm/`. DB suites.
6. **Merge condition and full gate** — the seven fixture scripts; the full-turn run on the
   task's own stack with ledger and audit evidence; the reclaim, beat-queue, companion,
   human-seat and full-scene suites; `pnpm ci:check` green.

## Deferrals (decision-0020)

No deferral without a card. Every item this plan leaves out already has one:

| Left out | Card |
|---|---|
| Codex entities replace the seed; chronicle proposes codex updates | TASK-0060 (and TASK-0056 contracts) |
| PC sheets over the engine (the seed's pregenerated stats are a stand-in) | TASK-0058 |
| Group sign-off for several humans | TASK-0049 |
| Assisted human DM proven at scale (ask policy end to end) | TASK-0053 |
| Positions, movement and range on a map | TASK-0071 |
| Campaign-level pacing for the Director | TASK-0085 |
| Graph framework for the nodes | TASK-0054 (trigger in decision-0019) |
| Parked combat rules (Grit, fight budgeting) | TASK-0055 |
| Playtest harness, auditor agent, demo | TASK-0048 |

## Open Questions (operator; defaults applied, nothing blocks dispatch)

Spec Open Questions 1–6 carry their defaults into this plan. None needs a new card: each
alternative is a different design of this same task, not deferred work.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| Checkpoint plus reason markers (research R5) | crash-safe resolve without a gate idempotency key | at-least-once would double a damage batch on reclaim; a gate key is a 029 contract change |
| Three DM job kinds on one table | companions and chronicle are separate actors and off the hot path | pipeline nodes would change AC #2's order and make companions DM puppets |

No constitution violation.

## Agent context

The Spec Kit agent-context script was not run: this project's `CLAUDE.md` is a PDLC-managed
grounding block. The wiki re-pin after merge (runbook: `ingestion`, `ai-gateway`,
`configuration`, `rules-answerer`, `database-schema`, `migrations`, plus a new `dm-runtime`
note) carries the context instead.
