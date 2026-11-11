# Feature Specification: Interpret emits Intents

**Feature Branch**: `task-0269-interpret-intents`
**Created**: 2026-11-11
**Status**: Draft (spec author, R1 sweep). **Split recommended** (plan.md "Size check"); `tasks.md`
waits on the orchestrator's ruling.
**Card**: TASK-0269 (N-04). Parent epic TASK-0258.
**Input**: TASK-0269 description and AC #1–#7; spec 092 plan "Migration" step 5; planner contract
v1 (spec 097); spec 102 (gate accepts Intents); spec 103 OQ-8 resolution; spec 100 OQ-13;
spec 097 OQ-5.

**Authored against** (upstream `plan.md` commits): spec 092 `06d7ca13`, spec 093 `beae54aa`,
spec 097 `a34d5d39` (contract `planner.md` same commit), spec 100 `16ae6147`, spec 102 `86d425b6`,
spec 103 `39c9ed24`. Branch base `origin/main` `702390db`. Consumed only through published
exports: `@the-stacks/intent` (contract v1.1 §11), `@the-stacks/planner` (contract §1–§7, types
only in `apps/server`), `@the-stacks/session-model` gate and projections.

`speckit-clarify` skipped: every ambiguity is settled by an upstream contract or listed under
"Open questions" with a recommendation.

## Summary

`dm.interpret` stops writing step-grammar readings. For each beat item it returns zero or more
Intent bodies (`kind`, `targets`, `params`, `text`) through structured output. Code stamps `id`,
`actor`, `source` and `commit`, then validates each with `IntentSchema`. A beat item whose text is
slash form (`/attack @goblin-2 weapon="Longsword"`) is parsed by `parse()` and never reaches the
model. An ambiguous item returns a clarify question. Resolve submits each Intent through
`gate.submit` as an `intent` request, one stage at a time, so the gate and the planner own every
attack, check, spell, help, move and pull-in. Model-written stakes, band effects, clue reveals and
the free retry ride beside each check Intent until a card puts stakes on Intents. Narrate reads
the facts of every `intent.recorded` row in the beat's window, including rows the gate settled
before the job ran.

## Scope

In scope (PR A, this card after the split):

- The interpret output schema, prompt and node (AC #1–#3).
- Resolve's Intent runner: declare-then-confirm submission, compound stages, the in-beat ruling,
  the turn hold, and the "beside" data (AC #3, #5).
- The narrate window over `intent.recorded` rows (AC #7).
- Migrating every test and script that scripts an interpret reading.

Split out (PR B, a new card; plan.md "Size check"):

- Deleting resolve's step paths the planner owns, the step-based plan-gate checks, the
  adjudicate node and the step grammar (AC #4).
- Deleting the encounter-start gathering (AC #6).

Out of scope (owned elsewhere):

- Companion and monster turns emitting Intents without an interpret call: TASK-0299.
- The declared ring, the confirm row and withdrawal: TASK-0199.
- Composer pills sending `intent` requests directly: TASK-0247.
- Stakes as an Intent field: no card yet (OQ-6).
- The attempt-1 metric on hosted play: TASK-0278 metric, read at CP-7.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A slash command resolves with no model call (Priority: P1)

A player in turn mode on their turn commits `/attack @goblin-2 weapon="Longsword"`. Interpret
parses it, resolve submits it, the gate plans and executes it. The fake gateway records no
interpret call.

**Why this priority**: card AC #1; constitution II (typed text and slash commands emit Intents).

**Independent Test**: a server integration test with a fake gateway that fails on any
`dm.interpret` call.

**Acceptance Scenarios**:

1. **Given** a beat holding only slash-form items and no monster turn, **When** interpret runs,
   **Then** it returns one reading per item, makes no call, and each Intent parses with
   `IntentSchema`.
2. **Given** a beat with one slash item and one prose item, **When** interpret runs, **Then** the
   model prompt holds only the prose item, and the slash item's reading comes from `parse()`.
3. **Given** a slash item that fails `parse()`, **Then** its reading carries a clarify question
   built from the parse refusal, no Intent, and no model call.
4. **Given** the settled slash `attack`, **Then** the log holds the engine rows and one
   `intent.recorded` row with `outcome: "settled"`, and the action resolves `applied`.

### User Story 2 — Prose becomes a typed Intent (Priority: P1)

A player types "I shoot the goblin on the bank with my shortbow". Interpret returns one `attack`
body. Code stamps `actor: pc:<characterId>`, the id and the commit state. The Intent validates on
the first attempt.

**Why this priority**: card AC #2 (hosted measure) and the CI proxy.

**Acceptance Scenarios**:

1. **Given** a fake gateway that returns a valid body per interpret kind, **Then** each stamped
   Intent parses with `IntentSchema` and `parse(toText(i))` round-trips.
2. **Given** a model body naming an actor id, a DC number or an unknown kind, **Then** the output
   fails the interpret schema (`invalid-output`, retried by `callJson`).
3. **Given** an ambiguous declaration ("I deal with the goblin"), **Then** the reading carries a
   clarify question and no Intent, and the action holds as today (spec 073).

### User Story 3 — A compound declaration plans stage by stage (Priority: P1)

A player in turn mode declares "I run to the reeds and stab the goblin". Interpret returns
`move #reeds` then `attack @goblin-2`. Resolve submits the `move`; the gate plans it, including any
opportunity attack. Resolve then submits the `attack`, planned against the state after the move.

**Why this priority**: card AC #3.

**Acceptance Scenarios**:

1. **Given** the two-stage reading, **When** resolve runs, **Then** two `intent.recorded` rows land
   in order, each with its own batch, and the attack's reach fact reflects the new zone.
2. **Given** the move's opportunity attack drops the mover, **Then** the attack stage is refused by
   the planner, resolve stops, and the action resolves `applied` with the move's batch only.
3. **Given** free mode and a three-stage reading whose second stage is a check, **Then** the
   first-stage rule (spec 064) keeps stages up to the check and lists the rest as follow-ups.
4. **Given** a stage returns `needs_ruling` under the AI seat, **Then** resolve answers it in the
   same job (`answerRulings`) and continues with the next stage.
5. **Given** a stage returns `needs_ruling` under a human seat, **Then** the action resolves
   `awaiting-dm` and later stages wait for the resumed turn.

### User Story 4 — Stakes and the free retry keep working (Priority: P1)

A player searches the ford. Interpret returns a `check` Intent with its stakes, band effects and
clue reference beside it. The gate rolls the check; resolve reads the band and runs the band's
effects and the reveal exactly as today. A repeat of a failed check with no new risk takes the
free retry.

**Why this priority**: card AC #5 (spec 097 OQ-5 ruling).

**Acceptance Scenarios**:

1. **Given** a check Intent that settles `success-at-cost`, **Then** resolve runs `onSuccess` then
   `onCost` through the existing effect path, and the fact sheet shows the cost text.
2. **Given** a success with `reveals: "ford-crossing#1"`, **Then** the clue text reaches the
   submission as today (spec 080).
3. **Given** a repeat of a failed check with no `newRisk`, **Then** resolve submits today's
   `check.roll` with `autoSuccess` instead of the Intent, and the row reads as a free success.

### User Story 5 — Gate-settled Intents are narrated (Priority: P2)

Under the AI seat a player's `attempt` came back `needs_ruling`. The `ruling` turn answers it at
job start (`answerRulings`), which appends a carrier row before resolve runs. The beat's narration
shows that row's "why" facts.

**Why this priority**: card AC #7 (spec 102 OQ-4; spec 103 OQ-8).

**Acceptance Scenarios**:

1. **Given** a carrier row appended before the job's narrate loaded its projections and after the
   previous narration's window, **Then** its facts render as why rows in this beat.
2. **Given** a carrier row the previous beat already narrated, **Then** this beat does not render
   it again.
3. **Given** a carrier row appended while the previous narration was in flight, **Then** this beat
   renders it (no row falls between windows).
4. **Given** a carrier row with `visibility: "dm"`, **Then** its facts do not reach the public
   fact sheet.

### Edge Cases

- An Intent body of a kind outside the interpret kind list fails the schema.
- A reading with zero Intents and no clarify is a no-roll outcome (`no-effect`), as a `none` step
  is today.
- A planner refusal on stage 1 resolves the action `refused` with the gate's code; the code reaches
  the fallback notice as `refusalCode` does today.
- `KIND_UNSERVED` (for example `dash`, `shove push`) resolves `refused` and names the owner card in
  the refusal details.
- A monster-turn reading (`actionId: null`) stamps `actor: npc:<id>` and submits as `ai:dm`,
  `confirmed`, with no declare step.
- A resumed plan saved before this change (old reading shape) runs through the legacy step path
  until PR B (plan.md D7).
- An Intent id longer than 64 characters cannot happen (plan.md D3).

## Requirements *(mandatory)*

### Functional Requirements

**Interpret output (AC #1–#3)**

- **FR-001**: The interpret reading MUST carry `stages: { intent: IntentBody, beside: Beside | null
  }[]` (max 6), `clarify`, `followUps` and `say`. It MUST NOT carry `steps`, `intent`,
  `uncertain`, `needsAdjudication` or `rulesQuestion`.
- **FR-002**: `IntentBody` MUST be `{ kind, targets, params, text? }` for the interpret kind list
  (plan.md D1), built from `paramsSchemaOf(kind)`. The model MUST NOT write `id`, `actor`,
  `source` or `commit`.
- **FR-003**: Code MUST stamp each body: `id` = `<actionId>.<n>` (`npc.<jobId>.<n>` for the monster
  turn), `actor` from the beat item (FR-005), `source: "ai"` (`"composer"` for a parsed slash item),
  `commit: "declared"` (`"confirmed"` for the monster turn). The stamped Intent MUST parse with
  `IntentSchema`; a failure is `invalid-output`.
- **FR-004**: A beat item whose trimmed text starts with `/` MUST be parsed with
  `parse(text, ctx)` and MUST NOT reach the model. A parse refusal MUST yield a reading with a
  clarify question naming the refusal and no stage.
- **FR-005**: The actor MUST come from the beat item: `pc:<characterId>` for a human's item,
  `companion:<id>` for an AI companion's item, `npc:<combatantId>` for the monster turn. The
  `seatActorIds` bridge MUST be deleted.
- **FR-006**: Interpret MUST make no call when every fresh item is slash form and no monster turn
  is due.
- **FR-007**: The interpret prompt MUST describe the Intent bodies, target id keying (party by
  character id, NPCs by seed id; spec 102 FR-013) and the beside fields, and MUST bump
  `PROMPT_VERSION` from `dm.interpret-v16` to `dm.interpret-v17`.

**Resolve's Intent runner (AC #3, #5)**

- **FR-008**: For a player or companion item, resolve MUST submit each stage twice: `declared`
  under the item's own proposer, then `confirmed` with an equal body under `ai:dm` (spec 102
  FR-007, FR-009, FR-011). The monster turn MUST submit `confirmed` under `ai:dm` once.
- **FR-009**: Resolve MUST submit stages in order and MUST stop at the first refusal, open
  ruling under a human seat, or pending proposal. Earlier stages stand.
- **FR-010**: Under the AI seat, a `needs_ruling` stage MUST be answered in the same job with
  `answerRulings`, then resolve MUST continue with the next stage.
- **FR-011**: The free-mode first-stage rule (spec 064) and follow-ups (spec 079) MUST apply to
  stages: keep stages through the first roll-bearing stage; list the rest as follow-ups.
- **FR-012**: The turn hold (`TURN_HELD`, TASK-0244) MUST hold an Intent item exactly as it holds
  a step item today.
- **FR-013**: For a settled `check`, `save` or `contest` stage with `beside`, resolve MUST read the
  band with `stepOutcome` from the stage's engine rows and run `effectsForBand` through the
  existing effect path (spec 070).
- **FR-014**: When `isFreeRetry` holds for a check stage, resolve MUST submit today's `check.roll`
  mechanics proposal with `autoSuccess` instead of the Intent (spec 097 OQ-5 ruling).
  `beside.autoFail` MUST take the same legacy path.
- **FR-015**: `beside.reveals` MUST set the submission's `reveals` and `revealedText` as today
  (spec 080).
- **FR-016**: The action's `action.resolve` outcome MUST follow today's rules: `applied` when any
  stage appended a batch, `refused` with the gate's code when stage 1 is refused, `no-effect` when
  no stage ran, `awaiting-dm` when a stage waits on a human DM.

**Narrate window (AC #7)**

- **FR-017**: Narrate MUST render the facts of every public `intent.recorded` row with seq in
  `(W0, W1]`: `W1` is the `throughSeq` of the projections narrate loads; `W0` is the `W1` the last
  completed turn job's narrate recorded, else 0.
- **FR-018**: Narrate MUST record its `W1` in the job checkpoint, so the next beat's `W0` needs no
  log marker (plan.md D6; OQ-2).
- **FR-019**: Narrate MUST read carrier rows through a new `NodeDeps` log reader, filtered to
  `visibility: "public"`. The `resolve.appendedRows` filter in `narrate.ts` MUST be replaced.

**Deletion (AC #4, #6; PR B after the split)**

- **FR-020**: `resolve.ts` MUST lose the `check`, `attack`, `spell`, `help`, `move` and `roll`
  step cases, `hitDamage`, the reaction loop and `pullIn`; `plan-gate.ts` MUST lose the
  step-based checks the planner and gate now own (plan.md D8).
- **FR-021**: The encounter-start gathering (`director:gather:*`, spec 100 FR-023a) MUST be
  deleted. A party member reaches the encounter zone only through a `move` Intent.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I): The interpreter is one more producer of the same `intent` request every seat
  sends. Kinds an agent sends here: the interpret kind list (plan.md D1).
- **CR-002** (II): Slash text and prose both become Intents; the planner plans every mechanical
  stage; no model call sits between a slash command and the engine.
- **CR-003** (III): Model output reaches the log only as an Intent the gate plans, a ruling
  Intent, or the legacy beside effects (time-boxed by OQ-6).
- **CR-004** (VI): The model writes no DC, no actor id and no number in an Intent body; the
  schema forbids `dc` in interpret bodies (plan.md D1).
- **CR-005** (VII): Every why row comes from a carrier row's code-chosen `PlanFact`s.

### Key Entities

- **InterpretStage**: one Intent body plus its beside data.
- **Beside**: `{ stakes, onSuccess, onFailure, onCost, onSevere, newRisk, reveals, autoFail }`, the
  spec 070/080 fields today's check step carries.
- **Narrate window**: `(W0, W1]` over carrier seqs, held in turn checkpoints.

## Success Criteria *(mandatory)*

- **SC-001**: A slash-only beat resolves with zero `dm.interpret` calls in an integration test
  (AC #1).
- **SC-002** (CI proxy for AC #2): every `@the-stacks/intent/fixtures` valid fixture of an
  interpret kind, reduced to a body, passes the interpret output schema and its JSON-schema
  conversion; every stamped result parses with `IntentSchema` and round-trips through
  `parse(toText(i))`; the 2026-10-26 capture's declared texts each have a scripted reading that
  validates on attempt 1. The hosted ≥ 99 % measure ticks at CP-7 from the playtest watch log.
- **SC-003**: A two-stage reading yields two carrier rows in order, each planned against the state
  after the previous (AC #3).
- **SC-004**: Band effects, reveals and the free retry pass their existing spec 070/080 tests,
  rescripted to the new reading shape (AC #5).
- **SC-005**: A carrier row appended by `answerRulings` before resolve renders as why rows in that
  beat, and no carrier row renders in two beats (AC #7).
- **SC-006** (PR B): `resolve.ts` holds no `attack.roll`, `check.roll` (outside the free retry),
  `spell.cast`, `help.grant` or `combatant.place` construction (AC #4, #6).
- **SC-007**: Intent PR gate: a schema test, a round-trip test and a resolve test per outcome
  (`settled`, `needs_ruling`, refusal) for each interpret kind group.
- **SC-008**: `pnpm ci:check` green; wiki freshness `OK`; spec-bridge check exits 0.

## Card acceptance criteria map

| Card AC | Covered by | PR (after split) |
|---|---|---|
| #1 Slash commands, zero model calls | FR-004, FR-006, SC-001 | A |
| #2 ≥ 99 % attempt-1 validity on the playtest corpus | FR-001–FR-003, FR-007, SC-002 (CI proxy). **Hosted: ticks at CP-7** from the playtest watch log (runbook "Hosted ACs") | A |
| #3 Compound declaration, one Intent per stage, planned in turn | FR-008–FR-011, SC-003 | A |
| #4 `resolve.ts` loses planner-owned paths | FR-020, SC-006 | B |
| #5 Band effects and free retry beside the Intent path | FR-013–FR-015, SC-004 | A |
| #6 Encounter-start gathering removed | FR-021, SC-006 | B |
| #7 Beat narrates every covered carrier row, gate-settled included | FR-017–FR-019, SC-005 | A |

## Assumptions

- TASK-0266, 0267, 0268, 0270, 0271 and 0272 are merged (true at `702390db`).
- The planner's `move` is served for zone targets; squares stay `KIND_UNSERVED` (N-05).
- `answerRulings` is safe to call mid-job; the queued `ruling` turn then finds nothing open.

## Open questions

Each has a recommendation. The orchestrator rules or cards each one.

- **OQ-1 — How the AI interpreter submits a player's Intent.** The AI DM seat may not set a `pc`
  or `companion` actor (contract §3). **Recommend:** declare-then-confirm (FR-008): `declared`
  under the item's own proposer, then `confirmed` under `ai:dm`, which spec 102 FR-007 already
  allows. Under a human seat the confirm routes to an approval proposal, which keeps today's
  "the human DM approves the runtime's mechanics". No contract change. Alternative: submit
  `confirmed` under the player's proposer; it skips the human DM's approval, a regression.
- **OQ-2 — Where the narrate window's lower bound lives.** A field on `narration` would amend the
  frozen `specs/029-proposal-gate/contracts/` (the narration proposal) and needs a ruling.
  `intent.recorded` cannot hold it: a carrier cannot know its future narration. **Recommend:**
  the turn checkpoint holds `factsThrough` (FR-018), read through `loadPriorTurns`. Ceiling: a
  human-written narration records no window, so the next AI beat may repeat a why row the human
  already narrated. Upgrade path: a narration v2 field after an operator ruling.
- **OQ-3 — How narrate reads carrier rows.** `NodeDeps` has no log reader, and `projections.intents`
  holds no facts. **Recommend:** add `NodeDeps.loadEvents(sessionId, { afterSeq, throughSeq, types })`
  over the existing event store read. No session-model change, so the projection hotspot stays
  clear.
- **OQ-4 — A narrate run for Intents settled outside any job.** TASK-0247 pills will send `intent`
  requests that queue no turn (spec 102 OQ-4). Today every producer that settles outside resolve
  already has a turn (rulings at job start, `approval` turns). **Recommend:** add an AC to
  TASK-0247: "a settled `intent.recorded` row from a direct request queues a coalesced turn, which
  narrates it".
- **OQ-5 — A failed slash parse.** **Recommend:** a clarify question from the parse refusal, no model
  fallback (FR-004). A model fallback would hide a typo behind a slow call and break AC #1.
- **OQ-6 — Stakes on Intents.** The beside path is the ceiling AC #5 sets. **Recommend:** card
  "stakes on check Intents" (a contract minor under C-CON) as an R2 revisit with trigger "the
  beside path blocks a card, or TASK-0299 needs stakes for AI actors".
- **OQ-7 — The adjudicate node.** No reading sets `needsAdjudication` after FR-001, so the node never
  runs; inventive actions become `attempt` Intents and reach the ruling path. **Recommend:** delete
  the node, its prompt and `AdjudicateModelOutput` in PR B. `PURPOSE_OF.adjudicate` stays (the
  ruling call uses it).
- **OQ-8 — Old checkpoints.** A turn paused before deploy holds an old-shape reading. **Recommend:**
  PR A runs it through the legacy step path. PR B drops an old-shape resumed plan and re-interprets
  the item; the PR B card states it as a one-way door.
- **OQ-9 — TASK-0223 ordering.** TASK-0223 waits on TASK-0269 and shares the `resolve.ts` hotspot.
  **Recommend:** 0223 waits for PR A only; PR B rebases after 0223 (the smaller PR merges first).

## Frozen contract and C-CON flags

- **Intent contract (C-CON):** none. Interpret emits a subset of contract v1.1 kinds; ids follow
  §1 `IdSchema`.
- **`specs/029-proposal-gate/contracts/`, ws-protocol frames, `proposal-seam.md`:** none under the
  recommendations. OQ-2's alternative (a narration field) would amend 029 and needs an operator
  ruling.
- **Event catalog:** none. No new event type or version.
