---
name: playtest-harness
description: The playtest harness (TASK-0048, specs/032-playtest-harness, apps/server/src/playtest/) - in-process scripted play over the real gate and DM worker in a per-run _playtest database, the run directory, the auditor (seven code checks plus the per-segment playtest.audit call), the report (finding ids, severities, fight stats), provider mode with the budget.ts cost guard, the pnpm playtest run/audit/estimate CLI and exit codes, and the CI case.
kind: pipeline
sources:
  - apps/server/src/playtest/harness.ts
  - apps/server/src/playtest/driver.ts
  - apps/server/src/playtest/scenario.ts
  - apps/server/src/dm/deeds.ts
  - apps/server/src/playtest/db.ts
  - apps/server/src/playtest/export.ts
  - apps/server/src/playtest/budget.ts
  - apps/server/src/playtest/cli.ts
  - apps/server/src/playtest/purpose.ts
  - apps/server/src/playtest/auditor/audit.ts
  - apps/server/src/playtest/auditor/prompt.ts
  - apps/server/src/playtest/auditor/checks.ts
  - apps/server/src/playtest/auditor/segments.ts
  - apps/server/src/playtest/auditor/schema.ts
  - apps/server/src/playtest/auditor/stats.ts
  - apps/server/playtests/scenarios/greyhollow-ford.json
  - apps/server/test/playtest/playtest.integration.test.ts
  - apps/server/test/playtest/stats.test.ts
  - .env.example
  - .claude/skills/playtest-run/scripts/checklist.mjs
  - .claude/skills/playtest-run/scripts/watch.mjs
  - .claude/skills/playtest-run/scripts/local-table.mjs
  - apps/server/seeds/greyhollow-ford-reed-camp.json
  - apps/server/dm-scripts/runbook-a-reed-camp.json
size_budget_exempt: the note sat within 40 chars of the 8000 budget before TASK-0195; the per-runbook scenario section is a short pointer to docs/design/playtest-scenarios.md, and the in-process harness above is one pipeline that does not split without a TASK of its own
verified_against: 62214d4016b1b30ce482f3b1a1525a30013a81bf
---

# Playtest harness

A playtest plays a scripted human seat through a whole scene of the AI DM ([[dm-runtime]]) and
then audits the result. It runs in process over the real gate ([[proposal-gate]]), gateway
([[ai-gateway]]) and DM worker ([[dm-turn-jobs]]); only the model answers differ by mode.
Code: `apps/server/src/playtest/`. Spec: `specs/032-playtest-harness/` (contracts, plus
`evidence/ci-playtest/`, one committed CI run directory).

## The run

`harness.ts`'s `runPlaytest({db, scenario, mode, out, provider?, noAudit?})` builds the gate (with
a static presence reader that names the scripted seat's user present and counts every `ai:`
actor present, so each turn's marker lists the scripted seat; [[presence]]),
gateway, DM enqueuer and worker, seeds the session from the scenario's `seedId`, then loops:
`driver.ts`'s `nextMove` picks the next scripted move, the harness submits it through
`gate.handle` as the human seat, and the worker drains until idle. Dice come from
`dice.ts`'s `scenarioRng`: the scenario's scripted faces, then `seededRng(seed)` (seed 0 if null). A scenario
(`scenario.ts`, Zod `ScenarioSchema`, shipped `apps/server/playtests/scenarios/greyhollow-ford.json`)
holds the seat, `moves.free`, `moves.combat`, `moves.fallback`, `limits` (`maxMoves`,
`maxWallMs`, 60 min in the shipped scenario), `dice`, and a `ci` block naming the DM script, audit script and retrieval fixture (the schema still names it; since spec 110 the harness no longer reads it, because the DM worker takes no `retrieve`)
under `apps/server/playtests/fixtures/`. A move with `intent: true` (spec 111) is a confirmed direct Intent: the harness parses its slash `text` with `@the-stacks/intent`, sends `{kind: "intent"}` through `gate.handle`, and counts a parse or gate refusal in `refusals`. The driver passes `intent` through, so the shipped scenario's two such moves (`/search #ferry-house`, `/move #causeway`) take the direct-Intent path with no interpret call. A move with `confirm: true` (spec 114; exclusive with `intent`) declares `text`, lets the DM react, then accepts the seat's live suggestion items through `gate.handle` `action.accept` (refusal `NO_CONFIRM` when none is live); the shipped scenario opens with one (`confirm-search`). The harness sets `readWindowMs` to 0, so the scripted seat leaves no read window. The manifest outcome is one of `ended`, `stalled`,
`failed`, `budget-stopped`, `timed-out`.

`moves.fallback` is a list (1 to 20 entries; a legacy single object reads as a one-element list).
Once the scripted `free` moves run out, the driver cycles the list in order and never sends the
same text twice in a row. After each fallback move the harness checks the ledger
(`turnChangedState`: any `change` row after the move, except seat and gate-policy rows, and a
table-mode row only when the mode itself changed). Three consecutive fallback moves that change
nothing (`STALL_LIMIT`) end the run as `stalled` with `stallReason: "seat-exhausted"` in the manifest.

**Downed seat.** `seatDowned` (`driver.ts`) is true when the seat's combatant is at 0 HP or not conscious. `nextMove` never declares for it: `wait` in turn mode (settling rolls its death saves, [[dm-turn-jobs]]), `done` in free mode, which ends the run `stalled` with `stallReason: "seat-downed"`.

**Isolation.** `db.ts`'s `resolvePlaytestUrl` picks `PLAYTEST_DATABASE_URL`, else
`TEST_DATABASE_URL || DATABASE_URL` suffixed `_playtest`; the host must be loopback and the URL
must differ from the base. `recreatePlaytestDb` drops, creates and migrates it, and refuses while
another connection exists.

## Modes

- **ci** (default; the Vitest case): a strict `FakeProvider` answers the DM from a DM script
  (`dm/script/load.ts`, shared with `apps/server/dm-scripts`, TASK-0158) and
  the auditor from an audit script (`queueAuditScript`).
  It never spends.
- **provider** (`--mode provider` only): `loadAiConfig(process.env)` drives real models. It is
  refused when `CI` is set, needs every `dm.*` purpose plus `playtest.audit`, a price in
  `AI_PRICES` for each used `<provider>/<model>`, and `--spend-ceiling-usd`. On the host, `host.docker.internal` base URLs become `localhost` (`PLAYTEST_HOST_NETWORK`).

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
`jobs.json` (the `/dm` turns item shape, no prompt text; a turn item also carries `factsThrough`, the checkpoint's facts window end or `null`, and `narrationSeqs`, the narration seqs the job shipped, spec 115), `usage.json`, and `report.json` /
`report.md` when audited. Default `.playtests/<runId>/` (gitignored); `--out` overrides. `exportSession` reads a session read-only; `readRunDir` re-reads a saved directory.

## The auditor

The auditor prompt (`auditor/prompt.ts`, `playtest.audit-v2`, specs/074) adds a `## Party` section: each seed character with `human player` or `AI companion`, then `agencyRule("auditor")`. `hero-is-theirs` covers every party member, companions included; a companion's own talk and declared actions are its own choices.

`auditor/audit.ts`'s `runAudit({transcript, ledger, jobs, seed, gateway, models})` cuts the
transcript with `segments.ts` (each `ai:dm` narration closes a segment, cut at that narration's facts window: `narrationCuts(jobs)` maps each `narrationSeqs` entry to its job's `factsThrough`, and `segment` gives narration k the non-narration rows in `(cut[k-1], cut[k]]`, the cut clamped to `[cut[k-1], seq-1]`; with no cut the narration closes every row before it, so a deed posted mid-narration lands in the next segment, spec 115; a tail with a `talk`
row or a deed carrier (`isDeedRow`, spec 111) is kept; no `scene.changed` row yields zero segments and the finding `no-scene`). Each
segment runs seven pure code checks (`auditor/checks.ts`, `CHECK_IDS`):

| Check | Fails when |
|---|---|
| `prose-digits` | the narration prose (all but the last blank-line block when every line of it is a code row or a `State:` line) has a digit |
| `dice-lines` | that last block (row forms: `→`, `: auto-fail`, `death saves:`, condition applied/removed, `spends a level N spell slot`, `helps … (attack|ability check)`, refusal rows; the `State:` line and refusal rows are accepted but not compared) differs from lines rebuilt from the ledger (`collectFacts`, `renderRollLine`, `renderChangeLine`); a `why` row (`WHY_LINE`: `Rule: `, `DC <n>`, `Difficulty: `, `Opposed by `, `Reach: `, `DM ruling: `, `No roll needed`, `The DM sets the `, `<name> joins the fight`, `<name> may react as the mover leaves`; spec 098 contract section 6, written by code from the planner's facts on `intent.recorded`) is accepted and not compared (spec 104) |
| `life-states` | a life-state word and the ledger's life-state changes disagree |
| `roll-reasons` | a ledger roll has an empty reason |
| `hidden-info` | public text contains a seed `hooks.secrets` string, or discloses secret tracker state (`trackerStateDisclosures`: a segment count or fraction, or the words tracker/clock/segment beside a tracker's name or id) |
| `hidden-info` (speech) | spec 112 D8: inside the hidden-info block, each public `ai:dm` `narration` or `talk` row runs `speechLeaks` against a snapshot built from the transcript before the row; a hit names an actor the party has not met, or a fogged zone, in speech (finding kind `hidden-info-leak`). Code restate lines (`isRestateLine`, from `fact-sheet.ts`) are skipped: they quote the player, not the DM |
| `dice-language` | the prose names dice or rolls and the segment's ledger has no roll |
| `deeds-narrated` | a deed in the segment (`isDeedRow` from `dm/deeds.ts`, spec 111, TASK-0337) has no `Deed: ` row in the segment's narration whose text is the Intent's `toText` form (clipped to 200 characters, `(stopped…` suffix allowed); finding kind `unnarrated-deed`, severity `fail`. A `Deed:` row (`DEED_LINE`) is accepted and not compared by `dice-lines` and `prose-digits` |

A tracker's bare name is not hidden text: the outcome may be told. With a gateway, one
`playtest.audit` chat call per segment follows (`purpose.ts` constant; 700 `maxTokens` default;
doctrine, hidden facts and rows in the prompt; JSON-only output, one retry on a parse or gateway
error, then a per-segment `error`). With no gateway the audit is `checks-only`. Unknown doctrine ids become `other`; cited seqs outside the segment are dropped.

## Report and exit codes

`Report` (`auditor/schema.ts`): `verdict` is `pass`, `fail` or `incomplete` (no scene, or any
segment whose auditor call errored). Findings carry stable ids `F1`, `F2`, ..., `source`
(`check`, `auditor`, `dm-audit`), `kind` and a severity from `SEVERITY_OF`: `fail` for ledger
contradiction, invented mechanics, hidden-info leak, player agency, roll without reason,
no-scene and unnarrated-deed; `warn` for `doctrine` and `other`; `note` for `dm-audit-flag`, one per job whose DM check hit a leak or contradiction (spec 103, `check: <check>/<kind>`) or, on a pre-0272 row, whose audit
runtime audit was flagged. `stats.ts` derives fight statistics from the ledger for TASK-0055
(rounds, attacks, hits, damage, reduced-to-zero, death saves, and `fledOrBargained` from roll
reasons, `null` plus `fledOrBargainedNote` when not derivable). `reducedToZero` lists every combatant dropped to 0 HP, party and NPC alike (TASK-0134). A note warns when
`playtest.audit` and `dm.narrate` share a provider and model.

`cli.ts` (`pnpm playtest run|audit|estimate`, built with `tsc -b`, loads `../../.env`, the same
shape as `bench:load`): `run` plays then
audits (`--no-audit` skips); `audit --dir` re-audits saved artifacts, `audit --session` exports
then audits (`--auditor fake|provider|none`); `estimate` prints the preflight estimate without a
model call. `EXIT`: 0 pass, 1 verdict fail or incomplete, 2 outcome not `ended`, 3 spend
unconfirmed, 4 refused, 64 usage.

## CI case

`test/playtest/playtest.integration.test.ts` runs the shipped scenario in ci mode (its DM script is the new `test/dm/scripts/greyhollow-ford-deeds.json`, spec 111, not an extended `-full` script; the audit fixture `greyhollow-ford.audit.json` gains the deed segments; spec 116 adds a `confirm-move` deed whose scripted react reply carries invented `params` keys, and the test asserts the one move item has `params: {}` and the talk jobs' `check.stripped` keys, 12 segments) inside
`pnpm test` (database-gated: loud skip, or throw under `REQUIRE_DATABASE=1`, see [[test-suite]])
and asserts outcome `ended` and a passing report. Other suites in `apps/server/test/playtest/`
cover the scenario, driver, dice, checks, audit, budget, CLI and a doctored run directory the
auditor must fail. The manual milestone run is a runbook under `docs/design/`.

## Per-runbook scenarios (human playtests)

Separate from the in-process harness above: each sweep runbook ships a scenario the operator
plays (TASK-0195, `docs/design/playtest-scenarios.md`). Parts: a seed, an optional
`DM_FAKE_SCRIPT` setup script, a checklist file under `docs/playtests/scenarios/`. The
`playtest-run` skill's `checklist.mjs derive --scenario <file>` adds the file's rows;
`local-table.mjs seed <creds> <port> <seedId> a,b` seats two humans and `act` declares and
commits one action. `watch.mjs` prints per turn `truncated=` and, after the spend line, `attempt-1 failures f/n = p%` and `out-max <purpose>=<tokens>` (TASK-0273). Runbook A ships seed `greyhollow-ford-reed-camp` and script
`runbook-a-reed-camp`; a script consumes its calls in order, so a companion prompt must be scripted.

Spec 100: the `greyhollow-ford-reed-camp` seed now declares a space (start `causeway`, hidden `reed-camp` and `camp-post`) and zone fields ([[seed-npc-presence]]).
