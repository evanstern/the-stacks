# Implementation Plan: With a human DM, an approved check roll narrates

**Branch**: `task-0168-human-dm-roll-resume` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: `specs/057-human-dm-roll-resume/spec.md`

## Summary

A resumed turn reuses the paused turn's plan for an action instead of interpreting it again.
Assemble classifies each committed candidate (awaiting, resumable, fresh) from the projections and
the session's earlier turn checkpoints. Interpret and adjudicate ask only about fresh items and
merge the resumed plans. Resolve seeds the resumed submissions, refreshed from the approved
proposal, and the existing replay continues the chain. Contract: `contracts/turn-resume.md`.

## Technical Context

**Language/Version**: TypeScript (Node 24), the existing server package.

**Primary Dependencies**: none new. Drizzle for the one new read.

**Storage**: Postgres `jobs.result.checkpoint` JSON gains an optional `resumed` field. No migration.

**Testing**: Vitest. Unit tests run in `pnpm ci:check`. DB suites need `TEST_DATABASE_URL`
(orchestrator-run).

**Target Platform**: the server process; script-mode worktree stack for the live check.

**Constraints**: no frozen contract change; no new event, proposal kind or frame; AI-seat
behaviour unchanged; no paid model call.

**Scale/Scope**: one session's turn checkpoints per assemble, read only when an `ai:dm` proposal
names a beat candidate.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable** — the flow is the existing `proposal.approve` gate request. The DB
      test and the evidence driver send it. No human-only path.
- [x] **II. Content contract** — no codex entity. N/A.
- [x] **III. Data planes** — the new state is a field of the DM job checkpoint (session plane, job
      queue). The read is a `jobs` query in `dm/jobs.ts`. No cross-plane access.
- [x] **IV. Event sourcing** — no new event. Resolve still writes only through `gate.submit`. The
      refresh reads the proposal view and ledger rows the gate appended.
- [x] **V. Citations** — rulings are reused unchanged, with their citations. No new claim.
- [x] **VI. 5e engine boundary** — the engine outcome of the approved roll picks the branch. No
      model reads or computes a number.
- [x] **VII. Structured first** — the resumed plan is the typed checkpoint data (`InterpretReading`,
      `Ruling`, `Submission`).
- [x] **VIII. Operator-owned content** — the script edits remove an entry; the new test script
      holds original text only.
- [x] **IX. Self-hostable** — no new service, container or dependency.

**Stack conformance**: no departure. No new runtime dependency.

## Research

- **R1 — Where the loop starts.** `enqueue.ts` queues an `approval` turn with an empty checkpoint.
  `assemble.selectBeat` reselects the committed action. Interpret re-plans it from
  `priorSteps` (row reasons only). `Run.submit` keys records per job, so the duplicate submits.
- **R2 — Reuse is decidable from data.** The paused job's checkpoint holds the reading
  (`interpret.readings`), the ruling (`adjudicate.rulings`) and the submissions with `proposalId`.
  The proposal view holds `status` and `decided.batchId`. The ledger rows of that batch hold the
  `check.resolved` outcome. Nothing needs a model.
- **R3 — Replay already continues a chain.** `Run.submit` returns a recorded key without
  resubmitting (the reclaim path, FR-006 of spec 031). A refreshed `applied` record makes `take()`
  continue to the branch effects and `action.resolve`.
- **R4 — Narration needs no change.** `buildNarrationFacts` reads all ledger rows of a beat action,
  so the approved roll is in the facts once the action has a result.
- **R5 — Rejected stays fresh.** A rejected proposal is counted by `rejectionCounts`; the existing
  re-interpret path and `REJECTION_LIMIT` apply (OQ-3).
- **R6 — Pending leaves the beat.** A pending `ai:dm` proposal naming the action marks it awaiting.
  This stops commit and reconcile turns from duplicating the roll (OQ-4).

## Data model

```ts
// apps/server/src/dm/resume.ts (new, pure)
export interface ResumedPlan {
  actionId: string;
  fromJobId: string;
  reading: InterpretReading;
  ruling: Ruling | null;
  submissions: Submission[];
}
export interface PriorTurn { jobId: string; checkpoint: TurnCheckpoint } // newest first
export function awaitingActionIds(p: SessionProjections, candidates: readonly string[]): Set<string>;
export function needsPriorTurns(p: SessionProjections, candidates: readonly string[]): boolean;
export function findResumedPlans(
  p: SessionProjections,
  candidates: readonly string[],   // committed, not awaiting
  prior: readonly PriorTurn[],
): ResumedPlan[];
export function refreshSubmission(p: SessionProjections, s: Submission): Submission;
```

- `TurnCheckpoint.resumed?: ResumedPlan[] | null` (`dm/jobs.ts`).
- `AssembleOutput.resumed: ResumedPlan[]`.
- `NodeDeps.loadPriorTurns?: (sessionId: string, excludeJobId: string) => Promise<PriorTurn[]>`.
  Optional: absent means `[]`, so unit-test contexts need no change.
- `dm/jobs.ts` `loadPriorTurnCheckpoints(db, sessionId, excludeJobId)`: `kind = 'turn'`, the
  session, `id <> excludeJobId`, a non-null `result->'checkpoint'`, ordered `created_at desc, id
  desc`. Returns `PriorTurn[]`.

Rules (from `contracts/turn-resume.md`):

- `awaitingActionIds`: action ids named by a `pending` proposal whose `proposer` is `ai:dm` and
  whose kind is `mechanics` (`proposal.actionId`), `scene-presence` (`proposal.actionId`) or
  `action.resolve` (`resolution.actionId`).
- `needsPriorTurns`: true when any `ai:dm` proposal of those kinds names a candidate. Assemble
  calls the loader only then.
- `findResumedPlans`: for each candidate, the first `PriorTurn` with a submission keyed
  `act:<id>:`. Take its last such submission. Resumable when its result is `pending` or
  `suggested`, its `proposalId` view is `approved`, and the checkpoint holds a reading for the
  action. `ruling` is the checkpoint's ruling for the action, or null.
- `refreshSubmission`: an `approved` pending submission becomes `applied` with `batchId =
  decided.batchId`, `outcome` from the batch's `check.resolved`/`attack.resolved` ledger row,
  `seqs: []`. Any other submission returns unchanged.

## Files touched

| File | Change |
|---|---|
| `apps/server/src/dm/resume.ts` | new: the pure classifier and refresh |
| `apps/server/src/dm/jobs.ts` | `TurnCheckpoint.resumed?`; `loadPriorTurnCheckpoints` |
| `apps/server/src/dm/pipeline/context.ts` | `NodeDeps.loadPriorTurns?` |
| `apps/server/src/dm/worker.ts` | wire `loadPriorTurns` to `loadPriorTurnCheckpoints`; the empty checkpoint holds `resumed: null` |
| `apps/server/src/dm/nodes/assemble.ts` | awaiting exclusion in `selectBeat` (fresh path only); `resumed` in the output (from the checkpoint when frozen) |
| `apps/server/src/dm/pipeline/runner.ts` | store `resumed` with the beat; adjudicate condition ignores resumed readings |
| `apps/server/src/dm/nodes/interpret.ts` | expected ids exclude resumed; no call when none; merge resumed readings in beat order |
| `apps/server/src/dm/prompts/interpret.ts` | beat entries and "Already applied" list fresh items only |
| `apps/server/src/dm/nodes/adjudicate.ts` | skip resumed readings; append resumed rulings |
| `apps/server/src/dm/nodes/resolve.ts` | seed refreshed resumed submissions into the run before the groups |
| `apps/server/test/dm/resume.test.ts` | new unit tests for `resume.ts` |
| `apps/server/test/dm/runner.test.ts`, `interpret.test.ts`, `assemble.test.ts` | new cases |
| `apps/server/test/dm/human-dm-roll-resume.integration.test.ts` | new DB test, cases (a), (b), (c) |
| `apps/server/test/dm/scripts/human-dm-approval.json` | drop the second `dm.interpret` entry |
| `apps/server/test/dm/scripts/human-dm-roll-chain.json` | new: the chained case (c) script |
| `apps/server/dm-scripts/greyhollow-human-dm.json` | drop the second `dm.interpret` entry (10 calls) |
| `specs/031-dm-runtime/contracts/resolve.md`, `nodes.md` | one "Amended by" line each |
| `specs/057-human-dm-roll-resume/evidence/*` | DB run, mutation guard, live run, driver |
| `docs/wiki/dm-runtime.md`, `dm-turn-jobs.md`, `dm-failure-and-gates.md`, `runtime-stacks.md`, `INDEX.md`, `CAPSULES.md` | re-pin |
| `docs/design/m3-table-sweep-runbook.md` | TASK-0168 "(this PR)" row |

Migrations: none. New runtime dependencies: none.

## Risks

- **Read size.** The loader reads every earlier turn checkpoint of the session. It runs only when
  an `ai:dm` proposal names a candidate, which under an AI seat never holds a pending one. Accepted
  at M3 scale (spec Assumptions).
- **Director repeats** (OQ-2). Unchanged pipeline order; visible as dismissible suggestions.
- **stepRef numbering.** Seeded submissions raise the run's length, so new stepRefs number after
  them. The seeds are saved with the first checkpoint, so a reclaim numbers the same.
