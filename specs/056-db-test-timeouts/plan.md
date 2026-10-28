# Implementation Plan: DB integration tests survive full-suite load

**Branch**: `task-0154-db-test-timeouts` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/056-db-test-timeouts/spec.md`

## Summary

Give every DB test in the three named files, plus any other server DB test the baseline run
shows over 2.5 s, an explicit per-test timeout. Size each timeout from a measured worst case:
`max(30 s, roundUp10s(3 × max(measured, 5 s)))`. Put one comment on each naming TASK-0154 and
the figure. Change no assertion, no fixture, no production code and no suite-wide setting.
The orchestrator measures first and proves the fix with three consecutive full runs.

## Technical Context

**Language/Version**: TypeScript on Node 22, vitest 5.0.1 (`apps/server`).

**Primary Dependencies**: vitest (installed). No new runtime or dev dependency.

**Storage**: The worktree stack's Postgres (`TEST_DATABASE_URL`). No migration.

**Testing**: `vitest run` per package, driven by `turbo run test` from the root.

**Target Platform**: Developer and agent hosts running worktree stacks; CI.

**Project Type**: Test-suite change inside the existing server package.

**Performance Goals**: None for the product. The suite's wall time does not grow on a pass.

**Constraints**: Implementers cannot export `TEST_DATABASE_URL` (auto-mode classifier). The
orchestrator runs every DB suite. No paid provider run: these tests use the scripted fake.

**Scale/Scope**: Three test files for certain (8 DB tests), plus any test FR-002 adds.

## Constitution Check (constitution 2.0.0)

*Checked before research and again after design. Both pass.*

- [x] **I. Agent-operable**: The suite runs from the same `pnpm` commands for a human and an
      agent. No human-only path.
- [x] **II. Content contract**: No codex entity. N/A.
- [x] **III. Data planes**: No new state.
- [x] **IV. Event sourcing**: Unchanged. No event type, no gate change.
- [x] **V. Citations**: Retrieval untouched. No eval change.
- [x] **VI. 5e engine boundary**: Engine untouched. The tests keep their scripted dice.
- [x] **VII. Structured first**: N/A. No generated artifact.
- [x] **VIII. Operator-owned content**: No content.
- [x] **IX. Self-hostable**: No container or compose change.

**Quality gates**: "CI is the gate" holds. The fix makes the DB suite pass reliably instead of
needing re-runs. "Grounding stays fresh" holds through Phase 4.

**Stack conformance**: Within the Architecture Constraints table. No departure.

## Design decisions

### D1. Explicit per-test timeouts, not isolation

Chosen: per-test timeouts on the slow DB tests. Reasons, from the code:

1. **Isolation inside the server is already done.** `apps/server/vitest.config.ts` sets
   `fileParallelism: false`. No server test file shares a run with another server file. A
   single-fork pool or a separate vitest project for these files changes nothing about the
   contention.
2. **The load comes from outside the server process.** `pnpm test` is `turbo run test`, which
   runs the server, web, engine, session-model and srd suites at once. Other sweep lanes share
   the host. The only isolation that removes this is `turbo --concurrency=1` for every run.
   That slows every lane's `ci:check` and still cannot stop other lanes.
3. **The budget is the real defect.** A whole scripted scene through the queue, the gate and
   the DM worker takes about 3 s alone. That is 60% of a 5 s default meant for unit tests. The
   repo already sizes such tests explicitly: `gate.integration.test.ts` (30 s, 60 s),
   `bench/load-db.integration.test.ts` (30 s), `library/uploads.integration.test.ts` (120 s).
4. **Smallest diff.** Literal third arguments to `it(...)`, about 8 to 10 lines.

Rejected: raising `testTimeout` suite-wide. It would let a hung unit test in any of about 150
server files sit for 30 s before failing (FR-005).

Rejected: a shared timeout constant in a helper. The existing call sites use inline literals
(`}, 30_000);`). A constant would be a new convention for one task.

### D2. The sizing rule

`timeout = max(30_000, ceil(3 × max(measuredMs, 5_000) / 10_000) × 10_000)`.

- `measuredMs` is the test's largest duration across the baseline full run and the alone run.
  A test that timed out in the baseline counts as 5 000 ms, the breach the card records.
- The 5 s floor makes the card's evidence count when the baseline does not reproduce a breach.
- The 3× factor covers host-load swings between lanes.
- The 30 s floor matches the repo's existing heavy-test timeouts.
- A result over 120 s goes back to the orchestrator as a finding. It would mean a test is slow
  for a reason other than load, like the replay fixed in 2b09a07.

### D3. Scope rule for other tests (FR-002)

The implementer reads the baseline evidence. Any server DB test (a file named
`*.integration.test.ts`) listed with a duration over 2 500 ms gets a timeout by D2. A non-DB
test over 2.5 s is reported, not changed.

### D4. Timeout form

Use the form the repo already uses with vitest 5.0.1: a number as the third argument of
`it(name, fn, timeout)`. Example to match: `apps/server/test/gate.integration.test.ts` line
979, `}, 30_000);`. The comment goes on the line above the `it(`:

```ts
// TASK-0154: 30 s budget; worst measured 4 812 ms under a full REQUIRE_DATABASE=1 run.
it("plays Greyhollow Ford to its end through exploration, social and fight", async () => {
```

### D5. The "full run" and its evidence

- The full run is `REQUIRE_DATABASE=1 pnpm test` from the worktree root. Turbo runs every
  package at once. This is the load under which every instance was seen.
- vitest's default reporter lists each test over its 300 ms slow threshold with its duration.
  The orchestrator keeps only the server's lines, filtered by turbo's
  `@the-stacks/server:test:` prefix. The raw log stays outside the repo. Exact commands are in
  [quickstart.md](./quickstart.md).
- If the default reporter omits per-test durations, the fallback is
  `REQUIRE_DATABASE=1 pnpm turbo run test --filter='!@the-stacks/shared' -- --reporter=verbose`.
  The shared package's `test` script is `echo ... && exit 0` and cannot take extra arguments.
- AC #2 counts strictly (spec OQ-1 default (a)). Any failing run restarts the count.

### D6. Orchestrator-run work

Phases 1 and 3 run no implementer. They need `TEST_DATABASE_URL` exported, which the
auto-mode classifier denies to implementers (runbook, 2026-10-28 TASK-0163 row). The
orchestrator writes the filtered evidence files into the worktree. The next implementer phase
commits them.

## Files touched

| File | Phase | Change |
|---|---|---|
| `specs/056-db-test-timeouts/evidence/alone.txt` | 1 (written), 2 (committed) | Filtered durations of the three files run alone |
| `specs/056-db-test-timeouts/evidence/baseline.txt` | 1 (written), 2 (committed) | Filtered server lines of one full run before the fix |
| `specs/056-db-test-timeouts/evidence/measurement.md` | 2, 4 | Per-test table: alone, baseline, timeout chosen; then the three-run results |
| `apps/server/test/dm/scene.integration.test.ts` | 2 | Timeout on the one DB test ("plays Greyhollow Ford...") |
| `apps/server/test/playtest/harness.integration.test.ts` | 2 | Timeouts on its 4 tests |
| `apps/server/test/playtest/provider.integration.test.ts` | 2 | Timeouts on its 3 tests (the CI refusal test too: it shares the file's DB setup) |
| Other `apps/server/test/**/*.integration.test.ts` | 2, only if D3 flags them | Timeout by D2 |
| `specs/056-db-test-timeouts/evidence/run-1.txt`, `run-2.txt`, `run-3.txt` | 3 (written), 4 (committed) | Filtered server lines of each full run |
| `docs/wiki/test-suite.md` | 4 | New paragraph on load-sized DB timeouts; the three files added to `sources`; `description` updated; re-pinned |
| `docs/wiki/CAPSULES.md` | 4 | Regenerated (the description changes) |
| `docs/wiki/INDEX.md` | 4 | One sentence in the state paragraph |
| `docs/design/m3-table-sweep-runbook.md` | 4 | Two Execution log rows (amendment, TASK-0154 "(this PR)") |
| `specs/054-two-player-alpha-kit/tasks.md` | 4 | Tick T041, T042, T043 |

No migration. No new dependency. No production source file. `apps/server/vitest.config.ts`
does not change, so the `ingestion` note's pin is untouched.

## Project Structure

### Documentation (this feature)

```text
specs/056-db-test-timeouts/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
├── tasks.md
├── checklists/requirements.md
└── evidence/            # filled by Phases 1 to 4
```

No `data-model.md` and no `contracts/`: the feature adds no entity and no interface.

### Source Code (repository root)

```text
apps/server/test/
├── dm/scene.integration.test.ts
└── playtest/
    ├── harness.integration.test.ts
    └── provider.integration.test.ts
```

## Complexity Tracking

No constitution violation. Nothing to justify.
