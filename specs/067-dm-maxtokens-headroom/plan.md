# Implementation Plan: DM maxTokens headroom and a truncated call outcome

**Branch**: `task-0192-dm-maxtokens-headroom` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/067-dm-maxtokens-headroom/spec.md`, alpha run 3 findings 11 and 12, runbook A
lane A1 (`docs/design/m3-runbook-a-run3-fixes.md`).

## Summary

Raise every documented `dm.*` cap to 4000 and say why. Then make truncation visible: the gateway's
usage record gains `truncated`, set when the provider reports `finish_reason: "length"` or when
output tokens reach the purpose's `maxTokens`. The DM call helpers record outcome `truncated` for
an attempt that was truncated and not accepted. The `dm_model_calls` outcome check gains
`truncated` through one generated migration.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Drizzle, drizzle-kit, Zod, Vitest. **No new runtime dependency.**
**Storage**: Postgres. One migration (`0008_*`): drop and re-add `dm_model_calls_outcome_valid`.
**Testing**: Vitest unit tests over the real gateway and the fake provider; one DB integration
test with `REQUIRE_DATABASE=1`.
**Target Platform**: server AI gateway and DM call helpers; web debug types.
**Project Type**: monorepo web service.
**Constraints**: no frozen contract changes. `ws-protocol.md`, spec 029 and spec 030 contracts are
untouched. `docs/wiki/` is re-pinned in the last phase.
**Scale/Scope**: 10 source or doc files, 1 generated migration (3 files), 5 test files.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the outcome is read through `GET /dm/sessions/:id/calls`, the route
      the debug page reads. No human-only path.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: `dm_model_calls` stays operational state beside `jobs`. No new plane.
- [x] **IV. Event sourcing**: no event changes. The ledger is not an event.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: no mechanic changes.
- [x] **VII. Structured first**: the outcome is a closed value set, enforced by a DB check.
- [x] **VIII. Operator-owned content**: no content. N/A.
- [x] **IX. Self-hostable**: caps stay operator config in `AI_PURPOSES`. No provider or model
      name enters source (decision-0007). No new container.

**Stack conformance**: within the Architecture Constraints table. No departure.

## Research (Phase 0)

**R1. The cap value.** Decision: 4000 for all seven `dm.*` purposes. Rationale: proven on vm-104
in run 3. The failed calls used exactly 1200; a free-mode interpret used about 200. A cap is a
ceiling: a call pays only for the tokens it uses. Alternatives: per-purpose values tuned to
observed output plus a margin. Rejected: run 3 measured only interpret, and router-side thinking
varies per prompt, so tuned numbers would be guesses.

**R2. How truncation is detected.** Decision: two signals, either one suffices.
(a) The OpenAI-compatible adapter sees `finish_reason: "length"`.
(b) The gateway sees `outputTokens >= maxTokens` for a purpose that sets `maxTokens`.
Rationale: (a) is the provider's own word; (b) covers routers that omit or rewrite the finish
reason, which is the run 3 evidence (exactly 1200 of 1200). Signal (b) also lets the fake
provider exercise the path with no adapter change. Alternatives: detect in `call.ts` from
`outputTokens` alone. Rejected: `call.ts` does not know the purpose's cap; the gateway does.

**R3. Which outcome wins.**
- JSON calls (`callJson`): an attempt that parses and validates is `ok`, truncated or not.
  An attempt that fails to parse is `truncated` when the call was truncated, else `invalid-json`.
  The repair re-ask runs after either, as today.
- Prose calls (`callText`): a truncated call is `truncated`. The text still returns to the node.
- Gateway errors and aborts keep `error` and `aborted`. Truncation never overrides them.

**R4. The code default.** Decision: `PURPOSE_MAX_TOKENS` becomes 4000 per `dm.*` purpose to
match `.env.example`. It only feeds the playtest cost estimate (`playtest/budget.ts`). Rationale:
one number per concept. Consequence: the estimate's per-call output size rises to the cap, so
its expected figure rises too (see Open questions).

## Data model (Phase 1)

- `UsageSummary` (`ai/types.ts`): gains optional `truncated?: boolean`. The adapter sets it on
  `finish_reason: "length"`.
- `UsageRecord` (`ai/types.ts`): gains required `truncated: boolean`. The gateway sets it from
  R2 (a) or (b). An unknown purpose emits no record, as today.
- `ModelCallRecord.outcome` (`dm/pipeline/context.ts`): `"ok" | "invalid-json" | "truncated" |
  "error"`. `RecordedCall` adds `"aborted"` as today.
- `dm_model_calls.outcome` check: `ok`, `invalid-json`, `truncated`, `error`, `aborted`.
- `DebugCall.outcome` (`apps/web/app/debug/api-types.ts`): same five values.

No new column. Older rows keep their values.

## Files touched

Phase 1, defaults and docs:
- `.env.example`: DM `AI_PURPOSES` example line to `maxTokens` 4000 each; comment states the reason.
- `docs/ops/dev-vm-104.md`: new "Model budget" section, same values and reason. Text only.
- `apps/server/src/dm/purposes.ts`: `PURPOSE_MAX_TOKENS` to 4000 each; doc comment states the reason.
- `apps/server/test/playtest/budget.test.ts`: the purpose-default assertion (`dm.director` 600)
  becomes 4000.

Phase 2, truncated outcome:
- `apps/server/src/ai/types.ts`: `UsageSummary.truncated?`, `UsageRecord.truncated`.
- `apps/server/src/ai/adapters/openai-compatible.ts`: set `usage.truncated` on
  `finish_reason: "length"`.
- `apps/server/src/ai/gateway.ts`: compute `record.truncated` (R2) in `chat()`; `embed()` records
  `truncated: false`.
- `apps/server/src/dm/pipeline/context.ts`: `ModelCallRecord.outcome` gains `"truncated"`.
- `apps/server/src/dm/pipeline/call.ts`: `settle` callers pick the outcome by R3.
- `apps/server/src/schema/dm-model-calls.ts`: the outcome check gains `'truncated'`.
- `apps/server/drizzle/0008_<generated>.sql`, `apps/server/drizzle/meta/0008_snapshot.json`,
  `apps/server/drizzle/meta/_journal.json`: generated by `pnpm --filter server db:generate`.
  Never hand-edit the journal.
- `apps/web/app/debug/api-types.ts`: `DebugCall.outcome` gains `"truncated"`.
- `specs/037-debug-api/contracts/debug-api.md`: both outcome unions gain `"truncated"` (not a
  frozen contract).
- Tests: `apps/server/test/ai.gateway.test.ts` (record flag from the cap; no flag below it),
  `apps/server/test/ai.openai-compatible.test.ts` (`finish_reason: "length"` sets the flag),
  `apps/server/test/ai.usage.test.ts` and `apps/server/test/dm/call.test.ts` (fixtures gain
  `truncated`; outcome rules R3), `apps/server/test/dm/model-calls.integration.test.ts` (a
  `truncated` row inserts).

Phase 3, wiki: `docs/wiki/ai-gateway.md`, `debug-view.md`, `database-schema.md`, `migrations.md`,
`hosted-dev.md`, `configuration.md`, plus `CAPSULES.md` and `INDEX.md` upkeep.

## Migration

One, generated. Expected SQL: `ALTER TABLE "dm_model_calls" DROP CONSTRAINT
"dm_model_calls_outcome_valid"` then `ADD CONSTRAINT ... CHECK (... IN ('ok', 'invalid-json',
'truncated', 'error', 'aborted'))`. Runbook overlap rule: only this task adds a migration in
runbook A. If `origin/main` gained a migration first, merge it in and regenerate.

## New runtime dependencies

None.

## Out of scope

- vm-104's env. It is already 4000 for `dm.interpret`; any further change is checkpoint C9.
- `playtest.audit` (700): not a `dm.*` purpose.
- `.claude/skills/playtest-run/scripts/watch.mjs`: it counts any non-`ok` call as not-ok, so a
  `truncated` row already surfaces there. A separate truncated count is an open question.
- The failure record's message text (`invalid-output`): unchanged. The ledger carries the cause.

## Open questions (for the orchestrator to card or rule)

- OQ-1: skip the repair re-ask after a truncated JSON attempt? The re-ask costs a second full-cap
  call that is likely to truncate again. This plan keeps it (no behavior change beyond the label).
- OQ-2: the playtest estimate uses the cap as the expected per-call output, so its expected figure
  rises about fivefold with 4000 caps. Use a measured typical output for "expected" and the cap
  only for the upper bound?
- OQ-3: add a `truncated=` count to the playtest-run watch script beside `invalid-json=`.
