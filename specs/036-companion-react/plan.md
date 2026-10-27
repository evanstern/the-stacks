# Implementation Plan: A human reaction re-runs the companion whose action is pending

**Branch**: `task-0114-companion-react` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)
**Input**: `specs/036-companion-react/spec.md`; card TASK-0114; runbook
`docs/design/m3-table-sweep-runbook.md` (branch `sweep-m3-runbook`), Track B1.

## Summary

Add a fourth companion-job reason, `react`. The gate listener queues it when a human comments
on (comments, approves, objects to) an AI companion's open action. One queued `react` job per
session absorbs a reaction storm, and a trailing quiet window with a maximum wait decides when
it may run. Every companion run (not only `react`) now sees its own open actions and must
decide each one, so a re-run closes the action instead of talking past it (M2 seq 44). The
decision is `commit` today. Withdraw and revise need a new lifecycle step in a frozen contract
and wait on operator checkpoint W (Phase 3).

## Alternatives for the trigger

| Option | What it does | Verdict |
|---|---|---|
| **A. `react` job on a human reaction** (card's preferred) | Gate listener queues a companion job when a human comments on a companion's open action; coalesced per session | **Chosen.** It answers exactly the evidence (seq 37–38 produced no job), keeps the declare-then-discuss design, and rides the existing queue, claim and fencing. |
| B. Companions always commit on declare | Force `commit: true` in free mode, as turn mode already does for the active companion | Rejected. It removes the discussion window the action card exists for; a human objection could never change the companion's action. It also leaves R3 (a run cannot address its own open action) untouched. |
| C. Auto-commit after a timeout | A sweeper commits any companion action open longer than N seconds | Rejected. It ignores what humans said, picks an arbitrary delay, and adds a timer path the worker does not have. |
| D. Fold pending companion actions into the next beat | Assemble commits or includes open companion actions whenever a beat starts | Rejected. That is the current workaround (a human commit starts the beat); it still does nothing when the human only comments, and it puts a companion decision in DM code. |
| E. Re-run companions on any human event (talk too) | Broad wake-up | Rejected. Cost scales with chat volume, and most talk is not about the pending action. |
| F. Deterministic commit on an `approve` stance, no model call | Code commits when a human approves | Rejected as the rule, kept as the default. An approval carries text ("Let's be cautious", seq 38) that may change the companion's intent; and in multiplayer one approval is not the table's consensus. Code does apply `commit` as the default when the model output is unusable (FR-012). |

## Coalescing design (multiplayer)

Rule: **at most one queued `react` job per session; a trailing quiet window of 3 s, capped at
10 s after the first reaction; at most one running plus one queued; and a run skips any
companion whose open actions carry no unanswered human reaction.**

- **Uniqueness by the database.** A partial unique index
  `jobs_companion_react_queued_key ON jobs (session_id) WHERE kind = 'companion' AND
  status = 'queued' AND input->>'reason' = 'react'` mirrors `jobs_turn_queued_key` and
  `jobs_chronicle_queued_key`. Two listeners racing on two humans' comments cannot both insert.
  Considered and rejected: an advisory lock in code (no migration). Every future caller would
  have to remember the lock; the index holds the invariant for all of them, as the two sibling
  indexes do.
- **Merge on conflict.** `enqueueCompanionReact(db, sessionId, companionId, { quietMs, maxWaitMs })`
  inserts `ON CONFLICT DO NOTHING`. On conflict it updates the queued row in one statement:
  union the companion id into `input.companions`, and set
  `input.notBefore = least(now() + quietMs, input.firstReactionAt + maxWaitMs)`. If the update
  finds no queued row (it was claimed in between), loop and insert, as `enqueueTurnForced`
  does.
- **Claim condition.** `claimDmJob` adds one predicate to the queued branch: a companion job
  with `input->>'notBefore'` set is claimable only when `(input->>'notBefore')::timestamptz <=
  now()`. Rows without `notBefore` (every existing reason) are unaffected. The worker already
  polls every `POLL_MS` (2 s), so the wait after the window is at most one poll; no nudge timer
  is added.
- **Bound.** While a `react` job runs, a new reaction inserts a new queued `react` job (the
  index covers only `queued`). It runs after the current one ends (existing `NOT EXISTS` on a
  live lease). The skip rule (FR-009) makes that second run free when the first already answered
  everything. Worst case for a storm: two model calls per companion, never one per reaction.
- **Times are database time.** `firstReactionAt` and `notBefore` are written with `now()` in
  SQL, so worker and listener clocks never disagree.

## Resolution design

- `CompanionOutput` gains `pending: { actionId, decision, text }[]` (max 4). `decision` is
  `"commit"` under W-B; `"commit" | "withdraw" | "revise"` under W-A (Phase 3 widens the enum).
  `text` is required for `revise`, else null.
- The prompt (`prompts/companion.ts`) splits "Open actions you may comment on" into **your open
  actions** (each with its comments and stances, oldest first) and **others' open actions**. It
  tells the model to decide every one of its own. `PROMPT_VERSION` bumps.
- `runCompanionJob` order per companion: skip rule (react only) → model call → for each own
  open action, take the model's decision or the default (FR-012) → submit. A new `act` is
  dropped and logged (`dm.companion.act-dropped`) while an own open action remains open after
  the decisions. In turn mode the active companion's forced act uses its open action instead of
  declaring a new one (FR-014); a non-active companion's `commit` is not submitted.
- Default decision (FR-012): `commit`; under W-A `withdraw` when the latest human stance is
  `object`.
- Reason `react` ends with nothing more (FR-015). `worker.ts` needs no new branch: `runSideJob`
  already passes any companion job to `runCompanionJob`, and only `hold` triggers a forced turn.

## Technical Context

**Language/Version**: TypeScript (Node, ESM), as the server today.
**Primary Dependencies**: existing only — Zod, Drizzle, Vitest, the fake AI gateway.
**Storage**: Postgres `jobs` table; one new partial unique index (migration).
**Testing**: Vitest; DB integration suites under `apps/server/test/dm/` with
`REQUIRE_DATABASE=1` on the worktree's own stack; fake-gateway scripted companion output.
**Target Platform**: the server process's DM worker.
**Project Type**: monorepo web service (`apps/server`, `packages/session-model`, `apps/web`).
**Performance Goals**: a single human's reaction is answered within quiet window (3 s) + one
poll (2 s) + one companion call.
**Constraints**: frozen contracts untouched in Phases 1–2; no new env variable; no new runtime
dependency.
**Scale/Scope**: up to 4 companions and the M3 three-human table.

## Constitution Check (2.0.0)

| Principle | Check | Result |
|---|---|---|
| I. Agent-operable | The companion is the agent; it acts only through `gate.submit` with its own proposer. Under W-A, `action.withdraw` is a gate proposal any declarer (human or agent) can submit. | Pass |
| II. Content is a contract | No codex entity changes. | N/A |
| III. Three data planes | Session plane and the `jobs` table only. No cross-plane import. | Pass |
| IV. Event-sourced play | Every companion decision reaches the log as a typed proposal through the gate. Under W-A the new event is typed, versioned, appended only by the gate, and the projection tolerates it; unknown-type tolerance is unchanged. No event is updated. | Pass |
| V. Citations | No rules claims. | N/A |
| VI. 5e engine boundary | No mechanics. A committed companion action is adjudicated by the existing pipeline. | Pass |
| VII. Structured before styled | No generated assets. | N/A |
| VIII. Operator-owned content | No content shipped. | Pass |
| IX. Self-hostable | No new service or dependency. | Pass |

Gate result: pass, no complexity entries.

## Project Structure

### Documentation (this feature)

```text
specs/036-companion-react/
├── spec.md
├── plan.md
├── tasks.md
└── checklists/requirements.md
```

### Files touched

Phase 1 — trigger and coalescing:

- `apps/server/src/dm/jobs.ts` — `CompanionJobInput.reason` gains `"react"`; optional
  `firstReactionAt`, `notBefore` (ISO strings); `enqueueCompanionReact`; the claim predicate.
- `apps/server/src/schema/jobs.ts` — `jobs_companion_react_queued_key`.
- `apps/server/drizzle/<next>_*.sql`, `apps/server/drizzle/meta/_journal.json`,
  `apps/server/drizzle/meta/<next>_snapshot.json` — generated by `drizzle-kit generate`, never
  hand-written. **Migration**: one, adding the partial unique index. Hotspot: TASK-0116 also adds
  a migration. The later-merging branch regenerates its migration after merging `origin/main`;
  never hand-merge the journal.
- `apps/server/src/dm/enqueue.ts` — the `react` rule (FR-001–FR-004); `quietMs`/`maxWaitMs`
  deps with defaults.
- `apps/server/src/index.ts` — no change expected (defaults apply); listed for review only.
- Tests: `apps/server/test/dm/jobs.integration.test.ts` (enqueue merge, claim condition, race),
  new `apps/server/test/dm/companion-react.integration.test.ts` (listener → job).

Phase 2 — resolution and contract:

- `apps/server/src/dm/companion.ts` — `pending` output, skip rule, default decision, act guard,
  turn-mode rule.
- `apps/server/src/dm/prompts/companion.ts` — own vs others' open actions; `PROMPT_VERSION`.
- `apps/server/src/dm/worker.ts` — reviewed; no change expected (see Resolution design).
- Fake-gateway fixtures under `apps/server/test/dm/fixtures/` and any script that emits
  `CompanionOutput` — add `pending: []` where the schema requires it.
- Tests: `companion.integration.test.ts`, `companion-react.integration.test.ts` (M2 repro,
  storm), `player-facing-prompts.test.ts` (version and sections), `worker.integration.test.ts`,
  `full-turn.integration.test.ts` (regressions only).
- Contracts: `specs/031-dm-runtime/contracts/companions.md` (reason `react`, pending rule,
  coalescing, ending), `specs/031-dm-runtime/contracts/turn-jobs.md` (enqueue rule, index, claim
  predicate, the "After a turn job" table unchanged). Each amendment carries "Amended by
  specs/036-companion-react".

Phase 3 — withdraw lifecycle (W-A only):

- `packages/session-model/src/events/actions.ts` (`ActionWithdrawnV1`), `catalog.ts`,
  `projections/actions.ts`, `projections/types.ts` (`ActionStatus` gains `withdrawn`),
  `projections/apply.ts`.
- `packages/session-model/src/gate/proposals.ts`, `permissions.ts`, `plan.ts`, `refusals.ts` if a
  new code is needed (prefer the existing not-open refusal).
- `apps/server/src/dm/jobs.ts` / `companion.ts` — widen `decision`; submit `action.withdraw`;
  `revise` = withdraw then declare.
- `apps/server/src/dm/nodes/assemble.ts` — reviewed: a beat already takes only committed actions.
- `apps/web/app/play/view-model.ts` and the action card component — render `withdrawn`, no
  commit control. No modals.
- Contracts: `specs/029-proposal-gate/contracts/proposals.md` (thirteen kinds),
  `proposal-events.md`, permission matrix row — each citing the checkpoint-W ruling on the card.
- Tests: session-model projection and gate unit tests; companion integration for withdraw and
  revise.
- Hotspots: `packages/session-model` (TASK-0051, TASK-0049, TASK-0050) and `apps/web/app/play/`.
  Merge `origin/main` before starting Phase 3.

**New runtime dependencies**: none.

## Phases and dispatch

| Phase | Kind | Card AC | Depends on |
|---|---|---|---|
| 1 Trigger and coalescing | sonnet dispatch | #1 | — |
| 2 Resolution, M2 repro, contract | sonnet dispatch | #2, #3 | 1 |
| 3 Withdraw lifecycle | sonnet dispatch, **only after checkpoint W rules W-A** | #2 | 2, ruling |
| 4 Wiki | sonnet dispatch | — | 2 (and 3 if run) |

The tier is the runbook's (sonnet). The judgment calls are settled here; Phase 3's scope is
fixed by the ruling.

## Operator checkpoints

1. **Checkpoint W** (spec): W-A (new `action.withdraw` / `action.withdrawn`, frozen-contract
   change to `specs/029-proposal-gate/contracts/`) or W-B (commit-only; AC #2 bypass note plus a
   follow-up card for W-A). Needed before Phase 3 only. Recommended: W-A.
2. The quiet window (3 s) and maximum wait (10 s) are defaults; the operator may change them at
   review. They are constants, so a change is a one-line diff.

## Risks

- **The model ignores `pending`.** The default decision (FR-012) still closes the action, so the
  stall cannot recur; quality of the answer may suffer. Verified with fake-gateway output only;
  a paid check belongs to TASK-0053's demo.
- **Claim query is a hotspot** shared with TASK-0116 (debug view reads jobs). The predicate is
  additive; a reconcile merge is expected.
- **Prompt text change** touches `prompts/companion.ts`, which TASK-0052 may also change. Merge
  `origin/main` before Phase 2.
- **Turn mode**: a non-active companion's open action waits for its turn. If the turn order
  never reaches it (combat ends), the action stays open until its next run. Free mode after
  combat runs companions on prompts and reactions, which then close it.

## Complexity Tracking

Empty.
