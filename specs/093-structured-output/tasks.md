# Tasks: Structured output in the gateway

**Input**: `specs/093-structured-output/spec.md`, `plan.md`.
**Prerequisites**: plan.md OQ-1 to OQ-6 as recommended. Phase 3 needs the OQ-3 C9 read (or its
fallback) recorded on the card before dispatch.

**Rules for every phase**: one phase is one sonnet dispatch. Run `pnpm install --frozen-lockfile`
in a fresh worktree. Use the fake gateway or stubbed `fetch`; no paid model call. End each phase
with `pnpm ci:check` green and one commit, `TASK-0273 phase <n>: <title>`, staged and committed in
separate calls with the literal worktree path. No migration. No new dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel within the phase (different files).
- **[Story]**: the spec user story (US1 to US5).

## Phase 1: Gateway structured mode (US1; FR-001 to FR-005; plan D1 to D3, D9)

**Goal**: a structured purpose sends its schema on the wire, and tool-call arguments stream back
as `text` events.

**Independent test**: `ai.config.test.ts`, `ai.gateway.test.ts` and
`ai.openai-compatible.test.ts` pass with the new cases. Every existing gateway test passes
unchanged.

- [x] T001 [US1] In `apps/server/src/ai/types.ts`, add `PurposeConfig.structured`,
      `ChatRequest.output` and the widened `Provider.chat` opts (plan D1).
- [x] T002 [US1] In `apps/server/src/ai/config.ts`, add `structured` to `PurposeConfigSchema`.
      In `crossValidate`, reject `structured` on an `op: "embed"` purpose with a named error.
- [x] T003 [US1] In `apps/server/src/ai/gateway.ts`, pass `structured: purpose.structured` in
      the `provider.chat` opts (plan D2).
- [x] T004 [US1] In `apps/server/src/ai/adapters/openai-compatible.ts`, build the tool-mode and
      json-schema-mode bodies, and stream index-0 tool-call arguments as `text`. Hold content
      deltas in tool mode and yield them only when no argument arrived (plan D3).
- [x] T005 [P] [US1] In `apps/server/test/ai.config.test.ts`, accept both modes, reject an
      unknown mode, and reject `structured` on an embed purpose.
- [x] T006 [P] [US1] In `apps/server/test/ai.gateway.test.ts`, assert the mode reaches the
      provider opts. Assert an unset mode passes `structured: undefined`.
- [x] T007 [US1] In `apps/server/test/ai.openai-compatible.test.ts`, add cases: tool-mode body;
      json-schema-mode body; no `output` sends today's body byte for byte; tool-call fragments
      yield `text` in order; `finish_reason: "tool_calls"` completes; content-only reply in tool
      mode yields one held `text`; mixed content and arguments yields arguments only;
      `finish_reason: "length"` in tool mode marks `truncated`.
- [x] T008 [US1] Amend `specs/011-ai-gateway/contracts/gateway.md` with `structured`, `output`
      and the wire mapping (plan D9).

## Phase 2: callJson sends its schema; truncation logs apart (US1, US2, US4; FR-006 to FR-009, FR-013, FR-015; plan D4, D5, D7, D9)

**Goal**: every JSON call sends its converted schema. A capped attempt logs `dm.call.truncated`.
The TASK-0203 shapes run through both paths.

**Independent test**: `call.test.ts`, `call-schemas.test.ts`, `schema-coercions.test.ts` and the
new S1 to S4 tool-mode cases pass.

- [ ] T009 [US1] In `apps/server/src/dm/pipeline/call.ts`, add `outputSpecOf` with a `WeakMap`
      cache. `collect()` takes an optional `output` and puts it on the chat request. `callJson`
      sends it on both attempts; `callText` sends none (plan D4).
- [ ] T010 [US2] In `apps/server/src/dm/pipeline/call.ts`, add `truncated` to `Collected`.
      Rename `logInvalid` to `logFailed`, emit `dm.call.truncated` with `parse` when truncated,
      and log a truncated `callText` attempt with `parse: null` (plan D5). Update the TASK-0203
      doc comment.
- [ ] T011 [US1] Create `apps/server/test/dm/call-schemas.test.ts`. Convert every schema a DM
      `callJson` site passes (`InterpretOutput`, `DirectorOutput`, `AdjudicateModelOutput`,
      `AuditModelOutput`, `ChronicleOutput`, `CompanionOutput`, `ReactOutput`) with the FR-006
      options. Assert no throw, `type: "object"` and no `$schema` key.
- [ ] T012 [US1] In `apps/server/test/dm/call.test.ts`, assert both attempts carry the same
      `output`, its name is `dm_audit` for `dm.audit`, and `callText` carries none.
- [ ] T013 [US2] In `apps/server/test/dm/call.test.ts`, add the four US2 scenarios. Assert no
      `dm.call.invalid-json` line for a capped reply.
- [ ] T014 [US4] Create `apps/server/test/dm/fixtures/task-0203-shapes.ts` with S1 to S8 (plan
      D7). Add S9 only if the OQ-6 excerpt is on the card.
- [ ] T015 [US4] Rewrite `apps/server/test/dm/schema-coercions.test.ts` to iterate the fixture
      module. Expected outcomes stay as today.
- [ ] T016 [US4] In `apps/server/test/ai.openai-compatible.test.ts`, stream S1 to S4 as tool-call
      argument deltas through a real gateway and `callJson` with each shape's normalizer. Assert
      `ok` on attempt 1. Stream one capped argument stream and assert `truncated` plus
      `dm.call.truncated`.
- [ ] T017 [US2] Amend `specs/031-dm-runtime/contracts/node-seam.md` ("Model calls") with the
      output spec and the `dm.call.truncated` event (plan D9).

## Phase 3: Interpret cap, boot warning and env example (US1, US5; FR-010, FR-011, FR-014; plan D6)

**Goal**: the env example declares a mode on every DM JSON purpose, boot names the unstructured
ones, and the interpret cap fits measured output.

**Prerequisite**: the card records the OQ-3 measurement (max, p95, session) or the fallback ruling.

**Independent test**: `call-schemas.test.ts` pins the interpret cap in `PURPOSE_MAX_TOKENS` and
in `.env.example`. A unit test covers `unstructuredDmPurposes`.

- [ ] T018 [US1] In `apps/server/src/dm/purposes.ts`, add `unstructuredDmPurposes(purposes)`
      per plan D6. Exclude `dm.narrate`.
- [ ] T019 [US1] In `apps/server/src/index.ts`, warn once beside the `missingDmPurposes` warning,
      listing the unstructured purposes.
- [ ] T020 [US5] In `apps/server/src/dm/purposes.ts`, set `PURPOSE_MAX_TOKENS["dm.interpret"]` to
      the OQ-3 value. The comment names the session, max, p95 and date.
- [ ] T021 [US1] In `.env.example`, add `"structured":"tool"` to every `dm.*` entry except
      `dm.narrate`. Set the interpret `maxTokens`. Rewrite the comment per plan D6.
- [ ] T022 [US1] In `apps/server/test/dm/call-schemas.test.ts`, test `unstructuredDmPurposes` and
      pin the interpret cap in both places (read `.env.example` from the repo root).
- [ ] T023 [US5] Run `pnpm --filter @the-stacks/server test -- budget` and update any
      `playtest/budget.test.ts` expectation the new cap moves.

## Phase 4: Playtest watch counts (US3; FR-012; plan D8)

**Goal**: the watch prints `truncated=`, the attempt-1 failure rate and `out-max`.

**Independent test**: `node .claude/skills/playtest-run/scripts/watch.mjs --input <tmp>.json
--state <tmp>.state` on a hand-built input with one truncated call prints all three. Paste the
output in the commit body.

- [ ] T024 [P] [US3] In `.claude/skills/playtest-run/scripts/watch.mjs`, add `truncated=<n>`
      after `invalid-json=<n>`. After the spend line, print `attempt-1 failures f/n = p%`
      (OQ-2 counting rule) and `out-max <purpose>=<tokens>` per purpose.
- [ ] T025 [P] [US3] In `.claude/skills/playtest-run/SKILL.md`, name `truncated` on line 72, flag
      it on line 74, and say AC #2 of TASK-0273 reads from the attempt-1 line.

## Phase 5: Wiki re-ground

**Goal**: the notes the runbook lists for TASK-0273 match the merged code, re-pinned honestly.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
freshness . docs/wiki` prints `OK`.

- [ ] T026 NEEDS-REVIEW `docs/wiki/ai-gateway.md`: the `structured` key, `ChatRequest.output`, the
      adapter wire mapping, tool-call streaming as `text`, the embed rejection. Read the diff of
      its sources before bumping the pin.
- [ ] T027 NEEDS-REVIEW `docs/wiki/dm-runtime.md`: `callJson` sends its schema; the
      `dm.call.truncated` log line; the interpret cap; the boot warning.
- [ ] T028 NEEDS-REVIEW `docs/wiki/dm-turn-jobs.md`: confirm the ledger is unchanged; amend only
      where it describes the log lines or `truncated`. Re-pin only after the diff read.
- [ ] T029 NEEDS-REVIEW `docs/wiki/playtest-harness.md`: the watch's three counts. Add
      `.claude/skills/playtest-run/scripts/watch.mjs` to its sources if absent.
- [ ] T030 Update `docs/wiki/INDEX.md` state paragraph and `docs/wiki/CAPSULES.md` for the
      `ai-gateway` capsule. Run the freshness gate and the spec-bridge check.

## Dependencies

- Phase 1 before Phase 2 (`ChatRequest.output` and the adapter tool stream).
- Phase 3 after Phase 2 (`call-schemas.test.ts` exists) and after the OQ-3 card note.
- Phase 4 is independent; it may run beside Phase 1.
- Phase 5 last.
