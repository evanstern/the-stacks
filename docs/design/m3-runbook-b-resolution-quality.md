# M3 runbook B — resolution quality (milestone m-3) — sweep runbook (2026-11-02)

- **Status:** signed-off (operator, 2026-11-02, in chat, answering "Do you sign off on runbook
  B's merge spine and re-splits (C0), with Opus for spec authoring (C1)?"): "Signed off, start".
  C0 and C1 are both granted.
- **Milestone:** m-3, "The Table (multiplayer)" (`docs/design/milestones.md`, M3 section).
- **Orchestrator:** this session plans, dispatches and gates. It never implements.
- **Predecessor:** `docs/design/m3-runbook-a-run3-fixes.md` (done 2026-11-02). Its "Gates",
  "Execution mode", "Model tiers" rules and checkpoints C5, C6 and C9 carry over unless this
  file says otherwise. This file replaces runbook A's "Runbook B" stub.
- **Dispatch rules:** `docs/ops/orchestrator-kit/dispatch-rules.md` binds every dispatched agent.

## Read first (in this order)

1. This file, top to bottom.
2. `docs/playtests/2026-11-02-runbook-a-playtest.md` (runbook A playtest run 1; most cards here cite it).
3. `docs/wiki/INDEX.md`, then `docs/wiki/CAPSULES.md`. Load notes just-in-time.
4. `backlog task view TASK-<n> --plain` for the card in hand.

## State when this runbook was written (2026-11-02)

- `origin/main` at `60d6df48`.
- Gates on `main`: wiki freshness `OK: 57 note(s) fresh`; spec-bridge `ok` (72 linked; warns
  TASK-0199 lags spec 066, which is runbook D's); `pnpm env:prune --check` clean.
- Highest spec on `origin/main`: `072-party-slideout`. This runbook claims numbers from **073**,
  in claim order. Spec 070 (TASK-0127) is merged and is built here.
- PR #109 (the runbook A playtest log) waits for the operator. This runbook does not merge it.

## Planning rulings (operator, 2026-11-02)

- The theme: the Director and interpret decide things only the player or the engine should
  decide. Runbook B fixes that first (lane B1).
- TASK-0113 is widened to cover the Director's goal notes and interpret, not only the
  narrator. The widening is recorded on the card (AC #4, #5).
- TASK-0210 carries the ruling "we should be able to attack anyone regardless of combatant
  state". It reverses spec 068 OQ-4 and amends `specs/058-*/contracts/plan-reason-gate.md`.
- TASK-0171 stays in runbook B. TASK-0111 and TASK-0109 move to runbook C.
- TASK-0214 goes last: upstream fixes may clear part of its audit failures.
- Standing: one sweep runs at a time. A playtest with its own scenario follows the sweep.

## Lanes (operator-ruled, 2026-11-02)

| Lane | Order (as ruled) | Theme |
|---|---|---|
| **B1** resolve only what's declared | TASK-0113 → 0205 → 0208 → 0127 → 0170 → 0214 | Director, interpret and narrate prompts |
| **B2** state follows the fiction | TASK-0210 → 0206, with 0211 alongside | plan gate, resolve, engine |
| **B3** engine numbers | TASK-0104 → 0105 and 0128 | engine, step schema |
| **B4** smaller fixes | TASK-0171, 0209, 0203, 0207, 0212, 0213, 0204 | fallback, scene start, parse |

### Overlap check (orchestrator, 2026-11-02, against `origin/main` 60d6df48)

Expected footprints, from the cards' "Where" lines and a grep of the current tree:

| Task | Expected source files |
|---|---|
| 0113 | `dm/prompts/narrate.ts`, `prompts/director.ts`, `prompts/interpret.ts`, `dm/facts.ts` (involuntary-effects list), `prompts/audit.ts`, `nodes/audit.ts`, the playtest auditor (`.claude/skills/playtest-run/scripts/`) |
| 0205 | `prompts/director.ts`, `prompts/interpret.ts`, `gates/plan-gate.ts` (a check rolls for the declaring PC) |
| 0208 | `packages/dnd5e-engine` (reaction rule), `nodes/resolve.ts`, `prompts/interpret.ts`, `dm/fallback.ts`, `prompts/narrate.ts` |
| 0127 | spec 070 plan.md: engine `attacks.ts`/schema, `nodes/schemas.ts`, `prompts/{interpret,adjudicate,step-grammar,narrate,audit}.ts`, `seed/schema.ts`, `gates/plan-gate.ts`, `nodes/resolve.ts`, new `dm/stakes.ts`, `facts.ts`, `fallback.ts`, `resume.ts`, `apps/web/app/play/ledger-format.ts` |
| 0170 | `nodes/schemas.ts`, `prompts/interpret.ts`, `nodes/resolve.ts`, `facts.ts`, `prompts/narrate.ts`, `prompts/audit.ts` |
| 0214 | `prompts/narrate.ts`, `facts.ts`, `prompts/audit.ts`, `fallback.ts` |
| 0210 | `gates/plan-gate.ts`, `nodes/resolve.ts` (pullIn), `specs/058-*/contracts/plan-reason-gate.md`, spec 068 tests |
| 0206 | `nodes/resolve.ts`, `facts.ts`, `snapshot/build.ts` (scene-presence), `prompts/director.ts`, `prompts/chronicle.ts` |
| 0211 | engine `commands/spell-slots.ts`, `nodes/resolve.ts`, `nodes/schemas.ts` |
| 0104 | engine, `nodes/schemas.ts`, `prompts/{interpret,adjudicate,step-grammar}.ts`, `nodes/resolve.ts`, `gates/plan-gate.ts`, `seed/schema.ts` |
| 0105 | engine, `packages/srd`, `nodes/schemas.ts`, `prompts/{interpret,adjudicate}.ts`, `nodes/resolve.ts` |
| 0128 | engine, `nodes/schemas.ts`, `prompts/interpret.ts`, `nodes/resolve.ts` |
| 0171 | `seed/schema.ts`, `seed/views.ts`, `apps/server/seeds/*.json`, `prompts/narrate.ts` (scene start), `nodes/narrate.ts`, `nodes/audit.ts`, `fallback.ts`, eight DM scripts (amended 2026-11-02 from spec 076's plan) |
| 0209 | `nodes/resolve.ts` (turn advance after a clarify group), `fallback.ts` (clarify sentence) |
| 0203 | `dm/pipeline/call.ts` (callJson, stripThink) |
| 0207 | `nodes/schemas.ts` (a say field), `prompts/interpret.ts`, `fallback.ts` |
| 0212 | `fallback.ts` |
| 0213 | `fallback.ts`, `facts.ts` |
| 0204 | `prompts/narrate.ts`, `nodes/audit.ts` or the deterministic audit checks, `doctrine/doctrine.ts` |

Findings:

- **The lanes share their hot files.** 13 of 19 cards edit `nodes/resolve.ts`, `nodes/schemas.ts`
  or `prompts/interpret.ts`. 8 edit `fallback.ts`. Lanes B1–B4 cannot develop in parallel the
  way runbook A's did. They stay as **spec lanes**: spec authoring touches only `specs/NNN-*/`,
  so all specs can be authored at once. Implementation follows one **merge spine** (below).
- **Re-split R1 — TASK-0209 moves ahead of TASK-0205.** 0205 AC #1 makes interpret ask
  (clarify) instead of assuming a method. Today a clarify spends the player's turn (0209). If
  0205 lands first, every new clarify costs a turn.
- **Re-split R2 — TASK-0211 leaves B2 for B3, behind TASK-0105.** 0211 AC #2 (Cure Wounds dice
  from the SRD record) is 0105 AC #2 for one spell. Spending a slot needs the spell step that
  0105 adds. B2 becomes TASK-0210 → 0206. B3 becomes TASK-0104 → 0105 → 0211, with 0128 after 0104.
- **Re-split R3 — TASK-0127 and TASK-0170 land before TASK-0104.** All three reshape the check
  step in `nodes/schemas.ts`. Spec 070 is merged against today's step shape. Author 0104's spec
  against spec 070's D1 step contract. 0104's model-picked difficulty tier then feeds 0127's
  band computation.
- **Fallback sequence (from the brief):** `fallback.ts` merges in spine order: 0209 → 0208 →
  0127 → 0207 → 0212 → 0213 → 0214. The fallback cards land before 0214, so 0214's audit
  replay sees the final fallback.
- **Prompt versions:** each prompt card bumps a prompt version (narrate-v7, interpret-v5,
  director-v4 today). Two cards in flight on one prompt both claim the next version. The later
  merge re-bumps its version and reconciles `docs/wiki/dm-narration-quality.md`.
- **Migrations:** none expected. A plan with a migration regenerates after merging
  `origin/main` in. Never hand-merge `meta/_journal.json`.
- **Rule at dispatch:** before each implementation dispatch, compare its `plan.md` file list
  with every task in implementation. Develop ahead only on disjoint source files. Otherwise
  draft-hold the later task until the earlier one merges, and log the amendment.

### Merge spine (proposed for C0)

Implementations merge in this order. A task may develop ahead of its turn when its `plan.md`
shares no source file with the tasks ahead of it.

| # | Task | Lane | Tier (impl) | Spec | Develops ahead? |
|---|---|---|---|---|---|
| 1 | TASK-0203 haiku parse | B4 | sonnet | escape E1 | yes (`call.ts` only) |
| 2 | TASK-0209 clarify keeps the turn | B4 → R1 | sonnet | spec set | — |
| 3 | TASK-0113 player agency (widened) | B1 | sonnet | spec set | yes, beside 0209 (prompts, facts, audit) |
| 4 | TASK-0210 attack anyone | B2 | sonnet | spec set | yes, beside 0113 (plan gate, pullIn) |
| 5 | TASK-0205 no undeclared method | B1 | sonnet | spec set | after 0113 merges (same prompts) |
| 6 | TASK-0206 revealed NPC is present | B2 | sonnet | spec set | after 0210 merges (`resolve.ts`) |
| 7 | TASK-0208 engine opportunity attack | B1 | sonnet | spec set | after 0205 merges |
| 8 | TASK-0127 stakes before dice | B1 | sonnet | spec 070 (merged) | after 0208 merges |
| 9 | TASK-0170 declared outcome | B1 | sonnet | spec set | after 0127 merges |
| 10 | TASK-0207 talk fallback voices the line | B4 | sonnet | spec set | after 0170 merges (`schemas.ts`) |
| 11 | TASK-0212 one "falls unconscious" | B4 | haiku | escape E2 | yes, beside 0207 if `plannedSentence` is untouched |
| 12 | TASK-0213 pull-in dice line | B4 | haiku | escape E3 | after 0212 merges |
| 13 | TASK-0104 engine-derived numbers | B3 | sonnet | spec set (R3) | after 0170 merges |
| 14 | TASK-0105 spells by SRD id | B3 | sonnet | spec set | after 0104 merges |
| 15 | TASK-0128 opposition and Help | B3 | sonnet | spec set | beside 0105 if disjoint, else after |
| 16 | TASK-0211 spell slots (R2) | B3 | sonnet | spec set | after 0105 merges |
| 17 | TASK-0171 scene-start intros | B4 | sonnet | spec set | yes, from #9 on (scene-start path) |
| 18 | TASK-0204 no "What do you do?" | B4 | haiku | escape E4 | after 0171 merges (`narrate.ts`, audit) |
| 19 | TASK-0214 combat audit pass rate | B1 | sonnet | spec set | last |

### Lane notes

- **TASK-0113 widened:** the card gains AC #4 (Director goal notes state no PC's volitional
  act) and AC #5 (interpret steps carry no volitional act the player did not declare). It
  settles the shared rule and the involuntary-effects facts that 0205, 0208 and 0127 apply.
  Its spec reserves the outcome-band field spec 070 fills.
- **TASK-0205** applies 0113's rule to methods and skills. AC #2 (a check rolls for the
  declaring player's PC) is a plan-gate rule, not a prompt rule.
- **TASK-0208:** the engine has no positions today. Its spec states what "leaving reach"
  means without a map (open question for C0 via the spec, default: a declared move away from
  an adjacent hostile, as named by interpret, with the reaction unspent).
- **TASK-0127:** build spec 070 as merged. Its OQ-1 and OQ-2 defaults (a) stand unless the
  operator rules otherwise at C0. Re-check its plan.md file list against 0113's and 0208's
  merged code before dispatch, and amend the spec's tasks.md if a seam moved.
- **TASK-0210:** the PR amends `specs/058-*/contracts/plan-reason-gate.md` (the stated reason
  for review: a contract reversal) and replaces the spec 068 tests that assert the refusal.
- **TASK-0206 AC #2** may already pass once 0210 lands (an attack on a present NPC pulls it
  in). Its spec checks that first and narrows to AC #1 and #3 if so.
- **Hosted ACs:** TASK-0203 AC #2, 0204 AC #2 and 0214 AC #1 need a hosted run. They tick at
  runbook B's playtest. Those cards stay In Progress after their PRs merge, until the
  playtest ticks them. Then flip them Done.

## Model tiers (from `.claude/model-tiers.json`, checked 2026-11-02)

| Tier | Agent | Pinned model | Used for |
|---|---|---|---|
| sonnet (default) | `sonnet-implementer` | `cc/claude-sonnet-5-5[1m]` | All implementation except 0212, 0213, 0204. The playtest scenario. |
| haiku | `haiku-implementer` | `cc/claude-haiku-5-5` | TASK-0212, 0213, 0204 (one function or one check each). |
| opus (escalation) | `opus-implementer` | `cc/claude-opus-5-5[1m]` (fallback `cc/claude-fable-5-1[1m]`) | Spec authoring for every "spec set" row. Needs C1. |

- Pass no `model` parameter on a dispatch. The frontmatter `cc/` pin applies.
- Verify the served model from the first dispatch's transcript before any sibling dispatch.
- Record one line per dispatch on the card: `Dispatch: tier=<tier> pinned=<model-id> served=<model-id>`.
- If auto mode denies a dispatch, stop and report it. Do not implement inline.

## Execution mode

- Interactive-root mode, as runbook A. Worktrees at `.worktrees/task-<n>`.
- Board track: `backlog/`-only commits go direct to `main` from root, pushed at once.
- Claim flips ride the claim commit on the task branch. Use the kit's `claim.sh`.
- This runbook lands by its own PR (branch `sweep-m3-runbook-b`). Execution log rows ride the
  next claimed task's branch; the final rows ride a wrap-up PR.
- Edits in `.worktrees/task-*` go through Bash where the app blocks Edit/Write (operator
  ruling "Allow edits via Bash", runbook A log). Show `git -C <worktree> diff` after each edit.
- Merge on green with `gh pr merge --merge`. Report each merge to the orchestrator in plain language.

## Gates

- Per PR, on the branch's final tree, before merge:
  - `pnpm ci:check` green.
  - `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs freshness . docs/wiki` prints `OK`.
  - `node ~/.claude/plugins/cache/praxisflux/spec-bridge/1.0.1/gates/cli.mjs check .` exits 0.
  - The card carries a `Dispatch:` line with a real `served=` ID for each dispatch.
- Tick every spec task in `tasks.md` before opening the PR (runbook A lesson: a late tick blocks the Done flip).
- Expected wiki reviews (NEEDS-REVIEW candidates):
  - 0113, 0205, 0214, 0204, 0171: `dm-narration-quality`, `dm-runtime`.
  - 0208, 0127, 0170, 0104, 0105, 0128, 0211: `dnd5e-engine`, `dm-runtime`, `dm-failure-and-gates`; 0105 also `srd-data`.
  - 0210, 0209: `dm-failure-and-gates`, `dm-runtime`, `turn-floor`.
  - 0206: `presence`, `seed-npc-presence`, `dm-runtime`.
  - 0207, 0212, 0213: `dm-narration-quality`.
  - 0203: `ai-gateway`.
  - 0171: `seed-npc-presence`, `dm-narration-quality`.
  - Scenario: `playtest-harness`.

## Escape lines (proposed for C0)

- **E1 — TASK-0203:** card ACs drive. Find the cause from a captured reply under the fake
  gateway or a ledger text capture. Record it on the card. Fix with a test.
- **E2 — TASK-0212:** card ACs drive. One fallback function plus a replay test.
- **E3 — TASK-0213:** card ACs drive. The fallback prints the pull-in initiative roll; a replay test.
- **E4 — TASK-0204:** card ACs drive. A deterministic audit check blocks the literal ending; a test.

## Task-specific merge conditions

- **TASK-0209:** a test replays run 1 seq 172–176; no `turn.advance` follows a clarify group.
- **TASK-0113:** prompt tests over the Director goal note and interpret's step rules; a test
  over the scene-start framing.
- **TASK-0205:** a test replays run 1 seq 24–30; no Stealth check, and no check for another human's PC.
- **TASK-0210:** a test replays run 1 seq 45 with Snag present; an absent actor is still refused.
- **TASK-0206:** a test replays run 1 seq 40 (reveal sets Snag and Pell present).
- **TASK-0208:** a test replays run 1 seq 151–161; the free resolves as Kestrel's step, and any
  reaction comes from the engine with the goblin as subject.
- **TASK-0127:** spec 070's tests, including both house-rule flags on and off.
- **TASK-0170:** a replay of the claw-marks case names the creature on success.
- **TASK-0207:** a test replays run 1 seq 124–126 and ships Pell's words.
- **TASK-0104, 0105, 0128, 0211:** scripted-dice engine tests; the scripted CI playtest stays green.
- **TASK-0171:** a captured-run test names every party character and present NPC; no DM-only seed text reaches the prompt.
- **TASK-0214:** a replay test over run 1 seq 103, 126, 131, 161 and 196.

## Last step — runbook B's playtest scenario

Starts after the spine merges. Follow `docs/design/playtest-scenarios.md` (TASK-0195
convention). Reuse seed `greyhollow-ford-reed-camp` unless a row needs a new seed fact. Ship:

- Checklist `docs/playtests/scenarios/runbook-b-<name>.md`, one row per bullet below.
- Script `apps/server/dm-scripts/runbook-b-<name>.json` for rehearsal set-up only.
- A local `DM_FAKE_SCRIPT` rehearsal log under `docs/playtests/`.

Rows the scenario must exercise:

- **Undeclared method** (0205, 0113): an approach with no stated method resolves plain or asks.
- **Clarify question** (0209): an ambiguous attack asks which weapon; the turn holds.
- **Revealed NPC** (0206): Snag is revealed, then targeted before the encounter starts.
- **Attack on a captive** (0210): an attack on Pell passes the gate and pulls him in.
- **Opportunity attack** (0208): a PC moves away from an adjacent goblin; any reaction is the engine's.
- **Spell slot** (0211, 0105): Odo casts Cure Wounds until his slots run out; the next cast is refused.
- **Stakes and outcome** (0127, 0170): a check's band and declared outcome show in the ledger and the prose.
- **Engine numbers** (0104): a check's modifier and DC come from stats and a difficulty tier.
- **Scene start** (0171): the opening names the party characters and Wenna, and no player (operator ruling 2026-11-02: "The opening should name the characters, not the players").
- **Narration** (0204, 0214, 0207, 0212, 0213): no "What do you do?" ending; at least 15 combat
  turns for the audit pass rate; any fallback voices NPC lines and dice lines.
- **Open followUp** (0208 AC #4): an action parked as a followUp stays shown as not yet attempted in a later beat.
- **Revisit rows** (TASK-0216): record whether a talk-turn reveal stays absent, or narration calls an offstage NPC gone.
- **Parse** (0203): no first-attempt invalid-json on dm.audit or dm.chronicle over 10+ turns.

Then **stop for the operator to play it** (checkpoint C7).

## Operator checkpoints

- **C0 — lane sign-off (now):** the merge spine, re-splits R1–R3, the tier table, escape lines
  E1–E4, and spec 070's OQ-1 and OQ-2 defaults.
- **C1 — standing opus sign-off** for spec authoring on every "spec set" row.
- **C5 — new runtime dependencies.** Stop after `plan.md`.
- **C6 — paid provider runs.** The playtest needs the operator's ceiling, in the operator's words.
- **C7 — the playtest.** The operator plays runbook B's scenario.
- **C9 — vm-104.** Every vm-104 command needs the operator's go on the exact command.
- Any spine amendment from a `plan.md` overlap: tell the operator, amend this file.

## Done means

- Every spine task merged by its own PR and Done (hosted ACs ticked at the playtest).
- Every card carries its `Dispatch:` lines with real `served=` IDs.
- `pnpm ci:check` green on `main`; wiki freshness `OK`; spec-bridge exits 0.
- No sweep worktrees remain; `pnpm env:prune --check` exits 0.
- The operator has played runbook B's scenario, and its findings are carded.

## Execution log

| Date | Task | PR | Merge | Dispatches | Notes |
|---|---|---|---|---|---|
| 2026-11-02 | TASK-0203 | #111 | e92a2e8d | sonnet | E1. Parse tolerates prose around one JSON object; unparsable replies logged. AC #2 ticks at the playtest. |
| 2026-11-02 | TASK-0210 | #112 | af1e581b | opus (spec 075), sonnet, haiku | Contract reversal (058 amended), operator's ruling quoted. |
| 2026-11-02 | TASK-0209 | #113 | fbf4d1df | opus (spec 073), sonnet, haiku | Clarify holds the turn. Footprint widened to narrate.ts and nodes/audit.ts; 0113 phase 2 held behind it. |
| 2026-11-02 | (ruling) | — | — | — | Spec 074 OQ-1, operator: "Yes, allow a flinch" (a foe's miss is a reflex trigger). |
| 2026-11-02 | TASK-0113 | #114 | d9aade52 | opus (spec 074 + amendment), sonnet x2, haiku | Widened (AC #4, #5). Cards TASK-0215 (surprise). |
| 2026-11-02 | TASK-0205 | #115 | 1a560446 | opus (spec 077), sonnet, haiku | Built beside 0206 (separate plan-gate functions). Card TASK-0217 (hidden state). |
| 2026-11-02 | TASK-0206 | #116 | 8349b07f | opus (spec 078), sonnet, haiku | Director `arrivals`. Card TASK-0216 (revisit after playtest). |
| 2026-11-02 | (incident) | — | — | — | A brief's `export $(grep ... .env)` ran bare `export` with no .env and printed a secret into an implementer transcript. Nothing committed. Operator: "No need" (no rotation). Briefs now use `VAR="$(sed ...)"`. 2026-11-02 update, relayed by the orchestrator: the operator is rotating it ("Rotating it now"). |
| 2026-11-02 | (ruling) | — | — | — | Spec 076 OQ-1, operator: "The opening should name the characters, not the players". |
| 2026-11-02 | TASK-0208 | #117 | 38b8e737 | opus (spec 079), sonnet x3, haiku (stopped) | Engine reactions, `STEP_ACTOR_MISMATCH`. Cards TASK-0218, 0219. Spec 081 (0207) carded TASK-0220. |
| 2026-11-02 | TASK-0127 | #118 | bbba03a0 | sonnet x3 (spec 070 by opus in runbook A) | Built the merged spec 070. Seam check: no seam changed meaning; deviations in `specs/070-stakes-before-dice/deviations.md`. Nat 20/nat 1 on by default. interpret-v8, adjudicate-v6, narrate-v11, audit-v7. |
| 2026-11-03 | TASK-0170 | #119 | 88589234 | opus (spec 080), sonnet x3 | Delta on spec 070. A check declares its success outcome and may reveal one beat clue; the seed now names goblin feet. Claw-marks fixture reconstructed. Card TASK-0221 (revisit). interpret-v9, adjudicate-v7, narrate-v12, audit-v8. |
| 2026-11-03 | TASK-0212 | #120 | d334e998 | haiku | E2. One 'falls unconscious'. Orchestrator ran the DB gate and fixed one stale wiki clause before merge. |
| 2026-11-03 | TASK-0207 | #121 | bed923f4 | opus (spec 081), sonnet x2 | `say` field; the fallback voices an NPC's planned line. interpret-v10, narrate-v13, audit-v9. Card TASK-0220. |
| 2026-11-03 | TASK-0213 | #122 | 05ef251e | sonnet (tier raised from haiku: root-cause hunt) | pullIn discarded its batch ids; NPC and PC paths fixed after two orchestrator reviews. narrate-v14. |
| 2026-11-03 | (ruling) | — | — | — | Spec 082 OQ-1, operator: "I'm okay with stats-only as long as the rule for Sneak Attack is something that's going to come later…". Carded TASK-0225 (m-4); standing S-sneak-attack playtest row. |
| 2026-11-03 | TASK-0104 | (this PR) | (at merge) | opus (spec 082 + seam check), sonnet x3 | Engine-derived numbers; `STAT_UNDEFINED`; interpret-v11, adjudicate-v8. Cards TASK-0222, 0223, 0224. |

## Later runbooks (order on record; each gets its own runbook and sign-off)

### Runbook C — actor state and NPC information

- TASK-0145, TASK-0146, TASK-0147.
- TASK-0148 and TASK-0149 → TASK-0150 and TASK-0151 → TASK-0152.
- TASK-0109 → TASK-0144 (0109 moved here from runbook B, 2026-11-02).
- TASK-0111 (moved here from runbook B, 2026-11-02).
- TASK-0172 → TASK-0173.
- TASK-0210, 0206 and 0211 are not here: runbook B builds them.
- Ends with its own playtest scenario.

### Runbook D — one chat stream (after TASK-0188's spec 066 merges)

- TASK-0188, then TASK-0187, TASK-0190, TASK-0133 and TASK-0169, then TASK-0132.
- Re-scope TASK-0129 and TASK-0131 against decision-0028 before they are laned.
- Ends with its own playtest scenario.
