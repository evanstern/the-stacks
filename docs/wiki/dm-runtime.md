---
name: dm-runtime
description: The AI DM runtime (TASK-0046, apps/server/src/dm/) - the fixed node pipeline (assemble to audit), resolve as the only gate writer with the engine owning every number, digit-free narration with code-rendered dice lines, the bounded audit loop (see dm-narration-quality), seven dm.* purposes, failure record and rules-term gates (see dm-failure-and-gates), scene seed, doctrine MIT NOTICE, companions, chronicle, /dm routes, the dm/ import boundary. Jobs: dm-turn-jobs.
kind: component
sources:
  - apps/server/src/dm/pipeline/runner.ts
  - apps/server/src/dm/pipeline/context.ts
  - apps/server/src/dm/pipeline/call.ts
  - apps/server/src/dm/nodes/assemble.ts
  - apps/server/src/dm/nodes/director.ts
  - apps/server/src/dm/nodes/schemas.ts
  - apps/server/src/dm/prompts/step-grammar.ts
  - apps/server/src/dm/prompts/interpret.ts
  - apps/server/src/dm/jobs.ts
  - apps/server/src/dm/nodes/interpret.ts
  - apps/server/src/dm/nodes/adjudicate.ts
  - apps/server/src/dm/nodes/resolve.ts
  - apps/server/src/dm/nodes/narrate.ts
  - apps/server/src/dm/purposes.ts
  - apps/server/src/dm/companion.ts
  - apps/server/src/dm/chronicle.ts
  - apps/server/src/dm/seed/schema.ts
  - apps/server/src/dm/seed/load.ts
  - apps/server/src/dm/doctrine/doctrine.ts
  - apps/server/src/dm/doctrine/NOTICE.md
  - apps/server/src/routes/dm.ts
  - apps/server/seeds/greyhollow-ford.json
  - biome.json
verified_against: 4af42befcf49b1e666df097dcd49e1d3b35e4057
---

# DM runtime

`apps/server/src/dm/` runs the AI dungeon master for a play session. A commit by a player
queues a **turn**; the turn reads the log, plans, resolves mechanics through the engine, narrates,
audits the narration, and writes everything back through the proposal gate ([[proposal-gate]]) as
the actor `ai:dm`. Spec: `specs/031-dm-runtime/` (contracts under `contracts/`). Queue and worker
mechanics are in [[dm-turn-jobs]].

## The pipeline

The runner (`pipeline/runner.ts`, `runTurn`) walks a fixed node order. Each node is a plain
async function `(TurnContext) => NodeResult` (`pipeline/context.ts`; no framework, decision-0019).

1. **assemble** - code only. Freezes the beat (committed, unresolved actions in `seq` order),
   folds the DM projection ([[session-model]]), selects scene-seed material, and looks up SRD
   records (`@the-stacks/srd`, [[srd-data]]).
2. **director** - `dm.director`. Decides scene-level changes (set the scene, trackers, table
   mode, encounter setup) and whether the beat resolves or **holds** for companions.
3. **interpret** - `dm.interpret`. Reads each action into steps (check, attack, effect, roll) and
   flags `needsAdjudication`.
4. **adjudicate** - `dm.adjudicate`, only when an interpret reading asks. May call `retrieve`
   ([[retrieval]]) for rules text and returns a ruling.
5. **resolve** - code only; the one node that writes. See below.
6. **narrate** - `dm.narrate`. Writes prose from code-built facts and the player-facing seed view ([[dm-narration-quality]]).
7. **audit** - deterministic checks plus one `dm.audit` call; decides what ships ([[dm-narration-quality]]).

Director, interpret and adjudicate outputs are checkpointed in `jobs.result` so a reclaimed job
does not re-pay model calls. Between nodes the runner checks the lease and aborts on a fence loss.
Model output is parsed with Zod through `callJson`/`callText` (`pipeline/call.ts`); every call
records its purpose, prompt version and outcome, never prompt text.

`callJson` makes at most two attempts: the second sends the first attempt's schema issues back.
A node may pass `normalize`, applied to the parsed JSON before the schema on every attempt. Only
the director passes one: `normalizeDirector` (`nodes/director.ts`) cuts an over-long `goalNote`
and each over-long `reason` (beat, table mode, scene, trackers) to the 300-character cap, at the
last space. It never touches a number, id or discriminant and adds no default (spec 033, row C4
of `contracts/director-output.md`).

## Failure record and rules-term gates

A failed turn stores a `TurnFailureResult` in `jobs.result`, and model output may carry only
closed rules-term lists. Both are in [[dm-failure-and-gates]].

## Resolve: the only writer

`nodes/resolve.ts` submits every gameplay write through `gate.submit` as `ai:dm`
(`companion.ts` and `chronicle.ts` also call it, as their own actors; an import-graph test pins
the set). It picks each next step from **engine events alone**: a `check.roll` or `attack.roll`
`mechanics` proposal goes in, the appended `check.resolved`/hit outcome comes out, and only then
do effects (`damage.apply`, `healing.apply`, `condition.*`) follow. No model is read inside
resolve, and no model ever sees or invents a number: the engine ([[dnd5e-engine]]) owns dice,
modifiers and damage. A gate refusal ([[proposal-gate]]) becomes a recorded result, never a
retry loop. Each submission is stored in the checkpoint (`Submission`: `stepRef`
`<jobId>#<n>`, key, kind, result, refusal, batch and proposal ids).

## Narration and audit

Prose is **digit-free**; code builds the facts and renders the dice lines, so prose cannot
misstate a roll. The audit loop makes at most `MAX_NARRATION_ATTEMPTS = 3` attempts and ships
a code-built in-fiction fallback on exhaustion, with a `dm` journal flag. Facts, audit checks,
the fallback and the player-facing seed view are in [[dm-narration-quality]].

## Purposes

`dm/purposes.ts` fixes seven chat purposes: `dm.director`, `dm.interpret`, `dm.adjudicate`,
`dm.narrate`, `dm.audit`, `dm.chronicle`, `dm.companion`. `PURPOSE_OF` maps each node to its one
purpose; `PURPOSE_MAX_TOKENS` holds default caps. Model choice stays in `AI_PURPOSES`
([[ai-gateway]], [[configuration]]); `missingDmPurposes` feeds a boot warning.

## Seed, doctrine, script

- **Scene seed** (`seed/schema.ts`, `seed/load.ts`; `apps/server/seeds/greyhollow-ford.json`):
  a validated JSON scene (goal, location, beats with clues and checks, NPCs, encounters).
  Original content plus SRD references; the seed id is stored as the scene id so the log alone
  names the seed. The Dockerfile copies `apps/server/seeds` ([[container-image]]).
- **Doctrine** (`doctrine/doctrine.ts`): DM-craft rules adapted from tabletop-dm (commit
  fe2c29b, Copyright (c) 2026 Brad Bush, MIT). `doctrine/NOTICE.md` carries the full licence
  text and ships beside the compiled module.
- **Scripted DM** (`dm/script/`): a Zod-validated script that turns a recorded set of
  per-purpose responses and dice into a `FakeProvider` plus `scriptedRng`, for tests and
  evidence runs ([[ai-gateway]], [[test-suite]]).

## Companions and chronicle

An AI companion is a party member with controller `ai-companion`. `companion.ts` asks
`dm.companion` for `say`, `comment` and `act` output and submits it through the gate as that
companion, under the same permission matrix and commit authority as a human. In turn mode the
active companion always acts (a null act becomes a hold action). A `hold` director decision queues a companion job; when it ends it
force-queues the turn. `chronicle.ts` runs off the hot path after narration: `dm.chronicle`
turns new narration into `journal` proposals, idempotent when nothing is new.

## Routes and boundary

`routes/dm.ts` (mounted at `/dm`, operator-only, [[server-entrypoint-and-app]]):
`POST /dm/sessions/:id/start` (body `{ seedId, seats }`, 202 `{ jobId }`, 409 if a scene or a
start job exists), `POST /dm/sessions/:id/turn` (manual retry, 202), and
`GET /dm/sessions/:id/turns?limit` (job list with outcome, audit record and call metadata, never
prompt text). A Biome `noRestrictedImports` override on `apps/server/src/dm/**` forbids the log
writers, ingestion, the library store, codex and ws ([[ci-pipeline]], [[monorepo-and-toolchain]]):
session state is written only through the gate.
