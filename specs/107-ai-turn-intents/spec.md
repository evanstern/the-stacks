# Feature Specification: AI companion and monster turns emit Intents

**Feature Branch**: `task-0299-ai-turn-intents`
**Created**: 2026-11-12
**Status**: Draft (spec author, R1 sweep, lane LI).
**Card**: TASK-0299 (gap G2, runbook finding F5, CP-5 ruling 2026-11-08). Parent epic TASK-0258.
**Input**: TASK-0299 description, AC #1–#4, and the card note from spec 096 OQ1 (the companion
prompt still renders a human commenter's user id).

**Authored against** (upstream commits on `origin/main`): spec 092 contract `intent-schema.md`
v1.1 `0cfd68f5`, spec 097 contract `planner.md` `a34d5d39`, spec 102 `plan.md` `86d425b6`,
spec 104 `plan.md` `f61a0bac` (merged as PR #168, `1aae66a2`), spec 106 `plan.md` `bb6d6beb`.
Branch base `origin/main` `348afe1c`. Consumed only through published exports:
`@the-stacks/intent` (`parse`, `toText`, `IntentSchema`), the `dm/nodes/schemas.ts` interpret
body schema, `dm/intent-runner.ts` `runStages`, and the gate's `intent` request.

`speckit-clarify` skipped: every ambiguity is settled by an upstream spec or listed under "Open
questions" with a recommendation.

## Summary

Today an AI companion's turn costs a `dm.companion` call, then the turn job's `dm.director`,
`dm.interpret` and `dm.narrate` calls. A monster turn costs `dm.director`, `dm.interpret` and
`dm.narrate`. After this card:

- **Companion turn (turn mode, own turn).** The `dm.companion` call returns typed Intent bodies
  in a new `turn` field. Code stamps and validates them, then declares the action with their
  canonical slash text, one line per stage. The turn job's interpret pre-pass parses slash lines
  with no model call (spec 104 FR-004). Resolve submits each stage declare-then-confirm through
  the same gate and planner as a player's Intent.
- **Monster turn.** Code picks the monster's stages from its engine stat block, its seed tactics
  and the spatial view. Interpret makes no call for the monster reading. A monster turn with an
  empty beat runs a code-made Director, so it makes no Director call. The only model call left
  on a monster turn is the turn's one `dm.narrate` call, after the mechanics settle.
- **Narration.** Each AI turn keeps the existing turn narration: one `dm.narrate` call per turn
  job. Rule 9 does not fire, because job-appended carrier rows carry an `ai:` actor.
- **Proof.** A bench test in `pnpm check:timing` plays one 4v4 round (one human PC, three
  companions, four goblins) on the fake model and fails at 60 s or more.

## Scope

In scope:

- The companion output schema, prompt and job (AC #1), and the commenter-label fix.
- A code monster policy and a code Director for monster turns (AC #2).
- Multi-line slash items in interpret's pre-pass, so a companion turn can carry several stages.
- Gate and planner parity tests for AI-actor Intents (AC #3).
- The 4v4 fixture round bench test (AC #4).

Out of scope (owned elsewhere or carded by the orchestrator from "Open questions"):

- Companion free-mode acts. They stay prose and go through interpret, because check stages need
  model-written stakes (`beside`) until TASK-0313 puts stakes on Intents (OQ-3).
- Monster spells, multiattack and morale (OQ-5).
- Removing the Director call from companion beats (OQ-7).
- Streaming narration: TASK-0298.
- The hosted 4v4 measure: TASK-0278 metric, read at CP-7.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A companion takes its turn as typed Intents (Priority: P1)

It is Pip's turn in a fight. The companion job asks `dm.companion` once. Pip returns
`turn: [{ kind: "move", targets: [zone reeds] }, { kind: "attack", targets: [goblin-2],
params: { weapon: "Shortsword" } }]`. Code stamps both, checks the round trip, and declares the
action with text `/move #reeds` and `/attack @goblin-2 with "Shortsword"` on two lines, then
commits. The turn job interprets with no model call and resolves both stages in order.

**Why this priority**: card AC #1.

**Independent Test**: a DB integration test with a strict fake gateway that scripts no
`dm.interpret` call; an interpret call fails the test.

**Acceptance Scenarios**:

1. **Given** an active companion in turn mode and a scripted `turn` with two valid bodies,
   **When** the companion job and the turn job run, **Then** the log holds one `action.declared`
   row whose text is the two slash lines, two `intent.recorded` rows confirmed under `ai:dm`, and
   the fake gateway recorded zero `dm.interpret` calls.
2. **Given** a scripted `turn` whose body names an unknown target, **When** stamping fails,
   **Then** the companion declares the hold act, the turn advances, and no interpret call runs.
3. **Given** a scripted `turn` of `[]` or `null` on the companion's own turn, **Then** the
   companion declares the hold act, interpret builds a zero-stage reading in code, the action
   resolves `no-effect`, and the turn advances.
4. **Given** a human comment on an open action, **When** the companion prompt renders it,
   **Then** the commenter reads as the seated character id, never a user id.

### User Story 2 — A monster acts from its stat block and tactics (Priority: P1)

It is goblin-2's turn. Tamsin stands in the same zone. Code picks `attack @tamsin with
"Scimitar"` from goblin-2's engine attacks. The runner skips the Director call and interpret
skips the model. Resolve submits the Intent once, `confirmed`, under `ai:dm`. Narrate then makes
the turn's one model call.

**Why this priority**: card AC #2.

**Independent Test**: a DB integration test with a strict fake gateway that scripts only
`dm.narrate` for the monster turn.

**Acceptance Scenarios**:

1. **Given** a monster engaged with a party combatant and a melee attack entry, **Then** its
   reading holds one `attack` stage with that entry's name, and the fake gateway recorded no
   `dm.director` and no `dm.interpret` call for the job.
2. **Given** a monster with only melee entries and its target in another known zone, **Then**
   the reading holds `move #<target zone>` then `attack`.
3. **Given** a monster with a ranged entry and no engaged target, **Then** the reading holds one
   ranged `attack` stage, and the planner judges range.
4. **Given** tactics `weakest`, **Then** the target is the conscious party combatant with the
   lowest current hit points, ties broken by initiative order.
5. **Given** no conscious party combatant, or a monster with no attack entry, **Then** the
   reading has zero stages, the turn resolves `no-effect`, and the turn advances.
6. **Given** a monster turn whose beat also holds a player's free-scope item, **Then** the
   Director and interpret run for that item as today, and the monster reading is still code-built.

### User Story 3 — AI-actor Intents meet the same gate and planner (Priority: P1)

A companion's attack and a monster's attack each pass the gate's actor, seat and turn checks
and plan through the planner exactly as a player's attack does.

**Why this priority**: card AC #3; constitution I and II.

**Acceptance Scenarios**:

1. **Given** a companion `attack` in reach, **Then** the carrier row is `settled` with a batch,
   declared under `ai:companion:<id>` and confirmed under `ai:dm`.
2. **Given** a companion `attack` out of reach, **Then** the confirm is refused `OUT_OF_REACH`,
   the action resolves `refused` with that code, and the turn advances.
3. **Given** a companion `attempt`, **Then** the carrier row is `needs_ruling`, the AI seat
   answers it in the same job (`answerRulings`), and resolve continues.
4. **Given** a monster `attack` out of reach, **Then** the stage is refused, nothing is
   appended for it, and the turn advances.
5. **Given** a companion item stamped with another character's actor, **Then** the gate refuses
   `NOT_YOUR_ACTOR` (the stamp cannot produce this; the test submits it by hand).
6. **Given** every companion-turn kind and the monster kinds, **Then** a stamped Intent parses
   with `IntentSchema` and `parse(toText(i))` round-trips.

### User Story 4 — A 4v4 round finishes under 60 s on the fake model (Priority: P1)

A fixture table seats one human PC and three AI companions against four goblins. The bench test
plays one full round through the real gate, queue and worker.

**Why this priority**: card AC #4; R1 exit criterion 3; constitution IX.

**Acceptance Scenarios**:

1. **Given** the 4v4 fixture in turn mode at the human's turn, **When** the human commits a slash
   attack and the worker drains, **Then** the round ends with the human active again in round 2,
   and the wall time from the commit to that table-mode row is under 60 000 ms.
2. **Then** the round made zero `dm.interpret` calls, zero `dm.director` calls on monster turns,
   three `dm.companion` calls, and one `dm.narrate` call per turn job.
3. **Then** the test prints the round time and each turn's time on pass and on fail.

### Edge Cases

- A companion revise decision (spec 036) still declares prose and takes an interpret call. It
  only arises when the companion had an open action, so it is off the turn path.
- A companion body of a kind outside `COMPANION_TURN_KINDS` fails the companion output schema
  (`invalid-output`); the active companion then takes the hold act (today's fallback).
- A resumed turn reuses the checkpointed interpret output; the code monster reading is
  checkpointed like a model reading, so a reclaim resubmits the same ids.
- A monster with no seed encounter entry (a hostile seed NPC) uses tactics `nearest`.
- No spatial placements on the table: every combatant counts as engaged (OQ-4).
- A human types several slash lines in one post: each line becomes one stage. This is the same
  pre-pass; no separate path.

## Requirements *(mandatory)*

### Functional Requirements

**Companion turn (AC #1)**

- **FR-001**: `CompanionOutput` MUST gain `turn: CompanionIntentBody[] | null` (max 3).
  `CompanionIntentBody` MUST be the interpret `IntentBodySchema` restricted to
  `COMPANION_TURN_KINDS` = `attack, cast, help, grapple, shove, move, dash, disengage, stand,
  drop_prone, attempt` (plan.md D1).
- **FR-002**: When the companion is active in turn mode, the job MUST ignore `act` and build the
  action from `turn`. Off its turn or in free mode, the job MUST ignore `turn` and keep today's
  `act` path.
- **FR-003**: The job MUST stamp each body with `id` `<actionId>.<n>`, actor
  `companion:<characterId>`, `source: "ai"`, `commit: "declared"`, MUST validate it with
  `IntentSchema`, and MUST check `parse(toText(i))` equals `i`. Any failure MUST fall back to
  the hold act and log `dm.companion.turn-invalid`.
- **FR-004**: The job MUST declare the action with text = the stamped Intents' `toText` lines
  joined by `\n`, then commit it, through today's `action.declare` and `action.commit` requests.
- **FR-005**: Interpret's pre-pass MUST treat an item whose every non-blank line starts with `/`
  as slash form, MUST parse each line as one stage with id `<actionId>.<n>`, and MUST yield a
  clarify reading naming the first refused line. Such an item MUST NOT reach the model.
- **FR-006**: Interpret MUST build a zero-stage reading in code, with no model call, for an
  `ai:companion:` item whose text equals `HOLD_ACT_TEXT`.
- **FR-007**: The companion prompt MUST describe the `turn` field with the companion-turn kinds,
  their params and target keying, MUST render each comment's actor with `dmActorLabel` (seated
  character id), and MUST bump `PROMPT_VERSION` from `dm.companion-v8` to `dm.companion-v9`.

**Monster turn (AC #2)**

- **FR-008**: A pure function `monsterStages(projections, seed, combatantId)` MUST return the
  monster's `InterpretStage[]` from the engine combatant's `stats.attacks`, the DM spatial view,
  and the seed tactics (plan.md D3). It MUST call no model, no planner and no engine.
- **FR-009**: The seed's encounter monster entry MUST accept an optional
  `tactics: "nearest" | "weakest"`, default `"nearest"`.
- **FR-010**: Interpret MUST build the monster reading (`actionId: null`, `say: null`) with
  `monsterStages` and MUST NOT ask the model for it. The interpret prompt MUST drop the
  monster-turn instructions and bump `PROMPT_VERSION` from `dm.interpret-v17` to
  `dm.interpret-v18`.
- **FR-011**: The runner MUST supply a code-made stay-put Director output, with no model call,
  for a turn job whose trigger is `npc-turn` and whose assembled beat is empty.
- **FR-012**: Resolve MUST run the monster reading through the existing `runStages` npc source
  unchanged: one `confirmed` submit under `ai:dm` per stage.

**Parity (AC #3)**

- **FR-013**: No gate, planner or Intent contract code MAY change. AI-actor Intents MUST reach
  the gate as the same `intent` request a player's Intent uses.

**4v4 round (AC #4)**

- **FR-014**: A bench test `apps/server/test/ai-round.bench-test.ts` MUST play one round on a
  4v4 fixture seed through the real gate, queue and worker with a strict scripted fake model, and
  MUST fail at 60 000 ms or more.
- **FR-015**: The fixture seed MUST live under `apps/server/test/dm/fixtures/`, never in
  `apps/server/seeds/`, so it never reaches the Start scene list.
- **FR-016**: The test MUST run only in `pnpm check:timing` (`*.bench-test.ts`), never in
  `pnpm test` (`scripts/check-no-wallclock-tests.mjs`).

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I): Kinds an agent sends here: companions send `COMPANION_TURN_KINDS` through
  `action.declare` text and the gate's `intent` request; the monster policy sends `move` and
  `attack` under `ai:dm`.
- **CR-002** (II): AI actors' mechanics are chosen in code (monster) or as typed bodies (companion);
  the planner plans every stage; free text is not a write path for an AI turn.
- **CR-003** (VI): No model writes a number, a DC or an actor id in an AI-actor Intent.
- **CR-004** (IX): A monster turn makes one model call (narrate). A companion turn makes no
  interpret call. The 4v4 round is gated in CI.

### Key Entities

- **CompanionIntentBody**: one interpret body of a companion-turn kind.
- **Monster tactics**: `nearest` or `weakest`, on the seed encounter monster entry.

## Success Criteria *(mandatory)*

- **SC-001**: A companion's own turn resolves with zero `dm.interpret` calls in an integration
  test (AC #1).
- **SC-002**: A monster turn records no `dm.director` and no `dm.interpret` call; its stages come
  from `monsterStages`, covered by unit tests per branch of plan.md D3 (AC #2).
- **SC-003**: Per-outcome tests (`settled`, `needs_ruling`, refusal) for a companion source and
  the monster source, plus schema and round-trip tests for each kind touched (AC #3; runbook
  Intent PR gate).
- **SC-004**: The 4v4 bench test passes under 60 s in `pnpm check:timing` (AC #4).
- **SC-005**: `pnpm ci:check` green; wiki freshness `OK`; spec-bridge check exits 0.

## Card acceptance criteria map

| Card AC | Covered by | Phases |
|---|---|---|
| #1 Companion turn emits a typed Intent, no interpret call | FR-001–FR-007, SC-001 | 2 |
| #2 Monster turn emits Intents from stat block and tactics, no Director prose call on the mechanics path | FR-008–FR-012, SC-002 | 1 |
| #3 AI-actor Intents pass the same gate and planner, with a test | FR-013, SC-003 | 1, 2, 3 |
| #4 4v4 fixture round under 60 s with the fake model | FR-014–FR-016, SC-004 | 4 |
| Card note (spec 096 OQ1): commenter user id in the companion prompt | FR-007 | 2 |

## Design decisions settled here

- **Monster Intents: code only, no model call** (AC #2). The stat block holds every attack entry,
  the projections hold sides, hit points and zones, and the seed holds tactics. One small
  structured call to pick target and weapon was rejected: it adds a model round trip to every
  monster turn (four per round) for a choice code makes from the same data, and it puts a model
  back on the mechanics path the AC removes. Ceiling: no spells, no multiattack, no morale
  (OQ-5).
- **Companion turns: one companion call with structured output, declared as slash text** (AC #1).
  The companion call already runs and already knows the scene; asking it for typed bodies removes
  the interpret call outright. Declaring the canonical slash text reuses the action card, the
  commit authority, the turn hold, resolve's declare-then-confirm and the turn advance with no
  new path. A code-only companion was rejected: a companion is a character with a voice and a
  want, and choosing its move is the judgment the companion call exists for.
- **Narration: the existing turn narration.** Each AI turn's job narrates once, as today. Rule 9
  stays off for job-appended rows. No AI turn makes a second narration call.
- **4v4 round: one timed round in `check:timing`.** Timed from the human's `action.committed` row
  to the `table-mode.changed` row that makes the human active in round 2. Model calls come from a
  committed script `apps/server/test/dm/scripts/ai-round-4v4.json`, loaded into a strict
  `FakeProvider` per purpose.

## Assumptions

- TASK-0269 (spec 104) is merged: interpret emits Intent stages, `runStages` serves an npc
  source, and slash items skip the model (true at `348afe1c`).
- The planner serves `attack`, `move` (zone targets), `dash`, `disengage`, `help`, `grapple`,
  `shove`, `stand`, `drop_prone` and `cast`; `attempt` is a ruling kind (spec 097 "Served kinds").
- The fake gateway adds no latency, so AC #4 measures mechanics, queue and DB time only. The
  hosted measure is CP-7's.

## Open questions

Each carries a recommendation. The orchestrator cards the ones that defer work.

- **OQ-1 — How a companion's hold ends its turn.** Options: (a) declare `HOLD_ACT_TEXT` and let
  interpret build a zero-stage reading in code (FR-006); (b) send an `end_turn` Intent or a floor
  `end` from the companion job. (b) bypasses the turn job, so nothing queues the next actor's job
  and resolve's turn-advance guards are untested for it. **Recommend (a).** Ceiling: a string
  match on one exported constant. Upgrade path: an `end_turn` stage once interpret's kind list
  carries it.
- **OQ-2 — Slash text on the companion's action card.** Players see `/attack @goblin-2 with
  "Shortsword"` as Pip's declared action. **Recommend:** accept it. The text form is the
  canonical, accessible form (constitution II), the companion's `say` carries the voice, and the
  narration carries the fiction. Revisit if a playtest finds it jarring (TASK-0247 renders Intent
  pills and is the natural home).
- **OQ-3 — Companion free-mode acts stay prose.** A free-mode act is often a check, and a check
  needs model-written stakes (`beside`). **Recommend:** keep prose plus interpret off-turn; AC #1
  names "a companion turn", which is the turn-mode own turn. Add to TASK-0313's trigger: "free-mode
  companion acts move to Intents when stakes ride on Intents".
- **OQ-4 — Monster reach with no placements.** A table with no zones has no spatial view.
  **Recommend:** treat every combatant as engaged and let the planner judge reach; a refusal ends
  the monster's turn as `refused`.
- **OQ-5 — Monster spells, multiattack and morale.** Monster spellcasting is null in
  `statsFromSrd` (TASK-0224). Multiattack is one SRD action that names several attacks. Morale is
  seed prose. **Recommend:** one card "monster policy: multiattack, spells and morale", deps
  TASK-0224, trigger "a seed fields a monster with multiattack or spells, or a playtest shows a
  monster fighting to the death against its morale line".
- **OQ-6 — The monster's spoken line.** Interpret wrote a monster `say` line (spec 081). The code
  reading carries `say: null`. **Recommend:** accept. Narrate still voices the monster from its
  portrayal; the fallback names it without a line. No card.
- **OQ-7 — The Director call on companion beats.** A companion's turn job still calls the
  Director (table mode, trackers, arrivals). **Recommend:** keep it here; card "code Director for
  turn-mode AI beats" with trigger "CP-7's hosted 4v4 round breaches 60 s and the Director call is
  the largest share".
- **OQ-8 — Director decisions lost on monster turns.** A code Director cannot end the scene,
  advance a tracker or land an arrival on a monster turn. Fights already end in code when no foe
  stands (TASK-0274). **Recommend:** accept; the next human or companion beat's Director makes
  those moves. No card.
