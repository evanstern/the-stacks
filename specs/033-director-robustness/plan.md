# Implementation Plan: First Scene — director output survives real models; failed jobs keep their error detail

**Branch**: `task-0102-director-robustness` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: [spec.md](spec.md), [research.md](research.md),
[contracts/failure-record.md](contracts/failure-record.md),
[contracts/director-output.md](contracts/director-output.md), [quickstart.md](quickstart.md);
amendment 2026-10-26: [contracts/interpret-output.md](contracts/interpret-output.md),
[contracts/rules-terms.md](contracts/rules-terms.md), research R10 and R11.

## Summary

Evidence first. Phase 1 makes a failed turn job keep its diagnostics: the failure record goes
to `jobs.result.failure` with the schema issues, the purpose and a bounded excerpt of each
attempt. Phase 2 is an orchestrator-run paid capture that commits the real failing director
output as a fixture. Phase 3 classifies that evidence against a fixed cause catalog and builds
only the selected fixes: parse extraction, a named normalization step, a prompt revision, or a
gateway adapter fix. The strict schema stays strict and no number is ever touched. Phase 4 is an
orchestrator-run paid verification. Phase 5 is the full gate.

**Amendment (2026-10-26)**: Phase 4 passed the director but stopped at interpret (research
R10). Phase 3b fixes interpret with a strict-schema approach: a reproduction test from the
fixture, a closed skill enum defined in the engine (the operator's rules-term requirement), and
prompt v2 that renders every closed list from its enum. Phase 4b is an operator `maxTokens`
checkpoint, then a paid verification rerun. Phase 5 follows Phase 4b.

## Technical Context

**Language/Version**: TypeScript (Node 24), ESM
**Primary Dependencies**: zod v4, drizzle-orm, vitest. No new dependency.
**Storage**: Postgres `jobs` table; `result` (jsonb) and `error` (text) exist. No migration.
**Testing**: vitest; database suites with `REQUIRE_DATABASE=1` on the worktree's stack.
**Target Platform**: the server's DM worker (`apps/server`).
**Project Type**: web application (pnpm monorepo).
**Performance Goals**: none new. One re-ask stays the limit.
**Constraints**: no model text on the operator route or in logs; no number coerced (R8);
`DirectorOutput` unchanged except one refine message.
**Scale/Scope**: about 6 source files, 3–4 test files, 1 fixture. Amendment: 8 source files
(3 engine, 5 server), about 4 new or changed test files plus the skill-value updates.

## Constitution Check

- [x] **I. Agent-operable** — the failure record is a database row an agent reads with the same
  query the operator uses (quickstart B5).
- [x] **II. Content contract** — no codex entity. The failure record and the fixture have typed,
  documented shapes (contracts/).
- [x] **III. Data planes** — the failure record is operational job state in `jobs`, the plane
  that already holds the turn checkpoint.
- [x] **IV. Event sourcing** — no play event changes. The failure notice is unchanged.
- [x] **V. Citations** — not applicable.
- [x] **VI. 5e engine boundary** — no mechanics change; normalization never touches a number.
- [x] **VII. Structured first** — model output is still validated by the strict schema before
  use; leniency is an explicit, tested pre-step.
- [x] **VIII. Operator-owned content** — the fixture holds director output about the shipped
  seed; the director prompt carries no library text.
- [x] **IX. Self-hostable** — no new service; the provider stays operator configuration.

No violations. Complexity Tracking is empty.

### Constitution Check — amendment re-run (constitution 2.0.0)

- [x] **I. Agent-operable** — unchanged interface. The interpret failure record is the same
  `jobs.result.failure` row (quickstart B5).
- [x] **II. Content contract** — no codex entity. The seed schema's skill keys become the engine
  enum; the seed stays a typed, documented shape (rules-terms.md amends scene-seed.md).
- [x] **III. Data planes** — no plane change. The skill gate is validation in the engine and the
  server; nothing crosses a plane.
- [x] **IV. Event-sourced play** — no event shape changes. `check.resolved.skill` stays a
  nullable string, so existing logs replay. LLM output still reaches the log only through the
  gate and the engine; the engine now refuses an unknown skill.
- [x] **V. Citations** — not applicable. The SRD and library citation gates are recorded, not
  changed (rules-terms.md).
- [x] **VI. 5e engine boundary** — the one engine change is a closed `check.roll` skill enum. It
  is pure validation: no I/O, no model, no number. Scripted tests cover it (FR-022). The server
  derives the enum from the engine; no mechanics live outside the engine.
- [x] **VII. Structured first** — model output stays strict-schema validated; no leniency is
  added for interpret (FR-019).
- [x] **VIII. Operator-owned content** — the skill names are SRD 5.2.1 terms (CC-BY-4.0), the
  same source as the shipped SRD data. The interpret fixture holds model output about the
  shipped seed. The interpret prompt carries no library passage.
- [x] **IX. Self-hostable** — `maxTokens` stays operator configuration in `.env`; no new service.

No violations. Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/033-director-robustness/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md                 # orchestrator runbook for the paid runs
├── contracts/
│   ├── failure-record.md         # jobs.result.failure, excerpt rule
│   ├── director-output.md        # cause catalog, normalization invariants
│   ├── interpret-output.md       # amendment: interpret catalog (I1–I5), prompt v2 shape
│   └── rules-terms.md            # amendment: gate audit, skill key list, files to change
├── evidence/                     # Phase 2 and 4 outputs (orchestrator)
│   ├── capture-<runId>/
│   ├── classification.md
│   └── verify-<runId>/
└── tasks.md
```

### Source Code (repository root)

```text
apps/server/src/
├── dm/pipeline/call.ts           # excerptOf, attempt records, (C1) extractJson, normalize hook
├── dm/pipeline/context.ts        # TurnFailure type (if not placed in jobs.ts)
├── dm/worker.ts                  # failed-turn result write, log without excerpts
├── dm/jobs.ts                    # TurnFailureResult type
├── jobs/queue.ts                 # finishJob: optional result beside error
├── dm/nodes/schemas.ts           # advance refine message only
├── dm/nodes/director.ts          # (C3–C5) normalizeDirector
├── dm/prompts/director.ts        # (C2, C6–C8) prompt v2
└── ai/adapters/openai-compatible.ts   # (C9 only)

apps/server/test/
├── dm/call.test.ts
├── dm/director.test.ts
├── dm/director-capture.test.ts   # fixture reproduction + fixed-pipeline acceptance
├── dm/worker.integration.test.ts
├── dm/fixtures/director-capture-<runId>.json
└── ai.openai-compatible.test.ts  # (C9 only)
```

Amendment (Phase 3b):

```text
packages/dnd5e-engine/src/
├── schema/state.ts               # SkillSchema (the one literal list), type Skill
├── schema/commands.ts            # check.roll skill: SkillSchema.nullable().default(null)
└── index.ts                      # export SkillSchema, Skill
packages/dnd5e-engine/test/
└── commands/attacks.test.ts      # check.roll skill accepted / refused

apps/server/src/dm/
├── nodes/schemas.ts              # SkillSchema derived from check.roll; StepSchema check skill;
│                                 #   exported option lists for the prompts
├── seed/schema.ts                # skills keys and clue check.skill use SkillSchema
├── prompts/common.ts             # STEP_GRAMMAR renders conditions, skills, damage types
├── prompts/interpret.ts          # OUTPUT_SHAPE v2; PROMPT_VERSION dm.interpret-v2
└── prompts/adjudicate.ts         # PROMPT_VERSION dm.adjudicate-v2 (shared grammar changed)

apps/server/test/dm/
├── interpret-capture.test.ts     # fixture reproduction (both attempts)
├── interpret-prompt.test.ts      # prompt v2 snapshot, lists from enums, example parses
├── rules-terms.test.ts           # StepSchema / EffectSchema reject unknown terms
├── seed.test.ts                  # unknown seed skill key fails to load
└── (skill values)                # interpret.test.ts, world.ts, beat/resolve/adjudicate
                                  #   integration tests, scripts/*.json (rules-terms.md)
```

No new dependency. No migration: the skill gate changes Zod schemas only, and
`apps/server/src/schema/` is untouched.

**Structure Decision**: existing modules only. The failure record is written by the worker,
built by `callJson`. Director-specific leniency stays in the director node.

## Phase design

| Phase | Who | Output | AC |
|---|---|---|---|
| 1. Diagnostics | sonnet implementer | failure record, excerpt rule, readable advance issue, tests | #1 |
| 2. Capture | **orchestrator** (paid, operator ceiling) | fixture + evidence dir | #2 (fixture) |
| 3. Classify and fix | **orchestrator** classifies; sonnet implementer fixes | `evidence/classification.md`, selected catalog rows, reproduction test | #2 (test), #3 (offline) |
| 4. Verification | **orchestrator** (paid, operator ceiling) | evidence dir, card note | #3 |
| 3b. Interpret fix (amendment) | sonnet implementer | reproduction test, skill gate (engine, then server), interpret prompt v2, tests | #3 (interpret, offline) |
| 4b. Verification rerun (amendment) | **orchestrator** (operator `maxTokens` checkpoint, then paid, operator ceiling) | evidence dir, card note | #3 (interpret) |
| 5. Full gate | sonnet implementer (gate); orchestrator (scripted CI playtest in the composite worktree) | green gate, contract amendment notes in 031 | #4 |

### Phase 1 notes

- `collect()` in `call.ts` also returns `outputTokens` from the `done` event (null when the
  stream ended without one).
- Each failed attempt is recorded with its own issues; `detail.issues` keeps the last
  attempt's issues so existing callers and the re-ask text are unchanged.
- `finishJob(db, job, { error, result? })`: when `result` is present on failure it is written;
  otherwise `null` as today. The ingest worker is untouched.
- The worker writes `{ checkpoint: latest, outcome: { status: "failed" }, audit: null, calls:
  outcome.calls, failure }`. A thrown turn has `calls: []`.

### Phase 3 notes

- The orchestrator writes `evidence/classification.md` from the fixture: the issues per
  attempt, the catalog rows selected, and why each other row is not.
- The implementer builds only the selected rows, in catalog order.
- The reproduction test has two parts:
  1. Strict v1 parse: `DirectorOutput.safeParse(JSON.parse(stripFence(text)))` on each captured
     attempt fails (or `JSON.parse` throws), and the issue paths match the fixture's.
  2. Fixed pipeline: `callJson` with a scripted gateway returning the captured attempts, plus
     the director's `normalize`, returns `ok` with a value the legality code accepts. When the
     classification selects only prompt rows (C2, C6, C7, C8), part 2 is replaced by a prompt
     snapshot test, and `classification.md` says so. AC #3 then rests on Phase 4.

### Phase 3b notes

- Order: reproduction test first (green on unfixed code), then the engine enum, then the server
  derivation and seed schema, then the fixture and test value updates, then the prompts.
- The reproduction test parses with `stripFence` then `InterpretOutput.safeParse`, exactly as
  `parseAgainst` does. Attempt 2's skill is `perception`, so its issue path is unchanged by the
  skill gate.
- `ConditionKeySchema` in `schemas.ts` is cast to `ZodType`. Export the option arrays
  (conditions, skills) from the uncast enums for the prompt. Take damage types from
  `DamageTypeSchema.options`.
- The interpret example lives in the prompt module as an object, rendered with
  `JSON.stringify`, so the test can parse the same object.

## Risks

- **The capture does not fail.** Output is not deterministic. Mitigation: FR-011 stop-and-ask;
  every committed run directory is still evidence.
- **The fix covers attempt 1 but not attempt 2 shapes.** The fixture holds both attempts; part
  2 of the reproduction test feeds both.
- **A prompt v2 shifts other decisions.** The scripted run queues by purpose, so CI is
  unaffected; the verification run is the real check.
- **Interpret invents a term again.** The schema still rejects it, and the run stops for an
  operator ruling (FR-028). No leniency is the fallback.
- **The skill enum breaks the composite's TASK-0048 fixtures.** Its doctored fixtures hold
  title-case skills only in `check.resolved` events, which stay wide. Its scenario holds none.
- **Adjudicate prompt v2 shifts adjudicate output.** It gains only the closed lists. The
  scripted run queues by purpose, so CI is unaffected.
- **The composite merge conflicts.** Both branches are expected to touch disjoint files. A
  conflict stops the run for an operator ruling (quickstart A5).

## Wiki

`docs/wiki/dm-runtime.md` pins sources this task touches (`call.ts`, `worker.ts`). After merge
the orchestrator runs `/grounding-wiki:wiki-update` (sweep re-ground step).

## Complexity Tracking

Empty.
