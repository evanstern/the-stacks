# Feature Specification: With a human DM, an approved check roll narrates

**Feature Branch**: `task-0168-human-dm-roll-resume`

**Created**: 2026-10-28

**Status**: Draft. Open questions OQ-1 to OQ-4 resolved by the operator on 2026-10-28 (option A each).

**Input**: TASK-0168. "With a human DM seated, a player check whose roll the DM approves narrates in the resumed turn, with no second roll proposal." Evidence: spec 055 `evidence/live-run.md` ("Clean pass 2", session `6cb00938`, jobs `7530b6d2` and `d5b5d97e`) and `quickstart.md` step 8c.

`speckit-clarify` was skipped: the code settles every question the card raises. The open questions below are operator judgment calls, not ambiguities in the defect.

## Background: what happens today

### The pause

1. A player commits `act-search`. The gate listener (`apps/server/src/dm/enqueue.ts`) queues a `commit` turn.
2. The turn runs assemble, director and interpret. Interpret returns one reading with a `check` step (perception, DC 13).
3. Resolve (`apps/server/src/dm/nodes/resolve.ts`, `runSteps`) submits the step as a `mechanics` proposal (`check.roll`). Under a human seat `mechanics` has policy `ask` (`packages/session-model/src/gate/policy.ts`). The gate returns `pending`.
4. `take()` marks the chain `awaiting`. `resolveAction` returns `awaiting-dm` and submits no `action.resolve`. The action stays `committed`. Narrate and audit skip (nothing narratable).
5. The job's checkpoint (`jobs.result.checkpoint`) holds the interpret reading and the submission `act:act-search:s0` with `result: "pending"` and its `proposalId`.

### The resume, and why it loops

1. The DM approves. The gate appends `dice.rolled`, `check.resolved` and `proposal.approved`. The command's `reason` keeps the marker ` [<pausedJobId>#1]`. The proposal view records `decided.batchId`.
2. The `proposal.approved` row is on an `ai:dm` proposal, so the listener queues an `approval` turn. It is a new job with an empty checkpoint.
3. Assemble selects every committed, unresolved action. `act-search` is in the beat again. Nothing reads the paused job's checkpoint.
4. Director and interpret run again. The interpret prompt shows the approved rows only as "Already applied: 2 ledger rows (reasons)" (`apps/server/src/dm/prompts/interpret.ts`). It shows no outcome. Its instruction "Plan only the steps that are not already applied" is the only guard.
5. The scripted interpret (and any model that does not obey that line) returns the same `check` step. Resolve keys submissions per job, so the new job has no record of `act:act-search:s0`. It submits a second `check.roll`, which pauses again. Every approval repeats this.

An AI seat makes `mechanics` `auto`. The roll applies inside the first turn, so only a human DM hits the loop.

### The contract that designed it

`specs/031-dm-runtime/contracts/resolve.md` ("Outcomes by gate result") says the approval turn's interpret "sees the applied batches in `priorSteps` and plans only what remains". `contracts/nodes.md` says the same for interpret. Neither file is on the frozen list (`specs/029-proposal-gate/contracts/`, `specs/030-play-route/contracts/proposal-seam.md`, ws-protocol frame shapes). This spec amends both (`contracts/turn-resume.md`).

### Root cause

The resumed turn holds no link to the plan that paused. It rebuilds the plan from a model call that sees only a row count. Re-interpreting is also wrong when it does obey the prompt:

- **The branch is lost.** A `check` step's `onSuccess` and `onFailure` effects were planned before the roll. The re-interpret prompt does not show the outcome, so the model cannot pick the branch.
- **The record is wrong.** `resolveAction` counts only this job's batch ids. An action whose only step was the approved check resolves `no-effect` with `batchIds: []`, though the check applied.
- **It spends calls.** Each approval pays one more `dm.interpret` call (and its repair re-ask).
- **Other turns re-propose too.** A `commit` turn for another action, or a boot `reconcile` turn, selects the paused action while its roll is still pending. It interprets it again and proposes a duplicate roll. Spec 055's live run lost a stack to this ("Rerun after the script fix").

## Decision: reuse the paused plan (card AC #2)

The resumed turn **reuses** the paused turn's reading, ruling and submissions for that action. It does not interpret the action again. Resolve already picks every next step from engine events alone (constitution IV and VI, `resolve.md`), so the approved roll's engine outcome is the only input the chain needs. The paused job's checkpoint holds the rest.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The DM approves a check roll and the table narrates (Priority: P1)

A human DM holds the seat. Tamsin searches the ferry. The AI DM proposes a perception check. The DM approves it. The AI DM narrates the result. No second roll is proposed.

**Why this priority**: it is card AC #1, and it unblocks the TASK-0053 demo's second run (checkpoint C7, `ask` mode with a human DM).

**Independent Test**: the new DB test, case (a): commit, drain, approve, drain. The approval turn calls `dm.director`, `dm.narrate`, `dm.audit` and no `dm.interpret`. The session holds one `check.roll` proposal. The action resolves `applied` with the approved batch. A narration proposal names the action.

**Acceptance Scenarios**:

1. **Given** a paused `check.roll` on a committed action, **When** the DM approves it, **Then** the next turn submits no new `check.roll` for that action.
2. **Given** the approved roll, **When** the resumed turn resolves the action, **Then** the `action.resolved` row has outcome `applied` and its `batchIds` hold the approved batch.
3. **Given** the resolved action, **When** narrate runs, **Then** its facts carry the check roll and its outcome, and one narration proposal names the action.

### User Story 2 - A multi-step chain resumes step by step (Priority: P2)

The check has an `onSuccess` effect. The DM approves the roll (a success). The resumed turn proposes the effect, not the roll. The DM approves the effect. The next turn narrates.

**Why this priority**: it proves the branch picked before the roll survives the pause.

**Independent Test**: the new DB test, case (c).

**Acceptance Scenarios**:

1. **Given** an approved successful check with one `onSuccess` effect, **When** the resumed turn runs, **Then** it submits the effect as a pending proposal and no second roll.
2. **Given** the approved effect, **When** the next turn runs, **Then** it resolves the action `applied` with both batches and narrates.

### User Story 3 - Other turns leave a paused action alone (Priority: P2)

While the roll is pending, another turn runs (a reconcile turn, or a commit turn for another action). It does not plan the paused action.

**Independent Test**: the new DB test, case (b).

**Acceptance Scenarios**:

1. **Given** a pending `ai:dm` proposal naming a committed action, **When** any turn assembles, **Then** the action is not in the beat.
2. **Given** a beat left empty by that rule, **When** the turn is not `scene-start`, **Then** it ends `empty-beat` with no model call.

### Edge Cases

- **Rejected roll.** The DM rejects the roll. The action has no resumable plan. It re-interprets as today, and `REJECTION_LIMIT` (2) still skips a twice-rejected action (`assemble.ts`). See OQ-3.
- **Suggest policy.** A DM-set `suggest` policy makes the proposal a suggestion. It can only be dismissed, which is a rejection. It is awaiting while pending.
- **Two paused actions in one turn.** Each action resumes from its own record. Approving one leaves the other awaiting.
- **Pause in a resumed turn.** A resumed turn that pauses again stores the merged plan in its own checkpoint. The next approval resumes from that job.
- **Reclaim of a resumed turn.** The resume plan is frozen in the checkpoint with the beat. A reclaimed job uses the frozen plan and does not search again.
- **AI seat.** Nothing pauses, so no action is ever awaiting or resumable. Behaviour is unchanged. Assemble skips the search when no `ai:dm` proposal names a beat candidate.
- **Director hold.** A resumed turn whose Director holds runs no action group. The plan stays resumable for the next turn.
- **Paused job failed later.** A paused job that failed after its pending submission still holds the submission. The resume uses it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (awaiting)**: Assemble MUST leave out of the beat every committed action named by a pending `ai:dm` proposal of kind `mechanics`, `scene-presence` or `action.resolve`.
- **FR-002 (resumable)**: Assemble MUST find, for each other committed beat candidate, the latest earlier turn job of the session whose checkpoint holds a submission keyed `act:<actionId>:`. The action is resumable when that job's last such submission has result `pending` or `suggested`, and its proposal's status is now `approved`.
- **FR-003 (plan)**: A resumable action's plan MUST be that job's interpret reading for the action, its ruling (or none), and its `act:<actionId>:` submissions.
- **FR-004 (refresh)**: Resolve MUST rewrite each approved submission of a resumed plan as `applied`, with `batchId` from the proposal view's `decided.batchId` and `outcome` from the `check.resolved` or `attack.resolved` ledger row of that batch. `seqs` is `[]`. `stepRef` keeps the paused job's marker.
- **FR-005 (seed)**: Resolve MUST add the resumed submissions to its run before the action groups. A recorded key is replayed, not resubmitted. The chain then continues from the engine outcome.
- **FR-006 (no re-interpret)**: Interpret MUST ask the model only about beat items without a resumed plan (and the monster turn). It MUST make no call when none remain. Its output MUST hold the resumed readings merged in beat order.
- **FR-007 (no re-adjudicate)**: Adjudicate MUST rule only on readings without a resumed plan. Its output MUST hold the resumed rulings. The runner's adjudicate condition MUST ignore resumed readings.
- **FR-008 (freeze)**: The runner MUST store the resumed plans in the checkpoint with the beat, on the first attempt only. A later attempt MUST use the stored plans.
- **FR-009 (record)**: A resumed action that resolves MUST carry the approved batches in its `action.resolve` `batchIds`, so its outcome is `applied`.
- **FR-010 (narrate)**: Narration MUST cover the resumed action through the existing facts builder (all ledger rows of the action). No narrate or audit change.
- **FR-011 (scripts)**: The shipped scripts `human-dm-approval.json` (test) and `greyhollow-human-dm.json` (live) MUST drop the second `dm.interpret` entry. The resumed turn calls `dm.director`, `dm.narrate`, `dm.audit`.
- **FR-012 (contracts)**: `specs/031-dm-runtime/contracts/resolve.md` and `contracts/nodes.md` MUST each gain one "Amended by specs/057-human-dm-roll-resume/contracts/turn-resume.md" line. No frozen contract changes.

### Card acceptance criteria mapping

| Card AC | Covered by |
|---|---|
| #1 narrates in the resumed turn, no second roll proposal, a DB test | US1, FR-001 to FR-010; DB test (a), (b), (c); mutation guard; live check |
| #2 reuses the resolved check, or a spec records why it must re-interpret | "Decision: reuse the paused plan"; FR-002 to FR-007; `contracts/turn-resume.md` |

### Key Entities

- **Resumed plan**: `{ actionId, fromJobId, reading, ruling | null, submissions }`. Derived at assemble; frozen in the checkpoint as `resumed`.
- **Awaiting action**: a committed action named by a pending `ai:dm` proposal. Not in the beat.

## Open questions (operator)

- **OQ-1 — Reuse instead of re-interpret (amends 031 `resolve.md` and `nodes.md`).** Recommended: **A**, reuse (this spec). B: keep re-interpret and only fix the scripts, which leaves the lost branch, the wrong `no-effect` record and the duplicate rolls from other turns.
  - **Resolved 2026-10-28 (operator, verbatim):** "TASK-0168: I accept the recommended defaults OQ-1 to OQ-4 (A): reuse the resolved check and amend 031, keep the Director in resumed turns, a rejected roll re-interprets as today, and awaiting actions leave every turn's beat."
- **OQ-2 — The Director still runs in a resumed turn.** The pipeline order stays fixed. A resumed turn pays one `dm.director` call. Its closing moves (trackers, table mode) may repeat suggestions the paused turn made; the human DM sees them in the approvals list. Recommended: **A**, keep the Director (no pipeline branch). B: skip the Director and its groups when every beat item is resumed and no monster turn is due. Card B as a revisit if A shows duplicate suggestions in the TASK-0053 run.
  - **Resolved 2026-10-28 (operator, verbatim):** "TASK-0168: I accept the recommended defaults OQ-1 to OQ-4 (A): reuse the resolved check and amend 031, keep the Director in resumed turns, a rejected roll re-interprets as today, and awaiting actions leave every turn's beat."
- **OQ-3 — A rejected roll still re-interprets.** Player-facing: after a rejection the AI DM may propose a similar roll once more before `REJECTION_LIMIT` skips the action. Recommended: **A**, unchanged here; it is the designed rejection path. B: card a task to define what a rejection means for the chain.
  - **Resolved 2026-10-28 (operator, verbatim):** "TASK-0168: I accept the recommended defaults OQ-1 to OQ-4 (A): reuse the resolved check and amend 031, keep the Director in resumed turns, a rejected roll re-interprets as today, and awaiting actions leave every turn's beat."
- **OQ-4 — Paused actions leave other turns' beats (FR-001).** This changes beats for `commit`, `reconcile` and `manual` turns under a human seat. Recommended: **A**, adopt it here, since it is the same defect through another trigger, and it stops a boot reconcile from spending a script. B: approval turns only.
  - **Resolved 2026-10-28 (operator, verbatim):** "TASK-0168: I accept the recommended defaults OQ-1 to OQ-4 (A): reuse the resolved check and amend 031, keep the Director in resumed turns, a rejected roll re-interprets as today, and awaiting actions leave every turn's beat."

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: DB test (a) passes: one `check.roll` proposal per session, approval turn calls exactly `dm.director`, `dm.narrate`, `dm.audit`.
- **SC-002**: The mutation guard turns DB test (a) and (b) red when assemble returns no resumed plans and no awaiting set.
- **SC-003**: The live check in script mode shows the narration in Brave after the DM approves the roll, with no second roll in the approvals slide-out.
- **SC-004**: Every existing DM suite passes unchanged under an AI seat.

## Assumptions

- Under a human seat `action.resolve` is `auto` and `narration` is `ask` (default policies). "Narrates" means one narration proposal; the DM approves it to put it in the transcript.
- A session has one running turn job at a time (`jobs_session_running_key`), so the paused job is finished when the resumed job assembles.
- A session's turn checkpoints fit one read at M3 scale.
