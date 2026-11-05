# M3 runbook B2 — runbook B playtest fixes (milestone m-3) — sweep runbook (2026-11-05)

- **Status:** signed-off (operator, 2026-11-05, in chat, answering "Do you sign off on the runbook
  B2 merge spine and amendment A1 (C0), with Opus for spec authoring (C1)?"): "Signed off, start".
  C0 (spine, A1, tiers, E1-E3, lane-note defaults) and C1 are both granted. E4 was added when A1
  was carded (TASK-0246), the same card-ACs-drive shape as E1 and E2; the operator was told.
- **Milestone:** m-3, "The Table (multiplayer)" (`docs/design/milestones.md`, M3 section).
- **Orchestrator:** this session plans, dispatches and gates. It never implements.
- **Predecessor:** `docs/design/m3-runbook-b-resolution-quality.md` (implementation done
  2026-11-03, playtest played 2026-11-04). Its "Gates", "Execution mode" and "Model tiers"
  rules and checkpoints C5, C6 and C9 carry over unless this file says otherwise.
- **Dispatch rules:** `docs/ops/orchestrator-kit/dispatch-rules.md` binds every dispatched agent.
- **Ordering ruling (operator, 2026-11-05):** "Fix sweep, then 0245". This sweep runs first.
  Runbook C opens with TASK-0245 (stub at the end of this file).

## Read first (in this order)

1. This file, top to bottom.
2. `docs/playtests/2026-11-03-runbook-b-playtest.md` (runbook B playtest run 1; every card here cites it).
3. `docs/wiki/INDEX.md`, then `docs/wiki/CAPSULES.md`. Load notes just-in-time.
4. `backlog task view TASK-<n> --plain` for the card in hand.

## State when this runbook was written (2026-11-05)

- `origin/main` at `d9ca2186` (playtest log PR #131 merged).
- Gates on `main`: wiki freshness `OK: 57 note(s) fresh`; spec-bridge `ok` (85 linked; warns
  TASK-0214 lags spec 085, expected: AC #1 is hosted); `tiers.mjs --check` exits 0, no regeneration.
- Highest spec on `origin/main`: `085-combat-audit-pass-rate`. This runbook claims numbers
  from **086**, in claim order.
- Prompt versions on `main`: interpret-v13, adjudicate-v10, narrate-v18, audit-v12,
  director-v7, chronicle-v4, companion-v7, react-v2.
- In Progress: TASK-0203 and TASK-0214 (carried from runbook B; hosted ACs not met), TASK-0186
  (playtest-run skill, not this sweep).
- Other sessions' worktrees, untouched by this sweep: `.worktrees/env-main` (detached) and
  `.worktrees/mud-ux` (TASK-0236).
- Runbook B playtest result: 37 turns, $4.73, auditor pass; checklist 33 pass, 7 fail,
  2 blocked, 2 not reached. Combat first-attempt audit pass 10 of 23 (43%) against 70%.

## Standing operator rulings (carry into every spec)

- A reflex flinch is allowed (spec 074 OQ-1: "Yes, allow a flinch").
- The opening names the characters, not the players (spec 076 OQ-1).
- Attack damage comes from stats only. Sneak Attack waits for TASK-0225 (spec 082 OQ-1).
- Attacks may target anyone present (TASK-0210).

## Scope

| Task | Finding | Playtest evidence |
|---|---|---|
| TASK-0242 | An NPC hit's damage roll renders "no result", so the audit refuses every wounding narration. | finding 31, seq 163-170, 185-192 |
| TASK-0244 | A party action lets a companion act out of turn; the off-turn list then refuses its narration. | finding 40, seq 206-241 |
| TASK-0203 | Attempt-1 replies fail the Zod schema and are logged as invalid-json (root cause on the card). | 17 of 224 calls |
| TASK-0237 | The Director reveals an NPC before the dice; a failed check still delivers the success. | finding 12, seq 43-51, 63-72 |
| TASK-0238 | An encounter monster can't be acted on before its encounter starts. | finding 16, seq 52-60, 73-94 |
| TASK-0240 | The model audit refuses a reflex flinch the operator ruled allowed. | finding 23, seq 100-106 |
| TASK-0214 | Re-measure combat first-attempt audit pass against 70%. Last. | AC #1 open |

## Overlap check (orchestrator, 2026-11-05, against `origin/main` d9ca2186)

Expected footprints, from the cards and a grep of the current tree (paths under
`apps/server/src/dm/` unless stated):

| Task | Expected source files |
|---|---|
| 0242 | `facts.ts` (npcTurn roll path, the `:dmg` submission), `prompts/narrate.ts` (`rollEntry`) |
| 0240 | `prompts/audit.ts`, `nodes/audit.ts` (advisory downgrade), `audit-words.ts` (reflex list) |
| 0203 | `pipeline/call.ts` (schema outcome), `apps/server/src/schema/dm-model-calls.ts` + a migration (the `dm_model_calls_outcome_valid` CHECK gains a schema outcome), `nodes/audit.ts` + `prompts/audit.ts` (kind, detail, actor coercions), `chronicle.ts`, `companion.ts`, `nodes/director.ts` + `prompts/director.ts` (goalNote), `prompts/interpret.ts` (attack, stakes fields) |
| 0244 | `gates/plan-gate.ts` (party-scope step actor), `nodes/resolve.ts` (hold for the companion's turn), `facts.ts` (off-turn list), possibly `floor-state.ts` |
| 0238 | `snapshot/build.ts` (revealed encounter monsters as actors), `gates/plan-gate.ts`, `nodes/resolve.ts` (pull-in or encounter start), `prompts/interpret.ts`, `facts.ts` + `fallback.ts` + `prompts/narrate.ts` (a refused attempt is not voiced as resolved) |
| 0237 | `nodes/director.ts` + `prompts/director.ts` (no pre-decided outcome; arrivals that hang on a check), `nodes/resolve.ts` (arrivals after the band), `prompts/audit.ts` + `claims.ts` (success-on-failure ledger-mismatch) |

Findings:

- **Every card shares a hot file with at least one other.** `facts.ts`: 0242, 0244, 0238.
  `prompts/audit.ts` / `nodes/audit.ts`: 0240, 0203, 0237. `gates/plan-gate.ts` /
  `nodes/resolve.ts`: 0244, 0238, 0237. `prompts/director.ts`: 0203, 0237.
  `prompts/interpret.ts`: 0203, 0238. As in runbook B, lanes are **spec lanes**: all specs
  author at once (they touch only `specs/NNN-*/`). Implementation follows one **merge spine**.
- **Two disjoint pairs develop in parallel.** 0242 (`facts.ts`, `narrate.ts`) and 0240
  (audit prompt, audit node, `audit-words.ts`) share no file. After both merge, 0203 and 0244
  share no file unless 0244's plan names a prompt.
- **0242 and 0240 go first.** They are the cheapest and the highest leverage on the audit pass
  rate (finding 31 hits every NPC hit; finding 23 hits every flinch).
- **0203 after 0240.** Both edit the audit prompt and the audit node. 0203's `call.ts`,
  schema and migration phase may develop ahead of 0240's merge.
- **0238 after 0244.** Both edit the plan gate, resolve and `facts.ts`. 0244 is the smaller.
- **0237 last of the fixes.** It edits resolve (after 0244, 0238), the Director prompt
  (after 0203) and the audit prompt (after 0240, 0203). Its spec re-checks the seams those
  merges moved.
- **Fallback:** only 0238 AC #3 may touch `fallback.ts`. No fallback sequence is needed.
- **Migration (0203):** generate it after merging `origin/main` in. Never hand-merge
  `apps/server/drizzle/meta/_journal.json`. No new runtime dependency is expected (C5 not triggered).
- **Prompt versions:** each prompt edit bumps that prompt's version. When two cards in flight
  claim the same next version, the later merge re-bumps and reconciles `docs/wiki/dm-narration-quality.md`.
- **Rule at dispatch:** before each implementation dispatch, compare its `plan.md` file list
  with every task in implementation. Develop ahead only on disjoint source files. Otherwise
  draft-hold the later task until the earlier one merges, and log the amendment.

## Merge spine (proposed for C0)

| # | Task | Tier (impl) | Spec | Develops ahead? |
|---|---|---|---|---|
| 1 | TASK-0242 NPC hit damage line | sonnet | escape E1 | yes |
| 2 | TASK-0240 reflex flinch in the audit | sonnet | escape E2 | yes, beside 0242 (disjoint) |
| 2b | TASK-0246 off-turn non-attack verbs (A1) | sonnet | escape E4 | after 0240 merges (`audit-words.ts`, `claims.ts`) |
| 3 | TASK-0203 schema outcome and coercions | sonnet | spec set | `call.ts`/schema phase yes; prompt phases after 0240 merges |
| 4 | TASK-0244 companion acts in its own turn | sonnet | spec set | after 0242 merges (`facts.ts`); beside 0203 if disjoint |
| 5 | TASK-0238 encounter monster before the encounter | sonnet | spec set | after 0244 merges |
| 6 | TASK-0237 reveal waits for the dice | sonnet | spec set | after 0238 and 0203 merge |
| 7 | TASK-0250 B2 playtest scenario | sonnet | escape E3 | after #6 merges |
| 8 | TASK-0214 re-measure | — (playtest) | spec 085 (merged) | at the playtest |

### Proposed amendment A1 (for C0) — off-turn non-attack verbs

TASK-0214's notes record a cause no card holds: the off-turn code check misses non-attack verbs
("turns its head", "shifts its grip", "watches"), and the model audit still blocks them.
Proposal: card it now, with ACs drawn from run 1, and slot it at spine #2b, after 0240
(both edit `audit-words.ts`). Without it, 0214's re-measure likely misses 70% on a known cause.
Granted at C0; carded as **TASK-0246** (sonnet, escape E4: card ACs drive). Default in its AC #2:
a perceptual verb (watches, waits, turns its head toward a noise) is not a turn action.

### Lane notes

- **TASK-0242:** the card narrows the cause to the npcTurn path (`facts.ts`), not the PC path.
  The fix puts the hit's amount, type and target on the roll line. Never invent a damage fact
  the ledger lacks.
- **TASK-0240:** apply the standing flinch ruling. A chosen dodge or a timed twist stays blocked
  (finding 23's second block was correct).
- **TASK-0203:** AC #1 is ticked. The vm-104 log shapes listed on the card are the test
  fixtures. Coercions accept only the safe shapes the card names. Any other mismatch still
  re-asks, now logged under its own outcome. AC #2 ticks at this runbook's playtest.
- **TASK-0244:** the spec picks hold or refuse for a party action naming a non-active
  companion (open question for C0 via the spec; default: hold the step for the companion's
  turn, and say so in the fact lines).
- **TASK-0238:** AC #1 allows a combatantId or a display-name map. The spec picks one (default:
  revealed encounter monsters enter the snapshot by combatantId). Its spec checks TASK-0206's
  arrivals path first and reuses it.
- **TASK-0237:** AC #2 offers two fixes. The spec picks one (default: arrivals that hang on a
  check wait for resolve, and the goal note states no result). The declared outcomes
  (0127, 0170) and the Director's arrivals (0206) stay.
- **TASK-0214:** no build. Its AC #1 is measured at this runbook's playtest. Met: tick AC #1 and
  close the card. Not met: card each remaining cause from the playtest log, ordered, then close
  or keep 0214 per the operator.

## Model tiers (from `.claude/model-tiers.json`, checked 2026-11-05)

| Tier | Agent | Pinned model | Used for |
|---|---|---|---|
| sonnet (default) | `sonnet-implementer` | `cc/claude-sonnet-5-5[1m]` | Every implementation row. The playtest scenario. |
| haiku | `haiku-implementer` | `cc/claude-haiku-5-5` | Single-file follow-ups only (none planned). |
| opus (escalation) | `opus-implementer` | `cc/claude-opus-5-5[1m]` (fallback `cc/claude-fable-5-1[1m]`) | Spec authoring for 0203, 0244, 0238, 0237. Needs C1. |

- Pass no `model` parameter on a dispatch. The frontmatter `cc/` pin applies.
- Verify the served model from the first dispatch's transcript before any sibling dispatch.
- Record one line per dispatch on the card: `Dispatch: tier=<tier> pinned=<model-id> served=<model-id>`.
- If auto mode denies a dispatch, stop and report it. Do not implement inline.

## Execution mode

- Interactive-root mode, as runbook B. Worktrees at `.worktrees/task-<n>`.
- Board track: `backlog/`-only commits go direct to `main` from root, pushed at once.
- Claim flips ride the claim commit on the task branch. Use the kit's `claim.sh`.
- This runbook lands by its own PR (branch `sweep-m3-runbook-b2`). Execution log rows ride the
  next claimed task's branch. The final rows ride a wrap-up PR.
- Edits in `.worktrees/task-*` go through Bash where the app blocks Edit/Write (operator
  ruling "Allow edits via Bash"). Show `git -C <worktree> diff` after each edit. Never touch
  `backlog/` or `.claude/` that way.
- Read the test database URL with `TEST_DATABASE_URL="$(sed -n 's/^TEST_DATABASE_URL=//p' .env)"`
  after `pnpm env:up`. Never `export $(grep ...)`.
- Merge on green with `gh pr merge --merge`. Report each merge to the orchestrator in plain language.

## Gates

- Per PR, on the branch's final tree, before merge:
  - `pnpm ci:check` green.
  - `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs freshness . docs/wiki` prints `OK`.
  - `node ~/.claude/plugins/cache/praxisflux/spec-bridge/1.0.1/gates/cli.mjs check .` exits 0.
  - The card carries a `Dispatch:` line with a real `served=` ID for each dispatch.
- Tick every spec task in `tasks.md` before opening the PR.
- After each agent, check that root is clean (runbook B lesson: agents wrote scratch files into root).
- Expected wiki reviews (NEEDS-REVIEW candidates):
  - 0242, 0240: `dm-narration-quality`, `output-claim-gate`.
  - 0203: `ai-gateway`, `database-schema`, `migrations`, `dm-runtime`.
  - 0244: `turn-floor`, `dm-failure-and-gates`, `dm-runtime`.
  - 0238: `presence`, `seed-npc-presence`, `actor-snapshot`, `dm-failure-and-gates`.
  - 0237: `dm-runtime`, `seed-npc-presence`, `dm-narration-quality`.
  - Scenario: `playtest-harness`.

## Escape lines (proposed for C0)

- **E1 — TASK-0242:** card ACs drive. A facts test replays seq 163-166; a scripted-audit test covers seq 163-170.
- **E2 — TASK-0240:** card ACs drive. An audit-prompt rule plus a code downgrade; a test per AC.
- **E4 — TASK-0246:** card ACs drive. A deterministic check per AC; a replay test over the run 1 phrases.
- **E3 — B2 scenario:** the TASK-0195 convention drives (as TASK-0234 in runbook B).

## Task-specific merge conditions

- **TASK-0242:** the seq 163-166 facts replay shows amount and target; seq 185-192 (lookout) passes too.
- **TASK-0240:** seq 100-106 attempt 2 passes the scripted audit; the "where Odo stood" dodge still blocks.
- **TASK-0203:** one test per vm-104 reply shape; the ledger records the schema outcome; the migration applies on a fresh stack.
- **TASK-0244:** a test replays seq 206-230; Odo acts once in round 2.
- **TASK-0238:** a test replays seq 52-58 and seq 73-92 (same-beat encounter start); the opposed check rolls.
- **TASK-0237:** a test replays seq 43-51 (no Pell on a severe failure) and seq 63-72.

## Last step — runbook B2's playtest scenario

Starts after spine #6 merges. Follow `docs/design/playtest-scenarios.md` (TASK-0195
convention). Reuse seed `greyhollow-ford-reed-camp` unless a row needs a new seed fact. Ship:

- Checklist `docs/playtests/scenarios/runbook-b2-<name>.md`, one row per bullet below, plus the standing rows.
- Script `apps/server/dm-scripts/runbook-b2-<name>.json` for rehearsal set-up only.
- A local `DM_FAKE_SCRIPT` rehearsal log under `docs/playtests/`.

Rows the scenario must exercise:

- **Failed reveal check** (0237): Kestrel scans the reeds. On a failure band, Pell stays unrevealed in prose and in the ledger.
- **Pre-encounter monster** (0238): a PC parleys with or targets the lookout before the fight. The opposed check rolls; no UNKNOWN_COMBATANT.
- **Wounding hits** (0242): at least three NPC hits that deal damage. Each roll line shows the damage; the audit passes the wound.
- **Companion in a party action** (0244): in turn order, a player declares "Odo casts Cure Wounds on Tamsin." during another actor's turn. Odo acts once that round.
- **Flinch** (0240): a foe misses a PC or companion. A flinch in the prose passes the audit.
- **Parse** (0203): over 10+ turns, no attempt-1 invalid-json on dm.audit or dm.chronicle; any schema outcome logs under its own name.
- **Audit pass rate** (0214): at least 15 combat turns. Count first-attempt passes against 70%.

Then **stop for the operator to play it** (checkpoint C7). Ask for the cost ceiling in the
operator's own words first (C6).

## Operator checkpoints

- **C0 — lane sign-off (now):** the merge spine, amendment A1, the tier table, escape lines
  E1-E3, and the lane-note defaults for 0244, 0238 and 0237.
- **C1 — standing opus sign-off** for spec authoring on every "spec set" row.
- **C5 — new runtime dependencies.** Stop after `plan.md`.
- **C6 — paid provider runs.** The playtest needs the operator's ceiling, in the operator's words.
- **C7 — the playtest.** The operator plays runbook B2's scenario.
- **C9 — vm-104.** Every vm-104 command needs the operator's go on the exact command.
- Any spine amendment from a `plan.md` overlap: tell the operator, amend this file.

## Done means

- Every spine task merged by its own PR and Done (0203 AC #2 and 0214 AC #1 ticked at the playtest, or carded per the 0214 lane note).
- Every card carries its `Dispatch:` lines with real `served=` IDs.
- `pnpm ci:check` green on `main`; wiki freshness `OK`; spec-bridge exits 0.
- No sweep worktrees remain; `pnpm env:prune --check` exits 0.
- The operator has played runbook B2's scenario, and its findings are carded.

## Execution log

| Date | Task | PR | Merge | Dispatches | Notes |
|---|---|---|---|---|---|
| 2026-11-05 | (ruling) | — | — | — | C0 and C1 signed off: "Signed off, start". A1 carded as TASK-0246 with escape E4. |
| 2026-11-05 | TASK-0242 | #133 | bef9c4d5 | sonnet | E1. An NPC hit's damage roll states damage dealt from the batch's hp.changed row. narrate-v19. |
| 2026-11-05 | TASK-0240 | #134 | fed4dee3 | sonnet | E2. A reflex-only player-agency issue is advisory; audit rule names the flinch. audit-v13. Merged main in (0242), both sides kept. |
| 2026-11-05 | TASK-0246 | #135 | a377997e | sonnet (one review fix) | E4 (A1). Off-turn readying phrases caught in code; perceptual verbs allowed. audit-v14. Review caught a version bump with no rule text. |
| 2026-11-05 | TASK-0203 | #136 | 5bf6f12e | opus (spec 086), sonnet x3 | schema-mismatch outcome, migration 0009, four safe coercions, prompts state fields. audit-v15, director-v8, companion-v8, interpret-v14. AC #2 ticks at the playtest. |
| 2026-11-05 | TASK-0244 | #137 | d66a15ce | opus (spec 087), sonnet x2 | An off-turn AI companion's party action is held for its turn (held trigger). narrate-v20. Human-PC case carded TASK-0248. |
| 2026-11-05 | TASK-0238 | #138 | 6ab16240 | opus (spec 088), sonnet x2 | Director arrivals carry encounter monsters; startable until run; refused actions told as not done. director-v9, interpret-v15, narrate-v21. Revisit TASK-0249. |
| 2026-11-05 | TASK-0237 | #139 | 5571839f | opus (spec 089), sonnet x2 | Arrivals a check names wait for the band; goal note states no dice result; unmetReveals. director-v10, audit-v16. |
| 2026-11-05 | TASK-0250 | (this PR) | (at merge) | sonnet | B2 playtest scenario (E3). Stop for C6 and C7. |

## Later runbooks (order on record; each gets its own runbook and sign-off)

### Runbook C — reply structure, one chat stream, actor state, NPC information

- Opens with **TASK-0245** (the operator's four-part DM reply: restate, describe, ask, state).
  Its four open choices are settled on the card.
- **TASK-0199** (build spec 066, one chat stream) alongside 0245: both reshape every reply.
  Their specs run a shared seam check; their implementations merge serially.
- Then the actor-state gate: TASK-0145, TASK-0146, TASK-0147, then TASK-0109 → TASK-0144.
- Then NPC information: TASK-0148 and TASK-0149 → TASK-0150 and TASK-0151 → TASK-0152;
  TASK-0172 → TASK-0173.
- TASK-0111 (from runbook B's stub).
- Smaller follow-ups ride C: TASK-0241 (pronouns), TASK-0243 (dropped die on advantage).
- Ends with its own playtest scenario.

### Runbook D — one chat stream follow-ons

- TASK-0188 is Done (spec 066 authored; TASK-0199 builds it in runbook C). Then TASK-0187, TASK-0190, TASK-0133 and TASK-0169, then
  TASK-0132. Re-scope TASK-0129 and TASK-0131 against decision-0028 before they are laned.
