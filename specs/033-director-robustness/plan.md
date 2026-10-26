# Implementation Plan: First Scene — director output survives real models; failed jobs keep their error detail

**Branch**: `task-0102-director-robustness` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: [spec.md](spec.md), [research.md](research.md),
[contracts/failure-record.md](contracts/failure-record.md),
[contracts/director-output.md](contracts/director-output.md), [quickstart.md](quickstart.md).

## Summary

Evidence first. Phase 1 makes a failed turn job keep its diagnostics: the failure record goes
to `jobs.result.failure` with the schema issues, the purpose and a bounded excerpt of each
attempt. Phase 2 is an orchestrator-run paid capture that commits the real failing director
output as a fixture. Phase 3 classifies that evidence against a fixed cause catalog and builds
only the selected fixes: parse extraction, a named normalization step, a prompt revision, or a
gateway adapter fix. The strict schema stays strict and no number is ever touched. Phase 4 is an
orchestrator-run paid verification. Phase 5 is the full gate.

## Technical Context

**Language/Version**: TypeScript (Node 24), ESM
**Primary Dependencies**: zod v4, drizzle-orm, vitest. No new dependency.
**Storage**: Postgres `jobs` table; `result` (jsonb) and `error` (text) exist. No migration.
**Testing**: vitest; database suites with `REQUIRE_DATABASE=1` on the worktree's stack.
**Target Platform**: the server's DM worker (`apps/server`).
**Project Type**: web application (pnpm monorepo).
**Performance Goals**: none new. One re-ask stays the limit.
**Constraints**: no model text on the operator route or in logs; no number coerced (R8);
`DirectorOutput` unchanged except one refine message.
**Scale/Scope**: about 6 source files, 3–4 test files, 1 fixture.

## Constitution Check

- [x] **I. Agent-operable** — the failure record is a database row an agent reads with the same
  query the operator uses (quickstart B5).
- [x] **II. Content contract** — no codex entity. The failure record and the fixture have typed,
  documented shapes (contracts/).
- [x] **III. Data planes** — the failure record is operational job state in `jobs`, the plane
  that already holds the turn checkpoint.
- [x] **IV. Event sourcing** — no play event changes. The failure notice is unchanged.
- [x] **V. Citations** — not applicable.
- [x] **VI. 5e engine boundary** — no mechanics change; normalization never touches a number.
- [x] **VII. Structured first** — model output is still validated by the strict schema before
  use; leniency is an explicit, tested pre-step.
- [x] **VIII. Operator-owned content** — the fixture holds director output about the shipped
  seed; the director prompt carries no library text.
- [x] **IX. Self-hostable** — no new service; the provider stays operator configuration.

No violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/033-director-robustness/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md                 # orchestrator runbook for the paid runs
├── contracts/
│   ├── failure-record.md         # jobs.result.failure, excerpt rule
│   └── director-output.md        # cause catalog, normalization invariants
├── evidence/                     # Phase 2 and 4 outputs (orchestrator)
│   ├── capture-<runId>/
│   ├── classification.md
│   └── verify-<runId>/
└── tasks.md
```

### Source Code (repository root)

```text
apps/server/src/
├── dm/pipeline/call.ts           # excerptOf, attempt records, (C1) extractJson, normalize hook
├── dm/pipeline/context.ts        # TurnFailure type (if not placed in jobs.ts)
├── dm/worker.ts                  # failed-turn result write, log without excerpts
├── dm/jobs.ts                    # TurnFailureResult type
├── jobs/queue.ts                 # finishJob: optional result beside error
├── dm/nodes/schemas.ts           # advance refine message only
├── dm/nodes/director.ts          # (C3–C5) normalizeDirector
├── dm/prompts/director.ts        # (C2, C6–C8) prompt v2
└── ai/adapters/openai-compatible.ts   # (C9 only)

apps/server/test/
├── dm/call.test.ts
├── dm/director.test.ts
├── dm/director-capture.test.ts   # fixture reproduction + fixed-pipeline acceptance
├── dm/worker.integration.test.ts
├── dm/fixtures/director-capture-<runId>.json
└── ai.openai-compatible.test.ts  # (C9 only)
```

**Structure Decision**: existing modules only. The failure record is written by the worker,
built by `callJson`. Director-specific leniency stays in the director node.

## Phase design

| Phase | Who | Output | AC |
|---|---|---|---|
| 1. Diagnostics | sonnet implementer | failure record, excerpt rule, readable advance issue, tests | #1 |
| 2. Capture | **orchestrator** (paid, operator ceiling) | fixture + evidence dir | #2 (fixture) |
| 3. Classify and fix | **orchestrator** classifies; sonnet implementer fixes | `evidence/classification.md`, selected catalog rows, reproduction test | #2 (test), #3 (offline) |
| 4. Verification | **orchestrator** (paid, operator ceiling) | evidence dir, card note | #3 |
| 5. Full gate | sonnet implementer (gate); orchestrator (scripted CI playtest in the composite worktree) | green gate, contract amendment notes in 031 | #4 |

### Phase 1 notes

- `collect()` in `call.ts` also returns `outputTokens` from the `done` event (null when the
  stream ended without one).
- Each failed attempt is recorded with its own issues; `detail.issues` keeps the last
  attempt's issues so existing callers and the re-ask text are unchanged.
- `finishJob(db, job, { error, result? })`: when `result` is present on failure it is written;
  otherwise `null` as today. The ingest worker is untouched.
- The worker writes `{ checkpoint: latest, outcome: { status: "failed" }, audit: null, calls:
  outcome.calls, failure }`. A thrown turn has `calls: []`.

### Phase 3 notes

- The orchestrator writes `evidence/classification.md` from the fixture: the issues per
  attempt, the catalog rows selected, and why each other row is not.
- The implementer builds only the selected rows, in catalog order.
- The reproduction test has two parts:
  1. Strict v1 parse: `DirectorOutput.safeParse(JSON.parse(stripFence(text)))` on each captured
     attempt fails (or `JSON.parse` throws), and the issue paths match the fixture's.
  2. Fixed pipeline: `callJson` with a scripted gateway returning the captured attempts, plus
     the director's `normalize`, returns `ok` with a value the legality code accepts. When the
     classification selects only prompt rows (C2, C6, C7, C8), part 2 is replaced by a prompt
     snapshot test, and `classification.md` says so. AC #3 then rests on Phase 4.

## Risks

- **The capture does not fail.** Output is not deterministic. Mitigation: FR-011 stop-and-ask;
  every committed run directory is still evidence.
- **The fix covers attempt 1 but not attempt 2 shapes.** The fixture holds both attempts; part
  2 of the reproduction test feeds both.
- **A prompt v2 shifts other decisions.** The scripted run queues by purpose, so CI is
  unaffected; the verification run is the real check.
- **The composite merge conflicts.** Both branches are expected to touch disjoint files. A
  conflict stops the run for an operator ruling (quickstart A5).

## Wiki

`docs/wiki/dm-runtime.md` pins sources this task touches (`call.ts`, `worker.ts`). After merge
the orchestrator runs `/grounding-wiki:wiki-update` (sweep re-ground step).

## Complexity Tracking

Empty.
