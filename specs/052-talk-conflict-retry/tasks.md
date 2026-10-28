---
description: "Task list for the talk CONFLICT retry fix (TASK-0157)"
---

# Tasks: Talk CONFLICT retry

**Input**: `specs/052-talk-conflict-retry/` (spec.md, plan.md, research.md, data-model.md,
quickstart.md, contracts/gate-api-amendment.md). The operator ruling of 2026-10-27 (Q1 to Q6 at
their recommended defaults; card commit 8a3105a) is quoted in spec.md "Open questions".

**Tests**: required and written first. Phase 1 writes the failing gate-level tests. Phase 2 makes
them pass. In Phases 3 and later, each test task comes before its implementation task and must
fail before that implementation lands.

**Dispatch unit**: each phase is one sonnet implementer dispatch. Run the phases in order:
1, 2, 3, 4, 5.
- Phase 2 needs Phase 1. Phase 3 needs Phase 2: its burst test passes only once the queue exists.
- Phase 4 touches only `specs/029-proposal-gate/contracts/gate-api.md`. It may run beside
  Phase 3.
- Phases 1, 2 and 3 run the DB suites. Never run two of them at once.

**Gate for every code phase** (run before the phase's last commit):
`pnpm lint && pnpm typecheck && pnpm test && pnpm check:boundaries`. Phase 3 also runs
`pnpm ci:check`.

**Database suites**: run on the worktree's own stack.
1. Run `pnpm env:up` if the stack is down.
2. Migrate both databases by hand (fresh stacks come up unmigrated, TASK-0098).
3. Restart the app.
4. Export only `TEST_DATABASE_URL` from the worktree `.env`. Never `source` the whole file.
5. Build the workspace packages once: `pnpm turbo run build --filter=@the-stacks/server^...`.
6. Run the suites with `REQUIRE_DATABASE=1`.
7. Leave the stack up. The orchestrator runs `pnpm env:down`.

**Known flakes**: the WebSocket gateway integration tests flake. DB scene and playtest tests can
hit the 5 s timeout under full-suite load (TASK-0154). Re-run a failing test this feature did not
touch once. Do not fix it. Record each re-run in the phase's commit message.

**Rules for every phase**:
- Follow spec.md and plan.md exactly. A needed deviation is a STOP: report it.
- Add no event type, proposal kind, refusal code, ws frame, frame field, migration or
  dependency. The only new gate surface is `GateDeps.retryDelayMs` (data-model.md).
- Touch only the files plan.md "Files touched" names for the phase.
- Edit frozen contract text only in Phase 4, verbatim from contracts/gate-api-amendment.md.
- Tests use the fake gateway. No paid run.
- UI: no modals. The only UI change is one label string.
- Never use the backlog MCP tools. Touch no file under `backlog/`.
- No "for now" without a card (decision-0020). Report any deferral as an open question.

**Commits**: one or more per phase. Each message starts with `TASK-0157:` and ends with the
Co-Authored-By trailer. Stage and commit in separate Bash calls with
`git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0157`. Push after each phase.

## Phase 1: Failing gate-level zero-CONFLICT tests (card AC #1)

**Goal**: Tests that fire concurrent writes at one session through the gate, with no socket
latency, and require zero `CONFLICT`. They fail on today's code.

**Independent test**: from `apps/server`,
`REQUIRE_DATABASE=1 npx vitest run test/gate.integration.test.ts -t "per-session ordering"`
fails, and every other gate integration test still passes.

### Tests first

- [x] T001 [US1] In `apps/server/test/gate.integration.test.ts`, add a
      `describe.skipIf(!reachable)("gate — per-session ordering", …)` block. Add a local helper
      `talk(text)` that returns
      `{ kind: "talk", talk: { text, channel: "ooc", characterId: null } }`. Add a helper
      `burst(gate, sessionId, senders, perSender, inFlight)`. It runs `senders` loops at once.
      Each loop sends `perSender` talk lines through `gate.handle` with a distinct human player
      proposer, `inFlight` lines at a time (`Promise.all` per group). It returns
      `{ ok, conflicts, other }` counts.
- [x] T002 [US1] In the same block, add the test "3 senders × 5 lines, one in flight each:
      every line lands, zero CONFLICT". Assert 15 ok and 0 conflicts. Read the session with
      `readFrom` and assert 15 `talk` rows with `seq` 1 to 15 and 15 distinct texts. Run the
      burst 20 times on 20 fresh sessions in one test (SC-001). Raise the test timeout to 30 s.
- [x] T003 [US1] Add the test "3 senders × 5 lines, all in flight at once: zero CONFLICT".
      Assert 15 ok, 0 conflicts and 15 rows.
- [x] T004 [US1] Add the test "5 senders × 20 lines into a 500-event log: zero CONFLICT"
      (SC-002). Prefill the session with one `appendSessionEvents` call of 500 public `talk`
      rows. Assert 100 ok, 0 conflicts and 600 rows in total.
- [x] T005 [US1] Add the test "recordPresence interleaved with talk: zero CONFLICT" (FR-002).
      Run a 3 × 5 burst and, at the same time, 5 `gate.recordPresence(sessionId,
      { purpose: "director" })` calls. Assert every result is ok and the log holds 20 rows.
- [x] T006 [US1] Add the test "sessions do not wait for each other" (FR-003). Build one gate
      with an injected `appendSessionEvents` seam that blocks session A's first append on a
      promise the test controls and passes every other call through. Start a write to A, then
      a write to B. Assert B resolves ok while A is still blocked. Release A and assert it
      resolves ok.
- [x] T007 [US1] Add the test "a thrown error ends that write only" (FR-004). Inject a seam
      that throws `new Error("boom")` on its first call only. Start two writes to one session at
      once. Assert the first rejects with "boom" and the second resolves ok.
- [x] T008 [US1] In the existing `describe("gate — sequence conflicts")` block, add the test
      "waits between attempts, never after the last" (FR-005). Pass
      `retryDelayMs: (attempt) => { calls.push(attempt); return 0; }`. With `conflicting(2)`
      assert `calls` equals `[1, 2]` and the result is ok. With `conflicting(3)` assert
      `calls` equals `[1, 2]` and the refusal is `CONFLICT`.
- [x] T009 [US1] Run the file. Record in the commit message which tests fail and their
      `conflicts` counts. T002–T004 and T008 must fail. T005–T007 may pass on today's code;
      record which. Every pre-existing test must pass. Commit the failing tests as
      "TASK-0157: Phase 1 — failing per-session ordering tests".

**Checkpoint**: the failing tests are committed and pushed. No source file changed.

## Phase 2: Per-session queue and jittered retry (card AC #1)

**Goal**: The gate runs each session's writes one at a time, keeps the guard, and waits
10–50 ms between attempts. Phase 1's tests pass.

**Independent test**: from `apps/server`,
`REQUIRE_DATABASE=1 npx vitest run test/gate.integration.test.ts` passes in full.

### Implementation

- [x] T010 [US1] In `apps/server/src/gate/gate.ts`, add
      `retryDelayMs?: (attempt: number) => number` to `GateDeps` with a doc comment. Default it
      in `createGate` to `() => 10 + randomInt(0, 41)`.
- [x] T011 [US1] In `run` and in `recordPresence`, after a `SeqConflictError` on attempt `n`
      with `n < MAX_ATTEMPTS`, await a sleep of `retryDelayMs(n)` ms, then continue. Do not
      wait after the last attempt. Keep `MAX_ATTEMPTS = 3` and the `CONFLICT` message unchanged.
- [x] T012 [US1] In `createGate`, add a private `Map<string, Promise<void>>` of queue tails and
      a function `inOrder<T>(sessionId, fn: () => Promise<T>): Promise<T>` per research.md R2.
      Chain with `prev.then(fn, fn)`. Store `next.then(noop, noop)` as the tail. Delete the map
      entry when the finished tail is still the current one.
- [x] T013 [US1] Wrap the body of `recordPresence` and both `run(...)` calls (in `submit` and
      `handle`) in `inOrder`. Keep schema parsing outside the queue, so an `INVALID_PROPOSAL`
      refusal never waits. Keep the `onAppended` calls inside the queued unit.
- [x] T014 [US1] Confirm nothing inside a queued write awaits a gate write for the same
      session. Grep every `onAppended(` listener and `apps/server/src/dm/worker.ts`. Record the
      finding in the commit message. A listener that awaits a gate write is a STOP: report it.
- [x] T015 [US1] Run the gate integration suite. Every test passes, Phase 1's included. Run the
      phase gate. Commit as "TASK-0157: Phase 2 — per-session gate queue and jittered retry".
- [x] T016 [US1] Mutation check, after the T015 commit. Temporarily change the body of `inOrder`
      to `return fn();`. Run
      `REQUIRE_DATABASE=1 npx vitest run test/gate.integration.test.ts -t "per-session ordering"`
      and confirm at least T002 or T003 fails with a nonzero `conflicts` count. Restore the file
      with `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0157 checkout -- apps/server/src/gate/gate.ts`.
      Re-run the block and confirm it passes.
- [x] T017 [US1] Run `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0157 diff`
      and confirm it is empty. Report the mutation run's failing tests and counts, and the
      restored run's result, in the phase report. Push.

**Checkpoint**: the gate suite is green, and the mutation check is recorded.

## Phase 3: WebSocket burst test, resend workaround removed, client label (card AC #1)

**Goal**: Over the real WebSocket gateway, 3 concurrent senders see no `CONFLICT`, and the test
no longer hides one. A `CONFLICT` that reaches the play client reads in plain words.

**Independent test**: from `apps/server`,
`REQUIRE_DATABASE=1 npx vitest run test/ws.integration.test.ts` passes 26/26; from `apps/web`,
`node --test test/play/reduce-frame.test.mjs` passes.

### Tests first

- [x] T018 [US1] In `apps/server/test/ws.integration.test.ts`, remove the resend branch from
      `sendTalkAndAwait`. On an `error` frame of any code, clear the timer, detach the listener
      and reject with an error naming the code and the text. Delete the `conflictRefusals`
      counter and its `afterAll` warning. Update the helper's doc comment to say a refusal
      fails the test (TASK-0157).
- [x] T019 [US1] In the same file, inside the US1 fan-out describe, add the test "T012b: three
      senders with every line in flight — no CONFLICT, each line once (TASK-0157)". Connect 3
      senders and 2 subscribers to one session. Each sender sends 5 talk lines at once without
      awaiting echoes. Collect every frame each sender receives. Assert no sender received an
      `error` frame. Assert each subscriber received 15 events with seqs 1 to 15 and 15
      distinct texts, in the same order on both.
- [x] T020 [P] [US1] In `apps/web/test/play/reduce-frame.test.mjs`, add a test: an `error` frame
      with `code: "CONFLICT"` and `kind: "internal"` sets `notice` to
      "The table was busy, so your line was not sent. Send it again. (CONFLICT)". Run it and
      confirm it fails.

### Implementation

- [x] T021 [US1] In `apps/web/app/play/labels.ts`, add
      `CONFLICT: "The table was busy, so your line was not sent. Send it again."` to
      `REFUSAL_LABEL`. Change the `refusalLabel` doc comment from "a floor refusal code" to
      "a refusal code". Run T020; it passes.
- [x] T022 [US1] Run `ws.integration.test.ts` (26/26) and confirm no CONFLICT warning prints.
      Run `pnpm bench:load run --tier commit --case concurrency-smoke --no-save` and confirm
      `PASS` with 0 errors. Record `wsRtP95` in the commit message (SC-003).
- [x] T023 Run the phase gate and `pnpm ci:check`. Commit as "TASK-0157: Phase 3 — WebSocket
      burst test, resend workaround removed, CONFLICT label".

**Checkpoint**: WebSocket, bench and web tests are green; no test resends on `CONFLICT`.

## Phase 4: Gate contract amendment (card AC #2)

**Goal**: The frozen gate contract states the ordering and retry policy.

**Independent test**: `specs/029-proposal-gate/contracts/gate-api.md` holds the step 7 edit
and the TASK-0157 amendment block exactly as contracts/gate-api-amendment.md gives them.

- [ ] T024 [US2] In `specs/029-proposal-gate/contracts/gate-api.md`, replace step 7 of
      "Algorithm (one attempt)" with the text in contracts/gate-api-amendment.md, Edit 1.
- [ ] T025 [US2] Insert the amendment block from contracts/gate-api-amendment.md, Edit 2,
      directly after the TASK-0049 amendment block. Add, as its last line, "Amended 2026-10-27
      (TASK-0157), operator ruling: \"TASK-0157: I accept the recommended defaults Q1 to Q6,
      including the per-session gate queue, the jittered retry and the 029 gate-api
      amendment.\"".
- [ ] T026 [US2] Confirm every rule in the block has a test: per-session order (T002–T005),
      parse first (existing "entry parsing" tests), isolation (T006, T007), retry bound and wait
      (T008, existing conflict tests), wire unchanged (T019). List the mapping in the commit
      message. Confirm `specs/029-proposal-gate/contracts/ws-delivery.md` is unchanged.
- [ ] T027 Commit as "TASK-0157: Phase 4 — gate-api ordering and retry amendment".

**Checkpoint**: the contract is amended; no other frozen file changed.

## Phase 5: Wiki re-ground and runbook rows (card AC #1, AC #2)

**Goal**: The grounding wiki describes the merged behaviour with honest re-pins, and the sweep
runbook records this task.

**Independent test**: the freshness gate prints `OK`, and the spec-bridge check exits 0.

- [ ] T028 Run `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0157 fetch origin`
      and merge `origin/main` into the branch (no rebase). Resolve any conflict in favour of the
      superset.
- [ ] T029 Run the `grounding-wiki:wiki-update` plan. Classify each note whose sources changed
      as RE-PIN-ONLY or NEEDS-REVIEW against `git diff <old-pin>..HEAD -- <sources>`.
- [ ] T030 NEEDS-REVIEW `docs/wiki/proposal-gate.md`: rewrite the **Concurrency** paragraph
      (per-session order, parse first, 3 attempts with a 10–50 ms jittered wait, `CONFLICT` only
      from an outside writer, no re-entry). Delete the "Known behaviour … carded TASK-0157"
      line. Re-pin it.
- [ ] T031 NEEDS-REVIEW `docs/wiki/websocket-gateway.md`: the `internal` / `CONFLICT` sentence
      now says when it can still occur. Re-pin it.
- [ ] T032 NEEDS-REVIEW `docs/wiki/play-route.md`: `refusalLabel` covers `CONFLICT`. Re-pin it.
- [ ] T033 Review `docs/wiki/presence.md` (`recordPresence` now joins the order) and
      `docs/wiki/test-suite.md` (the resend helper is gone; the gate ordering tests exist).
      Amend prose where behaviour changed, then re-pin each whose sources changed.
- [ ] T034 Regenerate `docs/wiki/CAPSULES.md` if any `description:` changed. Add one sentence to
      the `docs/wiki/INDEX.md` state paragraph: the gate orders each session's writes in process
      and retries outside conflicts with a jittered wait (TASK-0157, specs/052).
- [ ] T035 In `docs/design/m3-table-sweep-runbook.md` "Execution log": fill TASK-0143's row
      (PR `[#76](https://github.com/evanstern/the-stacks/pull/76)`, merge `b983945`), replacing
      its "(this PR)" and "—". Add a row:
      `| 2026-10-27 | TASK-0157 | (this PR) | — | spec (opus ×2), impl ×4 + wiki (sonnet) | Gate orders each session's writes in process (handle, submit, recordPresence); 3 attempts with a 10–50 ms jittered wait for outside writers; ws resend workaround removed; CONFLICT label in the play client; frozen 029 gate-api amended as ruled. |`
- [ ] T036 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
      (it must print `OK`). Run
      `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`
      (it must exit 0). Commit as "TASK-0157: Phase 5 — wiki re-ground and runbook rows".

**Checkpoint**: the wiki is fresh, the bridge is clean, and the runbook names this PR.

## Dependencies

- Phase 1 → Phase 2. Phase 2 makes Phase 1's tests pass.
- Phase 2 → Phase 3. T019 passes only with the queue.
- Phase 4 can run beside Phase 3 (disjoint files).
- Phases 1 to 4 → Phase 5.
- Within Phase 1, T001 comes first; T002–T008 share one file, so write them in order.

## Parallel opportunities

- T020 (web test) can be written beside T018–T019 (server tests).
- Phase 4 beside Phase 3.

## Story map

| Story | Card AC | Phases |
|---|---|---|
| US1 three players talk at once and every line lands | #1 | 1, 2, 3, 5 |
| US2 the retry policy is written in the gate contract | #2 | 4, 5 |

## Requirement coverage

| Requirement | Tasks |
|---|---|
| FR-001 | T002–T004, T012–T013, T016 |
| FR-002 | T005, T013 |
| FR-003 | T006, T012 |
| FR-004 | T007, T012 |
| FR-005 | T008, T010–T011 |
| FR-006 | T019, T022 |
| FR-007 | T002–T005 |
| FR-008 | T018, T022 |
| FR-009 | T024–T026 |
| FR-010 | T019, T026 |
| FR-011 | T020–T021 |
| CR-001, CR-002 | T013, T014 |

## Implementation strategy

The MVP is Phases 1 and 2: they remove the refusal at its source. Phase 3 proves it end to end
and removes the workaround. Phase 4 satisfies AC #2. Phase 5 re-grounds the wiki and records the
task.
