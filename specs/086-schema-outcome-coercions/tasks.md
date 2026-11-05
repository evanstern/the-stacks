# Tasks: Schema outcome and safe coercions

**Input**: `specs/086-schema-outcome-coercions/` (spec.md, plan.md). Plan research R1 to R6 and
design D1 to D6 settle every choice. Read them before starting a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order.

**Start gates**:

- **Phase 1** may develop ahead of TASK-0240. Its files are disjoint from every task in flight.
- **Phases 2 and 3 MUST NOT start until TASK-0240 has merged** (it edits `prompts/audit.ts` and
  `nodes/audit.ts`). The orchestrator confirms the merge (`gh api ... --jq .merged`) before the
  dispatch. If TASK-0246's plan names either audit file, wait for it too.
- Before each phase, merge `origin/main` into the branch.

**Gates for every phase**: run `pnpm install --frozen-lockfile` in the worktree first.
`pnpm ci:check` is green before the phase commits. Phase 1 also needs `pnpm env:up` for the
migration and `model-calls.integration.test.ts`. No paid model run.

**Scope rule**: do not edit `prompts/step-grammar.ts`, `prompts/chronicle.ts`, `audit-words.ts`,
`claims.ts`, `fallback.ts` or the repair re-ask text in `call.ts`. Coerce no field beyond spec
S1 to S4. If a task seems to need one, stop and report.

## Phase 1: The schema-mismatch outcome (US1; FR-001 to FR-004; card AC #3)

**Goal**: the ledger names a schema failure `schema-mismatch`, apart from `invalid-json`.

**Independent test**: `call.test.ts` and `model-calls.integration.test.ts` pass with the new
cases; the migration applies on a fresh stack.

- [x] T001 [US1] In `apps/server/src/dm/pipeline/context.ts`, add `"schema-mismatch"` to
      `ModelCallRecord.outcome` (plan D1).
- [x] T002 [US1] In `apps/server/src/dm/pipeline/call.ts`, apply plan D1: `parseAgainst` returns
      a failure kind; both `callJson` settle sites use it; `logInvalid` emits
      `dm.call.${kind}`. Update the TASK-0203 doc comment on `logInvalid`.
- [x] T003 [US1] In `apps/server/src/schema/dm-model-calls.ts`, add `'schema-mismatch'` to the
      `dm_model_calls_outcome_valid` CHECK (plan D2).
- [x] T004 [US1] Run `pnpm env:up`, then `pnpm --filter @the-stacks/server db:generate`. Commit
      the generated SQL, snapshot and `_journal.json` change unedited. Run
      `pnpm --filter @the-stacks/server db:migrate` on the fresh stack and confirm it applies.
- [x] T005 [P] [US1] In `apps/web/app/debug/api-types.ts`, add `"schema-mismatch"` to
      `DebugModelCall.outcome` (plan D3).
- [x] T006 [P] [US1] In `.claude/skills/playtest-run/scripts/watch.mjs`, count and print
      `schema=<n>`. In `.claude/skills/playtest-run/SKILL.md`, flag `schema-mismatch` beside
      `invalid-json` (plan D3).
- [x] T007 [US1] Update `apps/server/test/dm/call.test.ts`: schema-failure expectations become
      `schema-mismatch`; unparsable ones stay `invalid-json`. Add a `dm.call.schema-mismatch` log
      case and a truncated schema failure that settles `truncated`.
- [x] T008 [US1] Extend `apps/server/test/dm/model-calls.integration.test.ts`: store and read back
      a `schema-mismatch` row.
- [x] T009 [US1] Amend `specs/031-dm-runtime/contracts/node-seam.md`,
      `specs/037-debug-api/contracts/debug-api.md` and `specs/037-debug-api/data-model.md` with
      the new outcome. Commit as `TASK-0203 phase 1: schema-mismatch outcome and migration`.

## Phase 2: Safe coercions (US2, US3; FR-005 to FR-009, FR-011; card AC #4)

**Starts after TASK-0240 merges.**

**Goal**: S1 to S4 parse on attempt 1; S5 to S8 still re-ask.

**Independent test**: `schema-coercions.test.ts` passes one test per shape S1 to S8, plus the
normalizer edge cases.

- [x] T010 [US2] In `apps/server/src/dm/nodes/director.ts`, export `capText`. Change nothing else.
- [x] T011 [US2] In `apps/server/src/dm/nodes/audit.ts`, add and export `normalizeAudit` (plan D4)
      and pass it as `normalize` in the `dm.audit` call. Add a `ponytail:` comment naming the
      ceiling: only the three card shapes are coerced; add a field only with a logged run shape.
- [x] T012 [US2] In `apps/server/src/dm/chronicle.ts`, add and export `normalizeChronicle`
      (plan D5) and pass it as `normalize` in the `dm.chronicle` call.
- [x] T013 [US2, US3] Create `apps/server/test/dm/schema-coercions.test.ts`: one `callJson` test
      per shape S1 to S8 with its wrapper, labeled "rebuilt from the TASK-0203 root-cause note";
      plus direct normalizer cases for every spec edge case.
- [x] T014 [US2] Amend `specs/034-narration-quality/contracts/audit-criteria.md` with
      `normalizeAudit`. Commit as `TASK-0203 phase 2: safe audit and chronicle coercions`.

## Phase 3: Prompts state the failed fields (US4; FR-010)

**Starts after TASK-0240 merges** (and after phase 2).

**Goal**: each producing prompt names the enum or field its model got wrong in run 1.

**Independent test**: `narrate.test.ts`, `assemble.test.ts`, `companion-addressee.test.ts` and
`interpret-prompt.test.ts` pass with the new versions and sentences.

- [ ] T015 [US4] Re-read each `PROMPT_VERSION` on `main`. "Next version" is one past it.
- [ ] T016 [P] [US4] `apps/server/src/dm/prompts/audit.ts`: add the plan D6 sentence; bump.
- [ ] T017 [P] [US4] `apps/server/src/dm/prompts/director.ts`: add the plan D6 sentence; bump.
- [ ] T018 [P] [US4] `apps/server/src/dm/prompts/companion.ts`: add the plan D6 sentence; bump.
- [ ] T019 [P] [US4] `apps/server/src/dm/prompts/interpret.ts`: add the plan D6 sentence to
      `OUTPUT_SHAPE`; bump. Do not edit `step-grammar.ts`.
- [ ] T020 [US4] Update the version pins and add one sentence assertion each in
      `apps/server/test/dm/narrate.test.ts` (audit), `assemble.test.ts` (director),
      `companion-addressee.test.ts` (companion) and `interpret-prompt.test.ts` (interpret).
- [ ] T021 [US4] Amend `specs/033-director-robustness/contracts/director-output.md` and
      `specs/031-dm-runtime/contracts/companions.md`. Commit as
      `TASK-0203 phase 3: prompts state enums and required fields`.

## Phase 4: Wiki re-ground

**Goal**: every note citing a changed file is re-verified and re-pinned honestly.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
freshness . docs/wiki` prints `OK`.

- [ ] T022 Run `/grounding-wiki:wiki-update`. Review `ai-gateway.md` (NEEDS-REVIEW): the gateway
      is unchanged; confirm no outcome claim there and re-pin.
- [ ] T023 Review `database-schema.md` (NEEDS-REVIEW): the CHECK list with `schema-mismatch` and
      its migration number.
- [ ] T024 Review `migrations.md` (NEEDS-REVIEW): add the new migration to `sources` and its row.
- [ ] T025 Review `dm-runtime.md` (NEEDS-REVIEW): the outcome split, both log events, the audit
      and chronicle normalizers, the new interpret and director versions.
- [ ] T026 Re-pin `dm-failure-and-gates.md`, `dm-turn-jobs.md`, `debug-view.md` and
      `dm-narration-quality.md` after checking their outcome, log-event and prompt-version
      claims against the diff.
- [ ] T027 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md` for every changed note
      summary, and add one TASK-0203 sentence to the INDEX state paragraph.
- [ ] T028 Run the freshness gate, the spec-bridge check and `pnpm ci:check`. Commit as
      `TASK-0203 phase 4: wiki re-ground`.

## After merge (orchestrator, not a phase)

- Card AC #3 and #4 tick at merge. AC #2 ticks at runbook B2's playtest, read per OQ-1.
- If OQ-2 stays (a), watch the playtest for a `[turn-mode]` `other` issue on prose that should
  have blocked; card it if seen.
