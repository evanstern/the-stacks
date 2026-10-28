# Feature Specification: A roll reason the DM model writes cannot contradict actor state

**Feature Branch**: `task-0161-roll-reason-plan-gate`

**Created**: 2026-10-28

**Status**: Draft. Open questions OQ-1 to OQ-3 wait on the operator.

**Input**: TASK-0161. "A roll reason the DM model writes cannot contradict actor state, because the
plan gate checks it before resolve logs it." Evidence: M2 seq 221, step reason "shouting that two
kin have fallen", shipped on the seq 225 dice line while only one goblin had died. Use the TASK-0143
checker (spec 051).

`speckit-clarify` was skipped: the code and the TASK-0143 rulings settle the design. The open
questions below are operator judgment calls (player-facing behaviour and contract changes), not
ambiguities.

## Decision record and rule this card implements

- **decision-0025 (D17, TASK-0135)**, `docs/design/actor-state-gate.md`. This card implements the
  §3.4 claim rule (text must not contradict tracked actor state) at the §3.2 plan gate, "plan gate
  against S0" in the §4 resolve order. It adds no new rule: it moves an existing rule to an earlier
  checkpoint for one kind of model text.
- **Operator ruling 2026-10-27 on TASK-0143 OQ-1 (a)**, verbatim from the TASK-0143 card and
  `specs/051-output-claim-gate/spec.md` "Operator rulings": "TASK-0143: I accept the recommended
  defaults OQ-1 to OQ-6 (a), including the dm.narrate-v5 prompt bump and a follow-up card for
  checking roll reasons at the plan gate." The OQ-1 (a) option it accepts reads, in spec 051:
  "Out of U3's gate, with two guards here: the fallback stops voicing a refused reason (FR-011),
  and the orchestrator cards a follow-up that checks step reasons at the plan gate, before
  `resolve` writes them." Its rationale: "`resolve` logs the reason before narrate runs, and the
  log is append-only. A narrate-time gate cannot retract it. The plan gate (TASK-0112) is the only
  point before the write."
- **The checker's own contract** (`specs/051-output-claim-gate/contracts/claim-gate.md`) names this
  card as a caller: "TASK-0161 (step reasons at the plan gate) call the same function and amend
  this file; they do not fork a second checker." Its "Not gated here" list says "Dice lines, which
  hold roll reasons. Owner: TASK-0161."

## Background: what happens today

1. Interpret (`dm.interpret`) and adjudicate (`dm.adjudicate`) return steps
   (`apps/server/src/dm/nodes/schemas.ts`, `StepSchema`). Every step carries a model-written
   `reason` (up to 300 characters). A `check` step's `autoFail` carries one too.
2. Resolve runs the plan gate first (`apps/server/src/dm/gates/plan-gate.ts`, `checkPlan`,
   TASK-0112). It checks only ids: every actor and target id against the S0 snapshot. A refused
   action group resolves `refused` `UNKNOWN_COMBATANT` and runs no step. A refused NPC group runs no
   step, and the turn still advances.
3. Resolve then runs each step through the gate. The engine command's `reason` is the step reason
   plus a ` [<jobId>#<n>]` marker. It lands verbatim on `dice.rolled`, `attack.resolved`,
   `check.resolved`, `hp.changed` and `life-state.changed` rows, and on the dice lines below the
   narration (`renderDiceLines`).
4. Narrate and audit run later. The claim gate (`checkClaims`, spec 051) checks the narration, the
   rulings and the `goalNote`. The fallback stops voicing a refused reason (`reasonUsable`). The dice
   line still ships the reason, because the row holding it is already in the append-only log.

**The evidence.** M2 session `e8c848ec`, job `d6b08b46`, the goblin-2 NPC turn
(`docs/design/m2-demo/demo-session/transcript.jsonl`):

- seq 216: goblin-3 ("Goblin lookout") `life-state.changed` to `dead`. It is the only death in the
  log at this point.
- seq 221: `dice.rolled`, reason "Goblin-2 presses its scimitar at Tamsin before breaking off toward
  Snag, shouting that two kin have fallen. [d6b08b46-…#1]". `actionId` is null: the NPC group.
- seq 222: `attack.resolved`, the same reason, a miss.
- seq 225: the narration. The pot-helmed goblin shrieks "Two down!" and its dice line repeats the
  reason. Spec 051 names the reason as "the likely source of the 'Two down' claim".

`checkClaims` already refuses this text against that state: "two kin have fallen" is a rule 7
"N down" count, and S0 holds one non-party actor down or dead and no party actor down. The
fallback test `apps/server/test/dm/fallback.test.ts` ("does not voice a roll reason that claims two
kin fell with one dead (M2 seq 221, US4.4)") proves it on a built state. This card runs the same
check before resolve writes the row.

## Decisions

### D1 — State: S0, with the turn's planned presence changes as the diff

The plan is written before any roll, so a reason may only claim what S0 holds. The check uses
`{ snapshot: S0, diff: plannedDiff }`. `plannedDiff` holds one `presence` change for each actor this
turn's plan or opening moves change presence of:

- every target of a `presence` effect in the plan's steps (an `arrived` effect brings an absent NPC
  in);
- every seed NPC the turn's encounter start marks `arrived` (the seed-presence group, spec 050).

Claim rule 3 then exempts those actors from the act and speech rule, as it exempts them at narrate.
`plannedDiff` holds no life-state change, so rule 6 (omission) never fires: a reason need not
mention a death. A reason that predicts an outcome ("Kestrel's arrow drops the lookout") is refused
when S0 does not hold it. That is intended: the roll has not happened when the row is logged.

### D2 — Which text is checked

Every `reason` of every step that resolve would run, and every `check` step's `autoFail.reason`.
The groups are the plan gate's own groups: a ruling replaces its reading's steps, and a `clarify`
reading runs no step. Director reasons (`tableMode.reason`, tracker reasons, the scene-end reason)
are out of scope: Director legality is TASK-0145. Condition `source` text is OQ-3.

### D3 — Order inside the plan gate

The id check runs first, as today. A group that passes it then has its reasons checked in step
order (each step's `reason`, then its `autoFail.reason`). The first refused text is the group's
failure. One failure per group, as today.

### D4 — Refusal feeds the existing plan refusal path

A refused reason refuses its whole group before any step runs. An action group resolves `refused`
and runs no step. An NPC group runs no step, and the turn still advances. No model call is added,
and no node retries. The verdict lands in `checkpoint.planGate` with the claim issues. The refusal
code on `action.resolved` is OQ-2.

### D5 — A resumed plan's reasons are not checked again (TASK-0168, spec 057)

Since spec 057 (merged at 68032ecf), a turn that follows a human DM's approval reuses the paused
turn's reading, ruling and submissions for that action (`assembled.resumed`). Interpret and
adjudicate merge the resumed plans into their output, so `checkPlan` sees them again.

The reason check **skips** a group whose action id has a resumed plan. The id check still runs on
it, as today. Why:

- The paused turn's plan gate checked those reasons against its own S0 before any of them was
  logged. A reason that failed then would have refused the group, and the group would never have
  paused.
- Part of the chain is already logged under those reasons, and a human DM approved it. Refusing the
  group now would leave an approved, applied roll beside a `refused` action, and would overrule the
  DM's approval with a text check.
- The plan gate is a pre-write gate. For a resumed plan the writes have begun.

The resumed plan's later steps may carry reasons that state has since overtaken. The human DM sees
each of those proposals before it applies. Spec 057's contract lists "the claim gate" as unchanged,
and this keeps the resumed path unchanged too.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A monster's roll reason cannot miscount the dead (Priority: P1)

One goblin is dead. On goblin-2's turn the model writes the attack reason "shouting that two kin have
fallen". The table never sees that reason on a dice line, and no row in the log holds it.

**Why this priority**: it is card AC #1 and #2 over the card's own evidence.

**Independent Test**: the plan-gate unit test over M2 seq 221 (S0 folded from the M2 log through
seq 220; the seq 221 attack step as goblin-2's NPC reading).

**Acceptance Scenarios**:

1. **Given** S0 from the M2 log at seq 220 and an NPC reading whose attack reason is the seq 221
   reason, **When** the plan gate runs, **Then** the NPC verdict is refused with a `count` claim
   issue quoting "two kin have fallen", at step 0, field `reason`.
2. **Given** that verdict, **When** resolve runs the turn, **Then** no `dice.rolled` or
   `attack.resolved` row holds the reason, and the turn still advances.
3. **Given** a player action group whose step reason is refused, **When** resolve runs, **Then** the
   action resolves `refused` with the OQ-2 code and runs no step.

### User Story 2 — A truthful reason ships unchanged (Priority: P1)

The same goblin turn with the reason "Goblin-2 presses its scimitar at Tamsin before breaking off
toward Snag." passes. The attack rolls and the logged reason is the model's text byte for byte.

**Why this priority**: card AC #3; the gate must not rewrite or block honest text.

**Independent Test**: the control case of the same unit test, plus the resolve DB test.

**Acceptance Scenarios**:

1. **Given** the control reason, **When** the plan gate runs, **Then** the NPC verdict is
   `{ actionId: null, ok: true }`.
2. **Given** that verdict, **When** resolve runs, **Then** the logged `dice.rolled` reason equals the
   step reason plus the existing marker.

### User Story 3 — An arriving NPC may be described acting (Priority: P2)

Pell is absent at S0. A step holds an `arrived` presence effect on Pell with the reason "Pell
staggers out of the reeds". The reason passes, because the plan changes Pell's presence.

**Independent Test**: unit test; the same text without the presence effect is refused as `act`.

### User Story 4 — A resumed roll is not refused after the DM approved it (Priority: P2)

A human DM approved a paused check. The resumed turn's plan gate does not recheck that action's
reasons. The chain continues as spec 057 designed.

**Independent Test**: unit test (resumed ids skip the reason check, the id check still runs), and the
existing `human-dm-roll-resume` DB test stays green.

### Edge Cases

- **Encounter start in the same turn.** A seed NPC the encounter start marks `arrived` is exempt
  from the act rule (D1). A monster the encounter start adds has no S0 actor, so its name is an
  unresolved term and passes (claim rule 8).
- **Ruling replaces reading.** Only the ruling's steps are checked, because only they run.
- **Clarify reading.** No step runs; nothing is checked.
- **Hold.** A Director `hold` runs no action group; the plan gate gets no readings, as today.
- **Reclaim.** A reclaimed job reruns the pure check on the same checkpoint and gets the same
  verdicts.
- **Earlier group in the same turn kills an actor.** A later group's reason that claims the death is
  refused, because S0 does not hold it (D1). The plan was written before either roll.
- **Pronouns and descriptions.** They pass, as claim rule 8 states; `dm.audit` still reads the
  narration.
- **Shipped DM scripts.** A scripted reason the checker refuses breaks a scripted suite. A genuine
  contradiction gets its script text fixed. A false positive stops the phase (see plan.md).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The plan gate MUST run `checkClaims` on every step `reason` and every `autoFail.reason`
  of every group that resolve would run, before resolve writes any row. (AC #1)
- **FR-002**: The check state MUST be S0 with `plannedDiff`: one `presence` change per presence-effect
  target in the plan and per seed NPC the encounter start marks `arrived`. It MUST hold no
  life-state change. (AC #1; D1)
- **FR-003**: The id check MUST run first. A group that passes it MUST have its reasons checked in
  step order, and the first refused text MUST be the group's failure. (D3)
- **FR-004**: A reason verdict MUST record the step index, the field (`reason` or
  `autoFail.reason`), the refused text and the claim issues. It MUST be stored in
  `checkpoint.planGate` beside the id verdicts. (AC #2)
- **FR-005**: A refused action group MUST resolve `refused` with the OQ-2 code and run no step. A
  refused NPC group MUST run no step, and the turn MUST still advance. (AC #2; D4)
- **FR-006**: A passing reason MUST reach the engine command unchanged. The gate MUST NOT rewrite,
  trim or replace model text. (AC #3)
- **FR-007**: The reason check MUST skip a group whose action id has a resumed plan. The id check
  MUST still run on it. (D5)
- **FR-008**: The checker MUST stay one function. The plan gate MUST call `checkClaims` and MUST NOT
  add a second word list or matcher. (spec 051 contract)
- **FR-009**: `specs/051-output-claim-gate/contracts/claim-gate.md` MUST gain the plan-gate caller
  row, and its "Not gated here" dice-lines line MUST point here.
  `specs/031-dm-runtime/contracts/resolve.md` step 0 MUST gain one "Amended by" line. See
  `contracts/plan-reason-gate.md`.
- **FR-010**: A test over M2 seq 221 MUST build S0 from the recorded M2 log in place (no copy) and
  MUST refuse the recorded reason. A control with the reason's clause removed MUST pass. (AC #2,
  #3)
- **FR-011**: A mutation guard MUST show that stubbing the reason check turns the seq 221 test and
  the resolve DB refusal tests red.

### Card acceptance criteria mapping

| Card AC | Covered by |
|---|---|
| #1 The plan gate runs the actor-state checker on every model-written roll reason before resolve logs it | FR-001, FR-002, FR-003, FR-008; D1, D2, D3; US1 |
| #2 A refused reason feeds the existing plan refusal path, with a test over M2 seq 221 | FR-004, FR-005, FR-010, FR-011; D4; US1 |
| #3 A reason the checker passes ships unchanged | FR-006, FR-010; US2 |

### Key Entities

- **Reason verdict**: a plan-gate verdict variant: `{ actionId, ok: false, code, failure: {
  stepIndex, field, text, issues } }`. `issues` are `ClaimIssue`s from spec 051.
- **Planned diff**: a `SnapshotDiff` built by the plan gate from the plan, holding only `presence`
  changes.

## Open questions (operator)

### OQ-1 — Refusing the whole group (player-facing)

Card AC #2 names the existing plan refusal path. That path drops the whole group: a monster loses
its turn, or a player's declared action resolves `refused` (the fallback says "<name> cannot do that
here"), because of flavour text. M2 holds one such reason in 333 rows.

- **(a) Recommended.** Refuse the group (this spec, card as written). Deterministic, no model call,
  fail-closed. The player can declare again.
- **(b)** Re-ask the model: run the check inside interpret and adjudicate output validation, so a
  refused reason is a schema issue in the existing call retry loop. Better for players; it costs a
  call on each refusal, and an exhausted retry fails the turn (`invalid-output`). The plan gate
  check would stay as the backstop.
- **(c)** Keep the step and log a code-built reason ("<name> attacks <target>"). The dice line
  changes text, and the gate rewrites model output, which FR-006 and the rules-term doctrine
  ("a gate never maps, coerces or drops a term") forbid.

### OQ-2 — The refusal code on `action.resolved` (contract change)

`action.resolved.refusalCode` is the engine `RefusalCodeSchema`
(`specs/028-session-model/contracts/session-events.md`, `specs/031-dm-runtime/contracts/resolve.md`
"The `refusalCode` set follows the engine enum"). The plan gate reuses `UNKNOWN_COMBATANT` because
its id check predicts that engine refusal. A reason refusal has no engine analogue. The play route's
action card shows the code ("refused (CODE)"), and the narrate prompt shows it to the model.

- **(a) Recommended.** Append `REASON_CONTRADICTS_STATE` to the engine enum, payload v1, as the
  `ACTOR_UNABLE` precedent did (TASK-0112, operator ruling). Amend
  `specs/026-dnd5e-engine/contracts/refusals.md` with a row marked "plan gate only; `execute` never
  returns it". The engine coverage meta-test (`packages/dnd5e-engine/test/coverage.test.ts`) gets
  a named exemption list for codes the engine never returns, and `execute.test.ts`'s count goes
  from 27 to 28. Honest on the card and in the log.
- **(b)** Reuse `INVALID_COMMAND`. No contract change, but the code says the command failed its
  schema, which is false. The verdict detail in `checkpoint.planGate` holds the truth.
- **(c)** Widen `refusalCode` to engine codes plus plan-gate codes in the session-model schema.
  Cleanest layering; a larger 028 change and a session-model release.

### OQ-3 — Condition `source` text

A `condition` effect carries a model-written `source` (up to 100 characters). It lands on
`condition.applied` rows. It is not a roll reason, so the card does not name it.

- **(a) Recommended.** Check it in the same walk (one more field, same seam, same refusal). FR-001
  then reads "every `reason`, `autoFail.reason` and condition `source`".
- **(b)** Leave it out and card a follow-up with a trigger: the first logged `source` that
  contradicts state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The M2 seq 221 reason never reaches the log: the unit test refuses it, and the resolve
  DB test shows no row holding it.
- **SC-002**: A passing reason is logged byte for byte (reason plus the existing marker).
- **SC-003**: The mutation guard turns the seq 221 test and the resolve refusal DB tests red, and the
  restore leaves an empty diff.
- **SC-004**: Every existing DM unit and DB suite passes, including the scripted suites and
  `human-dm-roll-resume`.

## UI and live check

The change is not visible in the UI apart from a refusal code string on an action card, which the
action card already renders generically (`apps/web/app/play/components/action-card.tsx`). No web
file changes. A live Brave run is **not required**.

## Assumptions

- The DM model writes reasons before resolve, from S0; no reason needs S1 to be true.
- `checkClaims` is pure and fast enough to run on up to 20 readings of up to 6 steps per turn.
- No plan paused before this change deploys needs its reasons checked on resume (dev data only).
