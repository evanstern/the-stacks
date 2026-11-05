# Feature Specification: A companion acts in its own turn

**Feature Branch**: `task-0244-companion-own-turn`

**Created**: 2026-11-05

**Status**: Draft

**Input**: TASK-0244. "In turn order, a party action that names a companion's act (a spell, an
attack) waits for the companion's turn or is refused with a reason; and when an actor legitimately
acts in a beat, the off-turn list does not name them." Evidence: runbook B playtest run 1
(`docs/playtests/2026-11-03-runbook-b-playtest.md`, session `729a6c5c`), finding 40 (seq 206-241)
and finding 44 (seq 297-308). Runbook: `docs/design/m3-runbook-b2-playtest-fixes.md`, merge spine
#4, lane note for TASK-0244.

Authored against the Spec Kit templates in `.specify/templates/`. The spec dir was claimed with a
stub, so the skills' branch and directory steps do not apply. `speckit-clarify` was skipped: the
lane note's default (hold, and say so in the fact lines), the run 1 log and the code settle every
choice except the open questions at the end, which each carry a stated default.

## Evidence limits

- The raw run 1 rows live on vm-104 and are not in the repo. The replay is rebuilt from the
  playtest log and the seed `greyhollow-ford`, as specs 079 and 085 did. Seq numbers name the log's
  rows, not rows the test writes.
- Run 1, seq 206-241, as the log states it: during Kestrel's turn (round 2) Tamsin's party action
  "Odo casts Cure Wounds on Tamsin." committed by group sign-off. It resolved in the next beat, on
  goblin-2's turn (seq 222: slot 1 spent, Tamsin healed). Odo's own turn then cast Healing Word
  (seq 236: slot 2). Odo acted twice in round 2. Each narration of the first cast was refused three
  times ("Brother Odo is on the Next line and has not acted yet"), and the fallback shipped after
  102 s.
- Finding 44 (seq 297-308) is the same path a second time: the party cast ran on goblin-2's turn and
  was refused `NO_SLOT_AVAILABLE`, and every narration was refused for showing Odo casting off turn.

## Cause (read from the code at `origin/main` 5bf6f12e)

1. **No turn check on a party action's actor.** `checkPlan` (`gates/plan-gate.ts`, spec 079 D5)
   lets a party-scope group name any party combatant as attacker, caster, helper or mover. Resolve
   runs every committed beat item whatever the turn. The gate's commit rule
   (`session-model/gate/authority.ts`) gives a party action group authority at any time.
2. **The off-turn list misses a party action's actor.** `buildNarrationFacts` (`facts.ts`,
   TASK-0214) puts on turn the Turn actor, each action's `characterName` (null for a party action)
   and each roll's `name`. Cure Wounds rolls healing on its target, so the roll names Tamsin, not
   Odo. Odo stays on the Off turn line while the ledger shows him casting, so the audit refuses any
   prose that shows the cast.

## Scope

- In: turn mode, a party-scope action whose steps name an AI companion's combatant as attacker,
  caster, helper or mover. The facts' off-turn list for every action group that ran.
- Out: a party action that names a human PC off turn (OQ-2). Free mode (no turn order). Monster
  turns. Prompt wording beyond the one held-action fact line.

## Rules this spec states

- **R1 — Held.** In turn mode, a party-scope group whose step actors are exactly one AI companion
  is held for that companion's turn when the companion is not the active combatant. It is also
  held when the companion is active but has its own character action in the same beat. The group
  runs no step, writes no `action.resolve` row and stays committed.
- **R2 — Released.** When the turn advances to the companion a group is held for, resolve queues a
  turn job instead of the companion job. That beat resolves the held group as the companion's turn
  action, and the turn then advances. The companion takes no act of its own that turn.
- **R3 — Refused.** In turn mode, a party-scope group whose step actors include an off-turn AI
  companion and any other actor is refused `STEP_ACTOR_MISMATCH`, reason `off-turn`, before any
  step runs.
- **R4 — Said so.** A held group appears in the narration facts as a waiting line that names the
  companion. It is never an Action line, so no prompt or fallback voices it as done.
- **R5 — On turn.** Every actor a group's steps name as attacker, caster, helper or mover is on
  turn for that beat when the group ran. The off-turn list never names them.
- **R6 — Lapse.** The hold applies only while the companion is conscious and in the encounter
  order and the table is in turn mode. Otherwise the group takes today's path (OQ-3).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A party action waits for the companion's turn (Priority: P1)

During Kestrel's turn, Tamsin's player commits "Odo casts Cure Wounds on Tamsin." The DM says the
cast waits for Odo's turn. On goblin-2's turn nothing is cast. On Odo's turn the cast resolves as
Odo's action, and Odo takes no second action that round.

**Why this priority**: it is the card's AC #1 and the cause of finding 40 and finding 44.

**Independent Test**: the replay integration test (seq 206-230) and the plan-gate unit cases.

**Acceptance Scenarios**:

1. **Given** turn mode with Kestrel active and Odo later in the order, **When** a committed party
   group's only step actor is Odo, **Then** the plan verdict is held for Odo, no slot is spent and
   the action stays committed.
2. **Given** the held group, **When** goblin-2's turn job runs, **Then** the group is held again
   and goblin-2's turn advances as today.
3. **Given** goblin-2's beat advances the turn to Odo, **When** resolve picks the next job, **Then**
   it queues a turn job, not a companion job, and that turn resolves the cast (one slot spent) and
   advances the turn.
4. **Given** round 2 of the replay, **When** it ends, **Then** Odo has exactly one resolved group
   and one `slot.expended` row.
5. **Given** turn mode, **When** a party group names Odo and Kestrel as step actors on Kestrel's
   turn, **Then** the group is refused `STEP_ACTOR_MISMATCH` with reason `off-turn`.

### User Story 2 - An actor who acts is never listed off turn (Priority: P1)

When Odo's held cast resolves on his turn, the facts do not list him as off turn. The same holds
for any party action whose steps name an actor who is not the Turn actor and rolls no die.

**Why this priority**: it is the card's AC #2 and the cause of the three audit refusals.

**Independent Test**: `facts.test.ts` cases.

**Acceptance Scenarios**:

1. **Given** a party group that ran with Odo as caster and a healing roll on Tamsin, **When** the
   facts are built, **Then** `turn.offTurn` does not contain "Brother Odo".
2. **Given** a held group for Odo, **When** the facts are built, **Then** Odo stays on the off-turn
   list and the facts carry one waiting entry naming him.
3. **Given** a group the plan gate refused, **When** the facts are built, **Then** its step actors
   are not added to the on-turn set.

### Edge Cases

- The party action is committed during Odo's own turn after Odo's own act committed: R1 holds it
  for Odo's next turn (next round).
- Odo is downed or leaves the order before his turn: R6, the hold lapses (OQ-3).
- The encounter ends while the group is held: the table is in free mode, R6, so the next beat
  resolves the group as today (OQ-3).
- A worker restart: `reconcileTurnJobs` queues a turn for the committed group. That turn holds it
  again and ships one waiting narration. Accepted (plan `ponytail:`).
- A floor pass or a human's mode row hands the turn to the companion: that path queues the
  companion job, which acts on its own; R1 then holds the group again (the companion has its own
  action), so it waits a round. Accepted (plan `ponytail:`).
- A party group that names the active companion only (Odo on Odo's turn, no own action): not held,
  resolves now.
- A party group whose step actors are human PCs only: unchanged (OQ-2).
- A held beat with no other action and no monster turn still narrates the waiting line.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `checkPlan` MUST return a held verdict for a party-scope group per R1, derived from
  S0 alone (table mode, encounter order, active combatant, party controllers, life state).
- **FR-002**: `checkPlan` MUST refuse a party-scope group per R3 with `STEP_ACTOR_MISMATCH` and
  failure reason `off-turn`.
- **FR-003**: Resolve MUST run no step for a held group, write no `action.resolve` row, and report
  the action's outcome as `held` with the companion's combatant id.
- **FR-004**: Resolve MUST count a released group (its only step actor is the active combatant) as
  the active combatant's turn action when it decides whether to advance the turn.
- **FR-005**: When a beat advances the turn to an AI companion a group in that beat was held for,
  resolve MUST queue a turn job (trigger `held`) instead of the companion job.
- **FR-006**: Each action result for a group that ran MUST list the combatant ids its steps name as
  attacker, caster, helper or mover.
- **FR-007**: `buildNarrationFacts` MUST add each listed actor's name to the on-turn set (R5).
- **FR-008**: `buildNarrationFacts` MUST omit a held group from `actions` and list it in a
  `held` entry with the companion's name and the action text.
- **FR-009**: The narrate fact entries MUST render each `held` entry as one waiting line, and the
  narrate prompt version MUST bump.
- **FR-010**: `fallback.ts` MUST NOT change (runbook overlap finding). A held group is absent from
  `actions`, so the fallback never voices it.
- **FR-011**: A replay integration test MUST rebuild seq 206-230 and show Odo acting once in
  round 2.

### Key Entities

- **Held verdict**: a plan verdict `{ actionId, ok: false, code: "TURN_HELD", heldFor }`. The code
  is a plan-gate literal, not an engine refusal code. It never reaches an event.
- **Step actors**: the combatant ids a group's steps name as `attackerId`, `casterId`, `helperId`
  or a `move` `combatantId`.
- **Held fact**: `{ name, text, heldFor }` in `NarrationFacts.held`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the seq 206-230 replay, Odo has one resolved action group and one slot spent in
  round 2.
- **SC-002**: In the replay's Odo beat, `turn.offTurn` omits Brother Odo.
- **SC-003**: `pnpm ci:check` is green with no new runtime dependency and no migration.
- **SC-004**: At runbook B2's playtest, the "Companion in a party action" row passes: Odo acts once
  that round.

## Assumptions

- A party action's authority to commit off turn stays as it is. The hold lives in the DM runtime,
  not the gate.
- Every turn beat includes every committed, unresolved, non-awaiting action (`selectBeat`), so a
  held group returns in each later beat with no new storage.
- A held beat always ships a narration (its waiting line).

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 held or refused with a stated reason, with a test replaying seq 206-230 | R1-R3, FR-001 to FR-005, FR-011; US1; tasks Phase 1, 2, 4 |
| #2 off-turn list excludes an actor with a resolved step, with a facts test | R5, FR-006, FR-007; US2; tasks Phase 2, 3 |

## Open questions (each with a stated default)

- **OQ-1 — Hold or refuse a single-companion party action?** Default (runbook C0 lane note): hold
  it for the companion's turn and say so in the fact lines. Refuse only the multi-actor case (R3).
- **OQ-2 — A party action that names a human PC off turn.** Default: out of scope, behaviour
  unchanged. The human's own turn would then let that PC act twice. The orchestrator decides
  whether to card it.
- **OQ-3 — The companion goes down, leaves the order, or the encounter ends while held.** Default:
  the hold lapses (R6) and the group takes today's path: a downed caster is refused where the
  engine or the declare gate already refuses, and in free mode the group resolves on the next beat.
- **OQ-4 — Several actors, one of them an off-turn companion.** Default: refuse
  `STEP_ACTOR_MISMATCH` reason `off-turn` (R3). Splitting the group is not attempted.
- **OQ-5 — The waiting line on every intervening beat.** Default: each beat that holds the group
  carries the waiting line until it resolves.
