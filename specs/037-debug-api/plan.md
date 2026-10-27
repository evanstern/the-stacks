# Implementation Plan: Debug view card A — operator debug API and persisted model-call usage

**Branch**: `task-0116-debug-api` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/debug-api.md](contracts/debug-api.md), [quickstart.md](quickstart.md). Design:
[docs/design/debug-view.md](../../docs/design/debug-view.md) card A.

## Summary

The gateway hands each `chat()` caller its own usage record through an optional `onUsage`
callback (R2). The DM's shared call helpers copy six usage fields into every `ModelCallRecord`,
and write one row per call to a new `dm_model_calls` ledger table as the call ends (R1, R3).
Every gate submission a DM job stores records the seqs it wrote (R4). Four read-only,
operator-only routes under `/dm` serve the event log, the jobs, the seed and the ledger (R5).
`GET /dm/sessions/:id/turns` is unchanged.

## Technical Context

**Language/Version**: TypeScript (Node 24), ESM
**Primary Dependencies**: Hono, drizzle-orm, drizzle-kit, zod v4, vitest. **No new runtime
dependency.**
**Storage**: Postgres. One new table `dm_model_calls` (migration 0005). `jobs.result` jsonb gains
fields inside `calls[]` and the submission records.
**Testing**: vitest; database suites with `REQUIRE_DATABASE=1` on the worktree's own stack.
**Target Platform**: the server (`apps/server`): the AI gateway, the DM worker, the `/dm` routes.
**Project Type**: web application (pnpm monorepo).
**Performance Goals**: an idle 2 s poll of each route is one indexed read.
**Constraints**: no prompt or completion text stored or served (D4). No socket change (D3). No
change to frozen contracts (`ws-protocol.md` frames, `specs/029-proposal-gate/contracts/`,
`specs/030-play-route/contracts/proposal-seam.md`).
**Scale/Scope**: about 14 source files, 1 migration, about 8 test files, 4 contract docs, 6 wiki
notes.

## Constitution Check (2.0.0)

- [x] **I. Agent-operable** — every debug datum is an HTTP route an agent can call with an
  operator session. The page (TASK-0117) has no private data path.
- [x] **II. Content contract** — the seed schema does not change. The seed route serves it as
  loaded; `dmOnlyPaths` reuses the spec-034 field classes.
- [x] **III. Data planes** — `dm_model_calls` is operational state beside `jobs`, like the
  queue. It is not session play: no event, no projection reads it. No cross-plane import is
  added; the routes stay in `routes/dm.ts`.
- [x] **IV. Event-sourced play** — the routes only read. The event route returns rows as stored.
  No event shape changes. Recording `seqs` copies what the gate returned; the gate is
  unchanged.
- [x] **V. Citations** — not applicable; no rules answer changes. No retrieved passage is served.
- [x] **VI. 5e engine boundary** — no engine change; no number is computed.
- [x] **VII. Structured first** — usage becomes typed, stored data. Prompt storage stays out by
  the D4 ruling (an existing exception for DM text, not widened).
- [x] **VIII. Operator-owned content** — debug responses carry no library text (CR-004).
- [x] **IX. Self-hostable** — no new service. Usage is captured at the one gateway seam; no
  adapter times or prices a call.

No violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/037-debug-api/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/debug-api.md     # the API TASK-0117 specs against
├── checklists/requirements.md
└── tasks.md
```

### Source files touched

| File | Change | Phase |
|---|---|---|
| `apps/server/src/ai/types.ts` | `ChatRequest.onUsage?` | 1 |
| `apps/server/src/ai/gateway.ts` | call `req.onUsage` beside `sink.record` | 1 |
| `apps/server/src/dm/pipeline/context.ts` | `ModelCallRecord` usage fields; `RecordedCall`; `NodeDeps.recordCall?` | 1 |
| `apps/server/src/dm/pipeline/call.ts` | capture the usage record per attempt; fill the record; call `recordCall` (aborted included) | 1 |
| `apps/server/src/schema/dm-model-calls.ts` | new table | 2 |
| `apps/server/src/schema/` index or barrel, if one exists | export the table | 2 |
| `apps/server/drizzle/0005_<generated>.sql`, `drizzle/meta/0005_snapshot.json`, `drizzle/meta/_journal.json` | **generated** by `pnpm db:generate`; never hand-edited | 2 |
| `apps/server/src/dm/model-calls.ts` (new) | `insertModelCall`, `listModelCalls`, `modelCallTotals` | 2 |
| `apps/server/src/dm/worker.ts` | bind `recordCall` per job for turn, companion, chronicle; keep calls on a `held` outcome | 2 |
| `apps/server/src/dm/pipeline/context.ts` | `TurnOutcome` `held` carries `calls` | 2 |
| `apps/server/src/dm/pipeline/runner.ts` | return `calls` on `held` | 2 |
| `apps/server/src/dm/companion.ts` | `CompanionDeps.recordCall?`; `CompanionSubmission.seqs` | 2 |
| `apps/server/src/dm/chronicle.ts` | `ChronicleDeps.recordCall?`; `ChronicleResult.seqs` | 2 |
| `apps/server/src/dm/nodes/resolve.ts` | `Submission.seqs`; narration seqs from `submitNarration` | 2 |
| `apps/server/src/dm/jobs.ts` | `TurnCheckpoint.narration.seqs`; `DmJobRow.heartbeatAt`; `listDmJobsPage` | 2, 3 |
| `apps/server/src/dm/seed/views.ts` | `dmOnlySeedPaths`; `dmOnlySeedText` over it | 3 |
| `apps/server/src/routes/dm.ts` | four `GET` routes | 3 |
| `apps/server/src/routes/dm.ts` options / `app.ts` / `index.ts` | wiring only if a new dep is needed (the routes already get `db`, `loadProjections`) | 3 |
| `specs/031-dm-runtime/contracts/dm-api.md` | "Debug routes" section pointing to this contract; `/turns` text unchanged | 3 |
| `specs/031-dm-runtime/contracts/node-seam.md` | `ModelCallRecord` fields, `recordCall` | 3 |
| `specs/011-ai-gateway/contracts/gateway.md` | `onUsage` and its invariant | 3 |
| `specs/031-dm-runtime/contracts/resolve.md` | `Submission.seqs` | 3 |
| `docs/wiki/{dm-turn-jobs,ai-gateway,database-schema,migrations,dm-runtime}.md`, new `docs/wiki/debug-view.md`, `INDEX.md`, `CAPSULES.md` | re-ground | 4 |

Tests (new or extended):

| Test file | Covers | Phase |
|---|---|---|
| `apps/server/test/ai.gateway.test.ts` | `onUsage` fires once with the sink's record; not on unknown purpose; on error and cancel | 1 |
| `apps/server/test/dm/call.test.ts` | usage fields on ok, invalid-json repair, error; `recordCall` on each attempt incl. aborted; nulls when no record | 1 |
| `apps/server/test/dm/model-calls.integration.test.ts` (new) | insert, page, totals, unpriced counting, cascade | 2 |
| `apps/server/test/dm/full-turn.integration.test.ts` | **merge condition**: one ledger row per call; rows equal `jobs.result.calls` | 2 |
| `apps/server/test/dm/worker.integration.test.ts` | held turn keeps calls; companion and chronicle rows; `recordCall` failure does not fail the job | 2 |
| `apps/server/test/dm/resolve.integration.test.ts` | `Submission.seqs`; narration seqs | 2 |
| `apps/server/test/dm/seed.test.ts` | `dmOnlySeedPaths` agrees with `dmOnlySeedText` | 3 |
| `apps/server/test/dm/routes.integration.test.ts` | 401/403 × 4 routes; pagination; seed 404; no-text scan; `/turns` unchanged | 3 |

### Migration

**0005** — `CREATE TABLE dm_model_calls` with its FK, checks and two indexes. Generated by
`pnpm --filter @the-stacks/server db:generate`. The file name suffix is drizzle-kit's random
name. **Never hand-edit `apps/server/drizzle/meta/_journal.json`.** If another branch merges a
migration first: merge `origin/main`, delete this branch's `0005_*` SQL and snapshot, revert the
journal to `origin/main`'s, and regenerate (runbook concurrency doctrine). No hand-added SQL is
needed (no trigger, no extension).

### New runtime dependencies

None. Hono, drizzle and zod cover every route, table and schema.

## Phases and dispatch

One phase is one implementer dispatch (sonnet tier; the judgment calls are made in research.md).

| Phase | Scope | DB? |
|---|---|---|
| 1 | Gateway `onUsage`; `ModelCallRecord` usage fields; `recordCall` seam in `call.ts` | no |
| 2 | Ledger table, migration 0005, worker wiring, held-turn calls, submission seqs; merge-condition test | yes |
| 3 | The four debug routes, seed paths, contract docs | yes |
| 4 | Wiki re-ground, `CAPSULES.md`/`INDEX.md`, full gate | yes |

## Operator checkpoints

- **R8 / spec open question 4**: debug routes reachable on hosted dev (vm-104) with no flag. The
  default ships; the operator may rule otherwise before merge.
- **R1**: a second store (the ledger) beside `jobs.result.calls`. Recorded here for PR review.

## Risks

- **Migration collision.** Another M3 card adding a migration takes 0005. Mitigation: regenerate
  after merging `origin/main`, never hand-merge the journal.
- **Hotspot overlap.** `dm/worker.ts` and `dm/companion.ts` are shared with TASK-0114 and
  TASK-0052. Keep the worker change to the `recordCall` binding and the held-calls line.
- **Fixture churn.** Tests asserting exact `jobs.result` or `Submission` objects may need the new
  fields. Update the assertions; do not loosen them to `expect.objectContaining` unless the test
  was already partial.
- **Response size.** A failed turn's `result` holds up to two 8 KB excerpts per failed call.
  `limit` 50 bounds a jobs page.

## Complexity Tracking

Empty.
