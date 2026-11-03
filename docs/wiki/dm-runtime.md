---
name: dm-runtime
description: The AI DM runtime (TASK-0046, apps/server/src/dm/) - the fixed node pipeline (assemble to audit), the actor snapshot behind every prompt's state (see actor-snapshot), resolve as the only gate writer with the engine owning every number, the six-group resolve order, digit-free narration, the bounded audit loop (see dm-narration-quality), seven purposes, failure record and rules-term gates (see dm-failure-and-gates), scene seed, doctrine, companions, chronicle, /dm routes, import boundary.
kind: component
sources:
  - apps/server/src/dm/pipeline/runner.ts
  - apps/server/src/dm/first-stage.ts
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
size_budget_exempt: both notes sat within 30 chars of the 8000 budget before TASK-0180; the talk path got its own note (dm-talk-triggers) and only a pointer line lands here; the rest is one pipeline each, not splittable without a TASK of its own
verified_against: f4726f9060fe3cdf0068926f26aec5ef734fee79
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
   mode, encounter setup), whether the beat resolves or **holds** for companions, and the optional `arrivals` list (offstage seed NPCs now on screen, `dm.director-v6`). `legalizeDirector` keeps only offstage seed NPCs and drops all arrivals on scene start.
3. **interpret** - `dm.interpret`. Reads each action into steps (check, attack, move, effect, roll; `dm.interpret-v10`; a monster reading may set `say`, its spoken line, kept apart from rules notes and carried into the facts as `says:`; every check step declares `stakes`, a consequence per outcome band, success included, before the roll, and may set `reveals`, one clue of the beat's `Discoverable clues` section) and
   flags `needsAdjudication`. Resumed actions are not read again; their stored readings rejoin in beat order.
4. **adjudicate** - `dm.adjudicate`, only when an interpret reading asks. May call `retrieve`
   ([[retrieval]]) for rules text and returns a ruling. Resumed readings keep their stored ruling.
   A code-only **first-stage cut** (`first-stage.ts`, TASK-0182) runs between adjudicate and resolve: in `free` mode steps after the first run of like checks become `followUps`, and `holdDirector` holds that beat's turn, tracker and scene-end moves. `checkpoint.cut` makes a reclaim skip it. A human's clarify also holds (specs/073): `clarifyHolds` marks each committed human action whose reading asks a question and has no ruling; the cut holds that beat's turn, tracker and scene-end moves with reason `held: an action awaits an answer`. An AI actor's clarify does not hold. After the cut, `askUndeclared` (spec 077, [[dm-failure-and-gates]]) turns an undeclared manner check or another human's roll into a clarify, so the same hold applies; the `dm.plan.cut` log line reports the count as `asked`.
5. **resolve** - code only; the one node that writes. It first seeds the run with each resumed plan's submissions (an approved `pending` one becomes `applied`), so the chain continues without a second roll. After its last gate write it builds **S1** and returns
   `ResolveOutput.snapshot` and `ResolveOutput.diff` (S0 to S1). See below.
6. **narrate** - `dm.narrate`. Writes prose from code-built facts (including the monster reading's plan and the turn holder, TASK-0193), the player-facing seed view and S1 ([[dm-narration-quality]]).
7. **audit** - deterministic checks, including the claim gate against S1 and the diff ([[output-claim-gate]]), plus one `dm.audit` call (same S1 sections); decides what ships ([[dm-narration-quality]]).

An empty-beat `talk` turn skips this order ([[dm-talk-triggers]]).

Director, interpret and adjudicate outputs are checkpointed in `jobs.result`; a reclaim does not re-pay them. Model output is parsed with Zod through `callJson`/`callText` (`pipeline/call.ts`); every call
is recorded to `recordCall` ([[dm-turn-jobs]]). Parse order: think strip, strict parse (fence stripped), else the one top-level object inside surrounding prose, then normalize, schema. Each unparsable reply logs `dm.call.invalid-json` with a 200-char head and tail (TASK-0203). Excerpts keep raw text (TASK-0181).

`callJson` makes at most two attempts, the second with the first's issues. Only the director passes a `normalize` hook (`normalizeDirector`): it cuts an over-long `goalNote` or `reason` to 300 characters (spec 033).

## Actor snapshot

Every prompt's state comes from one `ActorSnapshot` ([[actor-snapshot]]): S0 for director,
interpret and adjudicate (`dm` view); S1 for narrate and audit (`fiction` view); the current
state for the companion (`seat` view); the state at `throughSeq` for the chronicle (`fiction`
view). An over-cap snapshot fails the turn with `state-overflow` ([[dm-failure-and-gates]]).

## Resolve: the only writer

`nodes/resolve.ts` submits every gameplay write through `gate.submit` as `ai:dm`
(`companion.ts` and `chronicle.ts` also call it). It picks each next step from **engine events alone**: a `check.roll` or `attack.roll`
`mechanics` proposal goes in, the appended `check.resolved`/hit outcome comes out, and only then
do effects (chosen by the row's outcome band: `effectsForBand` in `stakes.ts`; resolve also records the step's `reveals` clue text as `revealedText`, spec 080; an ability check repeated after a failure with no `newRisk` is sent as `autoSuccess`, a free retry) (`damage.apply`, `healing.apply`, `condition.*`) follow. A `presence` effect (`arrived`, `left`, `fled`, `removed`, `surrendered`, `conceded`) is not an engine command: resolve submits a `scene-presence` proposal, and `findLanded` recognises a landed one from the `scenePresence` projection. Resolve alone builds that kind ([[proposal-gate]]) and logs seed presence ([[seed-npc-presence]]). No model is read inside
resolve; the engine ([[dnd5e-engine]]) owns every number. Since TASK-0194 (spec 068) resolve first pulls each plan-gate `pull` id into the scene (`pullIn`: `combatant.add` from the NPC's SRD block, default `commoner`, then `initiative.join` in an encounter when it can act), as `actionId: null` rows. Since spec 075 (TASK-0210) the same `pullIn` also pulls attack targets, attackers and damage targets. The operator ruled: "I actually think that the rule itself is incorrect -- we should be able to attack anyone regardless of combatant state." A `move` step (TASK-0208, spec 079) submits no command of its own: for each hostile in `leavesReachOf` that `reactions.ts` `reactors` finds still adjacent, able and holding its reaction, resolve submits an `attack.roll` with `reaction: true` from the hostile's first SRD melee attack (`meleeAttackOf`), keyed `<step key>:r<n>`, then `damage.apply` on a hit. Interpret never plans the hostile's attack; a hostile with no melee attack logs `dm.reaction.skipped`. Only a pause stops the chain. `follow-ups.ts` carries an open `followUp` of an earlier beat into narrate facts. A gate refusal is recorded, never retried. Each submission is checkpointed (`Submission`, keyed `<jobId>#<n>`).

Resolve's six groups and settling: [[dm-turn-jobs]]; floor guard: [[turn-floor]].

## Narration and audit

Prose is **digit-free**; code builds the dice lines. The audit loop makes at most `MAX_NARRATION_ATTEMPTS = 3` attempts and ships
a code-built in-fiction fallback on exhaustion, with a `dm` journal flag. The claim gate: [[output-claim-gate]]. Facts, audit checks,
the fallback and the player-facing seed view are in [[dm-narration-quality]].

## Purposes

`dm/purposes.ts` fixes seven purposes (`dm.director`, `interpret`, `adjudicate`, `narrate`, `audit`, `chronicle`, `companion`). Models: `AI_PURPOSES`; see [[ai-gateway]]. Each `PURPOSE_MAX_TOKENS` default is 4000 (TASK-0192). In `callJson`/`callText`, an attempt whose usage says `truncated` settles as `truncated`, not `invalid-json`/`ok`.

## Seed, doctrine, script

- **Scene seed** (`seed/schema.ts`, `seed/load.ts`; `apps/server/seeds/greyhollow-ford.json`, plus `-duo` and `-trio`):
  a validated JSON scene (at least one `human` seat) (goal, location, beats with a required `presence` map, NPCs with `aliases`, encounters; [[seed-npc-presence]]);
  the seed id is the scene id.
- **Doctrine** (`doctrine/doctrine.ts`): DM-craft rules adapted from tabletop-dm (commit
  fe2c29b, Copyright (c) 2026 Brad Bush, MIT). `doctrine/NOTICE.md` carries the licence.
- **Agency** (specs/074, TASK-0113; `AGENCY_RULE` and `agencyRule(node)` in `doctrine.ts`): one shared rule, rendered into the director, interpret, narrate, audit, companion, react and playtest-auditor prompts. A party member's volitional acts belong to its player. The dice may decide a reflex only, and a reflex must be a fact (`FactInvoluntary`). The Director's goal note is pacing advice; the interpret prompt says so. The DOCTRINE pair 'Never decide the hero's words...' now allows a reflex and shows a club strike as the right example.
- **Scripted DM** (`dm/script/`): per-purpose responses and dice become a strict `FakeProvider` plus
  `scriptedRng`, for tests and evidence runs ([[test-suite]]). `script/env.ts` also loads a shipped
  script (`apps/server/dm-scripts/greyhollow-live.json`) at boot under `DM_FAKE_SCRIPT` on a worktree
  stack, replacing the AI config ([[ai-gateway]]).

## Companions and chronicle

An AI companion is a party member with controller `ai-companion`. `companion.ts` asks
`dm.companion` for `say`, `comment` and `act` output and submits it through the gate, under a human's permission matrix and commit authority. Each run returns one `pending` decision per own open action: `commit`, `withdraw` or `revise`
(`withdraw` after a human `object`, else `commit`). A human comment on
an open action queues a `react` run ([[dm-turn-jobs]], [[playtest-harness]]). In turn mode only the active companion
commits; a withdraw still takes the hold act.
A `hold` decision queues a companion job that force-queues the turn. A trio table queues no companion job. `chronicle.ts` runs off the hot path after narration: `dm.chronicle`
turns new narration into `journal` proposals, idempotent when nothing is new. It reads the state at
its `throughSeq` (`loadProjectionsThrough`, [[session-model]]) and prints it in the `fiction` view
(`dm.chronicle-v4`). The chronicle prompt drops absent actors from the fiction snapshot and allows a departure only when the transcript says so.

## Routes and boundary

`routes/dm.ts` (mounted at `/dm`, operator-only, [[server-entrypoint-and-app]]):
`GET /dm/seeds` (`{ seeds }` from `listSeeds`), `POST /dm/sessions/:id/start` (body `{ seedId, seats }`, 202 `{ jobId }`, 400 when a user holds two seats, 409 unless `sceneStartState` is `none`), `GET /dm/sessions/:id/start` (`{ state }`, TASK-0167), `POST /dm/sessions/:id/turn` (manual retry, 202), and
`GET /dm/sessions/:id/turns?limit` (job list with outcome, audit record and call metadata). Read-only `events`, `jobs`, `seed` and `calls` routes under `/dm/sessions/:id` serve the debug view ([[debug-view]]). A Biome `noRestrictedImports` override on `apps/server/src/dm/**` forbids log writers, ingestion, the library store, codex and ws ([[ci-pipeline]], [[monorepo-and-toolchain]]):
session state is written only through the gate.
