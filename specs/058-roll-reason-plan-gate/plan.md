# Implementation Plan: A roll reason the DM model writes cannot contradict actor state

**Branch**: `task-0161-roll-reason-plan-gate` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: `specs/058-roll-reason-plan-gate/spec.md`

## Summary

`checkPlan` gains a second check after its id check: it runs `checkClaims` (spec 051) on every step
`reason` and `autoFail.reason` of each group, against S0 and a presence-only `plannedDiff`. A
refused reason refuses the group through the existing plan refusal path, with a new verdict
variant. Groups with a resumed plan (spec 057) skip the reason check. Resolve passes the two new
inputs and takes the refusal code from the verdict. Contract: `contracts/plan-reason-gate.md`.

## Technical Context

**Language/Version**: TypeScript (Node 24), the existing server and engine packages.

**Primary Dependencies**: none new. `checkClaims` (`apps/server/src/dm/claims.ts`) and
`REASON_TO_PRESENCE` (`@the-stacks/session-model`) are already in the tree.

**Storage**: Postgres `jobs.result.checkpoint.planGate` JSON gains a verdict variant. No migration.
Older rows still parse: the field is optional and the old variants are unchanged.

**Testing**: Vitest. Pure tests run in `pnpm ci:check`. Resolve tests are DB suites
(`resolve.integration.test.ts`) and need `TEST_DATABASE_URL` (orchestrator-run).

**Target Platform**: the server process.

**Constraints**: no frozen contract change; no model call added; `checkPlan` stays pure; the
checker is not forked; AI-seat and human-seat behaviour unchanged for passing reasons.

**Scale/Scope**: at most 20 readings of at most 6 steps per turn, so at most about 240 short texts
per turn through a pure lexical checker.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: no new human path. The gate runs inside the existing turn job.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: session plane only. The check reads the S0 snapshot resolve already
      holds. No new query.
- [x] **IV. Event sourcing**: no new event. Resolve still writes only through `gate.submit`. The
      change stops a row before it is written; it never edits a logged row.
- [x] **V. Citations**: rulings and citations are untouched.
- [x] **VI. 5e engine boundary**: no number moves. Under OQ-2 (a) the engine enum gains one code
      the engine never returns; `execute` is unchanged. The meta-test names the exemption.
- [x] **VII. Structured first**: the verdict is typed (`ReasonFailure` with `ClaimIssue[]`).
- [x] **VIII. Operator-owned content**: the test reads the recorded M2 log in place; no content is
      copied or shipped.
- [x] **IX. Self-hostable**: no new service, container or dependency.

**Stack conformance**: no departure. No new runtime dependency.

## Research

- **R1 — Where the reason lands.** `runSteps` (`nodes/resolve.ts`) passes `step.reason` (and
  `autoFail.reason`) to `run.mech`, which appends ` [<jobId>#<n>]` and submits it as the command
  reason. The gate logs it on every event of the batch. Nothing after the plan gate and before the
  submit reads the text, so the plan gate is the last point before the write.
- **R2 — The checker already refuses the evidence.** "two kin have fallen" matches
  `COUNT_PATTERNS.numberDown` ("two" + "kin have" + "fallen"). "kin" is not a group noun, so rule 7's
  no-noun form applies: it passes only when the non-party count or the party count of down or dead
  actors is 2. At M2 seq 220 the counts are 1 and 0. `fallback.test.ts` US4.4 already proves the
  refusal on a built state.
- **R3 — Why S0, not live state.** The plan is fixed before resolve. Checking each step against the
  live state at its submit would move the check into `runSteps`, spread it over the chain, and let
  an earlier group's luck make a later reason true. The card names the plan gate; decision-0025 §4
  puts it "against S0".
- **R4 — The false positive the planned diff removes.** `checkPlan` already allows an `arrived`
  presence effect on an absent actor. Its reason ("Pell staggers out of the reeds") would fail claim
  rule 2 against S0. A presence change in the diff triggers rule 3's exemption. Building a
  `SnapshotDiff` keeps the `checkClaims` seam unchanged. Seed arrivals at encounter start get the
  same treatment; the ids come from the same rule `seedPresence` uses (beat declares `present`,
  logged presence is not `present`).
- **R5 — Resume.** Spec 057 merges resumed readings into the interpret output (`nodes/interpret.ts`)
  and resumed rulings into adjudicate's. `checkPlan` therefore sees them. `assembled.resumed` holds
  the action ids. Spec D5 gives the reason to skip.
- **R6 — Shipped scripts.** `apps/server/dm-scripts/*.json` and the test scripts under
  `apps/server/test/dm/scripts/` hold scripted reasons. Any scripted suite whose reason the checker
  refuses will fail in Phase 3's DB run. That is a finding to triage, not to mask.

## Design

### D1 — `plan-gate.ts`

- `PlanInput` gains `arriving: readonly string[]` and `resumed: readonly string[]`.
- New exported type `ReasonFailure` and the third `PlanVerdict` variant (contract).
- New exported constant `REASON_REFUSAL_CODE` (the OQ-2 code). Default `REASON_CONTRADICTS_STATE`.
- New exported pure helper `arrivingNpcs(seed, enc, scenePresence)`: the seed NPC ids the encounter
  beat declares `present` whose logged presence is not `present`. It mirrors `seedPresence`'s
  encounter-start branch. `seedPresence` itself is not changed.
- New internal `plannedDiff(snapshot, groups, arriving)` building the presence-only
  `SnapshotDiff` (contract rule 5).
- New internal `stepTexts(step)`: `[{ field: "reason", text }]` plus `autoFail.reason` for a `check`
  step with `autoFail`. Under OQ-3 (a) it adds each condition effect's `source`, field
  `<list>[j].source`.
- `checkPlan`: after the id loop finds no failure for a group, and the group's action id is not in
  `resumed`, walk `stepTexts` in step order and call `checkClaims`. Record the first refusal.

### D2 — `nodes/resolve.ts`

- The `checkPlan` call passes `arriving` (from `encounterToStart` and `arrivingNpcs` over
  `assembled.projections.scenePresence`) and `resumed` (`assembled.resumed` action ids).
- `resolveAction` sets `refusalCode = verdict.code` for a refused verdict instead of the literal.
- The NPC group path is unchanged: any refused verdict runs no step.

### D3 — Engine code (OQ-2 (a))

- `packages/dnd5e-engine/src/schema/refusals.ts`: append `REASON_CONTRADICTS_STATE`.
- `packages/dnd5e-engine/test/execute.test.ts`: the options count 27 becomes 28.
- `packages/dnd5e-engine/test/coverage.test.ts`: a named `PLAN_GATE_ONLY` list excludes the code
  from the "asserted by an expectRefusal call" check. A new assertion checks the list holds only
  codes in the enum.
- Under OQ-2 (b) D3 is dropped and `REASON_REFUSAL_CODE` is `INVALID_COMMAND`. Under (c) stop and
  re-plan: it changes `packages/session-model`.

### D4 — Mutation guard

Replace the reason walk in `checkPlan` with no check (return before calling `checkClaims`). Expect
the seq 221 unit test, the arriving and resumed unit tests that assert refusal, and the two resolve
DB refusal tests to fail. Restore; `git diff` is empty. Orchestrator-run.

## Files touched

| File | Change | Phase |
|---|---|---|
| `apps/server/test/dm/claim-fixtures.ts` | `snapshotAt(logPath, seq)` (S0 only, no diff) | 1 |
| `apps/server/test/dm/plan-reason-fixtures.ts` (new) | the M2 seq 221 reading and the control | 1 |
| `apps/server/test/dm/plan-gate.test.ts` | reason cases (evidence, control, arriving, resumed, autoFail, order, ruling replaces) | 1, 2 |
| `apps/server/src/dm/gates/plan-gate.ts` | D1 | 2 |
| `apps/server/src/dm/nodes/resolve.ts` | D2 | 3 |
| `packages/dnd5e-engine/src/schema/refusals.ts` | D3 (OQ-2 (a)) | 3 |
| `packages/dnd5e-engine/test/execute.test.ts`, `test/coverage.test.ts` | D3 (OQ-2 (a)) | 3 |
| `apps/server/test/dm/resolve.integration.test.ts` | three DB cases (NPC refused, action refused, passing reason logged unchanged) | 3 |
| `specs/031-dm-runtime/contracts/resolve.md` | step 0 "Amended by" line | 3 |
| `specs/051-output-claim-gate/contracts/claim-gate.md` | caller row; "Not gated here" line | 3 |
| `specs/026-dnd5e-engine/contracts/refusals.md` | one row (OQ-2 (a)) | 3 |
| `docs/wiki/dm-failure-and-gates.md`, `output-claim-gate.md`, `dm-turn-jobs.md`, `dm-runtime.md`, `dnd5e-engine.md` (OQ-2 (a)) | re-ground | 5 |
| `docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md` | upkeep | 5 |
| `docs/design/m3-table-sweep-runbook.md` | TASK-0161 "(this PR)" row | 5 |

No migration. No web file. No prompt or prompt-version change. `apps/server/src/dm/jobs.ts` imports
`PlanVerdict` and needs no edit.

## Phases

One phase is one implementer dispatch (sonnet), except Phase 4 (orchestrator). See `tasks.md`.

1. Evidence fixture and failing tests.
2. The reason check in `checkPlan`.
3. Resolve wiring, the refusal code, DB tests written, contracts amended.
4. Orchestrator: DB suites and the mutation guard.
5. Wiki re-ground, CAPSULES/INDEX, runbook row.

## Live check

Not required. No web file changes; the action card renders any `refusalCode` already, and a
refused reason is only reachable by a scripted or provider reason that contradicts state.
