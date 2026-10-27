# Implementation Plan: First Scene — scripted-dice playtest harness, auditor agent, milestone demo

**Branch**: `task-0048-playtest` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/032-playtest-harness/spec.md` (TASK-0048).

## Summary

Add a server-side **playtest module** (`apps/server/src/playtest/`) with a CLI
(`pnpm playtest run | audit | estimate`). `run` recreates a `<base>_playtest` database, wires
the real gate, gateway, DM worker and enqueuer in-process, and plays a **scenario**: scripted
human-seat moves submitted through `gate.handle`, the AI companions and AI DM played by the
DM runtime, dice from the DM script (CI mode) or scripted-then-seeded (provider mode). It saves
a **run directory** (manifest, transcript, readable transcript, ledger, jobs, usage). `audit`
splits a transcript into one segment per narration, runs code checks against the ledger, then
one `playtest.audit` gateway call per segment with the doctrine pairs, and writes
`report.json` + `report.md`. CI mode answers every model call from fixture scripts through the
strict fake adapter; a Vitest database suite runs it inside `pnpm test`, so `ci:check` and the CI
workflow cover it with no workflow edit. Provider mode is explicit, refused under `CI`, prints
an estimate, and needs `--spend-ceiling-usd`; a budget wrapper around the gateway cancels every
call once counted spend reaches the ceiling. The **demo** is a runbook plus a record template
(`docs/design/m2-demo.md`, attachments in `docs/design/m2-demo/`); the orchestrator and the
operator run it.

## Technical Context

**Language/Version**: TypeScript 5.9, Node 22 (ESM, compiled by `tsc -b` to `apps/server/dist`).

**Primary Dependencies**: existing only — `zod`, `drizzle-orm` (migrator), `pg`, the server's
AI gateway, DM runtime, gate, `@the-stacks/session-model`, `@the-stacks/dnd5e-engine`
(`scriptedRng`, `seededRng`), `@the-stacks/srd` (`estimateTokens`). `node:util` `parseArgs` for
the CLI. **No new runtime dependency.**

**Storage**: Postgres. The harness's own `<base>_playtest` database (dropped, recreated,
migrated per run, loopback only). `audit --session` reads a named database read-only. Artifacts
are files in the run directory. **No migration.**

**Testing**: Vitest. Unit tests (no database) for scenario/report schemas, segmenting, code
checks, prompt build, estimate, budget wrapper, CLI guards. One database suite,
`apps/server/test/playtest/playtest.integration.test.ts`, loud-skip or throw under
`REQUIRE_DATABASE=1`, like the DM suites.

**Target Platform**: host-run CLI against a worktree stack (`pnpm env:up`); CI's
`docker-compose.test.yml` database.

**Project Type**: server module plus CLI inside the existing monorepo.

**Performance Goals**: CI-mode full scene plus audit under 60 s on the CI runner (SC-001).

**Constraints**: no model call without explicit provider mode and a spend ceiling; never read or
write a key; session writes only through the gate; the DM script format and loader unchanged
(fake-gateway-script.md, "binding for TASK-0048").

**Scale/Scope**: one scene per run; eight to fifteen narrations; tens to low hundreds of rows.

## Constitution Check

*GATE: pre-Phase 0 and post-Phase 1. Constitution 2.0.0.*

- [x] **I. Agent-operable** — the harness is a CLI and a module API (`runPlaytest`,
      `exportSession`, `runAudit`). It drives the human seat through `gate.handle`, the same
      request path the WebSocket gateway calls, and starts scenes with the DM runtime's
      `scene-start` trigger, the same job the `/dm` start route inserts.
- [x] **II. Content contract** — no codex entity. The scenario is a Zod-validated test
      document, not content.
- [x] **III. Data planes** — new state is files plus play rows in the playtest database's
      session plane. Provider-mode retrieval reads the library plane through the existing
      `retrieve` seam. The module sits outside `dm/`, `library/` and `codex/`; it imports the
      log only for `readFrom` (a reader).
- [x] **IV. Event sourcing** — the harness appends nothing directly; every write is a gate
      request. The write-boundary test stays green (no writer binding imported).
- [x] **V. Citations** — no new library claim. CI retrieval uses an original-text fixture with
      a real anchor shape so the adjudicator's citation check runs.
- [x] **VI. 5e engine boundary** — dice come from the engine's `scriptedRng` / `seededRng`
      (a composite wrapper in the harness, not an engine change). The auditor reads numbers
      from the ledger and renders them with the DM runtime's own renderers; it computes no
      rule.
- [x] **VII. Structured first** — the report and manifest are Zod-validated data before the
      Markdown render. The manifest records provider, model and seed per run.
- [x] **VIII. Operator-owned content** — fixtures are original seed text and generated play
      text; no book text is committed. NON-NEGOTIABLE: pass.
- [x] **IX. Self-hostable** — every model call goes through the gateway under a named purpose;
      no vendor name in source; no new container or service.

**Stack conformance**: within the table. No new language, service or datastore.

Post-Phase 1 re-check: pass. The design adds one gateway purpose (`playtest.audit`), one
module, one CLI, one package script, fixtures, and docs. No violation; Complexity Tracking empty.

## Design

### Where code lives

| Path | Role |
|---|---|
| `apps/server/src/playtest/purpose.ts` | `PLAYTEST_AUDIT_PURPOSE = "playtest.audit"`, its default `maxTokens` |
| `apps/server/src/playtest/scenario.ts` | `ScenarioSchema`, `loadScenario(path)` (resolves fixture paths relative to the file) — [contracts/scenario.md](contracts/scenario.md) |
| `apps/server/src/playtest/db.ts` | `resolvePlaytestUrl(env)`, `recreatePlaytestDb(...)` — the `_load` pattern from `bench/load/db.ts`, re-implemented (no refactor of the bench) |
| `apps/server/src/playtest/dice.ts` | `scenarioRng(faces, seed)`: scripted faces, then `seededRng(seed)` |
| `apps/server/src/playtest/budget.ts` | `estimate(...)`, `budgetGateway(gateway, ceiling)`, `countingSink` — [contracts/cost-guard.md](contracts/cost-guard.md) |
| `apps/server/src/playtest/driver.ts` | `nextMove(projections, scenario, state)` — pure move choice (FR-004) |
| `apps/server/src/playtest/harness.ts` | `runPlaytest(opts)`: wires and runs one playtest; returns the manifest |
| `apps/server/src/playtest/export.ts` | `exportSession(db, sessionId)`: transcript, ledger, jobs; `writeRunDir`, `readRunDir` — [contracts/run-directory.md](contracts/run-directory.md) |
| `apps/server/src/playtest/auditor/segments.ts` | `segment(transcript)` (FR-010) |
| `apps/server/src/playtest/auditor/checks.ts` | code checks (FR-011) |
| `apps/server/src/playtest/auditor/prompt.ts` | prompt builder, doctrine notice header (FR-018) |
| `apps/server/src/playtest/auditor/schema.ts` | `AuditorOutput`, `ReportSchema`, `FindingSchema` — [contracts/auditor.md](contracts/auditor.md), [contracts/audit-report-schema.md](contracts/audit-report-schema.md) |
| `apps/server/src/playtest/auditor/stats.ts` | fight statistics from the ledger (TASK-0055 evidence) |
| `apps/server/src/playtest/auditor/audit.ts` | `runAudit(input)` → `Report` |
| `apps/server/src/playtest/auditor/render.ts` | `renderReport(report)` → Markdown; `renderTranscript(...)` → player-view Markdown |
| `apps/server/src/playtest/cli.ts` | `run`, `audit`, `estimate` subcommands — [contracts/cli.md](contracts/cli.md) |
| `apps/server/playtests/scenarios/greyhollow-ford.json` | the scenario (both modes) |
| `apps/server/playtests/fixtures/greyhollow-ford.audit.json` | CI auditor script (one response per segment) |
| `apps/server/playtests/fixtures/greyhollow-ford.retrieve.json` | CI retrieval fixture (original text; the scene test's passage) |
| `apps/server/test/playtest/` | unit tests, the database suite, a doctored-transcript fixture |
| `docs/design/m2-demo.md` | demo runbook and record template (Phase 5), filled at the demo (Phase 6) — [contracts/demo-runbook.md](contracts/demo-runbook.md) |

Package scripts: `apps/server/package.json` `"playtest": "tsc -b && node
--env-file-if-exists=../../.env dist/playtest/cli.js"`; root `"playtest": "pnpm --filter
@the-stacks/server playtest"`. `.gitignore` gains `.playtests/` (the default run directory root).

### Why not under `dm/`

The `dm/**` Biome zone forbids `**/events/**`, which the exporter needs for `readFrom`. The
harness is a caller of the DM runtime, not part of it, like the bench is a caller of
ingestion. It imports `dm/` exports (worker, enqueuer, script loader, facts renderers,
audit-words, doctrine, seed loader); nothing in `dm/` imports `playtest/`.

### CI mode wiring

1. `loadDmScript(scenario.ci.dmScript)` and `createScriptedDm(...)` — unchanged loader.
2. Extend the returned `aiConfig` (a new object, the loader untouched) with
   `playtest.audit → { provider: "scripted", model: "scripted-chat", op: "chat" }`, and queue the
   auditor script's responses with `scripted.provider.scriptChatFor("playtest.audit", ...)`.
3. `createGate({ db, rng: scripted.gateRng })`, `createGateway({ config, sink, adapters: { fake:
   () => scripted.provider } })`, `createDmEnqueuer`, `createDmWorker({ retrieve: fixture })`.
4. Drive the scenario; `drain` the worker between moves until idle (the `drainAll` settle loop
   from `worker-world.ts`, re-implemented in the harness).
5. Assert-free at module level; the database suite asserts. `remaining()` goes in the manifest.

### Provider mode wiring

`loadAiConfig(process.env)`; check every `DM_PURPOSES` entry and `playtest.audit` are configured
and priced; print the estimate; require the ceiling; build `createGateway` with a counting sink
and wrap it with `budgetGateway`. Gate RNG: `scenarioRng(scenario.dice ?? [], seed)`. Retrieval:
`retrieve({ db: libraryDb, gateway, config: loadRetrievalConfig(env) }, q)` against the base
database (read-only use), so an ingested library serves rulings.

### The human seat

`gate.handle(sessionId, { kind: "human", userId: scenario.seat.userId, role: "player" },
{ kind: "action.declare", ... })` then `action.commit`. A refusal is recorded in the manifest
(`refusals[]`) and the driver moves on. The scene starts with `enqueueTurn(db, sessionId,
"scene-start", null, { start: { seedId, seats: { [characterId]: userId } } })`.

### The auditor

See [contracts/auditor.md](contracts/auditor.md). Model note: purpose `playtest.audit`, op
`chat`, default `maxTokens` 700, **suggested tier strong**, preferably a different family than
`dm.narrate` (the report warns when the configured model names are equal). Calls per playtest:
one per segment (8 to 15). The CI auditor script answers `pass` for each of the eight segments
of `greyhollow-ford-full.json`.

### Transcript and report formats

- Transcript: JSON Lines, one `StoredEvent` per line, DM view, `seq` order —
  [contracts/run-directory.md](contracts/run-directory.md).
- Report: `report.json` (Zod `ReportSchema`, `v: 1`) and `report.md` —
  [contracts/audit-report-schema.md](contracts/audit-report-schema.md).

### CI integration

`apps/server/test/playtest/playtest.integration.test.ts` runs in `pnpm test`, which `ci:check`
runs and the CI workflow runs with `REQUIRE_DATABASE=1`. **No workflow edit and no new
`ci:check` entry**: the DM suites follow the same rule, and `ci:check` stays the exact local
mirror of CI (ci-pipeline note). The suite clears DM jobs before each test like the DM suites
(claims are global). It runs on the test database directly, not on `_playtest` (the CLI's
isolation guards a running app worker; CI has none).

### Doctrine notice

`auditor/prompt.ts` imports `DOCTRINE` and carries the `DOCTRINE_NOTICE` sentence in its header.
`apps/server/test/dm/doctrine.test.ts` check 3 extends from `dm/prompts/` to also scan
`playtest/auditor/`.

### Configuration

`.env.example` gains a commented `playtest.audit` entry beside the seven `dm.*` purposes. No new
environment variable beyond optional `PLAYTEST_DATABASE_URL` (override, like
`LOAD_DATABASE_URL`).

### Gates for this task

- `pnpm ci:check` green in the worktree; DB suites with `REQUIRE_DATABASE=1` on the worktree
  stack. TASK-0098 workaround: a fresh stack may be unmigrated; run
  `pnpm --filter @the-stacks/server db:migrate` for the app and the test database URLs by hand.
- WebSocket gateway suites are known-flaky: re-run, do not fix.
- `check:host-scripts` unchanged (the CLI runs from `dist`, not under strip-types).
- Write-boundary test and boundary rules unchanged and green.
- The demo (Phase 6) is the merge condition: the record is committed.

## Project Structure

### Documentation (this feature)

```text
specs/032-playtest-harness/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── scenario.md
│   ├── run-directory.md
│   ├── auditor.md
│   ├── audit-report-schema.md
│   ├── cost-guard.md
│   ├── cli.md
│   └── demo-runbook.md
├── checklists/requirements.md
├── evidence/            # Phase 4: the CI-mode run directory, committed
└── tasks.md
```

### Source Code (repository root)

```text
apps/server/
├── src/playtest/                 # new: harness, auditor, CLI
│   └── auditor/
├── playtests/                    # new: scenario and CI fixtures
│   ├── scenarios/
│   └── fixtures/
└── test/playtest/                # new: unit tests, DB suite, doctored fixture
apps/server/test/dm/doctrine.test.ts   # extended: notice guard covers playtest/auditor/
.env.example                      # playtest.audit example
.gitignore                        # .playtests/
package.json, apps/server/package.json   # playtest scripts
docs/design/m2-demo.md            # runbook + record template, then the record
docs/design/m2-demo/              # attachments (Phase 6)
```

**Structure Decision**: one new server module beside `bench/`, the same CLI pattern
(`tsc -b && node dist/.../cli.js`), data beside the code in `apps/server/playtests/` like
`apps/server/seeds/` and `apps/server/bench/load/profiles/`.

## Complexity Tracking

None.
