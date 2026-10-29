---
name: dm-runtime
description: The AI DM runtime (TASK-0046, apps/server/src/dm/) - the fixed node pipeline (assemble to audit), the actor snapshot behind every prompt's state (see actor-snapshot), resolve as the only gate writer with the engine owning every number, the six-group resolve order, digit-free narration, the bounded audit loop (see dm-narration-quality), seven purposes, failure record and rules-term gates (see dm-failure-and-gates), scene seed, doctrine, companions, chronicle, /dm routes, import boundary.
kind: component
sources:
  - apps/server/src/dm/pipeline/runner.ts
  - apps/server/src/dm/pipeline/context.ts
  - apps/server/src/dm/pipeline/call.ts
  - apps/server/src/dm/nodes/assemble.ts
  - apps/server/src/dm/resume.ts
  - apps/server/src/dm/nodes/director.ts
  - apps/server/src/dm/nodes/schemas.ts
  - apps/server/src/dm/prompts/step-grammar.ts
  - apps/server/src/dm/prompts/interpret.ts
  - apps/server/src/dm/snapshot/aliases.ts
  - apps/server/src/dm/snapshot/build.ts
  - apps/server/src/dm/snapshot/diff.ts
  - apps/server/src/dm/snapshot/index.ts
  - apps/server/src/dm/snapshot/render.ts
  - apps/server/src/dm/snapshot/types.ts
  - apps/server/src/dm/jobs.ts
  - apps/server/src/dm/script/env.ts
  - apps/server/dm-scripts/greyhollow-live.json
  - apps/server/src/dm/nodes/interpret.ts
  - apps/server/src/dm/nodes/adjudicate.ts
  - apps/server/src/dm/nodes/resolve.ts
  - apps/server/src/dm/nodes/settle.ts
  - apps/server/src/dm/nodes/narrate.ts
  - apps/server/src/dm/purposes.ts
  - apps/server/src/dm/companion.ts
  - apps/server/src/dm/chronicle.ts
  - apps/server/src/dm/seed/schema.ts
  - apps/server/src/dm/seed/load.ts
  - apps/server/src/dm/doctrine/doctrine.ts
  - apps/server/src/dm/doctrine/NOTICE.md
  - apps/server/src/routes/dm.ts
  - apps/server/src/dm/scene-start.ts
  - apps/server/seeds/greyhollow-ford.json
  - apps/server/seeds/greyhollow-ford-duo.json
  - apps/server/seeds/greyhollow-ford-trio.json
  - biome.json
verified_against: a079fb05afdb63d49c0ed186d76f578d356e30ca
---

# DM runtime

`apps/server/src/dm/` runs the AI dungeon master for a play session. A player commit
queues a **turn**; the turn reads the log, plans, resolves mechanics through the engine, narrates,
audits the narration, and writes back through the proposal gate ([[proposal-gate]]) as `ai:dm`. Spec: `specs/031-dm-runtime/`; queue mechanics in [[dm-turn-jobs]].

## The pipeline

The runner (`pipeline/runner.ts`, `runTurn`) walks a fixed node order. Each node is a plain
async function `(TurnContext) => NodeResult`.

1. **assemble** - code only. Freezes the beat (committed, unresolved actions in `seq` order; an action a pending `ai:dm` proposal names awaits the human DM and leaves every turn's beat),
   folds the DM projection ([[session-model]]), reads `projections.presence` into
   `AssembleOutput.presence` ([[presence]]; no Director prompt text uses it yet), builds **S0**
   (`AssembleOutput.snapshot`; each actor's logged scene presence sets `presentNpcIds`), selects scene-seed material, and looks up SRD
   records ([[srd-data]]). `AssembleOutput.resumed` holds the plans of actions whose paused turn's proposal is now approved (`resume.ts`, TASK-0168, specs/057); the checkpoint freezes them.
2. **director** - `dm.director`. Decides scene-level changes (set the scene, trackers, table
   mode, encounter setup) and whether the beat resolves or **holds** for companions.
3. **interpret** - `dm.interpret`. Reads each action into steps (check, attack, effect, roll) and
   flags `needsAdjudication`. Resumed actions are not read again; their stored readings rejoin in beat order.
4. **adjudicate** - `dm.adjudicate`, only when an interpret reading asks. May call `retrieve`
   ([[retrieval]]) for rules text and returns a ruling. Resumed readings keep their stored ruling.
5. **resolve** - code only; the one node that writes. It first seeds the run with each resumed plan's submissions (an approved `pending` one becomes `applied`), so the chain continues without a second roll. After its last gate write it builds **S1** and returns
   `ResolveOutput.snapshot` and `ResolveOutput.diff` (S0 to S1). See below.
6. **narrate** - `dm.narrate`. Writes prose from code-built facts, the player-facing seed view and S1 ([[dm-narration-quality]]).
7. **audit** - deterministic checks, including the claim gate against S1 and the diff ([[output-claim-gate]]), plus one `dm.audit` call (same S1 sections); decides what ships ([[dm-narration-quality]]).

Director, interpret and adjudicate outputs are checkpointed in `jobs.result`; a reclaim does not re-pay model calls. Model output is parsed with Zod through `callJson`/`callText` (`pipeline/call.ts`); every call
is recorded (no prompt text) to the `recordCall` seam ([[dm-turn-jobs]]).

`callJson` makes at most two attempts, the second with the first's schema issues. Only the director passes a `normalize` hook (`normalizeDirector`): it cuts an over-long `goalNote` or `reason` to 300 characters (spec 033).

## Actor snapshot

Every prompt's state comes from one `ActorSnapshot` ([[actor-snapshot]]): S0 for director,
interpret and adjudicate (`dm` view); S1 for narrate and audit (`fiction` view); the current
state for the companion (`seat` view); the state at `throughSeq` for the chronicle (`fiction`
view). An over-cap snapshot fails the turn with `state-overflow`. The failure record and the closed rules-term lists: [[dm-failure-and-gates]].

## Resolve: the only writer

`nodes/resolve.ts` submits every gameplay write through `gate.submit` as `ai:dm`
(`companion.ts` and `chronicle.ts` also call it). It picks each next step from **engine events alone**: a `check.roll` or `attack.roll`
`mechanics` proposal goes in, the appended `check.resolved`/hit outcome comes out, and only then
do effects (`damage.apply`, `healing.apply`, `condition.*`) follow. A `presence` effect (`arrived`, `left`, `fled`, `removed`, `surrendered`, `conceded`) is not an engine command: resolve submits a `scene-presence` proposal, and `findLanded` recognises a landed one from the `scenePresence` projection. Resolve is the only builder of that kind ([[proposal-gate]]); its seed-presence group logs the seed's declared presence at scene and encounter start ([[seed-npc-presence]]). No model is read inside
resolve, and no model sees or invents a number: the engine ([[dnd5e-engine]]) owns dice,
modifiers and damage. A gate refusal is recorded, never retried. Each submission is stored in the checkpoint (`Submission`, keyed by `stepRef` `<jobId>#<n>`).

Resolve's six groups and settling: [[dm-turn-jobs]]; floor guard: [[turn-floor]].

## Narration and audit

Prose is **digit-free**; code builds the dice lines. The audit loop makes at most `MAX_NARRATION_ATTEMPTS = 3` attempts and ships
a code-built in-fiction fallback on exhaustion, with a `dm` journal flag. The claim gate: [[output-claim-gate]]. Facts, audit checks,
the fallback and the player-facing seed view are in [[dm-narration-quality]].

## Purposes

`dm/purposes.ts` fixes seven purposes: `dm.director`, `dm.interpret`, `dm.adjudicate`,
`dm.narrate`, `dm.audit`, `dm.chronicle`, `dm.companion`.  Models: `AI_PURPOSES` ([[ai-gateway]]).

## Seed, doctrine, script

- **Scene seed** (`seed/schema.ts`, `seed/load.ts`; `apps/server/seeds/greyhollow-ford.json`, plus `-duo` and `-trio`):
  a validated JSON scene (at least one `human` seat) (goal, location, beats with a required `presence` map, NPCs with `aliases`, encounters; [[seed-npc-presence]]);
  the seed id is the scene id.
- **Doctrine** (`doctrine/doctrine.ts`): DM-craft rules adapted from tabletop-dm (commit
  fe2c29b, Copyright (c) 2026 Brad Bush, MIT). `doctrine/NOTICE.md` carries the licence.
- **Scripted DM** (`dm/script/`): per-purpose responses and dice become a strict `FakeProvider` plus
  `scriptedRng`, for tests and evidence runs ([[test-suite]]). `script/env.ts` also loads a shipped
  script (`apps/server/dm-scripts/greyhollow-live.json`) at boot under `DM_FAKE_SCRIPT` on a worktree
  stack, replacing the whole AI config ([[ai-gateway]], TASK-0158).

## Companions and chronicle

An AI companion is a party member with controller `ai-companion`. `companion.ts` asks
`dm.companion` for `say`, `comment` and `act` output and submits it through the gate as that
companion, under a human's permission matrix and commit authority. Each run returns one `pending` decision per own open action: `commit`, `withdraw` or `revise`
(default `withdraw` after a human `object`, else `commit`). A human comment on
an open action queues a `react` run ([[dm-turn-jobs]], [[playtest-harness]]). In turn mode only the active companion
commits, and a withdraw still takes the hold act so the turn advances.
A `hold` decision queues a companion job that force-queues the turn. A trio table queues no companion job. `chronicle.ts` runs off the hot path after narration: `dm.chronicle`
turns new narration into `journal` proposals, idempotent when nothing is new. It reads the state at
its `throughSeq` (`loadProjectionsThrough`, [[session-model]]) and prints it in the `fiction` view
(`dm.chronicle-v3`; overflow: [[actor-snapshot]]).

## Routes and boundary

`routes/dm.ts` (mounted at `/dm`, operator-only, [[server-entrypoint-and-app]]):
`GET /dm/seeds` (`{ seeds }` from `listSeeds`), `POST /dm/sessions/:id/start` (body `{ seedId, seats }`, 202 `{ jobId }`, 400 when a user holds two seats, 409 unless `sceneStartState` is `none`), `GET /dm/sessions/:id/start` (`{ state }`, TASK-0167), `POST /dm/sessions/:id/turn` (manual retry, 202), and
`GET /dm/sessions/:id/turns?limit` (job list with outcome, audit record and call metadata). Four read-only operator routes serve the debug view: `GET /dm/sessions/:id/events`, `/jobs`, `/seed` and `/calls` ([[debug-view]]). A Biome `noRestrictedImports` override on `apps/server/src/dm/**` forbids the log
writers, ingestion, the library store, codex and ws ([[ci-pipeline]], [[monorepo-and-toolchain]]):
session state is written only through the gate.
