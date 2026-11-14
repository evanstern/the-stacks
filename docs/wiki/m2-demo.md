---
name: m2-demo
description: The M2 milestone check (TASK-0048) - a human-played Greyhollow Ford scene and a scripted provider run, each audited, then every finding triaged and the record signed by the operator. Covers the pnpm playtest estimate/run/audit commands, the paid-run ceilings, the fake-gateway CI case, and what docs/design/m2-demo.md records.
kind: pipeline
sources:
  - docs/design/m2-demo.md
  - specs/032-playtest-harness/contracts/demo-runbook.md
  - apps/server/src/playtest/cli.ts
  - apps/server/playtests/scenarios/greyhollow-ford.json
  - apps/server/test/playtest/playtest.integration.test.ts
  - docs/design/m2-demo/demo-session/report.json
  - docs/design/m2-demo/provider-playtest-stalled-5/report.json
verified_against: b811b90d03f6e4769956e6db4f8a3cd7fce790df
---

# M2 demo

M2 in `docs/design/milestones.md` reads: one human plus AI companions play a scene - an
exploration, a social beat and a fight - to its end; the engine rolls every die; the narration
never contradicts the ledger; the auditor's report is attached. `docs/design/m2-demo.md` holds
both the runbook (sections A onward, sourced from
`specs/032-playtest-harness/contracts/demo-runbook.md`) and, after the second `# M2 demo
record` heading, the filled record. The harness itself is in [[playtest-harness]]; this note
covers how it is used for the milestone and what the record holds.

## How it works

**The commands.** All run from the task worktree through the `playtest` script of the server
package (`cli.ts`, see [[playtest-harness]] for flags and exit codes):

- `pnpm playtest estimate` prints the preflight spend estimate with no model call.
- `pnpm playtest run --mode provider --spend-ceiling-usd <n>` plays the scripted seat over real
  models in a per-run `_playtest` database, then audits. The operator approves each ceiling on
  the TASK-0048 card first (ceiling $22 for the scripted run, $6 for the demo audit).
- `pnpm playtest audit --session <id> --spend-ceiling-usd <n>` exports a live session
  read-only and audits it. The demo session was played by hand in the browser, so this is the
  path that produced its report.

**The CI case.** The per-commit guard is `test/playtest/playtest.integration.test.ts`: the
shipped scenario `greyhollow-ford.json` runs in ci mode against a strict `FakeProvider`
(DM script, audit script, retrieval fixture named by the scenario's `ci` block). Since spec 111 the scenario's moves include two Intent moves (`/search`, `/move`) and its `ci.dmScript` is `test/dm/scripts/greyhollow-ford-deeds.json`. It spends
nothing, asserts outcome `ended` and a passing report, and is database-gated like the other
integration suites ([[test-suite]]; `REQUIRE_DATABASE=1` turns the skip into a throw, as
[[ci-pipeline]] sets it). No provider is called in CI; `provider` mode is refused when `CI` is set.

**The two runs.** The *demo session* is the human run: the operator played Tamsin Vale in
Brave at the live table ([[play-route]]) with Brother Odo and Kestrel as AI companions and the
AI in the DM seat; it ended with the ferry hauled across (`scene.changed` after=null). The
*scripted playtest* (provider run 5) plays the scripted seat; it stalled at the 30-move cap
once the script ran out ("seat-exhausted" behaviour, [[playtest-harness]]). Earlier paid runs
1, 2 and 4 failed on defects since fixed (host networking; director invalid-output) and run 3
refused to start (estimate above its ceiling); their directories are attached as evidence.

**The auditor's output.** Each run directory carries `report.json`/`report.md`, the
transcript, the ledger and `run.json`. The demo session's report has 58 findings (11 fail, 24
warn, 23 note); run 5's has 109 (13 fail, 64 warn, 32 note). Both verdicts read `incomplete`
(at least one auditor segment errored or the scene did not reach its end), so the record's
claims lean on the findings, not on a pass verdict. Check `dice-lines` passes and the ledger
shows 32 engine `dice.rolled` rolls, which carries the "engine rolls every die" criterion.

**The record.** Every finding, 167 rows, is one row in the failure table with a resolution:
`accepted` (advisory warn or note, tied to the doctrine research), `false-positive` (auditor
lag against the ledger, F49 and F52 among them), or `carded` against a board task (for
example TASK-0111, TASK-0113, TASK-0114). A second table lists eight operator findings from
play (a missing out-of-character channel, no progress indication, dice lines inline in prose,
and a viewer bug fixed in `53a78fa`), each carded, accepted or fixed. The operator signed the
record on 2026-10-27, so every row is final and the "narration never contradicts the ledger"
criterion is met.

## Connections

Plays through [[proposal-gate]], [[ai-gateway]], [[dm-runtime]] and [[dm-turn-jobs]] via
[[playtest-harness]]; the human seat uses [[play-route]]. Sibling milestone check: [[m0-demo]].

## Operational notes

A run directory is the unit of evidence: re-audit with `audit --dir` and no database. The
paid-run ceiling is the enforced limit, not the estimate. Do not run `env:down` on the demo
worktree before the record is signed; the app database holds the demo session.
