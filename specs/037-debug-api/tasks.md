---
description: "Task list for the debug API and persisted model-call usage (TASK-0116)"
---

# Tasks: Debug view card A — operator debug API and persisted model-call usage

**Input**: `specs/037-debug-api/` — spec.md, plan.md, research.md, data-model.md,
contracts/debug-api.md, quickstart.md.

**Tests**: required. Every card AC and the runbook merge condition is proven by a named test.

**Dispatch unit**: one phase is one implementer dispatch (sonnet). Run phases in order:
1, 2, 3, 4. Each dispatch re-grounds from this spec dir and the branch's commits.

**Gate for every phase** (run before the phase's commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/server test && pnpm check:boundaries`.
Phase 4 also runs `pnpm ci:check`.

**Database suites** (Phases 2–4): run on the worktree's own stack. Run `pnpm env:up`. Migrate
both databases by hand; fresh stacks come up unmigrated (TASK-0098). Pass the app database URL
as `TEST_DATABASE_URL` (`apps/server/scripts/migrate.ts` prefers it). Restart the app. Run the
suites with `REQUIRE_DATABASE=1`. Leave the stack up.

**Known flake**: WebSocket gateway integration tests flake. Re-run once on an unrelated failure.
Do not fix them. Record each re-run in the phase's commit message.

**Rules for every phase**: store and serve no prompt or completion text. Do not change the socket,
`viewerFor`, or a frozen contract. Do not change the `GET /dm/sessions/:id/turns` response. Add
no dependency. Never hand-edit `apps/server/drizzle/meta/_journal.json`. Use the fake gateway
only. Never read or print a key.

**Commits**: one or more per phase, each message led by `TASK-0116:`.

## Format: `[ID] [P?] [Story] Description`

## AC coverage map

| Card AC | Proven by |
|---|---|
| #1 usage fields on callJson, callText, companion, chronicle | T004, T005, T012, T013, T017 |
| #2 no prompt or completion text | T006, T014, T025 |
| #3 full event log after a seq, all visibilities, paginated | T022 |
| #4 jobs with full input and result | T015, T023 |
| #5 scene seed, DM-only facts included | T019, T024 |
| #6 403 non-operator, 401 unauthenticated | T021 |
| #7 `/turns` contract unchanged | T026 |
| #8 contracts and wiki updated, re-pinned | T027, T030–T037 |
| Runbook merge condition: each call in a full fake-gateway turn persists its usage row | T013 |

---

## Phase 1: Usage capture at the gateway and the call helpers (US1; AC #1, #2) — DISPATCH (sonnet)

**Goal**: every `ModelCallRecord` the call helpers build carries the gateway's usage, and the
helpers hand each attempt to an optional `recordCall` seam. No database.

**Independent test**: `call.test.ts` and `ai.gateway.test.ts` pass with the new assertions.

- [x] T001 [US1] Add `onUsage?: (r: UsageRecord) => void` to `ChatRequest` in `apps/server/src/ai/types.ts`, with a doc comment: called once per call that emits a usage record (research R2).
- [x] T002 [US1] In `apps/server/src/ai/gateway.ts` `chat()`, build the `UsageRecord` once in `finally`, pass it to `sink.record`, then to `req.onUsage` when set. A throwing `onUsage` must not break the stream: catch and ignore it. The unknown-purpose path calls neither.
- [x] T003 [US1] In `apps/server/src/dm/pipeline/context.ts`, add `provider`, `model`, `inputTokens`, `outputTokens`, `costUsd`, `durationMs` (each `T | null`) to `ModelCallRecord`. Add `RecordedCall` (data-model.md). Add `recordCall?: (call: RecordedCall) => Promise<void>` to `NodeDeps`.
- [x] T004 [US1] In `apps/server/src/dm/pipeline/call.ts`, pass an `onUsage` that captures the record in `collect()`. Fill the six fields on every pushed record (ok, invalid-json, error). Use `null` for each field when no record arrived. After each attempt, await `deps.recordCall?.(…)` with the record plus `httpAttempts`. On an abort, record `outcome: "aborted"` and keep today's behavior of pushing nothing to `calls`. Widen the `deps` Pick to include `recordCall`.
- [x] T005 [P] [US1] Extend `apps/server/test/dm/call.test.ts`: usage fields on a first-try ok, a repaired invalid-json (two records, two usages), a gateway error; nulls when the fake emits no usage record; `recordCall` receives one call per attempt, including an aborted one; `calls` still omits the aborted attempt.
- [x] T006 [P] [US1] In `apps/server/test/dm/call.test.ts`, assert a `ModelCallRecord` has exactly the documented keys (contracts/debug-api.md) and that no value contains the fake gateway's scripted output text.
- [x] T007 [P] [US1] Extend `apps/server/test/ai.gateway.test.ts`: `onUsage` fires once with an object equal to the sink's record on `done`, on `error`, and on cancel; it does not fire for an unknown purpose; a throwing `onUsage` does not change the events yielded.

**Checkpoint**: gate green; commit `TASK-0116: Phase 1 — gateway onUsage and call-record usage`.

---

## Phase 2: The usage ledger, migration 0005, worker wiring and submission seqs (US1, US3; AC #1, #2, #4; merge condition) — DISPATCH (sonnet)

**Goal**: every DM model call stores one `dm_model_calls` row as it ends. Held turns keep their
calls. Every stored submission names its seqs.

**Independent test**: the full-turn integration test asserts one ledger row per call.

- [x] T008 [US1] Create `apps/server/src/schema/dm-model-calls.ts` per data-model.md (identity `bigint` id, FK to `jobs.id` on delete cascade, checks, two indexes). Export it wherever the other schema modules are collected for drizzle-kit and the db client.
- [x] T009 [US1] Run `pnpm --filter @the-stacks/server db:generate`. Commit the generated `apps/server/drizzle/0005_*.sql`, `apps/server/drizzle/meta/0005_snapshot.json` and the journal entry as generated. Read the SQL and confirm it holds only the table, checks, FK and indexes. Never hand-edit the journal.
- [x] T010 [US1] Create `apps/server/src/dm/model-calls.ts`: `insertModelCall(db, row)`, `listModelCalls(db, sessionId, { after, limit })` returning rows plus `hasMore`, and `modelCallTotals(db, sessionId)` returning `all`, `byPurpose`, `byModel` per contracts/debug-api.md `UsageTotals` (nulls count 0; `unpricedCalls` counts null cost; model key `"<provider>/<model>"` or `"unknown"`).
- [x] T011 [US1] In `apps/server/src/dm/worker.ts`, build one `recordCall` per claimed job binding job id, session id, kind and `job.attempts`. Pass it into the turn `NodeDeps`, `CompanionDeps` and the chronicle deps. It catches an insert error, logs `{ event: "dm.call.record-failed", jobId, purpose }`, and resolves.
- [x] T012 [US1] Add `recordCall?` to `CompanionDeps` (`apps/server/src/dm/companion.ts`) and `ChronicleDeps` (`apps/server/src/dm/chronicle.ts`) and pass it to `callJson`. Give the `held` `TurnOutcome` a `calls` list (`apps/server/src/dm/pipeline/context.ts`, `apps/server/src/dm/pipeline/runner.ts`), and store it in `jobs.result.calls` in `worker.ts` instead of `[]`.
- [x] T013 [US1] **Merge condition.** Extend `apps/server/test/dm/full-turn.integration.test.ts`: after the full fake-gateway turn, the job's `dm_model_calls` rows number exactly the turn's model calls. Each row matches a `jobs.result.calls` entry on purpose, prompt version, attempt, provider, model, tokens, cost and duration. Each row has non-null provider, model and token counts.
- [x] T014 [P] [US1] In `apps/server/test/dm/model-calls.integration.test.ts` (new), assert no ledger column holds text from the fake gateway script, and cover insert, paging by `after`, totals with an unpriced call, and cascade on job delete.
- [x] T015 [US3] Add `seqs: number[]` (the gate result's `events` seqs, ascending; `[]` on refusal) to `Submission` in `apps/server/src/dm/nodes/resolve.ts`; to `TurnCheckpoint.narration` from `submitNarration` (`apps/server/src/dm/jobs.ts`, `apps/server/src/dm/nodes/resolve.ts`); to `CompanionSubmission` in `apps/server/src/dm/companion.ts`; and to `ChronicleResult` in `apps/server/src/dm/chronicle.ts`. A replayed checkpoint submission keeps its stored seqs. Assert each in `apps/server/test/dm/resolve.integration.test.ts`, `companion.integration.test.ts` and `chronicle.integration.test.ts`.
- [x] T016 [P] [US1] Extend `apps/server/test/dm/companion.integration.test.ts` and `chronicle.integration.test.ts`: each job's stored calls carry the six usage fields and have ledger rows.
- [x] T017 [US1] Extend `apps/server/test/dm/worker.integration.test.ts`: a held turn stores its director and resolve calls; a `recordCall` whose insert fails still finishes the job and logs `dm.call.record-failed`; an aborted attempt leaves an `aborted` ledger row and a reclaimed attempt's rows keep their lower `job_attempt`.

**Checkpoint**: gate and database suites green; commit `TASK-0116: Phase 2 — usage ledger, migration 0005, submission seqs`.

---

## Phase 3: The operator debug routes (US2, US3, US4, US5; AC #2–#7) — DISPATCH (sonnet)

**Goal**: four read-only, operator-only routes per contracts/debug-api.md. `/turns` unchanged.

**Independent test**: `routes.integration.test.ts` passes, with the `/turns` assertions untouched.

- [x] T018 [P] [US4] Add `dmOnlySeedPaths(seed): string[]` (JSON Pointers) to `apps/server/src/dm/seed/views.ts`. Re-express `dmOnlySeedText` over it.
- [x] T019 [P] [US4] In `apps/server/test/dm/seed.test.ts`, assert `dmOnlySeedPaths` resolves to exactly the strings `dmOnlySeedText` returns for the shipped seed, and that no path points at a player-facing field.
- [x] T020 [US3] Add `heartbeatAt` to `DmJobRow` and add `listDmJobsPage(db, sessionId, { limit, before })` ordered `(created_at desc, id desc)` in `apps/server/src/dm/jobs.ts`. Leave `listDmJobs` unchanged.
- [x] T021 [US5] In `apps/server/test/dm/routes.integration.test.ts`, assert `401` with no cookie and `403` with a player session for each of `events`, `jobs`, `seed`, `calls`, and that the refusal comes before query validation.
- [x] T022 [US2] Add `GET /sessions/:sessionId/events` to `apps/server/src/routes/dm.ts` (query schema, `readFrom` + `toStoredEvent`, `nextAfter`, `hasMore`, `headSeq`). Test: public and DM rows both return; paging with `limit=2` returns every row once; a poll at the head returns empty with `headSeq`; bad `after`/`limit` is `400`.
- [x] T023 [US3] Add `GET /sessions/:sessionId/jobs` (via `listDmJobsPage`; `DebugJob` per contract; no claim token; `nextBefore`; a foreign `before` id is `400`). Test: a completed, a held and a failed turn return their stored `input` and `result` unchanged; a running turn returns its saved checkpoint; `before` paging has no gap or repeat; no `claimToken` key anywhere.
- [x] T024 [US4] Add `GET /sessions/:sessionId/seed` (`404` with no scene; `409` when the seed fails to load; `{ seedId, seed, dmOnlyPaths }`). Test the three outcomes.
- [x] T025 [US1] Add `GET /sessions/:sessionId/calls` (via `listModelCalls` and `modelCallTotals`). Test: rows after a cursor, totals over the whole session. Then scan every debug response body in the suite for the fake gateway's scripted output text; only the jobs route may contain it, and only inside `result.failure.detail.attempts[].excerpt`.
- [x] T026 [US5] In `apps/server/test/dm/routes.integration.test.ts`, keep every existing `/turns` assertion unchanged, and add one asserting a `/turns` item's `calls` entries still carry exactly `purpose`, `promptVersion` and `outcome`.
- [x] T027 Update contracts: add a "Debug routes" section to `specs/031-dm-runtime/contracts/dm-api.md` that points to `specs/037-debug-api/contracts/debug-api.md` (leave the `/turns` text as is); add the usage fields and `recordCall` to `specs/031-dm-runtime/contracts/node-seam.md`; add `Submission.seqs` to `specs/031-dm-runtime/contracts/resolve.md`; add `onUsage` and its invariant to `specs/011-ai-gateway/contracts/gateway.md`.
- [x] T028 Reconcile `specs/037-debug-api/contracts/debug-api.md` with the code as built. Any shape change needs a note in the phase commit, because TASK-0117 specs against it.
- [x] T029 Run the database suites and the phase gate.

**Checkpoint**: commit `TASK-0116: Phase 3 — operator debug routes and contracts`.

---

## Phase 4: Wiki re-ground and full gate (AC #8) — DISPATCH (sonnet)

**Goal**: the wiki describes the change and every pin is honest.

Classify each staled pin against `git diff <old-pin>..HEAD -- <sources>` as RE-PIN-ONLY or
NEEDS-REVIEW. Amend prose before bumping a NEEDS-REVIEW pin.

- [ ] T030 [P] NEEDS-REVIEW `docs/wiki/dm-turn-jobs.md`: the usage fields in `jobs.result.calls`, held turns keep calls, submission `seqs`, the ledger written per call.
- [ ] T031 [P] NEEDS-REVIEW `docs/wiki/ai-gateway.md`: `ChatRequest.onUsage` beside the sink.
- [ ] T032 [P] NEEDS-REVIEW `docs/wiki/database-schema.md`: the `dm_model_calls` table, its FK, checks and indexes.
- [ ] T033 [P] NEEDS-REVIEW `docs/wiki/migrations.md`: migration 0005 and the regenerate-on-collision rule.
- [ ] T034 [P] Review `docs/wiki/dm-runtime.md` (its `/dm` routes section). Update it if it lists routes; otherwise re-pin only.
- [ ] T035 Create `docs/wiki/debug-view.md`: the four routes, auth, cursors, the job-to-seq link, the ledger as cost authority, what TASK-0117 and TASK-0132 can and cannot use. Pin it to the commit it is verified against.
- [ ] T036 Update `docs/wiki/INDEX.md` (state paragraph and a `[[debug-view]]` entry) and regenerate `docs/wiki/CAPSULES.md` for every changed `description:`.
- [ ] T037 Run `pnpm ci:check`, the database suites, `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki` (prints `OK`) and `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` (exits 0).

**Checkpoint**: commit `TASK-0116: Phase 4 — wiki re-ground`.

---

## Dependencies & Execution Order

- Phase 1 has no dependency.
- Phase 2 depends on Phase 1 (`recordCall`, the usage fields).
- Phase 3 depends on Phase 2 (the ledger, `seqs`). T018–T019 could run earlier but ride Phase 3.
- Phase 4 depends on Phase 3.
- Within a phase, `[P]` tasks touch different files and may run in either order.

## Implementation strategy

MVP is Phases 1–2: usage is recorded and the merge condition holds. Phase 3 delivers the API that
unblocks TASK-0117. Phase 4 closes AC #8. The PR opens only after Phase 4.

## Notes

- Spec open question 4 (vm-104 reachability) is for the operator before merge. The default ships.
- TASK-0132 is not in scope. contracts/debug-api.md records what it would need.
