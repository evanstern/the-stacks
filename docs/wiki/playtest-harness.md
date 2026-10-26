---
name: playtest-harness
description: The playtest harness (TASK-0048, specs/032-playtest-harness, apps/server/src/playtest/) - in-process scripted play over the real gate and DM worker in a per-run _playtest database, the run directory, the auditor (six code checks plus the per-segment playtest.audit call), the report (finding ids, severities, fight stats), provider mode with the budget.ts cost guard, the pnpm playtest run/audit/estimate CLI and exit codes, and the CI case.
kind: pipeline
sources:
  - apps/server/src/playtest/harness.ts
  - apps/server/src/playtest/driver.ts
  - apps/server/src/playtest/scenario.ts
  - apps/server/src/playtest/db.ts
  - apps/server/src/playtest/export.ts
  - apps/server/src/playtest/budget.ts
  - apps/server/src/playtest/cli.ts
  - apps/server/src/playtest/purpose.ts
  - apps/server/src/playtest/auditor/audit.ts
  - apps/server/src/playtest/auditor/checks.ts
  - apps/server/src/playtest/auditor/segments.ts
  - apps/server/src/playtest/auditor/schema.ts
  - apps/server/src/playtest/auditor/stats.ts
  - apps/server/playtests/scenarios/greyhollow-ford.json
  - apps/server/test/playtest/playtest.integration.test.ts
  - .env.example
verified_against: 1dd5e874c5e7fec48888f245bf29a51c2fb0a38b
---

# Playtest harness

A playtest plays a scripted human seat through a whole scene of the AI DM ([[dm-runtime]]) and
then audits the result. It runs in process over the real gate ([[proposal-gate]]), gateway
([[ai-gateway]]) and DM worker ([[dm-turn-jobs]]); only the model answers differ by mode.
Code: `apps/server/src/playtest/`. Spec: `specs/032-playtest-harness/` (contracts, plus
`evidence/ci-playtest/`, one committed CI run directory).

## The run

`harness.ts`'s `runPlaytest({db, scenario, mode, out, provider?, noAudit?})` builds the gate,
gateway, DM enqueuer and worker, seeds the session from the scenario's `seedId`, then loops:
`driver.ts`'s `nextMove` picks the next scripted move, the harness submits it through
`gate.handle` as the human seat, and the worker drains until idle. Dice come from
`dice.ts`'s `scenarioRng`: the scenario's scripted faces, then `seededRng(seed)` (seed 0 if null). A scenario
(`scenario.ts`, Zod `ScenarioSchema`, shipped `apps/server/playtests/scenarios/greyhollow-ford.json`)
holds the seat, `moves.free`, `moves.combat`, `moves.fallback`, `limits` (`maxMoves`,
`maxWallMs`), `dice`, and a `ci` block naming the DM script, audit script and retrieval fixture
under `apps/server/playtests/fixtures/`. The manifest outcome is one of `ended`, `stalled`,
`failed`, `budget-stopped`, `timed-out`.

**Isolation.** `db.ts`'s `resolvePlaytestUrl` picks `PLAYTEST_DATABASE_URL`, else
`TEST_DATABASE_URL || DATABASE_URL` suffixed `_playtest`; the host must be loopback and the URL
must differ from the base. `recreatePlaytestDb` drops, creates and migrates it, and refuses while
another connection exists.

## Modes

- **ci** (default; the Vitest case): a strict `FakeProvider` answers the DM from a DM script and
  the auditor from an audit script (`queueAuditScript` queues them on purpose `playtest.audit`).
  It never spends.
- **provider** (`--mode provider` only): `loadAiConfig(process.env)` drives real models. It is
  refused when `CI` is set, needs every `dm.*` purpose plus `playtest.audit`, a price in
  `AI_PRICES` for each used `<provider>/<model>`, and `--spend-ceiling-usd`.

## Cost guard

`budget.ts` holds the provider preflight and the ceiling. `providerPreflight` checks in order:
CI refusal, missing purposes, missing prices (each exit 4), then the estimate, then a missing
ceiling or a ceiling below the upper-bound estimate (exit 3). `estimate` is a pinned per-purpose
table of expected and upper-bound calls and token sizes priced from `AI_PRICES`; the printout
says the ceiling, not the estimate, is what is enforced. At run time `countingSink` totals the
gateway's usage records and `budgetGateway` makes `chat` yield a `cancelled` error (and `embed`
throw) with message `playtest spend ceiling reached` once the total reaches the ceiling; the
harness also stops before each move with outcome `budget-stopped`. Overshoot is bounded by calls
already in flight.

## Run directory

`export.ts`: `writeRunDir` writes atomically (tmp then rename) `run.json` (manifest),
`transcript.jsonl` (DM view, every row), `transcript.md` (player view), `ledger.json`,
`jobs.json` (the `/dm` turns item shape, no prompt text), `usage.json`, and `report.json` /
`report.md` when audited. Default location `.playtests/<runId>/` (gitignored); `--out`
overrides. `exportSession` reads an existing session read-only; `readRunDir` re-reads a saved
directory with no database.

## The auditor

`auditor/audit.ts`'s `runAudit({transcript, ledger, jobs, seed, gateway, models})` cuts the
transcript with `segments.ts` (each `ai:dm` narration closes a segment; a tail with a `talk`
row is kept; no `scene.changed` row yields zero segments and the finding `no-scene`). Each
segment runs six pure code checks (`auditor/checks.ts`, `CHECK_IDS`):

| Check | Fails when |
|---|---|
| `prose-digits` | the narration prose (before the first blank line) has a digit |
| `dice-lines` | the dice lines after it differ from lines rebuilt from the ledger (`collectFacts`, `renderRollLine`, `renderChangeLine`) |
| `life-states` | a life-state word and the ledger's life-state changes disagree |
| `roll-reasons` | a ledger roll has an empty reason |
| `hidden-info` | public text contains a seed `hooks.secrets` string, or discloses secret tracker state (`trackerStateDisclosures`: a segment count or fraction, or the words tracker/clock/segment beside a tracker's name or id) |
| `dice-language` | the prose names dice or rolls and the segment's ledger has no roll |

A tracker's bare name is not hidden text: the outcome may be told. With a gateway, one
`playtest.audit` chat call per segment follows (`purpose.ts` constant; 700 `maxTokens` default;
doctrine, hidden facts and rows in the prompt; JSON-only output, one retry on a parse or gateway
error, then a per-segment `error`). With no gateway the audit is `checks-only`. Unknown doctrine ids become `other`; cited seqs outside the segment are dropped.

## Report and exit codes

`Report` (`auditor/schema.ts`): `verdict` is `pass`, `fail` or `incomplete` (no scene, or any
segment whose auditor call errored). Findings carry stable ids `F1`, `F2`, ..., `source`
(`check`, `auditor`, `dm-audit`), `kind` and a severity from `SEVERITY_OF`: `fail` for ledger
contradiction, invented mechanics, hidden-info leak, player agency, roll without reason and
no-scene; `warn` for `doctrine` and `other`; `note` for `dm-audit-flag`, one per job whose DM
runtime audit was flagged. `stats.ts` derives fight statistics from the ledger for TASK-0055
(rounds, attacks, hits, damage, reduced-to-zero, death saves, and `fledOrBargained` from roll
reasons, `null` plus `fledOrBargainedNote` when not derivable). A model note warns when
`playtest.audit` and `dm.narrate` resolve to the same provider and model.

`cli.ts` (`pnpm playtest run|audit|estimate`, built with `tsc -b`, loads `../../.env`, the same
shape as `bench:load`): `run` plays then
audits (`--no-audit` skips); `audit --dir` re-audits saved artifacts, `audit --session` exports
then audits (`--auditor fake|provider|none`); `estimate` prints the preflight estimate without a
model call. `EXIT`: 0 pass, 1 verdict fail or incomplete, 2 outcome not `ended`, 3 spend
unconfirmed, 4 refused, 64 usage.

## CI case

`test/playtest/playtest.integration.test.ts` runs the shipped scenario in ci mode inside
`pnpm test` (database-gated: loud skip, or throw under `REQUIRE_DATABASE=1`, see [[test-suite]])
and asserts outcome `ended` and a passing report. Other suites in `apps/server/test/playtest/`
cover the scenario, driver, dice, checks, audit, budget, CLI and a doctored run directory the
auditor must fail. The manual milestone run is a runbook under `docs/design/`, not covered here.
