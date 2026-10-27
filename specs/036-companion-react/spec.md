# Feature Specification: A human reaction re-runs the companion whose action is pending

**Feature Branch**: `task-0114-companion-react`

**Created**: 2026-10-26

**Status**: Draft

**Input**: Board card TASK-0114 (HIGH, m-3, Track B1 of `docs/design/m3-table-sweep-runbook.md`).
It fixes code from TASK-0046 (`specs/031-dm-runtime`). Grounding: wiki notes `dm-runtime`,
`dm-turn-jobs`, `proposal-gate`; decision-0020 (no unplanned "for now").

**Evidence**: M2 demo (`docs/design/m2-demo.md`, operator finding 5), session
`e8c848ec-11e9-442d-9bfa-8c26a0d84fcd`, transcript `docs/design/m2-demo/demo-session/transcript.jsonl`:

| Seq | Row | What it shows |
|---|---|---|
| 35 | `action.declared` `act-odo-1` by `ai:companion:odo` | Odo declares without committing |
| 37 | `action.commented` stance `comment` by the human ("Who is there?") | No job is enqueued |
| 38 | `action.commented` stance `approve` by the human ("Let's be cautious") | No job is enqueued |
| 39–40 | the human declares and commits Tamsin's own action | The workaround: the human's commit starts the next beat |
| 44 | `action.commented` by `ai:companion:odo` on its own `act-odo-1` | Odo re-ran (a DM prompt) and commented on its own action; it never committed it |

`act-odo-1` stays open for the rest of the session. The action card reads
"Waiting for Brother Odo to commit" indefinitely.

**Root causes** (code at `a4aab3c`):

- R1. The gate listener (`apps/server/src/dm/enqueue.ts`) enqueues work only on
  `action.committed` and on a decision about an `ai:dm` proposal. A human `action.commented`
  row enqueues nothing.
- R2. A companion job runs only after a turn (`reason: "turn"`, `"prompt"`) or a director hold
  (`"hold"`) (`apps/server/src/dm/worker.ts` lines 299–321).
- R3. A companion run cannot address an action it already declared. `CompanionOutput.act`
  always declares a **new** action id (`nextActionId`), and the prompt lists the companion's
  own open action only as one it "may comment on". Seq 44 is this cause.
- R4. No proposal kind ends an open action without committing it. The action lifecycle is
  `declared → discussed → committed → resolved` (`packages/session-model/src/projections/actions.ts`),
  and `action.resolved` applies only to a committed action. A companion that wants to withdraw
  or revise has no way to do so.

**Clarify**: skipped. The card, the M2 evidence and the runbook settle every behavior except
one, and that one is an operator ruling on a frozen contract, not a spec ambiguity:
**checkpoint W** (below). The spec states the recommended answer and the fallback answer, and
the phases are cut so the work before the ruling stands under either answer.

## Checkpoint W — withdraw and revise (operator ruling required before Phase 3)

Card AC #2 says the re-run companion "commits, revises or withdraws". Committing exists today.
Withdrawing and revising do not (R4): each needs a new lifecycle step, and the proposal kinds
are a closed, frozen contract (`specs/029-proposal-gate/contracts/proposals.md`: "Twelve
kinds, closed"). The dispatch rules forbid changing that contract without an operator ruling.

- **W-A (recommended).** Add an `action.withdraw` proposal kind and an `action.withdrawn`
  event. `withdrawn` is a terminal action status. The declarer of an open action may withdraw
  it. "Revise" is a withdraw followed by a new declaration. The mechanism serves human players
  too, which multiplayer needs.
- **W-B (fallback).** No contract change. A react run on a pending action always commits it.
  The companion may first add a comment that states its revised intent. AC #2's "revise or
  withdraw" is bypassed with a note on the card, and a follow-up card holds W-A.

Phases 1 and 2 implement the same behavior under W-A and W-B. Phase 3 runs only under W-A.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A human reaction wakes the companion (Priority: P1)

A companion has declared an action without committing it. A human comments on it, approves it
or objects to it. The companion runs again shortly after and answers.

**Why this priority**: this is the stall. Without a re-run, nothing the human does on the
companion's card has any effect.

**Independent Test**: in free mode, a companion declares an action with `commit: false`. A
human submits `action.comment` on it through the gate. One companion job for that companion
is queued. After the quiet window the worker runs it.

**Acceptance Scenarios**:

1. **Given** a companion's open action, **When** a human submits an `action.comment` with
   stance `comment`, `approve` or `object` on it, **Then** one companion job with reason
   `react` naming that companion is queued.
2. **Given** a companion's open action, **When** the companion itself, another companion or
   the AI DM comments on it, **Then** no `react` job is queued.
3. **Given** a human comment on a human's action, **Then** no `react` job is queued.
4. **Given** a human comment on a companion action that is already committed or resolved,
   **Then** no `react` job is queued.

---

### User Story 2 - The re-run companion resolves its pending action (Priority: P1)

The re-run companion reads the human reactions on its pending action and closes it: it commits
it, or (under W-A) withdraws or revises it. The table never waits on a companion that will not
act again.

**Why this priority**: a re-run that only talks (seq 44) leaves the stall in place.

**Independent Test**: the M2 repro. Replay seq 35–38 in a free-mode scene with the fake
gateway: Odo declares `act-odo-1` uncommitted, the human comments, then approves. Drain the
worker. `act-odo-1` is committed, a turn job runs, and `act-odo-1` reaches `resolved`. The same
test fails on `origin/main` at `a4aab3c`.

**Acceptance Scenarios**:

1. **Given** a react run for a companion with one open action, **When** the model answers
   `commit`, **Then** the companion submits `action.commit` for that same action id, and no new
   action is declared.
2. **Given** a react run, **When** the model's output is invalid or leaves the pending action
   unaddressed, **Then** code applies the default decision (FR-012), so the action does not stay
   open.
3. **Given** any companion run (`turn`, `prompt`, `hold` or `react`) for a companion that has an
   open action, **Then** that run addresses the open action before it may declare another one.
4. **Given** the active companion in turn mode with an open action of its own, **Then** it
   commits that action instead of declaring a second one.
5. *(W-A only)* **Given** a react run, **When** the model answers `withdraw`, **Then** the action
   is `withdrawn`, leaves the open-actions list, and no turn job is enqueued for it.
6. *(W-A only)* **Given** a react run, **When** the model answers `revise` with new text,
   **Then** the old action is `withdrawn` and a new action with the new text is declared (and
   committed when the model says so).

---

### User Story 3 - A reaction storm runs the companion once (Priority: P1)

Several humans react to the same pending action within seconds. The companion runs once, after
the storm settles, and sees every reaction.

**Why this priority**: multiplayer (TASK-0049, TASK-0050, TASK-0053) puts three humans at one
table. One model call per comment multiplies cost and makes the companion answer a half-read
conversation.

**Independent Test**: five human comments on one companion's open action, submitted inside the
quiet window, leave exactly one queued `react` job. After the worker drains, the companion made
exactly one `dm.companion` call, and its prompt carried all five comments.

**Acceptance Scenarios**:

1. **Given** a queued `react` job, **When** another human reacts on any companion's open action
   in the same session, **Then** no second job is queued; the queued job's companion list gains
   that companion if it is missing, and its start time moves to the end of the new quiet window.
2. **Given** reactions that keep arriving, **Then** the job still starts no later than the
   maximum wait after the first reaction.
3. **Given** a `react` job claimed and running, **When** a human reacts again, **Then** a new
   queued `react` job is created and runs after the current one (at most one running and one
   queued per session).
4. **Given** a `react` job whose companion no longer has an open action with an unanswered human
   reaction (for example the human's own commit started a beat that the companion's `turn` run
   already answered), **Then** the run skips that companion with no model call.

---

### User Story 4 - The contract says so (Priority: P2)

The companions contract records the new trigger, the pending-action rule and the coalescing
rule, so the next reader of `specs/031-dm-runtime/contracts/companions.md` sees them.

**Independent Test**: the contract text names reason `react`, its trigger, its coalescing rule
and its ending; `turn-jobs.md` names the new enqueue rule and claim condition.

---

### Edge Cases

- **Turn mode, companion not active.** A non-active companion's commit is refused
  (`COMMIT_NOT_ALLOWED`). A react run may reply with a comment and, under W-A, withdraw or
  revise. It does not commit. The open action waits for the companion's own turn, where
  Acceptance Scenario 2.4 commits it. The table is waiting on the turn order, not on the
  companion.
- **Dead, unconscious or stable companion.** The run skips it (existing rule). Its open action
  stays open. This matches today's behavior for every run of such a companion.
- **A human comment lands while a `turn` job runs.** The `react` job is queued; the claim
  serialization runs it after the turn job ends. The companion then sees the new beat.
- **The companion has two open actions.** Each open action gets one decision in the same run.
- **Reclaim.** A `react` job reclaimed after a crash re-reads the projections; an action the
  first attempt already committed is no longer open, so no duplicate commit is submitted.
- **No human ever reacts.** The open action waits for a human reaction or for the companion's
  next run. The table is then waiting on the humans, who can always react or commit their own
  action.
- **A human objects.** Under W-A the default decision for an unaddressed action whose latest
  human stance is `object` is `withdraw`. Under W-B it is `commit`.

## Requirements *(mandatory)*

### Functional Requirements

**Trigger (AC #1)**

- **FR-001**: The gate listener MUST queue a companion job with reason `react` when an appended
  batch holds an `action.commented` row whose actor is a human and whose action is open and was
  declared by an AI companion (actor `ai:companion:<id>`).
- **FR-002**: Comments by any AI actor (`ai:dm`, `ai:companion:*`) MUST NOT queue a `react` job.
  This prevents a companion-to-companion or DM loop.
- **FR-003**: The `react` job MUST name the companion (or companions) whose open actions drew the
  reactions.
- **FR-004**: A listener failure MUST be logged and MUST NOT fail the human's submission
  (existing listener contract).

**Coalescing (multiplayer)**

- **FR-005**: A session MUST hold at most one queued `react` job. A further reaction MUST merge
  into it: add the companion id when missing, and move its start time.
- **FR-006**: A queued `react` job MUST NOT be claimed before its start time. The start time is
  the later of now and (last reaction time + quiet window), capped at first reaction time +
  maximum wait. Defaults: quiet window 3 seconds, maximum wait 10 seconds.
- **FR-007**: The quiet window and the maximum wait MUST be injectable, so tests run with zero.
- **FR-008**: A `react` job MUST obey the existing per-session serialization: it is not claimable
  while a `turn` or `companion` job for the session holds a live lease, and a `turn` job outranks
  it.
- **FR-009**: A `react` run MUST skip, with no model call, any named companion that has no open
  action carrying a human reaction newer than the companion's own last event on that action.

**Resolution (AC #2)**

- **FR-010**: Every companion run MUST show the model the companion's own open actions, each with
  its comments, and MUST ask for one decision per open action.
- **FR-011**: The decision MUST be `commit` under W-B, and one of `commit`, `withdraw` or
  `revise` (with new text) under W-A.
- **FR-012**: Code MUST apply a default decision to an open action the output leaves unaddressed
  or when the output is invalid: `commit`; under W-A, `withdraw` when the latest human stance on
  the action is `object`.
- **FR-013**: `commit` MUST submit `action.commit` for the existing action id. A run MUST NOT
  declare a new action while the companion still has an open action, except through `revise`.
- **FR-014**: In turn mode, a non-active companion's `commit` decision MUST NOT be submitted; the
  action stays open for the companion's turn. The active companion with an open action MUST
  commit (or, under W-A, withdraw or revise) that action instead of declaring a second one.
- **FR-015**: A `react` job MUST end with nothing more queued by the companion module. The
  companion's commit queues the next turn through the existing commit rule.
- **FR-016**: The companion prompt's text change MUST bump its `PROMPT_VERSION`.

**Withdraw lifecycle (W-A only, Phase 3)**

- **FR-017**: The proposal kinds MUST gain `action.withdraw` (`{ actionId }`). The permission
  matrix MUST allow it for the declarer of the action (human or AI companion) and for a DM.
- **FR-018**: The event catalog MUST gain `action.withdrawn` (`{ actionId }`, versioned). The
  projection MUST move an open action to terminal status `withdrawn`; it MUST ignore a withdraw of
  a committed, resolved or withdrawn action, and the gate MUST refuse it before writing.
- **FR-019**: A withdrawn action MUST NOT join a beat, MUST NOT enqueue a turn, and MUST NOT show a
  commit control.

**Contract (AC #3)**

- **FR-020**: `specs/031-dm-runtime/contracts/companions.md` MUST record reason `react`, its
  trigger, the coalescing rule, the pending-action rule and the ending.
  `specs/031-dm-runtime/contracts/turn-jobs.md` MUST record the enqueue rule and the claim
  condition. Under W-A, `specs/029-proposal-gate/contracts/proposals.md` and
  `proposal-events.md` MUST record the new kind and event, citing the ruling.

### Key Entities

- **Pending action**: an action whose status is `declared` or `discussed`, declared by an AI
  companion.
- **Human reaction**: an `action.commented` row by a human actor on a pending action, any stance.
- **React job**: a companion job with reason `react`, a companion list, a first-reaction time and
  a start time.
- **Pending decision**: the companion's answer for one open action: `commit`, and under W-A
  `withdraw` or `revise`.

## Card acceptance criteria map

| Card AC | Requirements | Proven by |
|---|---|---|
| #1 A human comment, approval or objection on a companion's pending action enqueues that companion, with an integration test | FR-001–FR-009 | T010–T013 (Phase 1) |
| #2 The re-run companion commits, revises or withdraws, and a test shows the table no longer waits indefinitely | FR-010–FR-019 | T020–T025 (Phase 2, the M2 repro), T030–T036 (Phase 3, W-A) |
| #3 The companions contract records the new trigger | FR-020 | T026 (Phase 2), T037 (Phase 3) |
| Runbook merge condition: a test reproduces the M2 stall and shows the companion re-runs | US2 Independent Test | T021 |

## Success Criteria *(mandatory)*

- **SC-001**: In the M2 repro, the companion's pending action leaves the open state within one
  quiet window plus one worker poll of the human's last reaction, with no human commit.
- **SC-002**: Five reactions inside one quiet window produce exactly one companion model call.
- **SC-003**: Across the full DM integration suite, no companion run declares a second action
  while it holds an open one.
- **SC-004**: No existing companion, worker, jobs or full-turn test changes its expected outcome,
  apart from tests that asserted the old prompt version or the old "new action every run" rule.

## Assumptions

- "Approval or objection" in the card means `action.commented` with stance `approve` or `object`.
  It does not mean `proposal.approve`, which decides DM proposals and is out of scope.
- Only human reactions trigger a re-run (card wording). Whether an AI DM comment on a companion
  action should also trigger one is an open question for the orchestrator.
- The 3-second quiet window and 10-second maximum wait are defaults sized against the M2 timing
  (seq 37 to 38 was 50 seconds apart, so a single human never waits on the window more than
  3 seconds). They are constants, not configuration; no new env variable.
- The web action card needs no change under W-B: a committed action already drops the
  "Waiting for … to commit" line. Under W-A the card must render `withdrawn` (Phase 3).
- No new runtime dependency.
