# Measurement: DB test durations and timeouts (TASK-0154)

Both runs used `--reporter=verbose`, so every test has a duration.
`alone.txt` is the three named files run alone. `baseline.txt` is one full run, taken with the
quickstart step-3 fallback directly:
`pnpm turbo run test --filter='!@the-stacks/shared' -- --reporter=verbose`.
The baseline passed (server 1266 passed, 5 skipped). No test timed out in it.

Rule (plan.md D2): `timeout = max(30 000, ceil(3 x max(measuredMs, 5 000) / 10 000) x 10 000)`.
Every `measuredMs` is under 5 000, so each result is `max(30 000, 20 000)` = 30 000 ms.
No result exceeds 120 000 ms (T005).

## In-scope tests (8 DB tests in the three named files)

| File | Test | alone ms | baseline ms | measuredMs | Timeout ms |
|---|---|---|---|---|---|
| dm/scene.integration.test.ts | plays Greyhollow Ford to its end through exploration, social and fight | 1987 | 1928 | 1987 | 30 000 |
| playtest/harness.integration.test.ts | plays the CI scenario to its end and writes the run directory | 1974 | 2102 | 2102 | 30 000 |
| playtest/harness.integration.test.ts | stops declaring for a downed seat and ends stalled with seat-downed (TASK-0112) | 1412 | 1492 | 1492 | 30 000 |
| playtest/harness.integration.test.ts | ends stalled with artifacts saved when the move cap is reached | 887 | 767 | 887 | 30 000 |
| playtest/harness.integration.test.ts | ends failed with the job id and artifacts saved on a DM error | 163 | 167 | 167 | 30 000 |
| playtest/provider.integration.test.ts | plays to the end under a generous ceiling and records spend | 2018 | 2009 | 2018 | 30 000 |
| playtest/provider.integration.test.ts | stops budget-stopped once spend reaches the ceiling | 247 | 252 | 252 | 30 000 |
| playtest/provider.integration.test.ts | refuses to run under CI even when called directly | 4 | 5 | 5 | 30 000 |

The non-DB test "the full script is the four scene segments..." (9 ms alone, 13 ms baseline)
is not a DB test and keeps the default.

## Extra tests over 2 500 ms in baseline.txt (T009)

None. T009 is skipped: no `*.integration.test.ts` DB test outside the three files exceeds 2 500 ms.

## Reported, not changed

Non-target tests over 2.5 s in the baseline:

| File | Test | baseline ms | Note |
|---|---|---|---|
| bench/retrieval.integration.test.ts | T020: runs the CI matrix and holds every cell's recall@5 to baseline | 13628 | Already carries its own 120 000 ms timeout. |

`bench/load.integration.test.ts` "concurrency-smoke" ran 2303 ms, under the 2 500 ms line.
It already carries its own timeout.

## Three-run result

Phase 3 (2026-10-28, commit 6b52c1a0): three consecutive `REQUIRE_DATABASE=1 pnpm test` runs, one after another, no re-run. Each exited 0. No timeout, no failure, no `run-failed-<k>.txt` file.

| Run file | Exit | server Test Files | server Tests | web | session-model | dnd5e-engine | srd |
|---|---|---|---|---|---|---|---|
| run-1.txt | 0 | 114 passed, 1 skipped (115) | 1266 passed, 5 skipped (1271) | 265 node, 117 vitest | 816 | 240 | 181 |
| run-2.txt | 0 | 114 passed, 1 skipped (115) | 1266 passed, 5 skipped (1271) | 265 node, 117 vitest | 816 | 240 | 181 |
| run-3.txt | 0 | 114 passed, 1 skipped (115) | 1266 passed, 5 skipped (1271) | 265 node, 117 vitest | 816 | 240 | 181 |

Slowest duration of each timed test across the three runs (the reporter prints only tests above its slow threshold; the two fastest harness and provider tests print no line):

| Test | run 1 ms | run 2 ms | run 3 ms | Slowest ms | Timeout ms |
|---|---|---|---|---|---|
| plays Greyhollow Ford to its end through exploration, social and fight | 2069 | 2016 | 1976 | 2069 | 30 000 |
| plays the CI scenario to its end and writes the run directory | 2052 | 2039 | 2171 | 2171 | 30 000 |
| stops declaring for a downed seat and ends stalled with seat-downed (TASK-0112) | 1429 | 1436 | 1493 | 1493 | 30 000 |
| ends stalled with artifacts saved when the move cap is reached | 835 | 825 | 806 | 835 | 30 000 |
| plays to the end under a generous ceiling and records spend | 1947 | 1992 | 2052 | 2052 | 30 000 |

The slowest run was 2171 ms, 7.2 percent of the 30 000 ms timeout.
