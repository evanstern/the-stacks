# Phase 6 verification (T049-T051), TASK-0199

## T049 DB suites (REQUIRE_DATABASE=1, TEST_DATABASE_URL only, worktree stack task-0199)

| Suite | Files | Tests |
|---|---|---|
| `packages/session-model` | 35 passed | 1035 passed |
| `apps/server test/gate` | 6 passed | 62 passed |
| `apps/server test/dm` | 104 passed | 1167 passed |

No flake failed.

## T050 mutation guard (plan D5)

Failing tests per stub: session-model suite, and server `test/dm` + `gate.intent.integration` + `write-boundary`.

| Stub | session-model | server | Total failing |
|---|---|---|---|
| `readablePosts` returns `[]` | 9 | 0 | 9 |
| `suggestionState` never stale | 5 | 0 | 5 |
| accept acceptor rule passes | 2 | 0 | 2 |
| `interruptRead` returns null | 0 | 2 | 2 |
| enqueue rule 9 queues nothing | 0 | 3 | 3 |

Every stub fails at least one test. Each stub was restored with `git checkout`; `git status -s` was empty at the end.

## T051 script-mode server check

`DM_FAKE_SCRIPT=greyhollow-confirm` on the worktree app (`stacks-task-0199`, port 3199). Boot log: `DM script mode: greyhollow-confirm (6 calls, 0 dice)`. A local operator was created in the worktree's own database. Session `2c0c7b34-7d76-491f-86ba-e5d0296b05dc`, Tamsin seated to the operator. Posts used `post.mjs` and `accept.mjs`. No provider call; no credential printed.

| Expected | Observed |
|---|---|
| Scene start, scripted narration | (first run) seq 15 `narration`; `turn` job `scene-start` succeeded |
| `say` Intent queues a `talk` turn at ts + 10 s | seq 17/18; `talk` job `notBefore` = 05:08:24.025Z, ts 05:08:14.025Z |
| Second post moves it | `One.` queued `notBefore` 05:10:12.946Z; `Two.` (3 s later) moved the same job to 05:10:16.219Z; one queued job |
| `read` marker | seq 19 `presence.recorded` purpose `read` |
| One `action.suggested`, `declared` `hide` item | seq 20, item `i1`, `commit: declared`, `source: ai`, `readSeq` 17 |
| `action.accept` appends engine rows and `intent.recorded` | seq 21 `dice.rolled`, 22 `check.resolved` (stealth, total 21, DC 15), 23 `intent.recorded` |
| One `intent` turn narrates them | `intent` job succeeded; seq 25 `narration` |
| `ask_dm` visible to asker and DM only | seq 26 `talk` and seq 27 `intent.recorded` carry visibility = Tamsin's user id; not public |
| `ask_dm` draws one answer visible to asker and DM only | Re-run after F1 (session `023a7b9c-3051-4a0d-8d50-3d3da3381e94`): seq 26 `talk` and 27 `intent.recorded` (visibility = Tamsin's user id), then seq 28 `read` marker and seq 29 `talk` answer, same visibility, not public. The `talk` job ended `empty-beat`: one answer, no public row. |
| Turn mode: no `talk` turn | NOT RUN here (covered by unit and integration tests) |
| Human seat: no `talk` turn | NOT RUN here (covered by unit and integration tests) |

### Finding F1: script call order (FIXED)

`greyhollow-confirm.json` had no call for the rule 9 `intent` turn's `dm.narrate`. That turn took the `ask_dm` answer call, so the first run showed raw reaction JSON at seq 25 and a `narrate: gateway` failure at seq 29. Those first-run rows are superseded. The fix adds one plain-text `dm.narrate` entry (7 calls) between the `confirm` and `answer` calls, and amends the `dm-scripts.test.ts` order pin. Re-run sequence on session `023a7b9c-...`: seq 17/18 `say`; 19 `read`; 20 `action.suggested`; 21-23 engine rows and `intent.recorded`; seq 25 narration is the plain `intent` text; 26/27 `ask_dm`; 29 the answer.
