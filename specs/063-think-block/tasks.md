# Tasks: DM calls survive a leading think block

**Input**: `specs/063-think-block/` (spec.md, plan.md, research.md, contracts/think-strip.md,
quickstart.md)

**Board task**: TASK-0181. Card AC #1: the cause is identified and recorded on the card. Card
AC #2: DM calls parse a think-prefixed reply, or the source stops emitting it. Card AC #3: a
test covers a leading empty and a non-empty think block. Card AC #4: a hosted-dev turn after
deploy shows no invalid-json attempts.

**Prerequisites**: the operator rules OQ-1 to OQ-4 (spec.md). The tasks implement (a) for each.
A different ruling amends the contract and these tasks before Phase 1 dispatches.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and
the branch commits. Tasks marked **[orchestrator]** are run by the orchestrator. Work only in
`/Users/evanstern/projects/the-stacks/.worktrees/task-0181`. A fresh worktree runs
`pnpm install --frozen-lockfile` first. Each implementer phase ends with `pnpm ci:check` green
and one commit led by `TASK-0181:`. Tests use the fake gateway only; make no paid model call.
Do not change `apps/server/src/ai/`, the `ws-protocol` frames, `specs/029-proposal-gate/contracts/`
or `specs/030-play-route/contracts/proposal-seam.md`. Tests are written first and seen to fail.

**Order**: Phases 1–4 land before the PR. Phase 3 runs beside Phase 1 under the operator's go.
Phase 5 runs after merge and deploy, so it follows the wiki phase in time.

## Phase 1: Strip leading think blocks (card AC #2, #3; US1)

**Goal**: `callJson` accepts a think-prefixed reply on attempt 1, and `callText` returns prose
without the block (contracts/think-strip.md).

**Independent test**: `pnpm --filter @the-stacks/server exec vitest run test/dm/call.test.ts`.

- [ ] T001 [US1] In `apps/server/test/dm/call.test.ts`, add a `describe("stripThink")` block:
      `<think></think>{"a":1}` gives `{"a":1}`; `<think>step one\nstep two</think>\n\n{"a":1}`
      gives `{"a":1}`; leading whitespace before the block is stripped; two leading blocks are
      both stripped; `{"a":"<think>x</think>"}` is unchanged; an unclosed
      `<think>reasoning {"a":1}` is unchanged; plain `{"a":1}` is unchanged;
      `<think></think>` alone gives `""`. Import `stripThink` from `../../src/dm/pipeline/call.js`.
- [ ] T002 [US1] In the same file's `describe("callJson")`, add three cases on the existing fake
      gateway helpers: (a) the reply `<think></think>` plus valid JSON returns `ok` with one
      call record, `attempt: 1`, `outcome: "ok"`, and no second gateway call; (b) the same with
      a non-empty block `<think>The player wants to search.</think>` returns `ok` on attempt 1;
      (c) a fenced body after the block (`<think></think>\n```json\n{...}\n```) returns `ok`.
- [ ] T003 [US1] In the same file, add: (a) a think-only first reply `<think></think>` then a
      valid second reply gives `invalid-json` then `ok`; the re-ask's `assistant` message is the
      raw `<think></think>`, and the first attempt's issue contains
      `the reply held only a think block`; (b) two think-only replies give `invalid-output`
      whose `attempts[0].excerpt` is the raw `<think></think>`; (c) `callText` with the reply
      `<think>plan</think>\nThe door creaks.` returns `The door creaks.`.
- [ ] T004 [US1] Run the file. See T001–T003 fail (`stripThink` is not exported; the parse
      rejects the block).
- [ ] T005 [US1] In `apps/server/src/dm/pipeline/call.ts`, add and export `stripThink(text)`:
      `text.replace(/^(?:\s*<think>[\s\S]*?<\/think>)+\s*/, "")`. In `parseAgainst`, compute
      `const body = stripThink(text)`; when `body.trim() === ""` and `body !== text`, return
      `{ ok: false, issues: "not valid JSON: the reply held only a think block" }`; else parse
      `stripFence(body)`. In `callText`, return `stripThink(result.text)` as `text`. Keep the raw
      `first.text` in the re-ask message and in `attemptOf`. Update the doc comment on
      `stripFence`'s neighbour to name the order: think, then fence.
- [ ] T006 [US1] In `specs/031-dm-runtime/contracts/node-seam.md`, under "Model calls", add the
      line `Amended by specs/063-think-block/contracts/think-strip.md.` after the existing
      "Amended by" lines.
- [ ] T007 [US1] Run the file green, then `pnpm ci:check` green. Commit
      `TASK-0181: strip leading think blocks before the DM parse`.

## Phase 2: Mutation guard **[orchestrator]** (card AC #3)

- [ ] T008 **[orchestrator]** Make `stripThink` return its input unchanged. Run
      `test/dm/call.test.ts`. Expect T001 (except the unchanged-input cases), T002 and T003 red.
      Revert. Run again green. Record both runs, with the failing test names, in
      `specs/063-think-block/evidence/mutation-guard.md`. Commit it.

## Phase 3: Cause probe and source fix **[orchestrator]**, operator's go (card AC #1, #2; US2)

Runs beside Phase 1. Each vm-104 command needs the operator's go on its exact text. The probe
makes two short subscription-backed calls; ask the operator to confirm that spend on the card.

- [ ] T009 **[orchestrator]** Run probe P1 and P2 from `quickstart.md` §Probe on vm-104, each
      on the operator's go. Never print the key.
- [ ] T010 **[orchestrator]** Write `specs/063-think-block/evidence/probe.md`: for P1 and P2,
      where `<think>` arrives, the visible text, `usage.completion_tokens`, `finish_reason`,
      and the router version if shown. Update research.md R1's confidence column from the
      result. Commit both.
- [ ] T011 **[orchestrator]** Record the cause on the card with
      `backlog task edit TASK-0181 --append-notes` from this worktree. Tick card AC #1.
- [ ] T012 **[orchestrator]** With the operator, pick the source fix (research R7): (1) thinking
      off on the 9router `cc/` routes on vm-103, (2) a thinking-off request field, or (3) higher
      `maxTokens` in `/home/stacks/dev/.env`. Options (1) and (3) are operator-run outside the
      repo; record the change and its time in `evidence/probe.md`. Option (2) is a gateway code
      change: card it as a follow-up task, ordered before TASK-0163 run 3. It does not ride this
      branch.

## Phase 4: Wiki **[orchestrator]** (re-ground)

- [ ] T013 **[orchestrator]** Update `docs/wiki/dm-runtime.md`: the `callJson`/`callText`
      paragraph names the parse order (think strip, fence strip, parse, normalize, schema) and
      that excerpts keep raw text. Re-pin.
- [ ] T014 **[orchestrator]** Update `docs/wiki/dm-failure-and-gates.md`: a think-only reply's
      issue string, and that excerpts carry the raw think block. Re-pin.
- [ ] T015 **[orchestrator]** Update `docs/wiki/ai-gateway.md`: the adapter reads only
      `delta.content`, so a router that renders thinking as `<think>` text passes it through;
      the DM strips it in `call.ts` (link [[dm-runtime]]). Mark the note NEEDS-REVIEW if the
      Phase 3 result is not yet in. Re-pin.
- [ ] T016 **[orchestrator]** Re-verify `docs/wiki/debug-view.md` against the `call.ts` diff
      (`dm_model_calls` is unchanged) and re-pin honestly.
- [ ] T017 **[orchestrator]** Refresh the `dm-runtime` and `dm-failure-and-gates` entries in
      `docs/wiki/CAPSULES.md` and the `[[dm-runtime]]` line in `docs/wiki/INDEX.md` only if
      their text changed. Run the freshness gate
      (`node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`)
      and see `OK`. Commit.

## Phase 5: Hosted-dev check after deploy **[orchestrator]**, operator's go (card AC #4; US3)

Runs after the PR merges and CI deploys `main` to vm-104.

- [ ] T018 **[orchestrator]** Run `curl -s https://vm-104.tailb3c1b6.ts.net:8443/health`. Confirm
      `commit` equals the merge commit on `main`. Record it.
- [ ] T019 **[orchestrator]** With the operator, play one hosted-dev turn: commit one player
      action at a table and wait for its turn job to finish.
- [ ] T020 **[orchestrator]** In Brave, open `play/:sessionId/debug`, then the Ledger slide-out.
      Confirm every call row for that turn job has `callAttempt` 1 and `outcome` `ok`, and no
      row has `invalid-json`. Record the job id, the rows, the turn time and the cost in
      `specs/063-think-block/evidence/hosted-check.md`, commit it on `main` by the board track,
      and tick card AC #4.

## Dependencies

- Phase 1 blocks Phase 2 and Phase 4.
- Phase 3 is independent of Phase 1 and can run beside it. Its source fix must be live before
  Phase 5.
- Phase 5 needs the merge, the deploy and the Phase 3 source fix.

## Implementation strategy

Phase 1 alone fixes every think-plus-JSON reply (the 00:59 case). Phase 3 fixes think-only
replies (the 00:50–00:53 case). Both are needed for AC #4.
