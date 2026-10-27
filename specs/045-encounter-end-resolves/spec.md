# Feature Specification: An encounter-ending action resolves before the encounter ends

**Feature Branch**: `task-0110-encounter-end-resolves`

**Created**: 2026-10-27

**Status**: Draft

**Input**: Board card TASK-0110, M3 sweep Track C (runbook amendment 1, order C4:
"Encounter-ending action resolves applied; resolve order (D17 §4)"). Evidence: TASK-0106
verification run `specs/034-narration-quality/evidence/verify-20261026T183818Z-greyhollow-ford-provider/`,
rows 260–265, auditor finding F54.

**Binding decision**: decision-0025 (D17, the actor-state rule gate), accepted 2026-10-26 at
checkpoint C3 and merged with TASK-0135. Its Consequences section says: "TASK-0110 implements
the resolve order change (section 4)" and "The resolve order change touches the turn-jobs
contract; TASK-0110 documents it." **This card implements decision-0025 §4, the resolve
half:**

| Rule | Text (decision-0025 §4) | Where this spec meets it |
|---|---|---|
| §4 resolve order | "`resolve`: action groups first, then the Director group, then the batch gate" | FR-001 – FR-006 |
| §4 rationale | "`resolve` runs the action groups before the Director group, so a Director move sees the actions' results." | FR-002, FR-007 |
| §4 amendment of decision-0017 | Decision-0017's resolve-then-narrate order is amended in place. | FR-009 (contracts) |
| §2.5 (read, not implemented) | "Encounter start passes, because initiative is a roll." | FR-003 |

It implements none of the other D17 gates. The batch gate (§3.3, U9 TASK-0147) runs after the
Director group once that card lands. Director legality over state (§2.5, §3.1, U5 TASK-0145)
and the plan gate (§3.2, U6 TASK-0112) are their cards' work. Both TASK-0145 and TASK-0147
list TASK-0110 as a dependency; this order is what they build on.

**Builds on**: TASK-0140 (spec 040, PR #66). Resolve already produces S1 and the S0-to-S1 diff
after its last gate write (`apps/server/src/dm/snapshot/`, wiki note `actor-snapshot`). This
card moves writes inside resolve; S1 is still built after the last one, so the snapshot
contract is unchanged.

**Clarify**: skipped. The card, decision-0025 and the evidence settle the behaviour. The one
interpretive choice (encounter start stays before the action groups, FR-003) is stated as an
assumption and raised as open question OQ-1 rather than asked as a preference.

## Root cause (from the evidence)

Rows 259–266 of the run, in order:

| Seq | Row | Note |
|---|---|---|
| 260 | `action.declared` `act-odo-5` (Odo offers Snag the bargain) | Odo is the active actor in turn mode |
| 261 | `action.committed` `act-odo-5` | queues the turn job `1e7608d1…` |
| 262 | `encounter.ended`, marker `[1e7608d1…#1]` | **submission #1 of the job**; reason "Morale condition met … Odo's bargain closes the encounter" |
| 263 | `table-mode.changed` turn → free | submission #2 |
| 264 | `action.resolved` `act-odo-5` `refused`, `UNKNOWN_COMBATANT`, no batch | the action's own group, after the stage change |
| 265 | narration "Brother Odo cannot do that here. The fighting stops." | the deterministic fallback after three failed audits (F56) |

Two defects show in these rows. This card fixes the first.

1. **Order (this card).** `resolve` (`apps/server/src/dm/nodes/resolve.ts`, the node's main
   body) runs the Director group first, then the ruling group, the action groups, the NPC group
   and the turn advance. The Director decided at plan time, before any roll, that the bargain
   met the morale condition. Its free-mode decision landed as the job's first submission, so
   the encounter ended and the table left turn mode before the action that caused it was even
   tried. The ledger then records the cause after its effect. The Director's reason credits
   Odo's bargain; the action row says it was refused. That contradiction is F54. Contract
   `specs/031-dm-runtime/contracts/resolve.md` "Order of work" prescribes this order, so the
   code matches its contract: the contract is what changes.
2. **The refusal code (not this card).** `encounter.end` does not remove combatants: the engine
   handler emits `encounter.ended` and the fold sets only `encounter: null`
   (`packages/dnd5e-engine/src/commands/encounter.ts`, `handleEncounterEnd`;
   `packages/dnd5e-engine/src/evolve.ts`). So the encounter end did not produce
   `UNKNOWN_COMBATANT`. The first mechanics step of the interpret reading named an id that was
   not an engine combatant at S0. The evidence does not record the reading (`jobs.json` keeps
   calls, not model output). The scene's only actors without an engine combatant are the seed
   NPCs `wenna` and `pell`, and the bargain was for Pell's freedom; so the likely step is an
   effect on `pell`. That is an inference, not a recorded fact. A step whose actor or target is
   missing from S0 is decision-0025 §3.2's plan gate, which is TASK-0112 AC #5 (U6).

With the order fixed, a well-formed reading of the same declaration (a contested check by Odo
against Snag, decision-0025 §2.2) lands its roll and resolves `applied` first. The Director's
encounter end and free mode follow it. Whether the Director may end the encounter when that
check fails is decision-0025 §2.5, card TASK-0145 (its AC #1 tests the same rows).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The action that ends a fight is recorded as what ended it (Priority: P1)

A player or companion, on their turn, does something whose success ends the encounter: a
bargain that meets the morale condition, a surrender demand, a final blow. The DM's Director
also judges that the encounter is over. The table sees the action resolve first, with its
roll, and then the encounter end. The ledger never shows the encounter ending before the
action that caused it, and the narration never says the actor "cannot do that here".

**Why this priority**: This is the card's outcome and its AC #1. F54 is a ledger contradiction
a player can see. The fallback narration faithfully repeated it.

**Independent Test**: Replay rows 260–265 with the fake gateway and scripted dice. Odo,
active in turn mode, commits the bargain. Interpret reads it as a Persuasion check by Odo
against a DC; the scripted die succeeds. The Director returns free mode with the morale reason.
Check the rows the job appends and the action's outcome.

**Acceptance Scenarios**:

1. **Given** turn mode with Odo active and the reed-camp encounter running, **When** Odo's
   bargain resolves with a successful check and the Director decides free mode, **Then**
   `action.resolved` for `act-odo-5` is `applied` with the check's batch id, **and** its seq is
   lower than the `encounter.ended` seq, **and** `encounter.ended` precedes the
   `table-mode.changed` row to free.
2. **Given** the same turn, **When** the job ends, **Then** no `turn.advanced` row was appended
   after the encounter ended, the table is in free mode, and the shipped narration (model or
   fallback) does not contain "cannot do that here".
3. **Given** the same turn but a reading whose first step names an id with no engine combatant
   (the evidence's likely shape), **When** resolve runs, **Then** the action resolves `refused`
   with `UNKNOWN_COMBATANT`, **and** that `action.resolved` row still precedes
   `encounter.ended`. The refusal itself is TASK-0112's plan gate to prevent.

---

### User Story 2 - A fight that starts on an action still lets the action land in it (Priority: P1)

In free mode a player declares an attack on a goblin. The Director starts the encounter. The
monsters join, initiative is rolled, and the attack then resolves against a goblin that now
exists. This already works and must keep working under the new order.

**Why this priority**: A literal "all Director moves after the actions" order would run the
attack before the goblin is an engine combatant and refuse it with `UNKNOWN_COMBATANT`. That
would trade F54 for a worse defect on every ambush.

**Independent Test**: The existing resolve test "enters turn mode from the Director" plus a
new case: a committed attack on `goblin-2` in free mode, the Director deciding `turn` for
`reed-camp`. Check that `combatant.added` and `encounter.started` precede the attack's rows.

**Acceptance Scenarios**:

1. **Given** free mode and a committed attack on a seed monster, **When** the Director decides
   turn mode, **Then** the monsters are added and initiative rolled before the attack, and the
   attack resolves against an engine combatant.
2. **Given** that turn, **When** resolve ends, **Then** no turn advance runs (the mode just
   started), exactly as today.

---

### User Story 3 - Monster turns and stage changes keep their causal order (Priority: P2)

On an NPC turn, the monster acts, then any Director stage change (free mode, encounter end,
tracker advance, scene end) lands. A tracker advance reflects the turn's results rather than
preceding them.

**Why this priority**: The same order rule covers the NPC group and trackers. Decision-0025
§2.5 requires a tracker advance and a scene end to cite a recorded fact from the turn, which
is possible only when they land after the turn's rolls (TASK-0145 builds that check).

**Independent Test**: Resolve tests that run an NPC turn with a free-mode decision, and an
action with a tracker advance and a scene end, then compare row seqs.

**Acceptance Scenarios**:

1. **Given** an `npc-turn` job and a Director free-mode decision, **When** resolve runs,
   **Then** the NPC's step rows precede `encounter.ended`.
2. **Given** a committed action and a Director tracker advance, **When** resolve runs,
   **Then** the action's `action.resolved` row precedes the `tracker.changed` row.
3. **Given** a scene-end decision, **When** resolve runs, **Then** every action row precedes
   `encounter.ended`, `table-mode.changed` and the `scene.changed` row with `after: null`.

---

### User Story 4 - The order is written where the next card reads it (Priority: P1)

An engineer writing TASK-0145 or TASK-0147 opens the turn-jobs contract and finds the resolve
order, which groups precede the action groups and why, and where the batch gate will sit.

**Why this priority**: The card's AC #2. Two queued cards depend on this order.

**Independent Test**: Read `specs/031-dm-runtime/contracts/turn-jobs.md`. It has a section
naming the resolve order, citing decision-0025 §4, and agreeing with `resolve.md` and
`director.md`.

**Acceptance Scenarios**:

1. **Given** the turn-jobs contract, **When** an engineer reads it, **Then** it states the
   group order of FR-001, the encounter-start exception of FR-003, the hold-mode order, and
   the batch gate's future position.
2. **Given** `resolve.md` "Order of work" and `director.md`, **When** compared with turn-jobs,
   **Then** all three state the same order.

### Edge Cases

- **Hold.** In hold mode resolve runs the Director's moves only: opening moves, then closing
  moves. No action, NPC or advance group runs. Unchanged in effect.
- **Scene start.** The `scene-start` setup (scene, party, combatants, trackers) runs first.
  The beat is empty on scene start, so no action group competes with it.
- **Encounter start and end in one decision.** The Director schema yields one `tableMode`
  decision per turn, so a single turn cannot start and end an encounter. A scene-end decision
  in the same turn as an encounter start still runs its closing moves after the actions.
- **The action's own group refuses or awaits a human DM.** The Director's closing moves still
  run after it. An `awaiting-dm` action is pending, not resolved; the encounter still ends if
  the Director decided so. TASK-0145 decides whether that is legal.
- **The action ends the encounter in the engine itself.** No engine command ends an encounter
  as a side effect of damage today. Out of scope.
- **Turn advance after a closing move.** The advance runs only while the encounter is active
  and the mode is still turn. A closing free-mode move switches both off, so no
  `turn.advanced` lands after `encounter.ended`. This holds today and must still hold.
- **Reclaim.** Submissions replay by semantic key, so a job reclaimed under the new code
  replays its own recorded submissions in any order. The in-flight marker `<jobId>#<n>` counts
  submissions, so the n-th submission is a different step under the old and new orders. A job
  checkpointed by the old code and reclaimed by the new code across a deploy could match a
  landed row to the wrong step. See OQ-2.
- **Narration facts.** Facts follow the appended rows, so narrate now reads the action's
  result before the encounter end. The fallback reads the same rows. No facts schema change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Resolve MUST run its groups in this order: (1) the Director's opening moves,
  (2) the ruling group, (3) the action groups in commit order, (4) the NPC group, (5) the
  Director's closing moves, (6) the turn advance group. Decision-0025 §3.3's batch gate
  (TASK-0147) will run between (5) and S1; this card leaves that slot empty.
- **FR-002**: The Director's closing moves MUST be: tracker advances, the `free` table-mode
  decision (encounter end, then free mode), and the scene end (encounter end, free mode, then
  scene `after: null`). They MUST run after every action group and the NPC group.
- **FR-003**: The Director's opening moves MUST be: the `scene-start` setup, and the `turn`
  table-mode decision (monster combatants added, initiative rolled, turn mode set). They MUST
  run before the ruling and action groups, because the actions may name the combatants they
  add (User Story 2). Decision-0025 §2.5 already passes encounter start, because initiative is
  a roll.
- **FR-004**: The turn advance group MUST run only while the encounter is active, the mode is
  turn, and the mode did not start this turn. After a closing free-mode or scene-end move, no
  turn advance runs.
- **FR-005**: Hold mode MUST run the opening moves, then the closing moves, and nothing else.
- **FR-006**: Every submission MUST keep its current semantic key, proposal kind, proposer,
  marker form and reason text. Only the order of submissions within a job changes.
- **FR-007**: A committed action whose roll succeeds MUST resolve `applied` with its batch
  ids, and its `action.resolved` row MUST precede any `encounter.ended` and
  `table-mode.changed` row the same job appends (AC #1).
- **FR-008**: S1 and the S0-to-S1 diff MUST still be built after the last gate write of
  resolve, as spec 040 requires. The snapshot contract does not change.
- **FR-009**: `specs/031-dm-runtime/contracts/turn-jobs.md` MUST gain a "Resolve order"
  section stating FR-001 to FR-005, citing decision-0025 §4 and noting the amendment to
  decision-0017. `resolve.md` "Order of work" and `director.md` "Decision → proposals" MUST
  agree with it (AC #2).
- **FR-010**: A test MUST reproduce rows 260–265 through the real worker, gate and engine with
  the fake gateway and scripted dice, and assert FR-007 and the scenarios of User Story 1
  (AC #1).
- **FR-011**: Resolve-level tests MUST assert the orders in User Stories 2 and 3 and the hold
  order of FR-005 by row seq.
- **FR-012**: No model prompt, prompt version, gateway purpose, engine command, event type,
  WebSocket frame, proposal kind or migration changes.

### Key Entities

- **Resolve group**: an ordered list of gate submissions inside one turn job. The groups are
  the Director's opening moves, rulings, one per action, the NPC turn, the Director's closing
  moves and the turn advance.
- **Director opening move**: a Director decision that establishes actors or a stage the
  actions need: scene-start setup and encounter start.
- **Director closing move**: a Director decision that responds to the turn: tracker advance,
  free mode with encounter end, scene end.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the reproduction of rows 260–265, the bargain resolves `applied` and its
  resolution row precedes the encounter end: 1 of 1 runs.
- **SC-002**: Across the resolve test suite, 0 jobs append `encounter.ended`, a free-mode
  `table-mode.changed`, a `tracker.changed` advance or a scene end before an `action.resolved`
  row of the same job.
- **SC-003**: An attack declared in free mode that triggers an encounter still resolves
  against an engine combatant: 0 `UNKNOWN_COMBATANT` refusals in that test.
- **SC-004**: The turn-jobs, resolve and director contracts state one order with 0
  disagreements.
- **SC-005**: The whole existing DM test suite still passes with no prompt fixture changes.

## Card acceptance criteria mapping

| Card AC | Text | Met by |
|---|---|---|
| #1 | A test reproduces rows 260–265: the action whose resolution ends the encounter resolves applied | FR-007, FR-010; User Story 1; tasks Phase 3 |
| #2 | The resolution order (encounter end versus action resolution) is documented in the turn-jobs contract | FR-009; User Story 4; tasks Phase 1 |

## Assumptions

- The reproduction uses a well-formed reading (a Persuasion check by Odo against a DC). The
  evidence records no interpret output, and decision-0025 §2.2 says a bargain that makes Snag
  yield needs a roll against him. The literal refused shape is covered too (User Story 1
  scenario 3), only to pin the order.
- Encounter start stays an opening move (FR-003). Decision-0025 §4 says "action groups first,
  then the Director group" without separating start from end. Its rationale ("so a Director
  move sees the actions' results") and §2.5 ("Encounter start passes, because initiative is a
  roll") support the split; a literal reading breaks User Story 2. Raised as OQ-1.
- The Director's decision is still made at plan time from S0. This card changes when it lands,
  not what it decides. Deciding whether the Director's move is still legal after the actions
  is TASK-0145.
- Tests run on the worktree's own stack with the fake gateway and scripted dice. No paid run.

## Out of scope (each owned by a card)

- The plan gate that refuses a step naming an id missing from S0: TASK-0112 AC #5 (U6).
- Director legality over actor state, including refusing an encounter end when the bargain's
  check fails: TASK-0145 AC #1 (U5).
- The resolve batch gate: TASK-0147 (U9).
- No-roll outcome rows for uncontested effort: TASK-0127. Opposition rolls: TASK-0128.

## Open questions

- **OQ-1 (operator ruling requested, non-blocking).** Decision-0025 §4 names the Director group
  as one unit after the action groups. This spec splits it: encounter start and scene-start
  setup before the actions, everything else after. Options: (a) ratify the split as the
  reading of §4 (this spec's default); (b) keep the literal order and move monster joins into
  the action group that names them (a larger change to resolve and interpret); (c) amend
  decision-0025 §4's text to name the split. The spec proceeds on (a); (c) is a one-line
  decision-record amendment the orchestrator can card.
- **OQ-2 (card candidate).** A turn job checkpointed by the old order and reclaimed by the new
  code across a deploy can match a landed mechanics row to the wrong step, because the marker
  counts submissions and the order changed. The window is one in-flight job per session at the
  moment of a deploy. Options: (a) accept and record the risk in the turn-jobs contract;
  (b) card a tightening where a reclaim's landed-row lookup also checks the event type the
  command produces; (c) add an order version to the checkpoint and fail a mismatched reclaim
  loudly. This spec does (a) in the contract text; (b) or (c) needs a card.
