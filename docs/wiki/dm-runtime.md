---
name: dm-runtime
description: The AI DM runtime (TASK-0046, apps/server/src/dm/) - the fixed node pipeline (assemble to check): interpret emits Intent stages, resolve runs them through the Intent runner, narrate reads a `why` window; the actor snapshot, resolve as the only gate writer, digit-free narration, the check node, six purposes, scene seed, doctrine, companions, chronicle, /dm routes, import boundary.
kind: component
sources:
  - apps/server/src/dm/pipeline/runner.ts
  - apps/server/src/dm/first-stage.ts
  - apps/server/src/dm/intent-runner.ts
  - apps/server/src/session/projections.ts
  - apps/server/src/dm/pipeline/context.ts
  - apps/server/src/dm/pipeline/call.ts
  - apps/server/src/dm/nodes/assemble.ts
  - apps/server/src/dm/nodes/check.ts
  - apps/server/src/dm/resume.ts
  - apps/server/src/dm/nodes/director.ts
  - apps/server/src/dm/nodes/schemas.ts
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
  - apps/server/src/dm/nodes/resolve.ts
  - apps/server/src/dm/nodes/settle.ts
  - apps/server/src/dm/nodes/narrate.ts
  - apps/server/src/dm/deeds.ts
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
verified_against: 5ba7f18bb95249307d50ce843a083392047107bd
---

# DM runtime

`apps/server/src/dm/` runs the AI dungeon master for a play session. A player commit
queues a **turn**; the turn reads the log, plans, resolves mechanics through the engine, narrates,
checks the narration, and writes back through the proposal gate ([[proposal-gate]]) as `ai:dm`. Spec: `specs/031-dm-runtime/`; queue mechanics in [[dm-turn-jobs]].

## The pipeline

The runner (`pipeline/runner.ts`, `runTurn`) walks a fixed node order. Each node is a plain
async function `(TurnContext) => NodeResult`.

1. **assemble** - code only. Freezes the beat (committed, unresolved actions in `seq` order; an action a pending `ai:dm` proposal names awaits the human DM and leaves every turn's beat),
   folds the DM projection ([[session-model]]), reads `projections.presence` into
   `AssembleOutput.presence` ([[presence]]; no Director prompt text uses it yet), builds **S0**
   (`AssembleOutput.snapshot`; each actor's logged scene presence sets `presentNpcIds`), selects scene-seed material, and looks up SRD
   records ([[srd-data]]). `AssembleOutput.resumed` holds the plans of actions whose paused turn's proposal is now approved (`resume.ts`, TASK-0168, specs/057); the checkpoint freezes them.
2. **director** - `dm.director`. Decides scene-level changes (set the scene, trackers, table
   mode, encounter setup), whether the beat resolves or **holds** for companions, and the optional `arrivals` list (offstage seed NPCs, or in free mode unseen encounter monsters, now on screen, `dm.director-v12` (TASK-0274, spec 099: an encounter that already ran and can still fight is listed "(resume)", and in turn mode `unseenMonsters` lists the running fight's joinable monsters); v11, TASK-0302, spec 096: a human actor reads as the seated character id, never a user id); v10, TASK-0237, spec 089: `goalNote` also states no result a roll this beat could decide, and the arrivals rule says a reveal a roll decides is the roll's; narrate withholds the note on a beat where a check failed; v9, spec 088, TASK-0238: monster arrivals; its `goalNote` states no count, morale or trigger, TASK-0214; v8, TASK-0203: the shape says `goalNote` is its own always-written top-level key, never inside `pacing`). `legalizeDirector` keeps only offstage seed NPCs and, in free mode, `unseenMonsters` (in turn mode, `joinableMonsters`: monsters of the active encounter not yet combatants, spec 099), and drops all arrivals on scene start.

**Encounter phases** (spec 099, TASK-0274). `encounterPhase` (`gates/plan-gate.ts`) derives each seed encounter's phase from the engine order and the ledger, never stored: `pending` (not run), `active` (the order holds one of its monsters) or `ended` (it ran, no order holds it). `startableEncounterIds` replaces `runnableEncounterIds` in legality and the prompt: every `pending` encounter, and each `ended` one with an `eligibleMonsters` entry (a monster that is a combatant, not dead, logged present or never logged, side `hostile` or none). A `turn` decision on an ended encounter is a **resume**: `directorOpening` adds no combatant and runs no encounter-start presence group, then rolls initiative over living party members and eligible monsters only; when no monster is eligible it rolls nothing. A resume with no eligible monster is overridden "no foe of the encounter can fight". `directorClosing` ends the fight in code: after the Director's own decision it loads fresh projections, clears a fight the engine already ended (a `combatant.depart` of the last living combatant), or runs `encounter.end` and sets free mode with reason "No foe still stands." when `encounterOver` holds. A party wipe does not end it. A newcomer arriving in turn mode is added with side `hostile` and joined with `initiative.join`, so only it rolls. Every `combatant.add` resolve writes carries a side: seed characters `party`, encounter monsters `hostile`, other pulled NPCs `neutral` (`combatantFromSrd` takes the side).
3. **interpret** - `dm.interpret` (spec 104, TASK-0269; `dm.interpret-v18`). Reads each beat item into a list of up to 6 **stages**, each `{intent, beside}`: an Intent body (kind, targets, params, `text`) from the 18 `INTERPRET_KINDS` (`attempt`, `check`, `save`, `contest`, `attack`, `cast`, `help`, `hide`, `search`, `grapple`, `shove`, `use_object`, `move`, `stand`, `drop_prone`, `dash`, `dodge`, `disengage`), written through structured output; `INTENT_GRAMMAR` (`prompts/interpret.ts`) lists one line per kind. The model writes no id, actor, source, commit or DC: `stampIntent` stamps the id (`<actionId>.<n>`, or `npc.<job>.<n>`), the actor (`actorOfItem`: the beat item's own character, never the model's), source `ai` and commit (`declared`; `confirmed` on a monster turn), then re-validates the whole `IntentSchema`; a failure is `invalid-output`. The `beside` block (check, save, contest, search or hide only) keeps the spec 070/080 data the Intent cannot hold: `stakes`, band effects (`onSuccess`, `onFailure`, `onCost`, `onSevere`), `newRisk`, `reveals`, `autoFail`. A check stage names a skill or ability and no number; the planner derives the DC ([[planner]]). A slash item never reaches the model: `isSlash` holds when every non-blank line starts with `/`, and `parseSlashItem` parses each line with `parse` from [[intent-contract]] into one stage (ids `<actionId>.<n>`, at most 6 lines; a parse refusal or a body the schema rejects becomes a clarify reading that names the line). An AI companion's hold act (`HOLD_ACT_TEXT`) is a zero-stage reading built in code. Ambiguous text returns `clarify`, one question, and no stage. A monster turn (spec 107, TASK-0299) is code: `monsterStages` (`dm/monster-policy.ts`) builds the reading from the engine stat block, the spatial view and the seed monster's `tactics` (`nearest` or `weakest`), with `say` null and no model call; it names an attack entry, never a number (one attack per turn; a melee-only monster in another zone gets `move` then `attack`). Resumed actions are not read again; their stored readings rejoin in beat order, and an old checkpoint's `steps` reading still parses as `LegacyInterpretReading` (`hasStages` tells the two apart).
   A code-only **first-stage cut** (`first-stage.ts`, TASK-0182) runs between interpret and resolve (spec 110 deleted the adjudicate node): in `free` mode `firstStages` keeps stages up to the first roll-bearing run of like stages and `stageLine` turns each cut stage into a follow-up, and `holdDirector` holds that beat's turn, tracker and scene-end moves. `checkpoint.cut` makes a reclaim skip it. A human's clarify also holds (specs/073): `clarifyHolds` marks each committed human action whose reading asks a question; the cut holds that beat's turn, tracker and scene-end moves with reason `held: an action awaits an answer`. An AI actor's clarify does not hold. After the cut, `askUndeclared` (spec 077, [[dm-plan-gate]]) turns an undeclared manner check (also on an Intent `check` stage) or another human's roll into a clarify, so the same hold applies; the `dm.plan.cut` log line reports the count as `asked`.
4. **resolve** - code only; the one node that writes. An Intent reading goes to `runStages` (`intent-runner.ts`); there is no step path (spec 110). It first seeds the run with each resumed plan's submissions (an approved `pending` one becomes `applied`), so the chain continues without a second roll. After its last gate write it builds **S1** and returns
   `ResolveOutput.snapshot` and `ResolveOutput.diff` (S0 to S1). See below. In turn mode a held party action (`TURN_HELD`, TASK-0244) resolves as outcome `held`: no step, no row, still committed; the turn advance ignores it, and when the turn reaches the companion resolve queues a `turn` job with trigger `held` instead of a companion job ([[dm-turn-jobs]]).
5. **narrate** - `dm.narrate`. Builds the fact sheet (`dm/fact-sheet.ts`, [[dm-narration-quality]]), asks the model for tagged `[restate]` `[describe]` `[ask]` slots (TASK-0245, spec 098) and ships `composeReply`: slots, then code rows and a `State:` line. Spec 108 (TASK-0298) streams it: narrate sends the code-rendered rows part through `NodeDeps.streamNarration` before the model call, feeds each model delta to the stream parser (`dm/narration-stream.ts`) and forwards the checked parts; `check` sends the last parts and records `firstTokenMs`, `firstProseMs` and `firstProseAt` in the check record ([[dm-narration-quality]]). Renders a `why` row for every public `intent.recorded` row in the window `(W0, W1]` (`NodeDeps.loadEvents`; `factsThrough` on the checkpoint, below). Writes prose from code-built facts (including the monster reading's plan, the turn holder, the Off turn list and the Waiting line for a held party action, TASK-0193, TASK-0214, TASK-0244), the player-facing seed view and S1 ([[dm-narration-quality]]).
6. **check** - pure code, no model call: `checkNarration` tests the describe and ask slots for a leak (dropped, with a `dm` correction) and a contradiction (shipped, with a public correction); nothing blocks play ([[dm-narration-quality]]).

An empty-beat `talk` turn skips this order ([[dm-talk-triggers]]). Spec 111 (TASK-0337) D2, the deed rule: any non-`talk`, non-`scene-start` turn whose beat is empty asks `pendingDeeds` (`nodes/narrate.ts`) for the deeds in the narrate window. With none, the turn ends `empty-beat`. With one or more, the runner sets `deedPass`, skips the director call with a code-made stay-put Director output (`resolve`, mode `stay`, no arrivals, no companion prompts) and goes on to narrate the deeds rather than to the talk path ([[dm-turn-jobs]]). A turn with trigger `intent` (spec 066 FR-031) is such a turn: it no longer skips the director by trigger. A `deed` is a player-side act the engine settled or stopped, or a `ruling` that settled a player's ask (`dm/deeds.ts`: `isDeedRow`, pure, in narrate's import closure). Spec 107 D4: an `npc-turn` job with an empty beat also skips the director call (the same code-made output). Spec 102 FR-023: at the start of every turn job under an AI seat the worker calls `answerRulings` (`dm/rulings.ts`, prompt `dm.ruling-v1`): one structured call per open ruling request, oldest first, then a `ruling` Intent from `ai:dm`; the model returns a decision and a difficulty tier, never a number.

Director and interpret outputs are checkpointed in `jobs.result`; a reclaim does not re-pay them. A checkpoint whose interpret readings include an old-shape one (steps, no stages) is dropped from interpret on: the worker calls `dropLegacyPlan` (`resume.ts`) at claim, logs `dm.checkpoint.legacy-dropped`, and keeps `beat`, `director`, `submissions` and `lastSeq`, so landed rows replay by marker; `findResumedPlans` skips an old-shape reading the same way. The old shape is not read again (one-way, ruled 2026-11-12). Model output is parsed with Zod through `callJson`/`callText` (`pipeline/call.ts`); every call
is recorded to `recordCall` ([[dm-turn-jobs]]). Parse order: think strip, strict parse (fence stripped), else the one top-level object inside surrounding prose, then normalize, schema. A capped attempt logs `dm.call.truncated` (with `parse` set to the failure kind, null for `callText`) instead. Each rejected reply logs one line with a 200-char head and tail: `dm.call.invalid-json` when no JSON parses, `dm.call.schema-mismatch` when JSON parses and fails the schema (TASK-0203). The ledger outcome follows the same split (`truncated` wins when the attempt was capped). Excerpts keep raw text (TASK-0181).

`callJson` makes at most two attempts, the second with the first's issues. Three calls pass a `normalize` hook. `normalizeDirector` cuts an over-long `goalNote` or `reason` to 300 characters (spec 033). `normalizeChronicle` (`chronicle.ts`) turns numeric `sourceActionIds` into strings. The companion prompt (`dm.companion-v8`) says to write all four keys.

## Actor snapshot

Every prompt's state comes from one `ActorSnapshot` ([[actor-snapshot]]): S0 for director,
interpret (`dm` view); S1 for narrate (`fiction` view); the current
state for the companion (`seat` view); the state at `throughSeq` for the chronicle (`fiction`
view). An over-cap snapshot fails the turn with `state-overflow` ([[dm-failure-and-gates]]).

## Resolve: the only writer

**Intent runner** (spec 104, `dm/intent-runner.ts`, `runStages`). For each stage in order the runner stamps two copies of the Intent. An item's stage is first **declared** under its proposer (`proposerOf`: the human's user id or the AI companion), then **confirmed** under `ai:dm`, one `intent` proposal each (keys `<prefix>:i<n>:d` and `<prefix>:i<n>`); a monster turn confirms only. The planner and the gate own legality ([[planner]], [[proposal-gate]]); the runner reads the `intent.recorded` carrier row: `settled` continues; `needs_ruling` under a human seat stops the chain awaiting, under an AI seat calls `answerRulings` and continues when the Intent is `answered` (the ruling's batch counts toward the Intent); a refusal of the first stage with nothing applied is the action's refusal. After a settled `beside` stage the band (`stepOutcome` over the stage's batch) picks the effects (`effectsForBand`, `effectCommand`; a `presence` effect is a `scene-presence` proposal), and the stage's `reveals` clue text copies to the submission. **Beside path:** the band effects and the free retry are model-written data (spec 097 OQ-5); a free retry or an `autoFail` stage still submits a legacy `check.roll` (FR-014, `legacyRoll`), since the planner has no such route. A reclaim skips the submissions the log already holds and recovers a landed stage's batches from `IntentView.batchIds`. Engine rows an Intent plans carry `actionId: null`; `buildNarrationFacts` finds them through the action's batch ids. An `action.resolved` refusal keeps `INVALID_COMMAND` for a non-engine code (`engineCode`).

Spec 083: `case "spell"` submits one `spell.cast` with the caster's level from the seed (`casterLevel`) and the table's house rules; the engine rolls and applies every spell number and spends the slot. The seed lists Odo's `cure-wounds` beside his other spells.

`nodes/resolve.ts` submits every gameplay write through `gate.submit` as `ai:dm`
(`companion.ts` and `chronicle.ts` also call it). It picks each next step from **engine events alone**: a `check.roll` or `attack.roll`
`mechanics` proposal goes in, the appended `check.resolved`/hit outcome comes out, and only then
do effects (chosen by the row's outcome band: `effectsForBand` in `stakes.ts`; resolve also records the step's `reveals` clue text as `revealedText`, spec 080; an ability check repeated after a failure with no `newRisk` is sent as `autoSuccess`, a free retry) (`damage.apply`, `healing.apply`, `condition.*`) follow. A `presence` effect (`arrived`, `left`, `fled`, `removed`, `surrendered`, `conceded`) is not an engine command: resolve submits a `scene-presence` proposal, and `findLanded` recognises a landed one from the `scenePresence` projection. Resolve and the Intent runner build that kind ([[proposal-gate]]) and resolve logs seed presence ([[seed-npc-presence]]). No model is read inside
resolve (the AI seat's ruling answers run through `answerRulings`, `dm.ruling-v1`); the engine ([[dnd5e-engine]]) owns every number: each combatant carries `stats` (spec 082: `combatant.add` takes a seed PC's from its sheet via `statsFromCharacter`, a monster or pulled NPC's from its SRD block via `statsFromSrd`), and resolve sends `difficulty`, `opposition` (an object `difficulty` becomes the command's `opposition`, spec 084) or `attack` for the engine to derive. The planner builds the commands: a `help` Intent becomes one `help.grant`, an attack's hit damage is the attack entry's alone, and a `move` Intent's opportunity attacks come from the planner's reaction probe ([[planner]]). Resolve pulls no NPC into the scene from a plan (spec 110 deleted `pullIn`, `reactions.ts` and the `pull` ids; `buildNarrationFacts` no longer sets `facts.pulled`). Spec 110 also deleted the old step path: the adjudicate node, the step grammar prompt, the `Step` and legacy-reading schemas and `runSteps`. The `dm.adjudicate` purpose stays, because `rulings.ts` uses it. Only a pause stops the chain. `follow-ups.ts` carries an open `followUp` of an earlier beat into narrate facts. A gate refusal is recorded, never retried. Each submission is checkpointed (`Submission`, keyed `<jobId>#<n>`).

Spec 100 (TASK-0271): at scene start resolve submits `space.define` from the seed (key `director:space`) before the first party `combatant.add`, and every party `combatant.add` carries `placement` at the seed's `start` zone. A monster `combatant.add` (arrival or encounter start) carries its encounter's `zone`; `pullIn` places an NPC in the active seed encounter's zone, else its own `zone`. At encounter start, before initiative, resolve submits `combatant.place` to the encounter zone for each party combatant standing elsewhere (key `director:gather:<encounterId>:<combatantId>`); The gather stays under spec 104: it is code, not a stage. The gate's fog rule decides each row's visibility ([[zone-fog]]).

Resolve holds a Director arrival that a check's stake texts name (`splitArrivals`, spec 089): `landHeldArrivals` lands it after the NPC group only when the applied band's texts name it, else it logs `dm.arrival.held`. Resolve's six groups and settling: [[dm-turn-jobs]]; floor guard: [[turn-floor]].

## Narration and check

**Narrate window** (spec 104 FR-018, FR-019; spec 111 moves the arithmetic to `narrateWindow` in `dm/deeds.ts`, read through `loadWindow` in `nodes/narrate.ts`). Each narrate renders a `why` row for every public `intent.recorded` row in `(W0, W1]` and, since spec 111, one `Deed:` row per deed in the window (`windowDeeds`, [[dm-narration-quality]]), so an Intent a human DM or the gate settled before the job is narrated too. `W1` is `projections.throughSeq` of the projections that narrate reads; it is stored as `NarrateOutput.factsThrough` and `TurnCheckpoint.factsThrough` (absent on older rows). `W0` is the newest prior checkpoint's `factsThrough`, else the seq of the newest earlier `narration` row, else 0, so a first beat or a deploy does not re-render history. `NodeDeps.loadEvents` reads the rows; the worker wires it to `loadEventWindow` in `session/projections.ts` (`readFrom` with `throughSeq` and `types`, [[event-log]]), because `dm/` imports no log module. The carrier read now spans `afterSeq: 0` through W1, because a ruling row finds the ask it answers earlier than W0; rows at or before W0 are filtered out of the plan facts and the deeds. A failed narrate or check stores `factsThrough` at the current `throughSeq`, so the next beat does not repeat the rows.

Prose is **digit-free**; code builds the rows and the State line (`NarrateOutput.sheet`, `slots`). Each turn makes one `dm.narrate` call; a call error ships restate, rows and the State line. The `check` node (spec 103, TASK-0272) then drops leak sentences and files corrections; it never re-calls the model and there is no fallback summary. The claim gate is retired ([[output-claim-gate]]). Facts, checks and the player-facing seed view are in [[dm-narration-quality]]. The `check` stage reports as `narrate` in `jobs.stage` (no migration). `callText` takes an optional `onText` observer (a throw never breaks the call) and returns `firstTokenMs`. The worker's `onNarrationStream(sessionId, part)` dep builds `streamNarration` per turn job and sends `end` in a `finally` around every turn job, on every outcome ([[dm-turn-jobs]], [[websocket-gateway]]).

## Purposes

`dm/purposes.ts` fixes six purposes (`dm.director`, `interpret`, `adjudicate` (now used only by the AI seat's `answerRulings`), `narrate`, `chronicle`, `companion`; `dm.audit` is retired, old `dm_model_calls` rows stay valid). Models: `AI_PURPOSES`; see [[ai-gateway]]. Each `PURPOSE_MAX_TOKENS` default is 4000 (TASK-0192), except `dm.interpret` at 8000 (TASK-0273: a hosted read saturated 4000). `unstructuredDmPurposes` names configured purposes lacking `structured`. `callJson` sends its Zod schema as `ChatRequest.output` (JSON Schema draft-7, input shape; `.refine` rules still run after parsing). In `callJson`/`callText`, an attempt whose usage says `truncated` settles as `truncated`, not `invalid-json`/`ok`.

## Seed, doctrine, script

- **Scene seed** (`seed/schema.ts`, `seed/load.ts`; `apps/server/seeds/greyhollow-ford.json`, plus `-duo` and `-trio`):
  a validated JSON scene (at least one `human` seat) (goal, location, beats with a required `presence` map, NPCs with `aliases`, encounters; [[seed-npc-presence]]);
  the seed id is the scene id. `location.ways` (up to 6 `{label, draft}`, default `[]`) is validated by parsing each way's draft. Scene start writes `after: openingScene(playerFacingSeed(seed))` (spec 091), so `scene.changed` carries `description`, `ways` and `cast`.
- **Doctrine** (`doctrine/doctrine.ts`): DM-craft rules adapted from tabletop-dm (commit
  fe2c29b, Copyright (c) 2026 Brad Bush, MIT). `doctrine/NOTICE.md` carries the licence.
- **Agency** (specs/074, TASK-0113; `AGENCY_RULE` and `agencyRule(node)` in `doctrine.ts`): one shared rule, rendered into the director, interpret, narrate, companion, react and playtest-auditor prompts. A party member's volitional acts belong to its player. The dice may decide a reflex only, and a reflex must be a fact (`FactInvoluntary`). The Director's goal note is pacing advice; the interpret prompt says so. The DOCTRINE pair 'Never decide the hero's words...' now allows a reflex and shows a club strike as the right example.
- **Scripted DM** (`dm/script/`): per-purpose responses and dice become a strict `FakeProvider` plus
  `scriptedRng`, for tests and evidence runs ([[test-suite]]). `script/env.ts` also loads a shipped
  script (`apps/server/dm-scripts/greyhollow-live.json`) at boot under `DM_FAKE_SCRIPT` on a worktree
  stack, replacing the AI config ([[ai-gateway]]).

## Companions and chronicle

An AI companion is a party member with controller `ai-companion`. `companion.ts` asks
`dm.companion` for `say`, `comment` and `act` output and submits it through the gate, under a human's permission matrix and commit authority. Each run returns one `pending` decision per own open action: `commit`, `withdraw` or `revise`
(`withdraw` after a human `object`, else `commit`). A human comment on
an open action queues a `react` run ([[dm-turn-jobs]], [[playtest-harness]]). In turn mode only the active companion
commits; a withdraw still takes the hold act. Spec 107 (`dm.companion-v9`): on its own turn the companion writes `turn`, up to 3 typed Intent bodies from `COMPANION_TURN_KINDS` (`CompanionIntentBodySchema`; no check-family kind). `turnText` stamps each body (actor from the job), checks `parse(toText(i))` round-trips, joins the lines and declares and commits them as one action, so interpret makes no model call for it. A null, empty or invalid `turn` takes the hold act and logs `dm.companion.turn-invalid` (`reason: missing-turn`, or the failing `path`).
A `hold` decision queues a companion job that force-queues the turn. A trio table queues no companion job. `chronicle.ts` runs off the hot path after narration: `dm.chronicle`
turns new narration into `journal` proposals, idempotent when nothing is new. It reads the state at
its `throughSeq` (`loadProjectionsThrough`, [[session-model]]) and prints it in the `fiction` view
(`dm.chronicle-v4`). The chronicle prompt drops absent actors from the fiction snapshot and allows a departure only when the transcript says so.

## Routes and boundary

`routes/dm.ts` (mounted at `/dm`, operator-only, [[server-entrypoint-and-app]]):
`GET /dm/seeds` (`{ seeds }` from `listSeeds`), `POST /dm/sessions/:id/start` (body `{ seedId, seats }`, 202 `{ jobId }`, 400 when a user holds two seats, 409 unless `sceneStartState` is `none`), `GET /dm/sessions/:id/start` (`{ state }`, TASK-0167), `POST /dm/sessions/:id/turn` (manual retry, 202), and
`GET /dm/sessions/:id/turns?limit` (job list with outcome, check record (or the legacy audit record on pre-0272 rows) and call metadata). Read-only `events`, `jobs`, `seed` and `calls` routes under `/dm/sessions/:id` serve the debug view ([[debug-view]]). A Biome `noRestrictedImports` override on `apps/server/src/dm/**` forbids log writers, ingestion, the library store, codex and ws ([[ci-pipeline]], [[monorepo-and-toolchain]]):
session state is written only through the gate.
