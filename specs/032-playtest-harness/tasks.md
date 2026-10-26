---
description: "Task list for the playtest harness, auditor agent and M2 demo (TASK-0048)"
---

# Tasks: First Scene — scripted-dice playtest harness, auditor agent, milestone demo

**Input**: `specs/032-playtest-harness/` — spec.md, plan.md, research.md, data-model.md,
quickstart.md, contracts/ (scenario, run-directory, auditor, audit-report-schema, cost-guard,
cli, demo-runbook). Binding inputs from `specs/031-dm-runtime/contracts/`:
fake-gateway-script.md (format and loader unchanged), doctrine.md, audit.md, dm-api.md,
scene-seed.md, purposes.md.

**Tests**: required. Every card AC is proven by a named test or artifact below. Write each
phase's tests with its code. A phase is not done until they pass.

**Dispatch unit**: Phases 1 to 5 are one implementer dispatch each (sonnet, per the runbook).
Run them in order; each builds on the previous phase's files. Re-ground each dispatch from this
spec dir and the branch's commits. **Phase 6 is the demo. It is not dispatched.** The
orchestrator and the operator run it.

**Gate for every phase** (run before the phase's commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/server test && pnpm check:boundaries`.
Phase 4 and Phase 5 run `pnpm ci:check`. `pnpm ci:check` MUST be green before Phase 6 starts.

**Database suites**: run on the worktree's own stack. Run `pnpm env:up`. Run
`pnpm --filter @the-stacks/server db:migrate` against the app URL and the test URL (TASK-0098:
a fresh stack may come up unmigrated). Run the suites with `REQUIRE_DATABASE=1`. Leave the
stack up between phases; the orchestrator runs `pnpm env:down` before removing the worktree.

**Known flake**: the WebSocket gateway integration tests flake. On a WebSocket failure
unrelated to the phase's change, re-run the suite. Do not fix the flake. Record each re-run in
the phase's commit message.

**Model calls**: Phases 1 to 5 use the fake gateway only. Never run `--mode provider` or
`--auditor provider` against a real provider. Never set, read or commit an API key. A real
provider run is the Phase 6 operator checkpoint.

**Commit rule**: one or more commits per phase, message led by `TASK-0048:`, ending with the
`Co-Authored-By` trailer. Tick each task here (`- [x]`) in the commit that completes it. Use
the `backlog` CLI inside the worktree for any card change; never the backlog MCP tools.

**Out of scope** (do not touch): `apps/web`; `packages/*`; `apps/server/src/dm/**` (the
harness imports `dm/` exports; a needed `dm/` change is a STOP); the DM script
format and loader; the gate; the `events` and `jobs` tables; TASK-0055's parked combat rules;
`.github/workflows/`.

**STOP conditions**: a new npm dependency; a migration; a change to `dm/`, the gate, the
session model or the engine; a change to `DmScriptSchema`; any deferral not carded (decision-0020).
Stop and report.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1 harness run, US2 auditor, US3 modes and cost guard, US4 the demo, US5 the
  demo record (spec.md).

## AC coverage map

| Card AC | Proof (phase) |
|---|---|
| #1 scripted dice and players; transcript and ledger saved | `test/playtest/harness.integration.test.ts` (P2); `specs/032-playtest-harness/evidence/ci-playtest/` (P4) |
| #2 auditor checks transcript vs ledger and doctrine; writes a report | `test/playtest/checks.test.ts`, `test/playtest/audit.test.ts` (P3); `test/playtest/playtest.integration.test.ts` (P3) |
| #3 CI against the fake adapter; on demand against a provider | `test/playtest/playtest.integration.test.ts` in `pnpm ci:check` (P3); `test/playtest/budget.test.ts`, `test/playtest/cli.test.ts` (P4) |
| #4 one human plus AI companions play the scene to its end | `docs/design/m2-demo.md` criteria table and `docs/design/m2-demo/demo-session/` (P6) |
| #5 the demo record lists every audit failure and its resolution | `docs/design/m2-demo.md` failure table (P6) |

All test paths are under `apps/server/`.

---

## Phase 1: Foundations — purpose, schemas and fixtures (US1, US2, US3; AC #1, #2, #3)

**Goal**: every data shape the later phases use exists, is validated, and has fixtures.

**Independent test**: `test/playtest/scenario.test.ts` and `test/playtest/schema.test.ts` pass
with no database.

- [x] T001 Create `apps/server/src/playtest/purpose.ts`: `PLAYTEST_AUDIT_PURPOSE = "playtest.audit"` and `PLAYTEST_AUDIT_MAX_TOKENS = 700`.
- [x] T002 Create `apps/server/src/playtest/scenario.ts`: `ScenarioSchema`, `AuditScriptSchema`, `loadScenario(path)`, `loadAuditScript(path)` and `ScenarioError`, per contracts/scenario.md (paths resolved relative to the scenario file; the seat checked against the seed's one human character via `loadSeed`).
- [x] T003 Create `apps/server/src/playtest/auditor/schema.ts`: `AuditorOutput` (contracts/auditor.md), `FINDING_KINDS`, `SEVERITY_OF`, `FindingSchema`, `FightStatsSchema`, `ReportSchema` (contracts/audit-report-schema.md), and the run manifest schema `RunManifestSchema` (data-model.md).
- [x] T004 [P] Create `apps/server/playtests/scenarios/greyhollow-ford.json` per contracts/scenario.md "The shipped scenario" (move texts verbatim from `test/dm/scene.integration.test.ts`).
- [x] T005 [P] Create `apps/server/playtests/fixtures/greyhollow-ford.retrieve.json`: the scene test's `retrieve` result (the `PASSAGE` text and its `Fixture Rules` anchor), as JSON.
- [x] T006 [P] Create `apps/server/playtests/fixtures/greyhollow-ford.audit.json`: an `AuditScriptSchema` document with eight `json` responses `{ "verdict": "pass", "findings": [] }`, one per narration of `greyhollow-ford-full.json`, each with a `note` naming its segment.
- [x] T007 [P] Add `.playtests/` to `.gitignore`.
- [x] T008 [P] Write `apps/server/test/playtest/scenario.test.ts`: the shipped scenario loads and resolves its `ci` paths; each `ci` path exists; the DM script it names loads with `loadDmScript` unchanged; the auditor script loads; a wrong seat character, an unknown seed and a bad move id each fail with a named issue.
- [x] T009 [P] Write `apps/server/test/playtest/schema.test.ts`: `AuditorOutput` rejects `fail` with no findings and more than 12 findings; `SEVERITY_OF` covers every kind; `ReportSchema` round-trips a minimal report; a finding id must match `F<n>`.

---

## Phase 2: The harness run (US1; AC #1)

**Goal**: one command-free module call plays the whole scene in CI mode and writes the run
directory.

**Independent test**: `test/playtest/harness.integration.test.ts` passes on the worktree
stack with `REQUIRE_DATABASE=1`.

- [x] T010 [US1] Create `apps/server/src/playtest/db.ts`: `resolvePlaytestUrl(env)` (`PLAYTEST_DATABASE_URL`, else `TEST_DATABASE_URL || DATABASE_URL` suffixed `_playtest`; refuse equal-to-base and non-loopback) and `recreatePlaytestDb(...)` (drop, create, migrate with the drizzle migrator; refuse when another connection exists), following `apps/server/src/bench/load/db.ts` without editing it.
- [x] T011 [P] [US1] Create `apps/server/src/playtest/dice.ts`: `scenarioRng(faces, seed)` returning an engine `Rng` that serves `faces` in order, then `seededRng(seed)`; expose `drawn()` and `scriptedUsed()`.
- [x] T012 [P] [US1] Create `apps/server/src/playtest/driver.ts`: the pure `nextMove(projections, scenario, state)` per contracts/scenario.md "Driver", including `firstActionId` and `pt-<n>` ids.
- [x] T013 [US1] Create `apps/server/src/playtest/export.ts`: `exportSession(db, sessionId)` (paged `readFrom`, `loadProjections(..., { role: "dm" }).ledger`, `listDmJobs(db, sessionId, 500)` mapped to the dm-api item shape), `writeRunDir(dir, artifacts)` (atomic per file) and `readRunDir(dir)`, per contracts/run-directory.md.
- [x] T014 [US1] Create `apps/server/src/playtest/auditor/render.ts` with `renderTranscript(rows, ledger)` only (player view by `canSee` for a player viewer; dice lines via the `dm/facts.ts` renderers). `renderReport` comes in Phase 3.
- [x] T015 [US1] Create `apps/server/src/playtest/harness.ts`: `runPlaytest({ db, scenario, mode: "ci", out, signal? })` per plan.md "CI mode wiring" and "The human seat": scripted DM plus the auditor queue on one strict `FakeProvider`, `createGate`, `createGateway` with a counting `memorySink`-style sink, `createDmEnqueuer` registered on `gate.onAppended`, `createDmWorker` with the fixture `retrieve`, the scene-start `enqueueTurn`, the driver loop with a settle-and-drain helper, the stop conditions in data-model.md order, then `exportSession` and `writeRunDir`. Return the manifest. Record gate refusals of scripted moves in `moves.refusals`.
- [x] T016 [P] [US1] Write `apps/server/test/playtest/driver.test.ts`: free moves in order; fallback after the list; combat move only when the seat is the active combatant; the first combat move uses `firstActionId`; `"wait"` while a human action is unresolved; `"done"` when the scene ends or the move cap is reached.
- [x] T017 [P] [US1] Write `apps/server/test/playtest/dice.test.ts`: scripted faces first, then the seeded sequence equals `seededRng(seed)`'s; `drawn()` counts both.
- [x] T018 [US1] Write `apps/server/test/playtest/harness.integration.test.ts` (loud-skip, throw under `REQUIRE_DATABASE=1`; clear DM jobs before each test): the CI scenario ends with outcome `ended`; the run directory holds every file of contracts/run-directory.md except the report files; `transcript.jsonl` rows are in ascending seq and equal the session's log; the ledger's rolled faces equal the DM script's dice in order; `scriptRemaining` is zero for dice and every purpose except `dm.chronicle`; both companions and the human seat committed actions; a scenario with `maxMoves: 2` ends `stalled` with artifacts saved; a DM script with an `error` response for `dm.director` at scene start ends `failed` with the job id and artifacts saved.

---

## Phase 3: The auditor (US2; AC #2, #3)

**Goal**: the auditor turns a run directory into a report; the CI playtest plus its audit runs
in `pnpm test`.

**Independent test**: `test/playtest/checks.test.ts` and `test/playtest/audit.test.ts` pass
with no database; `test/playtest/playtest.integration.test.ts` passes on the stack.

- [x] T019 [US2] Create `apps/server/src/playtest/auditor/segments.ts`: `segment(transcript, ledger)` per contracts/auditor.md "Segments", including the tail rule and `no-scene`.
- [x] T020 [US2] Create `apps/server/src/playtest/auditor/checks.ts`: the six code checks of contracts/auditor.md (`prose-digits`, `dice-lines`, `life-states`, `roll-reasons`, `hidden-info`, `dice-language`), reusing `collectFacts`, `renderRollLine`, `renderChangeLine` (`dm/facts.ts`) and the word lists in `dm/audit-words.ts`.
- [x] T021 [P] [US2] Create `apps/server/src/playtest/auditor/stats.ts`: fight statistics per contracts/auditor.md "Fight statistics".
- [x] T022 [US2] Create `apps/server/src/playtest/auditor/prompt.ts`: `buildAuditorPrompt(segment, seed)` per contracts/auditor.md (system text, every `DOCTRINE` pair, hidden-information block, row lines under the token caps by `estimateTokens`, the on-trial text), with the `DOCTRINE_NOTICE` sentence in the file header.
- [x] T023 [US2] Create `apps/server/src/playtest/auditor/audit.ts`: `runAudit(input)` per contracts/auditor.md (code checks, one `playtest.audit` call per segment with one retry on parse failure or gateway error, parse rules 1 to 4, DM-runtime audit flags as `note` findings, finding ids, verdict rules, model note, usage).
- [x] T024 [US2] Add `renderReport(report)` to `apps/server/src/playtest/auditor/render.ts` per contracts/audit-report-schema.md "`report.md` layout".
- [x] T025 [US2] Extend `apps/server/src/playtest/harness.ts`: after export, run `runAudit` with the same gateway (CI mode: the scripted `playtest.audit` queue) unless `noAudit`; write `report.json` and `report.md`; add `scriptRemaining` for `playtest.audit`.
- [x] T026 [US2] Extend `apps/server/test/dm/doctrine.test.ts` guard rule 3 to scan `apps/server/src/playtest/auditor/` as well as `dm/prompts/`.
- [x] T027 [P] [US2] Create the doctored fixture `apps/server/test/playtest/fixtures/doctored/` (`run.json`, `transcript.jsonl`, `ledger.json`, `jobs.json`, `README.md`): a copy of a CI run directory with one planted problem per code check (a changed dice-line total, a digit in prose, "falls unconscious" for a character with no such change, an empty roll reason, a seed secret in a public narration, dice words in a segment with no roll) and one job audit record with `flagged: true`. The README lists each planted problem, its row seq and its expected check id.
- [x] T028 [P] [US2] Write `apps/server/test/playtest/checks.test.ts`: each check passes on a clean segment and fails on its planted problem with the right kind and seqs; the DM runtime's `factualSummary` output passes every check.
- [x] T029 [P] [US2] Write `apps/server/test/playtest/audit.test.ts` (no database; a strict `FakeProvider` gateway): the doctored fixture gives verdict `fail` with exactly the README's findings (checks-only mode); a scripted doctrine finding becomes `warn` with its `doctrineId` and `fail` stays out of the verdict; an unknown `doctrineId` becomes `other`; out-of-segment seqs are dropped; a non-JSON answer retries once then records `{ error }` and verdict `incomplete`; a fenced-JSON answer parses; the flagged job becomes one `note` finding; finding ids are stable across two runs; neither report file contains prompt text; `modelNote` is set when `playtest.audit` and `dm.narrate` share provider and model.
- [x] T030 [US2] Write `apps/server/test/playtest/playtest.integration.test.ts` (loud-skip, throw under `REQUIRE_DATABASE=1`; clear DM jobs before each test): the CI scenario runs with the audit; the report verdict is `pass`; eight segments; zero `fail` findings; every scripted auditor response consumed; `fight` is not null and counts the strike; `report.md` exists. This file is the AC #3 CI case.

---

## Phase 4: Provider mode, the cost guard and the CLI (US3; AC #3, #1 evidence)

**Goal**: the CLI runs both modes; provider mode cannot spend without an explicit ceiling.

**Independent test**: `test/playtest/budget.test.ts` and `test/playtest/cli.test.ts` pass with
no database and no network; `pnpm playtest run` produces a passing CI run directory.

- [x] T031 [US3] Create `apps/server/src/playtest/budget.ts`: `estimate(...)` with the pinned per-purpose table of contracts/cost-guard.md, `countingSink(inner)`, `budgetGateway(gateway, sink, ceilingUsd)`, and `providerPreflight(env, aiConfig, needs)` returning the ordered refusals of contracts/cost-guard.md steps 1 to 3.
- [x] T032 [US3] Extend `apps/server/src/playtest/harness.ts` with `mode: "provider"` per plan.md "Provider mode wiring": `loadAiConfig` passed in, `scenarioRng(scenario.dice.faces, seed)`, the counting sink and `budgetGateway`, real `retrieve` over a separate library database handle, outcome `budget-stopped` when the ceiling is reached; record `dice`, `models` (names only) and `spend` in the manifest.
- [x] T033 [US3] Create `apps/server/src/playtest/cli.ts`: `run`, `audit`, `estimate` per contracts/cli.md, the exit codes, stderr JSON log lines, and the preflight order of contracts/cost-guard.md (estimate printed before the ceiling check; no run directory created on exit 3 or 4).
- [x] T034 [US3] Add the `playtest` script to `apps/server/package.json` (`tsc -b && node --env-file-if-exists=../../.env dist/playtest/cli.js`) and to the root `package.json` (`pnpm --filter @the-stacks/server playtest`).
- [x] T035 [P] [US3] Update `.env.example`: add a commented `playtest.audit` entry to the `AI_PURPOSES` example, with the note "strong tier; prefer a different model family than dm.narrate", and a commented `PLAYTEST_DATABASE_URL` override.
- [x] T036 [P] [US3] Write `apps/server/test/playtest/budget.test.ts`: the estimate table is pinned; expected ≤ upper bound for every purpose; a priced `fake` provider with a ceiling of one call's cost lets one call through and cancels the next with kind `cancelled` and no provider call; `embed` throws past the ceiling; `providerPreflight` refuses under `CI`, names every missing purpose, names every unpriced model, in that order.
- [x] T037 [P] [US3] Write `apps/server/test/playtest/cli.test.ts` (calls the CLI's exported `main(argv, env)`; no database): `run --mode provider` with `CI=1` exits 4; with no `AI_*` exits 4 naming purposes; with a complete priced fake config and no ceiling prints the estimate and exits 3 with no gateway call and no run directory; a ceiling below the upper bound exits 3; `estimate` exits 0; a bad flag exits 64; `audit --dir <doctored> --auditor none` exits 1.
- [x] T038 [US3] Run `pnpm playtest run --out specs/032-playtest-harness/evidence/ci-playtest` on the worktree stack. Confirm outcome `ended` and verdict `pass`. Commit the run directory.
- [x] T039 [US3] Run `REQUIRE_DATABASE=1 pnpm ci:check`. It must exit 0. Paste its summary into `specs/032-playtest-harness/evidence/ci-check.txt`.

---

## Phase 5: Demo runbook and record template (US4, US5 preparation; AC #4, #5)

**Goal**: the demo can be run and recorded from a committed document.

**Independent test**: `docs/design/m2-demo.md` holds every runbook step and the full record
template of contracts/demo-runbook.md; every command it names exists.

- [x] T040 [US4] Create `docs/design/m2-demo.md`: a status line ("Template — filled at the M2 demo, TASK-0048 Phase 6"), the runbook sections A to F verbatim in substance from contracts/demo-runbook.md, then the record template.
- [x] T041 [US5] Create `docs/design/m2-demo/.gitkeep` so the attachments directory exists.
- [x] T042 [US4] Dry-check the runbook on the worktree stack without a provider: run `pnpm playtest estimate` (expect exit 4 naming the missing purposes) and confirm `pnpm env:status`, the `/auth/me` shape and the `/dm` start route path match the runbook text. Fix the runbook text, not the code, on a mismatch; a code mismatch is a STOP.
- [x] T043 Run `REQUIRE_DATABASE=1 pnpm ci:check`. It must exit 0 before Phase 6.

---

## Phase 6: The M2 demo — ORCHESTRATOR AND OPERATOR, NOT DISPATCHED (US4, US5; AC #4, #5)

**Goal**: the milestone demo has run, and its record is committed with the auditor reports
attached (runbook merge condition for TASK-0048).

**Who**: the orchestrator drives the stack, the CLI and the record; the operator plays the
human seat in Brave and approves every paid run. No implementer runs any task in this phase.

**Precondition**: Phases 1 to 5 ticked; T043 green.

- [ ] T044 [US4] **Checkpoint (operator)**: follow `docs/design/m2-demo.md` section B. Present `pnpm playtest estimate` output, the provider names and the model per purpose. Get the operator's approval and ceilings. Record them on TASK-0048 with `backlog task edit TASK-0048 --append-notes` from the worktree. Do not run any provider command before this approval.
- [ ] T045 [US4] Run the paid scripted playtest (section C) under the approved ceiling. Copy its run directory to `docs/design/m2-demo/provider-playtest/`. Stop and report to the operator on outcome `failed` or `timed-out`.
- [ ] T046 [US4] Play the demo (section D): the operator plays Tamsin in Brave to the scene's end; the orchestrator watches `/dm/sessions/<id>/turns`, records retries, and saves `docs/design/m2-demo/scene-end.png`.
- [ ] T047 [US5] Audit the demo session (section E) under the approved ceiling into `docs/design/m2-demo/demo-session/`.
- [ ] T048 [US5] Fill `docs/design/m2-demo.md` (section F): the criteria table, the runs table, one failure-table row per finding and DM-runtime audit flag in both reports, each with a resolution; card each `carded` row and each failed demo criterion with the `backlog` CLI; get the operator's sign-off for `accepted` and `false-positive` rows.
- [ ] T049 [US5] Verify SC-006: the failure table's row count equals the findings plus flags in both `report.json` files, and no row lacks a resolution. Commit the record and `docs/design/m2-demo/` on the task branch.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6, strictly.
- Within a phase, `[P]` tasks touch different files and may run together after the non-`[P]`
  tasks they test exist.
- Phase 6 starts only after T043 is green and the operator is available. A `fixed` resolution
  in T048 may add a code commit; re-run `pnpm ci:check` after it.

## Parallel examples

- Phase 1: T004, T005, T006, T007 together; then T008 and T009 together.
- Phase 2: T011 and T012 together, then T016 and T017 together.
- Phase 3: T021 beside T019 and T020; T027, T028, T029 together after T023.
- Phase 4: T035, T036, T037 together after T033.

## Implementation Strategy

MVP is US1 (Phases 1 and 2): a full scripted scene with saved evidence. US2 adds the judge, US3
the paid path and its guard, US4 and US5 the milestone event. Each phase lands green on its
own, so a stopped sweep resumes from the last ticked task.

## Notes

- The orchestrator re-seeds the card's phase ACs from this file before the first
  implementation dispatch (`spec-bridge:link`).
- The wiki re-ground is a separate dispatch after merge (runbook): reviews of `test-suite`,
  `ci-pipeline`, `ai-gateway`, `configuration`, `dm-runtime` (doctrine guard scope); new notes
  `playtest-harness` and `m2-demo` (beside `m0-demo`); regenerate `CAPSULES.md`; update
  `INDEX.md`.
- TASK-0055 reads this card's evidence (`docs/design/m2-demo/`, fight statistics). This card
  changes no combat rule.

## Deviations

- Phase 4: a job that fails because the ceiling cancelled its call ends the run `budget-stopped`, not `failed` (data-model.md lists `failed` first; the cancellation is the ceiling's doing).
- Phase 4: `providerPreflight` returns every refusal found, step 1 first, instead of stopping at step 1. The CLI exits 4 on any refusal.
- Phase 4: the retrieval embed purpose joins the estimate and the price check only when it is configured in `AI_PURPOSES`.
- Phase 4: relative CLI paths resolve against `INIT_CWD` (the directory `pnpm` was invoked from), because `pnpm --filter` runs in `apps/server`. The default `--out` is `.playtests/<runId>` (already gitignored).
- Phase 4: `FightStatsSchema` gained `fledOrBargainedNote` (default `null`), set when `fledOrBargained` is `null`.
- Phase 4: `T039` evidence in `evidence/ci-check.txt` is the summary of the run, not the full log.
- Phase 5: `pnpm env:status` prints no `APP_PORT`; `pnpm env:up` prints the ports and `.env` holds `TEST_DATABASE_URL`. The runbook (section A) says how to derive the ports and the app database URL.
- Phase 5: the T042 dry check ran `pnpm playtest estimate` (exit 4, naming 8 purposes plus `ollama/bge-m3` unpriced); `pnpm playtest --help` is not a command (exit 64). The `/dm` routes (`POST /sessions/:id/start`, `POST /sessions/:id/turn`, `GET /sessions/:id/turns`) match the runbook; `start` returns 202.
- Demo fix D3: `splitNarration` split at the first blank line, so a multi-paragraph prose narration (every real scene-start) counted its later paragraphs as dice lines. It now takes only the final blank-line block, and only when every line carries a rendered dice-line marker (`→` or `: auto-fail`). Regression tests use the real seq-10 texts of both paid runs.
- Demo fix D4: in provider mode the CLI rewrites `host.docker.internal` to `localhost` in `AI_PROVIDERS` base URLs when it runs on the host (no `/.dockerenv`), logging a `rewrite-provider-host` line per provider on stderr. `PLAYTEST_HOST_NETWORK=1` forces the rewrite and `=0` disables it. It is an env override, not a flag. The usage text names it.
