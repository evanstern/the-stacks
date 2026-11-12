# R1 Fast Table (milestone m-10) — sweep runbook (2026-11-08)

**You (the session reading this) are the ORCHESTRATOR** for the tasks below. Run each through the
full PDLC: spec → link → worktree → delegated implementation → PR → merge → re-ground. Develop in
parallel within lanes. Merge serially. Treat merge conflicts as routine. Direction is decided; do
not re-litigate it. The ratified replan (`docs/design/replan-2026-11/`), constitution 3.0.0 and
decision-0030 win. The board is the plan of record. This file carries ordering, doctrine and the log.

- **Status:** signed-off (operator, 2026-11-08, in chat, at CP-5: "Sign off, start"). The
  operator ruled F1–F5 and the mis-homed cards as recommended (see "CP-5 rulings" below).
  <!-- Only the OPERATOR flips draft → signed-off. An executing session refuses a runbook whose
       status it cannot verify. -->
- **Handoff:** paused 2026-11-10 at the operator's request. Resume from `docs/design/r1-handoff-2026-11-10.md`.
- **Milestone:** R1 Fast Table, board id `m-10`, epic TASK-0258 (EP-1). Plan-of-action §5 R1.
- **Orchestrator:** plans, dispatches and gates. It never implements.
- **Dispatch rules:** `docs/ops/orchestrator-kit/dispatch-rules.md` binds every dispatched agent.
  Its runbook pointer (line 26) names the M3 runbook. Each brief names this file instead.
- **Carried over from runbook B** (`docs/design/m3-runbook-b-resolution-quality.md`): "Model tiers"
  dispatch rules, "Execution mode", the "Rule at dispatch" overlap check, prompt-version and
  migration rules, and checkpoints C5, C6, C9. This file overrides them only where it says so.

## Read first (in this order)

1. This file, top to bottom.
2. `docs/design/replan-2026-11/plan-of-action.md` (§4 graph and seams, §5 R1, §6 frozen work),
   `target-architecture.md` (§2 Intent, §3 space, §6 turn pipeline, §8 seams),
   `decisions-for-ratification.md` (P-04, P-08, P-09, P-12, P-14).
3. `.specify/memory/constitution.md` 3.0.0, "Development Workflow and Quality Gates".
4. decision-0030 and `specs/092-intent-contract/contracts/intent-schema.md` (frozen v1). Until
   TASK-0266 merges, read them from `origin/task-0266-intent-contract`.
5. `docs/wiki/INDEX.md`, then `docs/wiki/CAPSULES.md`. Load notes just-in-time.
6. `backlog task list --plain -m m-10` for live state. Then `backlog task view TASK-<n> --plain`.

## State when this runbook was written (2026-11-08)

- `origin/main` at `7098e2de`. Root on `main`, clean, level with origin.
- Gates on `main`: wiki freshness `OK: 57 note(s) fresh`. spec-bridge `ok: 90 linked`, with two
  lag warnings: TASK-0199 (spec 066) and TASK-0247 (spec 091). `pnpm env:prune --check`: no orphans.
  `tiers.mjs --check`: clean.
- **Merge-drift gate: absent** (`scripts/check-merge-drift.mjs` does not exist). The raw git
  claim rules in the concurrency doctrine stand.
- Highest spec: `091-mud-stream-and-composer` on `origin/main`; `092-intent-contract` on
  `origin/task-0266-intent-contract`. This runbook claims numbers from **093**, in claim order.
- **Done already:** CP-1 (P-01…P-21 ratified 2026-11-07), CP-2 (constitution 3.0.0), CP-3 (board
  rework), CP-4 (Intent contract v1 frozen 2026-11-08, decision-0030, Q1–Q9 as recommended).
  Upstream cards TASK-0104, 0113, 0127, 0188, 0236 are Done.
- **In flight (this runbook adopts them; do not duplicate):**
  - **TASK-0266** (N-01): In Progress on pushed branch `task-0266-intent-contract`, worktree
    `.worktrees/task-0266`. Branch carries spec 092 (spec, plan, tasks, frozen contract) and
    decision-0030. Phases 1–4 are unbuilt (T001–T013 open). Its PR lands with its implementation.
    On `main` the card still reads To Do; the claim rides the branch, as doctrine requires.
  - **TASK-0186** (playtest-run skill): In Progress. Skill merged in PR #96. AC #4 is open (hosted
    browser-pane watch). Absorbed TASK-0196 and TASK-0235 have no ACs on the card yet.
- **Paused — untouched:** none of the 28 R1 cards carries the `paused` label.
- **Parked worktrees (plan-of-action §6; not this runbook's to clean):** under `.claude/worktrees/`:
  `sweep-m3-runbook-b`, `sweep-m3-runbook-a`, `task-0188-one-chat-stream`, `runbook-0180-0182`,
  `pdlc-1.0.1-replant` (each 0 commits ahead of `origin/main`), plus two `claude/*` branches. List
  them for the operator at sweep close. Never remove a worktree another session may hold.
- **Queued (this runbook's scope):** 27 deliverable cards plus epic TASK-0258 (no PR). Order is the
  merge spine below.

## CP-5 rulings (operator, 2026-11-08)

- F1–F4 approved as recommended. The cards carry the edits (TASK-0267, 0269, 0199, 0275, 0215, 0245 notes).
- F5: three new R1 cards. G1 = **TASK-0298** narration streams to clients (lane LN, after 0272).
  G2 = **TASK-0299** companion and monster turns emit Intents (lane LI, after 0269).
  G3 = **TASK-0300** CI latency gate on fixture tables (lane LZ, after 0268).
- TASK-0037 is merged into TASK-0101 and archived. Its two AC live on 0101.
- TASK-0098, 0138, 0101 and 0231 stay in R1. TASK-0130 carries label `droppable` and a revisit trigger.
- Standing grants at sign-off: C1 (opus for spec authoring and the 066/091 amendments).
  C-AMD, C-GATE, C-AUD, C-CON, C-OPUS, C5, C6, C9 and CP-7 still stop the sweep.

## Planning findings (for CP-5)

These come from reading the cards against the code on `7098e2de`. Each needs a CP-5 ruling.

- **F1 — TASK-0267 AC #4 cannot land in the planner PR.** "`resolve.ts` loses the ported code
  paths" breaks the live turn pipeline until the gate calls the planner (TASK-0268) and interpret
  emits Intents (TASK-0269). **Recommend:** move AC #4 to TASK-0269. TASK-0267 ships the pure
  package with golden tests only.
- **F2 — TASK-0199 AC #4 and TASK-0275 overlap.** Both claim "in combat, the active player's Enter
  commits". **Recommend:** TASK-0199 owns the commit rule (no ring in combat, Enter commits).
  TASK-0275 owns the banner, pips, action bar and off-turn refusal, and builds on 0199's rule.
- **F3 — TASK-0215 AC #2 targets `NarrationFacts`.** TASK-0245 replaces it with the fact sheet.
  **Recommend:** retarget AC #2 to "the fact sheet lists startlement for a surprised PC". Land
  0215 after 0274 (shared `commands/encounter.ts`) and 0245.
- **F4 — TASK-0245 develops ahead of TASK-0268.** The §4 graph draws GATE → NAR. The fact sheet
  reads settled engine events, which exist today. It shares no source file with 0267 or 0268.
  **Recommend:** 0245 builds after 0273 only. Its spec states the fact-sheet input as engine
  events, so the planner path feeds it unchanged.
- **F5 — gaps no R1 card owns.** Each blocks an exit criterion. **Recommend:** the orchestrator
  cards each one (board track) at CP-5, or the operator folds it into a named card.
  - **G1 — narration streams to clients.** `dm/pipeline/call.ts` collects the whole reply.
    `ws/protocol.ts` has no partial-narration frame. Exit 2 (first token < 10 s) and the demo
    ("narration never blocks the next turn") need it. Closest home: TASK-0272.
  - **G2 — AI companion and monster turns at round speed.** Exit 3 (4v4 round < 60 s) runs three
    companions and four monsters. `dm/companion.ts` submits `action.declare` text, so each
    companion turn costs a companion call plus an interpret call. NPC turns run through the
    Director. No card makes these emit Intents directly. Closest home: TASK-0269.
  - **G3 — CI latency gate.** Constitution 3.0.0: "CI MUST record time from confirmed Intent to
    fact rows on fixture tables." TASK-0278 measures the hosted run only. Closest home: TASK-0268.
- **F6 — card splits.** See "Cards needing spec amendments or splitting" below.
- **F7 — mis-homed cards.** See "Mis-homed cards" below.

## Lanes (proposed for CP-5)

| Lane | Cards (order) | Theme | Starts |
|---|---|---|---|
| **L0** contract | TASK-0266 | `packages/intent` | now (spec ready) |
| **LP** platform and hygiene | TASK-0231 → 0138 → 0098; 0101 (+0037); 0186 remainder | tests, stacks, hosted dev, wiki, skill | now |
| **LF** foundations | TASK-0270 ∥ 0273 | `packages/space` + engine placement; gateway structured output | now |
| **LI** intent spine | TASK-0267 → 0268 → 0269 | planner, gate, interpret | 0267 after 0266 + 0270 merge |
| **LS** space and encounter | TASK-0271 ∥ 0274 → 0215 | spatial events, encounter state | after 0270 merges |
| **LN** narration | TASK-0245 → 0272 → 0130 | fact sheet, prose slots, doctrine | 0245 after 0273 merges |
| **LE** engine rules | TASK-0222, 0224, 0223 | numbers from the engine | 0222, 0224 after 0274 merges; 0223 after 0269 |
| **LT** table UX | amend 066 → TASK-0199 → amend 091 → 0247; 0275 → 0276; 0277 | stream, composer, combat UX | 0199 after 0268 merges |
| **LZ** gate | TASK-0278 | R1 scenario, latency metrics | metrics early; scenario last |

Spec authoring touches only `specs/NNN-*/`. Author every lane's spec as soon as its upstream
**spec** is committed on its branch, not its upstream merge. Author a downstream spec against the
upstream's committed `plan.md`. Re-check the seam before implementation dispatch.

### Expected footprints (from the cards and the tree on 7098e2de)

| Task | Expected source files |
|---|---|
| 0266 | new `packages/intent/`, `biome.json`, `fixtures/boundary-violations/packages/intent/`, `pnpm-lock.yaml` |
| 0270 | new `packages/space/`; engine `src/schema/`, `execute.ts`, `commands/combatants.ts`, new `commands/move.ts`, `commands/attacks.ts` (OA from bands); `biome.json`; lockfile |
| 0273 | `apps/server/src/ai/{config,gateway,types,retry}.ts`, `ai/adapters/*`, `dm/pipeline/call.ts`, `dm/purposes.ts`, `dm/model-calls.ts`, `.claude/skills/playtest-run/scripts/` (truncated count) |
| 0267 | new `packages/planner/`; reads `dm/nodes/resolve.ts`, `dm/gates/plan-gate.ts` (no edit if F1 is ruled); `biome.json`; lockfile |
| 0268 | `packages/session-model/src/gate/{proposals,plan,permissions,policy}.ts`, `apps/server/src/gate/gate.ts`, `apps/server/src/ws/protocol.ts`, `specs/029-proposal-gate/contracts/` |
| 0269 | `dm/nodes/{interpret,resolve,schemas}.ts`, `dm/prompts/{interpret,step-grammar}.ts`, `dm/gates/plan-gate.ts`, `dm/companion.ts` (if G2 lands here) |
| 0271 | `packages/session-model/src/catalog.ts`, new `events/space.ts`, `projections/`, `visibility.ts`; `dm/nodes/assemble.ts`, `dm/facts.ts`; `dm/seed/`, `apps/server/seeds/*.json` |
| 0274 | engine `commands/encounter.ts`, `commands/combatants.ts`, `schema/`; `dm/nodes/resolve.ts` (encounter end/resume) |
| 0215 | engine `commands/encounter.ts`; the fact-sheet module from 0245 |
| 0222 | engine `commands/attacks.ts`, `commands/conditions.ts`, saves in `commands/roll.ts` |
| 0223 | `packages/planner/` (roll and effect steps), engine `commands/hit-points.ts`, `packages/srd` reads |
| 0224 | engine saves and `commands/attacks.ts` (grapple escape), `packages/srd` stat-block DCs |
| 0245 | `dm/facts.ts`, new fact-sheet module, `dm/prompts/narrate.ts`, `dm/nodes/narrate.ts`, `dm/fallback.ts`, `apps/web/app/play/ledger-format.ts` |
| 0272 | delete `dm/claims.ts`, regenerate loop in `dm/nodes/audit.ts`, `dm/fallback.ts`, `dm/audit-words.ts`, `dm/prompts/audit.ts`; `dm/nodes/narrate.ts`, `dm/prompts/narrate.ts`; catalog (correction row); `dm/doctrine/` |
| 0130 | `dm/doctrine/doctrine.ts`, `dm/prompts/narrate.ts`, planner ruling inputs |
| 0199 | spec 066 plan: `session-model/src/gate/{plan,proposals}.ts`, `dm/{talk-turn,jobs,enqueue}.ts`, `play/view-model.ts`, `play/components/composer.tsx`, `transcript.tsx`; ~30 files |
| 0247 | spec 091 plan: `play/{table-view.tsx,view-model.ts}`, `components/{composer,transcript}.tsx`, `session-model/src/events/scene.ts`, `dm/seed/`, `apps/server/seeds/` |
| 0275 | `play/components/{turn-order,status-strip,composer}.tsx`, new action bar, `session-model/src/gate/turn.ts` |
| 0276 | `session-model/src/gate/proposals.ts` (reaction answer), engine reactions read, `play/components/` reaction row |
| 0277 | `play/components/{margin,composer}.tsx`, `play/view-model.ts`, space projection from 0271 |
| 0278 | `apps/server/src/playtest/auditor/{stats,checks,render}.ts`, `docs/playtests/scenarios/`, `apps/server/dm-scripts/`, seed |
| 0098 | `scripts/env.mjs`, `scripts/env-lib.mjs`, `apps/server/scripts/migrate.ts`, `src/cli/create-operator.ts`, `jobs/queue.ts` (backoff), `specs/010-worktree-stacks/contracts/env-cli.md` |
| 0138 | `apps/server/test/dm/adjudicate.integration.test.ts` |
| 0231 | `docs/wiki/dnd5e-engine.md`, `docs/wiki/dm-failure-and-gates.md`, two new notes, `INDEX.md`, `CAPSULES.md` |
| 0101 (+0037) | `deploy/dev/` (ollama service, pinned digest), `docs/ops/dev-vm-104.md`, `docs/wiki/hosted-dev.md` |
| 0186 | `.claude/skills/playtest-run/` (cost estimate, R1 scenario name) |

### Merge spine (proposed for CP-5)

Implementations merge in this order. A task develops ahead of its turn only when its `plan.md`
shares no source file with any task ahead of it still unmerged.

| # | Task | Lane | Tier (impl) | Spec | Develops ahead? |
|---|---|---|---|---|---|
| 1 | TASK-0231 wiki split | LP | haiku | escape E1 | yes (wiki only); merge before any engine or gate PR re-pins those notes |
| 2 | TASK-0138 adjudicate skip | LP | haiku | escape E2 | yes (one test file) |
| 3 | TASK-0266 Intent contract | L0 | sonnet | spec 092 (on branch) | yes (new package) |
| 4 | TASK-0273 structured output | LF | sonnet | spec set | yes (`ai/`, `call.ts`) |
| 5 | TASK-0270 space + zones | LF | sonnet | spec set | yes; lockfile and `biome.json` reconcile after #3 |
| 6 | TASK-0098 migrated stacks | LP | sonnet | spec set | yes (`scripts/`, migrate CLI) |
| 7 | TASK-0186 skill remainder | LP | sonnet | escape E3 | yes (skill only) |
| 8 | TASK-0267 planner | LI | sonnet | spec set | after #3 and #5 merge |
| 9 | TASK-0245 fact sheet | LN | sonnet | spec set | after #4 merges (F4); beside #8 |
| 10 | TASK-0274 encounter state | LS | sonnet | spec set | after #5 merges; beside #8, #9 |
| 11 | TASK-0271 spatial events | LS | sonnet | spec set | after #5 merges; catalog serial point |
| 12 | TASK-0222 auto-fail, auto-crit | LE | sonnet | escape E4 | after #10 merges (engine schema) |
| 13 | TASK-0268 gate accepts Intents | LI | sonnet | spec set | after #8 merges; `proposals.ts` serial point |
| 14 | TASK-0272 prose slots, audit retired | LN | sonnet | spec set | after #9 merges; one-way door C-AUD |
| 15 | TASK-0269 interpret emits Intents | LI | sonnet | spec set | after #13 merges (takes F1's AC #4) |
| 16 | TASK-0199 quiet ring (spec 066 amended) | LT | sonnet | spec 066 + amendment | after #13 merges (`proposals.ts`, `gate/plan.ts`) |
| 17 | TASK-0215 surprise | LS | sonnet | escape E5 | after #10 and #9 merge |
| 18 | TASK-0224 monster DCs | LE | sonnet | escape E6 | after #12 merges |
| 19 | TASK-0223 engine-derived amounts | LE | sonnet | spec set | after #15 merges (planner + resolve) |
| 20 | TASK-0275 combat turn UX | LT | sonnet | spec set | after #16 merges (composer, view-model) |
| 21 | TASK-0247 MUD stream (spec 091 amended) | LT | sonnet | spec 091 + amendment | after #16 and #9 merge |
| 22 | TASK-0277 targeting, zone chips | LT | sonnet | spec set | after #21 merges (composer, margin) |
| 23 | TASK-0276 reactions, roll requests | LT | sonnet | spec set | after #20 merges |
| 24 | TASK-0101 hosted dev AI (+0037) | LP | sonnet + orchestrator | escape E7 | any time; must merge before #26; C9 per command |
| 24a | TASK-0300 CI latency gate (G3) | LZ | sonnet | spec set | after #13 merges |
| 24b | TASK-0299 AI turns emit Intents (G2) | LI | sonnet | spec set | after #15 merges (`dm/companion.ts`, Director) |
| 24c | TASK-0298 narration streams (G1) | LN | sonnet | spec set | after #14 merges (`call.ts`, `ws/protocol.ts`) |
| 25 | TASK-0130 doctrine pass | LN | sonnet | spec set | after #14 merges; AC #5 ticks at CP-7 |
| 26 | TASK-0278 scenario + latency | LZ | sonnet | spec set | metrics phase beside #8 on; scenario phase last |

Then **stop for CP-7** (the R1 playtest).

### Lane notes

- **L0, TASK-0266.** Build spec 092 as frozen. Merge `origin/main` into the branch before Phase 1.
  Phases 1–4 run as four sonnet dispatches. Phase 5 is the orchestrator's. T014 is already done
  (decision-0030 on the branch). T015 is replaced by the explicit amendment steps in lane LT.
- **LT, spec amendments come first.** Before TASK-0199's implementation dispatch, amend spec 066
  against the frozen contract per spec 092 plan "Downstream amendments". Before TASK-0247's,
  amend spec 091 the same way. Each amendment is an opus spec dispatch on the owning card's
  branch. Re-derive `tasks.md` and re-link (`spec-bridge:link` update mode). The operator reviews
  each amendment at C-AMD before implementation starts. Specs 066 and 091 keep their numbers.
- **TASK-0199** keeps spec 066's ruled UX except where P-04 and decision-0030 change it. The
  amendment applies F2's split. If the amended `tasks.md` exceeds one PR (see the split list), stop.
- **TASK-0268** adds `intent` to `ProposalKindSchema` and the declare envelope (spec 092 plan
  "Migration" 1–4). This amends frozen contracts (`specs/029-proposal-gate/contracts/`,
  `docs/wiki/ws-protocol.md` frame shapes). That needs the operator's ruling (C-GATE) quoted in
  the brief, per dispatch-rules line 41.
- **TASK-0272** deletes the regenerate-then-fallback loop and `dm/claims.ts`. Its PR is the stated
  reason for review: a one-way door (C-AUD). Before merge, replay the B2 run's captured turns
  through the new leak and contradiction check, and attach the counts to the PR.
- **TASK-0222, 0223, 0224** follow §4 "PLN → ENG1". 0222 and 0224 are pure engine and may build
  after 0274 merges. 0223 changes model-written roll and effect amounts, which live in the planner
  after F1, so it waits for 0269.
- **TASK-0278** has two phases in one PR: auditor latency metrics (AC #1), then the scenario
  (AC #2). Build metrics as soon as 0266 merges, against fixture timestamps. Author the scenario
  last, per `docs/design/playtest-scenarios.md` "Rule for runbook authors". Ship checklist, script
  and a `DM_FAKE_SCRIPT` rehearsal log.
- **TASK-0186** finishes as a small PR: add TASK-0196's cost-estimate ACs and retarget TASK-0235's
  ACs to the R1 scenario (the card gains those ACs at claim). AC #4 ticks at CP-7.
- **Prompt versions today:** interpret-v15, narrate-v21, audit-v16, director-v10, companion-v8,
  adjudicate-v10. Two cards in flight on one prompt both claim the next version. The later merge
  re-bumps and reconciles `docs/wiki/dm-narration-quality.md`.
- **Migrations:** none expected (state is events and JSON). A plan with a migration regenerates
  after merging `origin/main` in. Never hand-merge `meta/_journal.json`.
- **Rule at dispatch:** as runbook B. Compare each `plan.md` file list with every task in
  implementation. Develop ahead only on disjoint source files. Otherwise draft-hold the later task
  and log the amendment.
- **Hosted ACs:** TASK-0269 AC #2, 0272 AC #3, 0273 AC #2–#3, 0278 AC #2, 0186 AC #4 and 0130
  AC #5 need the hosted run. Those cards stay In Progress after merge until CP-7 ticks them.

## Model tiers (from `.claude/model-tiers.json`, checked 2026-11-08)

| Tier | Agent | Pinned model | Fallback | Used for |
|---|---|---|---|---|
| sonnet (default) | `sonnet-implementer` | `cc/claude-sonnet-5-5[1m]` | — | All implementation except the haiku rows. The R1 scenario. |
| haiku | `haiku-implementer` | `cc/claude-haiku-5-5` | — | TASK-0231 (wiki split), TASK-0138 (one test file). |
| opus (escalation) | `opus-implementer` | `cc/claude-opus-5-5[1m]` | `cc/claude-fable-5-1[1m]` | Spec authoring for every "spec set" row and the 066/091 amendments. Needs C1. |

- Rubric: every implementation row runs against a written spec or card ACs whose judgment calls
  the spec settles, so it runs at the default tier. Spec authoring is design work (opus, standing
  project rule).
- **No opus implementation is planned.** TASK-0267 (planner) and TASK-0272 (audit retirement) are
  the likeliest candidates. Raising either is checkpoint C-OPUS, recorded before dispatch.
- Raise a tier one way only (haiku → sonnet, as runbook B did for TASK-0213). Log it.
- Pass no `model` parameter. The frontmatter `cc/` pin applies.
- Verify the served model from the first dispatch's transcript before any sibling dispatch.
- Record one line per dispatch on the card: `Dispatch: tier=<tier> pinned=<model-id> served=<model-id>`.
- If auto mode denies a dispatch, stop and report it. Do not implement inline.

## Execution mode

- Interactive-root mode, as runbook B. Worktrees at `.worktrees/task-<n>`.
- Board track: `backlog/`-only commits go direct to `main` from root, pushed at once.
- Claim flips ride the claim commit on the task branch. Use `docs/ops/orchestrator-kit/tools/claim.sh`.
- This runbook lands by its own PR (branch `sweep-r1-runbook`). Execution-log rows ride the next
  claimed task's branch. The final rows ride a wrap-up PR.
- Merge on green with `gh pr merge --merge` (standing merge-on-green grant). Report each merge.

## Per-PR gates this project enforces

- **Merge-drift gate: absent** (`scripts/check-merge-drift.mjs`). Raw git claim rules apply.
- `pnpm install --frozen-lockfile` in every fresh worktree.
- `pnpm ci:check` green on the branch's final tree (lint, typecheck, build, test, boundaries,
  hooks, scripts, host-scripts).
- DB-touching work: `REQUIRE_DATABASE=1` on the worktree's own stack, per dispatch-rules "Gates".
  Until TASK-0098 merges, migrate both databases by hand after `pnpm env:up`.
- Export only `TEST_DATABASE_URL`, as `VAR="$(sed …)"`. Never `source` or `export $(grep …)` the `.env`.
- Known flakes (gateway WebSocket tests, DB 5 s timeouts): re-run once and report. Do not fix.
- Wiki freshness: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs freshness . docs/wiki` prints `OK`.
- Spec-bridge: `node ~/.claude/plugins/cache/praxisflux/spec-bridge/1.0.1/gates/cli.mjs check .` exits 0.
- The card carries a `Dispatch:` line with a real `served=` ID for each dispatch.
- Every spec task in `tasks.md` ticked before the PR opens.
- **New packages** (`intent`, `space`, `planner`): a `biome.json` boundary override, boundary
  fixtures under `fixtures/boundary-violations/packages/<name>/`, and a wiki note. Downstream code
  imports only the package's published exports (target-architecture §8 "Rule at every seam").
- **Engine PRs** (0270, 0274, 0215, 0222, 0223, 0224): scripted-dice tests for every new or
  changed command (constitution VI).
- **Intent PRs** (0266, 0267, 0268, 0269): a schema test, a round-trip test and a planner test per
  outcome for each kind touched (constitution II).
- **Narration PRs** (0245, 0272, 0130): fact-sheet tests show every digit and state comes from a
  code-rendered row (constitution VII).
- **Projection PRs** (0271, 0277): a per-viewer parity test, and a hidden-information test that no
  player projection holds an unrevealed zone or placement (constitution III, V).
- **UI PRs** (0199, 0247, 0275, 0276, 0277): `apps/web/test/no-dialog.test.mjs` green; renders at
  1280 px and 390 px; an accessibility check; live check in Brave. No modals.
- **Contract changes:** an Intent contract change follows contract §10 (minor additive; major
  needs a decision record and C-CON). Frozen contracts in dispatch-rules line 41 change only with
  the operator's ruling quoted in the brief.
- `pnpm env:prune --check` exits 0 after every post-merge cleanup.
- `git -C <worktree> add` and `git -C <worktree> commit` in separate Bash calls, literal paths.

### Expected wiki reviews (NEEDS-REVIEW candidates)

| Tasks | Notes |
|---|---|
| 0266, 0267, 0270 | new notes per package; `monorepo-and-toolchain`; `overview` |
| 0270, 0274, 0215, 0222, 0223, 0224 | `dnd5e-engine` (or its split halves after 0231), `srd-data` |
| 0267, 0268, 0269 | `proposal-gate`, `session-model`, `dm-failure-and-gates`, `dm-runtime`, `ws-protocol` |
| 0271 | `session-model`, `actor-snapshot`, `seed-npc-presence`, `dm-runtime` |
| 0273 | `ai-gateway`, `dm-turn-jobs`, `playtest-harness` |
| 0245, 0272, 0130 | `dm-narration-quality`, `output-claim-gate` (retired by 0272), `dm-runtime` |
| 0199, 0247, 0275, 0276, 0277 | `play-route`, `chat-ui`, `dm-talk-triggers`, `turn-floor`, `scene-panels` |
| 0278, 0186 | `playtest-harness` |
| 0098, 0138 | `runtime-stacks`, `migrations`, `test-suite` |
| 0101 (+0037) | `hosted-dev`, `ai-gateway` |

## Per-task artifacts required before PR

- [ ] `specs/NNN-<slug>/` carries a real `spec.md` (card ACs mapped), `plan.md` (Constitution
      Check against 3.0.0; every touched file, migration and new runtime dependency named) and
      `tasks.md` (real phases; one phase is one dispatch; ends with a wiki phase), committed on
      the task branch — **or** an operator-signed escape line below names the task.
- [ ] The card carries its Spec marker from the claim commit, and phase ACs are seeded from
      `tasks.md` before implementation dispatch.
- [ ] TASK-0199 and TASK-0247: the amended spec is committed and reviewed at C-AMD before the
      first implementation dispatch.
- [ ] Every downstream spec names the upstream `plan.md` commit it was authored against, and a
      seam check runs before its implementation dispatch.
- **Escape lines (proposed for CP-5; operator-signed only):**
  - **E1 — TASK-0231:** card AC drives. Split each note by concept; drop both exemption lines.
  - **E2 — TASK-0138:** card ACs drive. `describe.skipIf(!reachable)` as `jobs.integration.test.ts`.
  - **E3 — TASK-0186:** card ACs drive (precedent: direct operator request, no spec set).
  - **E4 — TASK-0222:** card AC drives. Scripted-dice engine tests per condition.
  - **E5 — TASK-0215:** card ACs drive (AC #2 retargeted per F3). Engine test plus fact-sheet test.
  - **E6 — TASK-0224:** card AC drives, including the grapple escape DC scope. Engine tests.
  - **E7 — TASK-0101 (+0037):** card ACs drive. Ops work; every vm-104 command at C9.
  - **E8 — TASK-0303 (hotfix, operator-signed 2026-11-09):** card ACs drive. Dockerfile package copies plus a guard test; stabilize the SC-005 timing test.
  - **E9 — TASK-0307 (operator-signed 2026-11-10):** card ACs drive. Accept and strip both slot-label forms; no doubled restate; ask only for a real clarification.
  - **E10 — TASK-0314 (operator-signed 2026-11-11, "Sign E10"):** card ACs drive. One enqueue rule: a human DM's ruling Intent queues the resume turn; plus its test. Merges before TASK-0199 phase 3.

## Concurrency & conflict doctrine

- **Hotspots (serial points; one open PR at a time):**
  - `packages/session-model/src/gate/proposals.ts`: 0268, 0199, 0276.
  - `packages/session-model/src/catalog.ts` and `src/events/*.ts`: 0271, 0272, 0199, 0247, 0276.
  - `packages/session-model/src/gate/plan.ts`: 0268, 0199.
  - `packages/dnd5e-engine/src/schema/`, `execute.ts`, `commands/{encounter,combatants,attacks}.ts`:
    0270, 0274, 0215, 0222, 0224, 0223.
  - `apps/server/src/dm/nodes/resolve.ts` (1967 lines) and `dm/gates/plan-gate.ts`: 0269, 0274, 0223.
  - `apps/server/src/dm/nodes/{schemas,interpret}.ts`, `dm/prompts/interpret.ts`: 0269, 0273.
  - `apps/server/src/dm/pipeline/call.ts`, `apps/server/src/ai/`: 0273, 0272.
  - `apps/server/src/dm/{facts,fallback,claims,audit-words}.ts`, `dm/nodes/{narrate,audit}.ts`,
    `dm/prompts/{narrate,audit}.ts`: 0245, 0272, 0215, 0130.
  - `apps/server/src/dm/{talk-turn,jobs,enqueue}.ts`: 0199, 0272.
  - `apps/server/src/dm/seed/`, `apps/server/seeds/*.json`: 0271, 0247, 0278.
  - `apps/web/app/play/{view-model.ts,table-view.tsx}`, `play/components/{composer,transcript,margin,turn-order}.tsx`:
    0199, 0247, 0275, 0276, 0277.
  - `apps/server/src/ws/protocol.ts`: 0268 (frozen frame shapes).
  - `biome.json`, `pnpm-lock.yaml`, root `tsconfig` references: 0266, 0270, 0267. Regenerate the
    lockfile with `pnpm install` after a merge-in. Never hand-merge it.
  - `docs/wiki/dnd5e-engine.md`, `dm-failure-and-gates.md`: merge 0231 first.
- **Paused tasks are not live lanes.** None in scope today. A `paused` card is never claimed,
  rebased or cleaned.
- Reconcile by what the branch carries. A **pin-carrying branch** (wiki re-pins of its own
  commits) merges `origin/main` in and lands as a merge commit. A pin-free branch rebases. The
  dispatch rules forbid rebase for implementers; the orchestrator does reconciles. Take main's
  side for anything you did not deliberately change.
- **Honest re-pins only.** A merge-in never justifies a pin bump. Route every staled pin through
  the wiki-update plan loop: read `git diff <old-pin>..<merge-commit> -- <sources>`, classify
  RE-PIN-ONLY or NEEDS-REVIEW, amend prose before bumping.
- After every history move, re-run the gates and the freshness probe unconditionally.
- Two hotspot-heavy PRs never merge within one re-ground cycle without a reconcile between.
- Conflicting with a sibling session's open PR: the smaller PR merges first.
- **Claim before work.** The first commit of a task claims it: card → In Progress plus the
  `specs/NNN-*` stub, on the task branch cut from `origin/main`. Push at once. Never force-push a claim.
- **Spec numbers.** Claim from 093 in claim order. Expected order: 0273, 0270, 0098, 0267, 0245,
  0274, 0271, 0268, 0272, 0269, 0223, 0275, 0277, 0276, 0130, 0278. Before each claim, run
  `git fetch origin` and `git ls-tree --name-only -r origin/main specs/` plus `git branch -r`
  to see numbers held on other branches.
- **A rejected push means you lost the race.** Fetch, re-read the board and `specs/`. If another
  session holds the task or number, stop the lane and tell the operator. Otherwise merge
  `origin/main` into the claim branch and push.
- Verify a PR merged (`gh api repos/evanstern/the-stacks/pulls/<n> --jq .merged`) before deleting
  its branch or worktree. Run `pnpm env:down` before `git worktree remove`.

## Operator checkpoints (do not proceed silently)

- **CP-5 — this sign-off.** Lanes, merge spine, tier table, escape lines E1–E7, findings F1–F7,
  gap cards G1–G3, the split list and the mis-homed list.
- **C1 — standing opus sign-off** for spec authoring and the spec 066/091 amendments.
- **C-OPUS — any opus implementation dispatch.** Name the task and the judgment call the spec
  leaves open. Recorded before dispatch.
- **C-AMD — spec 066 and spec 091 amendments.** The operator reviews each amended spec before
  its lane's first implementation dispatch.
- **C-GATE — TASK-0268 amends frozen contracts** (`specs/029-proposal-gate/contracts/`,
  `ws-protocol` frame shapes). Ruling quoted in the brief.
- **C-CON — any Intent contract change.** Minor per contract §10: tell the operator. Major:
  decision record and the operator's ruling.
- **C-AUD — TASK-0272 deletes the audit loop and `dm/claims.ts`.** A one-way door. The operator
  approves the merge after seeing the replay counts.
- **C5 — new runtime dependencies.** Stop after `plan.md`.
- **C6 — paid provider runs.** The hosted playtest needs the operator's ceiling, in the operator's words.
- **C9 — vm-104.** Every vm-104 command needs the operator's go on the exact command (TASK-0101,
  0037, hosted rehearsal, CP-7).
- **CP-7 — the R1 playtest gate.** The operator plays the R1 scenario. The exit criteria are read
  from its log.
- Out of scope: **CP-6** (codex model freeze) is R2.
- Any spine amendment from a `plan.md` overlap, a split, or a softened gate: amend this file, note
  why, tell the operator.

## Cards needing spec amendments or splitting

- **TASK-0199 (spec 066):** amend against decision-0030 (C-AMD). Spec 066 has 61 open tasks over
  about 30 source files, server and web. **Split trigger:** if the amended `tasks.md` still spans
  the server talk path and the web composer at more than about 40 tasks, split into
  0199-server (ring on `declared`, confirm row, `ask_dm`) and 0199-web (one composer, one Send).
- **TASK-0247 (spec 091):** amend against decision-0030 (C-AMD). Absorbs seven cards. Keep as one
  PR unless the amendment adds the Intent-pill path to a plan already at 28 tasks; then split the
  pill path (AC #1–#3) from the stream rows (AC #4–#7).
- **TASK-0267:** move AC #4 to TASK-0269 (F1).
- **TASK-0215:** retarget AC #2 to the fact sheet (F3).
- **TASK-0278:** two phases in one PR (metrics early, scenario last). No split.
- **TASK-0186:** add the absorbed TASK-0196 ACs; retarget the TASK-0235 ACs from runbook B to the
  R1 scenario.
- **Gap cards G1–G3** (F5): create or fold at CP-5.

## Mis-homed cards (recommendation for CP-5)

- **TASK-0098 (unmigrated stacks), TASK-0138 (adjudicate skip):** not R1 deliverables, but every
  DB lane pays for them at every gate. **Keep in R1, first in lane LP.**
- **TASK-0101 (hosted dev AI):** a hard prerequisite of exit criteria 1 and 7, which are read on
  the hosted stack. **Keep in R1.** Must merge before CP-7.
- **TASK-0037 (dev runbook path):** two doc lines in the same files as TASK-0101 (AC #5 edits
  `docs/ops/dev-vm-104.md` and `hosted-dev`). Too small to carry its own review decision.
  **Ruled at CP-5: merged into TASK-0101; 0037 archived.**
- **TASK-0231 (wiki split):** hygiene, but it cuts conflicts on two notes nine R1 cards re-pin.
  **Keep, first in the spine.**
- **TASK-0130 (doctrine pass):** last in its lane; AC #5 needs a captured R1 run. **Keep in R1 as
  droppable tail.** If CP-7 is ready first, move it to R2 with a revisit trigger.

## Done means

Every scoped card is Done by its own merged PR (0037 is merged into 0101; 0258 has no PR). Each
exit criterion maps to the cards that deliver it and is read from the CP-7 log:

| R1 exit criterion | Delivered by | Read from |
|---|---|---|
| 1. p95 confirmed Intent → fact rows < 1 s, hosted | 0266, 0267, 0268, 0245; 0300 (CI); 0101 (hosted) | 0278 metric, CP-7 log |
| 2. p50 first narration token < 10 s | 0272, 0273; 0298 (streaming) | 0278 metric, CP-7 log |
| 3. 4v4 round < 60 s wall time | 0267, 0268, 0269, 0274, 0275, 0276; 0299 (AI turns) | 0278 metric, CP-7 log |
| 4. Zero audit-regenerate fallbacks; audit loop deleted | 0272, 0130 | code (no regenerate path), CP-7 log |
| 5. Attempt-1 schema failures < 1% | 0273, 0269 | playtest watch, CP-7 log |
| 6. Encounter ends, resumes, drops a fled combatant | 0274, 0215 | engine tests, CP-7 scenario rows |
| 7. R1 combat scenario passes the auditor | 0278, 0186 | CP-7 auditor verdict |

The demo's "every attack, save and move resolves in code" is carried by 0270, 0267, 0222, 0223 and
0224. "Zone chips" is carried by 0271 and 0277. The stream and composer are 0199 and 0247.

Also true at close:

- Every card carries its `Dispatch:` lines with real `served=` IDs.
- `pnpm ci:check` green on `main`; wiki freshness `OK`; spec-bridge exits 0 with no R1 lag warning.
- No sweep worktrees remain; `pnpm env:prune --check` exits 0.
- Hosted ACs ticked at CP-7. Findings carded.
- This file's log complete and status flipped to done.

## Execution log

Multi-phase dispatch stays visible in `notes` (for example `phases: 1-2 done, 3 dispatched`),
updated at each dispatch boundary. `tokens/cost` carries best-effort actuals.

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
| 2026-11-08 | TASK-0231 | #145 | f0d0b491 | haiku | E1; wiki split, pins kept |
| 2026-11-08 | TASK-0138 | #146 | a837f7e1 | haiku | E2; REQUIRE_DATABASE=1 verified by orchestrator |
| 2026-11-08 | TASK-0266 | #147 | 32d00d10 | opus spec; sonnet x4 | contract v1.0 frozen (decision-0030), v1.1 text forms (C-CON) |
| 2026-11-09 | TASK-0273 | #148 | aee5400b | opus spec; sonnet x4 | interpret cap 8000 (OQ-3 read via debug route; saturated at 4000); held through the baseline playtest |
| 2026-11-09 | TASK-0270 | #150 | 85c10c53 | opus spec; sonnet x4 | OQ-10 engine events; OQ-3/OQ-4 to TASK-0274 |
| 2026-11-09 | TASK-0098 | #151 | 78284502 | opus spec; sonnet x1 | OQ2 carded as TASK-0301 (R8) |
| 2026-11-09 | baseline playtest | #149 (log, awaiting operator) | — | $5.25 of $25 | new blocker TASK-0302 (R1) |
| 2026-11-09 | TASK-0302 | #152 | aec294a4 | opus spec; sonnet x1 | live-verified on vm-104: 0 of 4 refused (baseline 4 of 5) |
| 2026-11-09 | TASK-0303 | #153, #154 | 4d092779, a0049104 | haiku; sonnet; orchestrator | deploy image missing packages/space; timing budget moved to serial check:timing |
| 2026-11-09 | TASK-0302 verify log | #155 | — | $2.08 | $7.33 of $25 in total |
| 2026-11-10 | TASK-0267 | #156 | f00a5f3c | opus spec; sonnet x1 | planner package, 28 served kinds |
| 2026-11-10 | TASK-0245 | #157 | ec33b56b | opus spec; sonnet x1 | fact sheet, dm.narrate-v22, dm.audit-v17 |
| 2026-11-10 | TASK-0274 | #158 | 28735c39 | opus spec; sonnet x2 | close-combat rule in the engine (operator ruling); stand mapping moved here from 0267 |
| 2026-11-10 | TASK-0271 | #159 | dc12f1fc | opus spec; sonnet x2 | fog in the gate; frozen spec 029 contract amended (operator ruling); TASK-0306 carded |
| 2026-11-10 | TASK-0306 | #161 | 2cc7c438 | opus spec; sonnet x1 | engaged-only ranged penalty (operator ruling); melee pairs |
| 2026-11-10 | R1 lane playtest | #162 (log) | dbde6a3a | $2.59 of $15 | encounter ended in code; TASK-0307 found |
| 2026-11-10 | TASK-0307 | #163 | cdbaf393 | sonnet x1 | E9; slot labels stripped; live-verified on vm-104 |
| 2026-11-10 | TASK-0308 | #164 | 7d6cde2a | haiku x1 | E8 extended; wall-clock tests serial; guard added |
| 2026-11-11 | TASK-0268 | (this PR) | — | opus spec (~2h, nudged); sonnet x3 | C-GATE "Approve all"; intent kind, intent.recorded carrier, AI-seat ruling turn; spec 029 contracts amended |
| 2026-11-11 | TASK-0272 | (this PR) | — | opus spec; sonnet x5 | C-AUD: B2 replay 25 turns, 0 leak, 0 contradiction (after the departed-actor fix); OQ-1 isolated in 320aee54; OQ-8 window moved to TASK-0269 |
| 2026-11-11 | TASK-0269 | (this PR) | — | opus spec; sonnet x5 | split ruled (AC #4/#6 to TASK-0312); C-GATE "Relax the gate (a)"; red interim commits by ruling |
| 2026-11-11 | TASK-0314 | (this PR) | — | sonnet x1 | E10; human-DM ruling queues the resume turn (enqueue rule 8) |
