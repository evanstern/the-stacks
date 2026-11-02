# Tasks: DM maxTokens headroom and a truncated call outcome

**Input**: `specs/067-dm-maxtokens-headroom/` (spec.md, plan.md). Plan research R1 to R4 settle
every choice; read them before starting a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order.

**Gates for every phase**: run `pnpm install --frozen-lockfile` in a fresh worktree first.
`pnpm ci:check` is green before the phase commits.

## Phase 1: Defaults with thinking headroom (card AC #1, User Story 1)

**Goal**: every documented and code-default `dm.*` cap is 4000, with the reason stated.

**Independent test**: the budget test passes with the new default, and both docs name 4000 and
the reason.

- [X] T001 [P] [US1] In `.env.example`, set `maxTokens` to 4000 for all seven `dm.*` entries in the
      DM `AI_PURPOSES` example line. Above it, add a comment: hidden thinking on routed models
      counts against `maxTokens`; 1200 truncated interpret in alpha run 3; a cap is a ceiling,
      not a spend.
- [X] T002 [P] [US1] In `docs/ops/dev-vm-104.md`, add a "Model budget" section after "Secrets".
      State 4000 for every `dm.*` purpose and the same reason. Write it in simplified technical
      English. Do not change vm-104 itself.
- [X] T003 [US1] In `apps/server/src/dm/purposes.ts`, set every `PURPOSE_MAX_TOKENS` value to
      4000. Rewrite the doc comment to give the reason and point to `.env.example`.
- [X] T004 [US1] In `apps/server/test/playtest/budget.test.ts`, change the purpose-default
      assertion for `dm.director` from 600 to 4000. Fix any other assertion that pinned an old
      default.
- [X] T005 [US1] Run `pnpm ci:check`. Commit as `TASK-0192 phase 1: dm.* maxTokens headroom`.

## Phase 2: The truncated outcome (card AC #2, #3, User Story 2)

**Goal**: an attempt whose output hit the cap and could not be used is recorded as `truncated`.

**Independent test**: T013 passes over the real gateway and the fake provider.

- [X] T006 [US2] In `apps/server/src/ai/types.ts`, add `truncated?: boolean` to `UsageSummary`
      and `truncated: boolean` to `UsageRecord`, each with a one-line doc comment.
- [X] T007 [US2] In `apps/server/src/ai/adapters/openai-compatible.ts`, set `truncated: true` on
      the terminal event's usage when any chunk carried `finish_reason: "length"`. Keep the flag
      when a later `chunk.usage` replaces `usage`.
- [X] T008 [US2] In `apps/server/src/ai/gateway.ts` `chat()`, set `record.truncated` to true when
      `usage.truncated` is true, or when `purpose.maxTokens` is set and `usage.outputTokens >=
      purpose.maxTokens`. Else false. In `embed()`, record `truncated: false`.
- [X] T009 [US2] In `apps/server/src/dm/pipeline/context.ts`, add `"truncated"` to
      `ModelCallRecord.outcome`.
- [X] T010 [US2] In `apps/server/src/dm/pipeline/call.ts`, apply plan R3. In `callJson`, a failed
      parse settles `truncated` when `usage?.truncated` is true, else `invalid-json`. In
      `callText`, a truncated call settles `truncated`, else `ok`. Errors and aborts are unchanged.
      The repair re-ask still runs after a truncated attempt.
- [X] T011 [US2] In `apps/server/src/schema/dm-model-calls.ts`, add `'truncated'` to
      `dm_model_calls_outcome_valid`. Update the doc comment if it lists outcomes. Run
      `pnpm --filter @the-stacks/server db:generate`. Commit the generated `0008_*.sql`,
      `meta/0008_snapshot.json` and `meta/_journal.json` as generated. Never hand-edit the
      journal. If `origin/main` already holds an `0008`, merge it in and regenerate.
- [X] T012 [P] [US2] In `apps/web/app/debug/api-types.ts`, add `"truncated"` to
      `DebugCall.outcome`. In `specs/037-debug-api/contracts/debug-api.md`, add `"truncated"` to
      both outcome unions with a note citing TASK-0192.
- [X] T013 [US2] **Merge condition.** In `apps/server/test/ai.gateway.test.ts` or a new
      `apps/server/test/dm/truncated.test.ts`, build the real gateway over a `FakeProvider` with a
      `dm.interpret` purpose at `maxTokens: 1200`. Script a reply with no JSON whose `done` usage
      has `outputTokens: 1200`. Call `callJson` with a `recordCall` spy. Assert the attempt's
      recorded outcome is `truncated`. Assert a second scripted reply at 1199 tokens with no JSON
      records `invalid-json`.
- [X] T014 [P] [US2] Add unit tests. In `apps/server/test/ai.gateway.test.ts`: the record's
      `truncated` is true at the cap, false below it, false with no `maxTokens`. In
      `apps/server/test/ai.openai-compatible.test.ts`: `finish_reason: "length"` sets
      `usage.truncated`. In `apps/server/test/dm/call.test.ts`: a truncated reply that parses
      records `ok`; a truncated `callText` records `truncated`; an error stays `error`. Add
      `truncated: false` to the `UsageRecord` fixtures in `apps/server/test/ai.usage.test.ts` and
      `apps/server/test/dm/call.test.ts`.
- [X] T015 [US2] In `apps/server/test/dm/model-calls.integration.test.ts`, assert a row with
      outcome `truncated` inserts and reads back. Run it with `REQUIRE_DATABASE=1` on the
      worktree's own stack: `pnpm env:up`, migrate both databases by hand, then run the suite
      with only `TEST_DATABASE_URL` exported. Leave the stack up.
- [X] T016 [US2] Run `pnpm ci:check`. Commit as `TASK-0192 phase 2: truncated call outcome`.

## Phase 3: Wiki re-ground

**Goal**: the corpus describes the new caps, the flag, the outcome and migration 0008.

- [ ] T017 Re-ground `docs/wiki/ai-gateway.md`, `debug-view.md`, `database-schema.md`,
      `migrations.md`, `hosted-dev.md` and `configuration.md` (NEEDS-REVIEW) against the diff.
      Re-pin each honestly.
- [ ] T018 Re-pin any other note the freshness gate flags because its sources changed (expected:
      `dm-runtime`, `dm-turn-jobs`, `dm-failure-and-gates`, `playtest-harness`). Review each
      against the diff before re-pinning.
- [ ] T019 Update the `docs/wiki/INDEX.md` state paragraph with one sentence for TASK-0192.
      Regenerate `docs/wiki/CAPSULES.md` if any `description:` changed.
- [ ] T020 Run the wiki freshness gate (`OK`), the spec-bridge check (exit 0) and `pnpm ci:check`.
      Commit as `TASK-0192 phase 3: wiki re-ground`.

## Dependencies

- Phase 1 and Phase 2 share no file. Phase 2 may start before Phase 1 merges into the branch.
- Phase 3 after Phases 1 and 2.
- Within Phase 2: T006 before T007 and T008; T009 before T010; T008 and T010 before T013.

## Card acceptance criteria map

| Card AC | Tasks |
|---|---|
| #1 | T001 to T005 |
| #2 | T006 to T012, T015 |
| #3 | T013, T014 |
