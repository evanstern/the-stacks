# Mutation guard (T025)

Run by the orchestrator on 2026-10-29 against 59b840c3. Each mutation was applied alone, its test run, then restored with `git checkout`.

| # | Mutation | Test | Result |
|---|---|---|---|
| M1 | `dmSeatView` keeps party controllers (`players.has(e.userId)` → `false`) | `node --test test/play/dm-seat.test.mjs` | fails |
| M2 | `canSeat` ignores the role (`source.role === "operator"` → `true`, table-view.tsx line 61) | `vitest run test/play/table-view.test.tsx` | fails: "the operator on a caught-up live table sees DM seat; others do not" (1 failed, 17 passed) |
| M3 | `shouldResync` ignores `prev.caughtUp` | `node --test test/play/viewer.test.mjs` | fails |
| M4 | `returnInput` sends `{ kind: "human", userId: "x" }` | `vitest run test/play/dm-seat-panel.test.tsx` | fails |

Unmutated baselines: table-view 18/18 and dm-seat-panel 5/5 pass. After restoring, `git status --short` is empty.
