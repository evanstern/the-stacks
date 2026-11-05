# Implementation Plan: Schema outcome and safe coercions

**Branch**: `task-0203-schema-outcome` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: `specs/086-schema-outcome-coercions/spec.md`; the TASK-0203 root-cause note (vm-104
log, 2026-11-04); runbook B2 merge spine #3 (`docs/design/m3-runbook-b2-playtest-fixes.md`).
This plan assumes OQ-1 to OQ-4 (a). Research and design are small, so they live in this file.
There is no separate research.md, data-model.md or quickstart.md.

## Summary

Split the failed-attempt outcome in `callJson`: a parse failure stays `invalid-json`, a schema
failure becomes `schema-mismatch`. Widen the ledger CHECK by a generated migration. Add two
normalizers through the existing `CallRequest.normalize` seam: audit (kind, detail, actor) and
chronicle (ids). State the failed fields in four prompts and bump their versions. Test every
run 1 shape through `callJson` with the scripted fake gateway.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, drizzle-orm, drizzle-kit, Vitest. **No new runtime dependency.**
**Storage**: Postgres. **One migration**: the `dm_model_calls_outcome_valid` CHECK gains
`schema-mismatch`. No column, no event shape change.
**Testing**: Vitest unit tests with the scripted fake gateway; one DB integration test
(`model-calls.integration.test.ts`, needs `pnpm env:up`). No paid model run.
**Constraints**: no frozen contract change (`ws-protocol`, spec 029, spec 030 seam). The
`invalid-output` failure record keeps its shape. The repair re-ask text is not changed.
**Scale/Scope**: 11 source files, 1 migration, 1 new test file, 7 extended test files,
6 contract amendments.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the outcome reads through the existing debug route and ledger. No
      human-only path.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: `dm_model_calls` stays operational state beside `jobs`. No new state.
- [x] **IV. Event sourcing**: no event change. A coerced chronicle id rides the existing
      `journal.entry.added` payload, which already takes a `RefIdSchema` string.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: no coercion touches a mechanic or an engine number.
- [x] **VII. Structured first**: both normalizers are pure functions before the schema.
- [x] **VIII. Operator-owned content**: no content change.
- [x] **IX. Self-hostable**: no new service or dependency.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Research

- **R1 — Where the label is chosen.** `callJson` (`pipeline/call.ts`) settles every failed
  `parseAgainst` as `invalid-json`. `parseAgainst` already knows which step failed: its parse
  branch returns `not valid JSON: …`, its schema branch returns the Zod issues. It returns no
  kind.
- **R2 — The seam exists.** `CallRequest.normalize` runs on the parsed JSON before the schema on
  every attempt. The director already uses it (`normalizeDirector`, spec 033 row C4). The audit
  and chronicle calls pass none.
- **R3 — The clip rule exists.** `capText` in `nodes/director.ts` cuts at the last space before
  300 characters, hard when spaceless. It is private.
- **R4 — Who reads the outcome.** `ModelCallRecord.outcome` (`pipeline/context.ts`), the ledger
  CHECK, `apps/web/app/debug/api-types.ts` (`DebugModelCall.outcome`), and the playtest watcher
  (`.claude/skills/playtest-run/scripts/watch.mjs`, counts `invalid-json`). `routes/dm.ts` and
  `read-result.ts` type it as `string`.
- **R5 — Migration precedent.** Migration 0008 (TASK-0192) widened the same CHECK for
  `truncated` by drop-and-add. `pnpm --filter @the-stacks/server db:generate` writes the SQL,
  the snapshot and the `_journal.json` entry.
- **R6 — Run 1 shapes.** Card root-cause note, table S1 to S8 in spec.md.

## Design

### D1 — Outcome split (`apps/server/src/dm/pipeline/call.ts`, `pipeline/context.ts`)

- `parseAgainst` failures return `{ ok: false, kind: "invalid-json" | "schema-mismatch", issues }`.
  The think-only and parse branches are `invalid-json`. The schema branch is `schema-mismatch`.
- Both settle sites in `callJson` use `usage.truncated ? "truncated" : parsed.kind`.
- `logInvalid` emits `dm.call.${parsed.kind}` with the same payload (OQ-4 a).
- `ModelCallRecord.outcome` becomes `"ok" | "invalid-json" | "schema-mismatch" | "truncated" |
  "error"`.

### D2 — Ledger CHECK (`apps/server/src/schema/dm-model-calls.ts` + migration 0009)

- Add `'schema-mismatch'` to the `dm_model_calls_outcome_valid` list.
- Run `pnpm --filter @the-stacks/server db:generate` after merging `origin/main` into the branch.
  Commit the generated `drizzle/0009_*.sql`, `drizzle/meta/0009_snapshot.json` and the
  `drizzle/meta/_journal.json` change exactly as generated. If `main` already holds a 0009, the
  generator numbers past it; never renumber by hand.

### D3 — Readers (`apps/web/app/debug/api-types.ts`, `watch.mjs`, `SKILL.md`)

- `DebugModelCall.outcome` gains `"schema-mismatch"`.
- The watcher prints `schema=<n>` beside `invalid-json=<n>`.
- `playtest-run/SKILL.md` line 74 flags `schema-mismatch` beside `invalid-json`.

### D4 — Audit normalizer (`apps/server/src/dm/nodes/audit.ts`, `nodes/director.ts`)

- Export `capText` from `nodes/director.ts` (no other change there).
- Add and export `normalizeAudit(json: unknown): unknown` in `nodes/audit.ts`. For each plain
  object in a plain-object root's `issues` array:
  - a string `kind` not in `AUDIT_ISSUE_KINDS` becomes `other`; a string `detail` becomes
    `` `[${kind}] ${detail}` ``;
  - then a string `detail` passes through `capText`;
  - an `actor` equal to `null` is deleted.
  Anything else passes through unchanged. Return a copy; never mutate the input.
- Pass `normalize: normalizeAudit` in the `dm.audit` `callJson` call.

### D5 — Chronicle normalizer (`apps/server/src/dm/chronicle.ts`)

- Add and export `normalizeChronicle(json: unknown): unknown`. For each plain object in a
  plain-object root's `entries` array, map each `sourceActionIds` element that is a non-negative
  safe integer to `String(n)`. Leave every other element unchanged.
- Pass `normalize: normalizeChronicle` in the `dm.chronicle` `callJson` call.

### D6 — Prompt sentences (version bumps)

Bump each to one past the version on `main` when phase 3 starts.

- `apps/server/src/dm/prompts/audit.ts`: after the output shape, add: "Use only these five kinds.
  An off-turn act is `invented-mechanics`; there is no other kind. Keep `detail` to 300
  characters. Omit `actor` when no character is named; never write null."
- `apps/server/src/dm/prompts/director.ts`: append to `OUTPUT_SHAPE`: "Write every top-level key.
  `goalNote` is its own top-level key, always written (an empty string when you have no note),
  never inside `pacing`."
- `apps/server/src/dm/prompts/companion.ts`: after the shape, add: "Write all four keys every
  time. Set `comment`, `say` or `act` to null when you have none; never leave a key out."
- `apps/server/src/dm/prompts/interpret.ts`: append to `OUTPUT_SHAPE`: "Every attack step names
  `attack`, the attack's name from the attacker's list, on a monster turn too. An ability check
  writes `stakes.cost` and `stakes.severe` as text, never null; only a saving throw sets them
  null." Do not edit `prompts/step-grammar.ts` (adjudicate shares it).

## Tests (card AC #3, #4)

- `apps/server/test/dm/call.test.ts`: update the existing `invalid-json` expectations whose reply
  parses and fails the schema to `schema-mismatch`; keep the unparsable ones. Add: a schema
  failure logs `dm.call.schema-mismatch`; a truncated schema failure settles `truncated`.
- `apps/server/test/dm/model-calls.integration.test.ts`: stores and reads back a
  `schema-mismatch` row (mirrors the `truncated` case).
- `apps/server/test/dm/schema-coercions.test.ts` (new): one `callJson` test per shape S1 to S8,
  each rebuilt from the card note and labeled so, using that row's wrapper and the real schema
  and normalizer (`AuditModelOutput` + `normalizeAudit`, `ChronicleOutput` +
  `normalizeChronicle`, `CompanionOutput`, `DirectorOutput` + `normalizeDirector`, `InterpretOutput`). S1 to S4 assert one call, outcome `ok`, the coerced value. S5 to S8 assert
  attempt 1 `schema-mismatch` and a second request. Plus direct `normalizeAudit` and
  `normalizeChronicle` cases for the spec edge cases (non-string kind, empty detail, long actor,
  float and negative ids, non-object root).
- Version pins: `narrate.test.ts` (audit), `assemble.test.ts` (director),
  `companion-addressee.test.ts` (companion), `interpret-prompt.test.ts` (interpret), each with
  the new sentence.

## Contracts

- `specs/031-dm-runtime/contracts/node-seam.md`: amendment — the `schema-mismatch` outcome.
- `specs/037-debug-api/contracts/debug-api.md` and `specs/037-debug-api/data-model.md`:
  amendment — the outcome list and the CHECK.
- `specs/034-narration-quality/contracts/audit-criteria.md`: amendment — `normalizeAudit`.
- `specs/033-director-robustness/contracts/director-output.md`: amendment — the goalNote sentence.
- `specs/031-dm-runtime/contracts/companions.md`: amendment — `normalizeChronicle` and the
  companion key sentence.

## Files

| File | Change | Phase |
|---|---|---|
| `apps/server/src/dm/pipeline/call.ts` | D1 | 1 |
| `apps/server/src/dm/pipeline/context.ts` | D1 (`ModelCallRecord.outcome`) | 1 |
| `apps/server/src/schema/dm-model-calls.ts` | D2 | 1 |
| `apps/server/drizzle/0009_*.sql`, `drizzle/meta/0009_snapshot.json`, `drizzle/meta/_journal.json` | D2, generated | 1 |
| `apps/web/app/debug/api-types.ts` | D3 | 1 |
| `.claude/skills/playtest-run/scripts/watch.mjs`, `.claude/skills/playtest-run/SKILL.md` | D3 | 1 |
| `apps/server/test/dm/call.test.ts` | outcome split | 1 |
| `apps/server/test/dm/model-calls.integration.test.ts` | `schema-mismatch` row | 1 |
| `specs/031-dm-runtime/contracts/node-seam.md`, `specs/037-debug-api/contracts/debug-api.md`, `specs/037-debug-api/data-model.md` | amendments | 1 |
| `apps/server/src/dm/nodes/director.ts` | D4 (export `capText`) | 2 |
| `apps/server/src/dm/nodes/audit.ts` | D4 | 2 |
| `apps/server/src/dm/chronicle.ts` | D5 | 2 |
| `apps/server/test/dm/schema-coercions.test.ts` | new, S1 to S8 | 2 |
| `specs/034-narration-quality/contracts/audit-criteria.md` | amendment | 2 |
| `apps/server/src/dm/prompts/audit.ts` | D6, version bump | 3 |
| `apps/server/src/dm/prompts/director.ts` | D6, version bump | 3 |
| `apps/server/src/dm/prompts/companion.ts` | D6, version bump | 3 |
| `apps/server/src/dm/prompts/interpret.ts` | D6, version bump | 3 |
| `apps/server/test/dm/narrate.test.ts`, `assemble.test.ts`, `companion-addressee.test.ts`, `interpret-prompt.test.ts` | version pins, sentences | 3 |
| `specs/033-director-robustness/contracts/director-output.md`, `specs/031-dm-runtime/contracts/companions.md` | amendments | 3 |
| `docs/wiki/ai-gateway.md`, `database-schema.md`, `migrations.md`, `dm-runtime.md`, `dm-failure-and-gates.md`, `dm-turn-jobs.md`, `debug-view.md`, `dm-narration-quality.md`, `CAPSULES.md`, `INDEX.md` | re-ground | 4 |

**Footprint note for the orchestrator**: the runbook's expected footprint for 0203 matches, with
three additions: `pipeline/context.ts`, `apps/web/app/debug/api-types.ts` and the playtest-run
skill (watcher and SKILL.md), all phase 1. `companion.ts` (the module) is not edited; only its
prompt is. `nodes/director.ts` gets a one-word export in phase 2.

## Overlap

- **Phase 1 develops ahead.** Its files are disjoint from every other spine task in flight
  (0242, 0240, 0246, 0244).
- **Phases 2 and 3 start after TASK-0240 merges.** 0240 edits `prompts/audit.ts` and
  `nodes/audit.ts`. Merge `origin/main` into the branch first.
- **TASK-0246** edits `audit-words.ts` and `claims.ts`. This plan touches neither, so 0246 does
  not block. If 0246's plan names `nodes/audit.ts` or `prompts/audit.ts`, phases 2 and 3 also
  wait for 0246; the orchestrator logs the amendment.
- **Later spine tasks follow this one**: 0237 edits `prompts/director.ts`, `nodes/director.ts` and
  `prompts/audit.ts`; 0238 edits `prompts/interpret.ts`. They re-bump on top of this merge.
- **Prompt versions**: "next version" is one past what `main` holds when phase 3 starts
  (audit-v12, director-v7, companion-v7, interpret-v13 at authoring). If another card in flight
  claims the same next version, the later merge re-bumps and reconciles
  `docs/wiki/dm-narration-quality.md`.
- **Migration**: generated after merging `origin/main` in. If another branch merges a migration
  first, delete this branch's generated files, merge `main`, and re-generate.
