# M3 runbook A — alpha run 3 fixes (milestone m-3) — sweep runbook (2026-11-02)

- **Status:** signed-off (operator, 2026-11-02, in chat, answering the C0 question "Do you sign
  off on runbook A's lanes (C0), with the C1 opus sign-off for spec authoring?"): "Signed off,
  start". C0 and C1 are both granted.
- **Milestone:** m-3, "The Table (multiplayer)" (`docs/design/milestones.md`, M3 section).
- **Orchestrator:** this session plans, dispatches and gates. It never implements.
- **Predecessor:** `docs/design/m3-table-sweep-runbook.md` (paused 2026-11-02, order exhausted).
  Its "Per-PR gates", "Per-task artifacts required before PR", "Concurrency & conflict
  doctrine" and checkpoints C5, C6 and C9 carry over unless this file says otherwise.
- **Dispatch rules:** `docs/ops/orchestrator-kit/dispatch-rules.md` binds every dispatched agent.

## Read first (in this order)

1. This file, top to bottom.
2. `docs/playtests/2026-11-01-two-browser-alpha-run-3.md` (the run 3 log; every card here cites it).
3. `docs/wiki/INDEX.md`, then `docs/wiki/CAPSULES.md`. Load notes just-in-time.
4. `backlog task view TASK-<n> --plain` for the card in hand.

## State when this runbook was written (2026-11-02)

- `origin/main` at `7e252840`. Root clean.
- Gates on `main`: wiki freshness `OK: 56 note(s) fresh`; spec-bridge `ok` (65 linked);
  `tiers.mjs --check` exit 0.
- Highest spec on `origin/main`: `065-talk-triggers`. **Spec 066 is reserved** by TASK-0188's
  design round (branch `task-0188-one-chat-stream`, session `local_6dc867a5`). This runbook
  claims numbers from **067**, in claim order.
- In progress: TASK-0181 (closes in lane A1), TASK-0186 (AC #4 waits on a hosted watch).
- Hosted dev (vm-104) healthy; `dm.interpret` maxTokens 4000 there (env only).

## Planning rulings recorded on the board (operator, 2026-11-02)

- [x] TASK-0120, TASK-0121, TASK-0122, TASK-0130, TASK-0107, TASK-0108 moved off m-3,
      `revisit` label added, ruling noted on each card. TASK-0113 stays: TASK-0127 depends on it.
- [x] TASK-0185 merged into TASK-0138 (its pattern criterion is TASK-0138 AC #3) and archived.
- [x] TASK-0195 carded: "Per-runbook playtest scenarios" (m-3).
- [x] TASK-0184 closed Done from PR #94 (`c0b7f282`).
- Standing: a playtest runs after every sweep, with a scenario aimed at that sweep's features.
- Standing: no transcript work until TASK-0188's spec 066 lands (runbook D).
- Standing: one sweep runs at a time. Runbooks A and B both edit the DM prompts.

## Execution lanes

**Develop in parallel, merge serially.** Each lane has at most one task in implementation at a
time. Merges go one at a time across all lanes, smallest first when two are green together.

| Lane | Order | Tier (impl) | Spec | Footprint (expected) |
|---|---|---|---|---|
| **A1** DM model and narration | TASK-0192 → TASK-0193; close TASK-0181 after 0192 | sonnet | 0192, 0193 spec sets | 0192: `.env.example`, `docs/ops/dev-vm-104.md`, `apps/server/src/ai/` (gateway, adapters), `dm/pipeline/call.ts`, `dm/model-calls.ts`, `schema/dm-model-calls.ts` + a migration (the `outcome` CHECK gains `truncated`). 0193: `dm/fallback.ts`, `dm/prompts/narrate.ts` (v7), `dm/facts.ts`, `dm/nodes/audit.ts`. |
| **A2** DM gate | TASK-0194 (widened: AC #4 pulls the target into initiative) | sonnet | spec set | `dm/gates/plan-gate.ts`, `dm/nodes/resolve.ts` (`initiative.join`), `dm/nodes/schemas.ts` if step kinds change, `dm/prompts/interpret.ts` if its rules change. |
| **A3** Companion | TASK-0189 | sonnet | escape E1 | `dm/prompts/companion.ts` (v6), `dm/companion.ts`. |
| **A4** Web table | TASK-0191 → TASK-0164 | haiku → sonnet | 0191 escape E2; 0164 spec set | 0191: `apps/web/app/play/table-view.tsx`. 0164: `table-view.tsx`, `play/components/turn-order.tsx`, a new party slide-out, `dm/seed/schema.ts`, `apps/server/seeds/*.json`, the seat view feeding the web. |
| **A5** Table landing | TASK-0175 | sonnet | spec set | `apps/web/app/routes/table.tsx`, a new read route under `apps/server/src/routes/`. |
| **Side** design only | TASK-0127 spec (stakes before dice) | opus | spec set only | `specs/NNN-stakes-before-dice/` only. No code. |
| **Last** playtest scenario | TASK-0195, after A1–A5 merge | sonnet | escape E3 | a new seed in `apps/server/seeds/`, `.claude/skills/playtest-run/SKILL.md`, a `DM_FAKE_SCRIPT` script. |

### Overlap check (orchestrator, 2026-11-02, against `origin/main` 7e252840)

- **Re-split from the brief:** TASK-0175 leaves lane A4 for its own lane A5. It shares no file
  with 0191 or 0164, so holding it behind them wasted a lane.
- **A4 is serial by file:** 0191 and 0164 both edit `table-view.tsx`. 0191 goes first (small).
- **A1 and A2 risk:** 0193 may need the next-actor fact (`dm/facts.ts`) or the NPC turn path in
  `dm/nodes/resolve.ts`; 0194 edits `resolve.ts`. Rule: before 0193's implementation dispatch,
  compare its `plan.md` file list with 0194's. On any shared source file, 0193 implements after
  0194 merges (draft-hold) and this table is amended.
- **A4 and A2 risk:** 0164 may touch `dm/snapshot/` for class and level; 0194 may touch it for
  the joined combatant. Same rule: compare `plan.md` lists before dispatch.
- **Seeds:** 0164 adds class and level to every shipped seed. TASK-0195's scenario seed is
  authored after 0164 merges, so it carries them.
- **Migrations:** only 0192 is expected to add one. A second plan with a migration regenerates
  after merging `origin/main` in. Never hand-merge `meta/_journal.json`.
- **Shared wiki notes:** `dm-narration-quality.md` lists prompt versions; 0193 (narrate-v7) and
  0189 (companion-v6) both edit it. The later merge reconciles the list.
- **Spec 0127 vs runbook B:** the spec only adds a spec dir. It does not block A.

### Lane notes

- **TASK-0181 close (A1):** when 0192 merges, tick AC #1 and AC #7 citing the 2026-11-02 cause
  note (interpret truncated at maxTokens) and 0192's PR. AC #9 cites the 2026-10-30 hosted check
  already on the card. Then `-s Done` with a final summary.
- **TASK-0192 AC #1** changes repo defaults only. vm-104's env is already 4000. Any further
  vm-104 change is C9.
- **TASK-0194:** the spec states which step kinds may target a present non-combatant
  (AC #1, #2), and when a targeted actor "can act" and rolls initiative (AC #4).
- **TASK-0127 side lane:** TASK-0113 is still To Do. The spec covers the order 0113 → 0127,
  extending the NarrationFacts shape 0113 settles, and names what 0170 adds after it. The card
  stays To Do with its Spec marker. The spec PR merges as a spec-only PR (stated reason: the
  outcome-band contract for review). Runbook B builds it.

## Model tiers (from `.claude/model-tiers.json`, checked 2026-11-02)

| Tier | Agent | Pinned model | Used for |
|---|---|---|---|
| sonnet (default) | `sonnet-implementer` | `cc/claude-sonnet-5-5[1m]` | All implementation except 0191; TASK-0195. |
| haiku | `haiku-implementer` | `cc/claude-haiku-5-5` | TASK-0191 (one file, CSS layout). |
| opus (escalation) | `opus-implementer` | `cc/claude-opus-5-5[1m]` (fallback `cc/claude-fable-5-1[1m]`) | Spec authoring: 0192, 0193, 0194, 0164, 0175, 0127. Needs C1. |

- Pass no `model` parameter on a dispatch. The frontmatter `cc/` pin applies; a bare ID fails on 9router.
- Verify the served model from the first dispatch's transcript before any sibling dispatch.
- Record one line per dispatch on the card: `Dispatch: tier=<tier> pinned=<model-id> served=<model-id>`.
- If auto mode denies a dispatch, stop and report it. Do not implement inline.

## Execution mode

- Interactive-root mode, as the predecessor. Worktrees at `.worktrees/task-<n>`.
- Board track: `backlog/`-only commits go direct to `main` from root, pushed at once.
- Claim flips ride the claim commit on the task branch. Use the kit's `claim.sh`.
- This runbook lands by its own PR (branch `sweep-m3-runbook-a`). Execution log rows ride the
  next claimed task's branch; the final rows ride a wrap-up PR.
- Merge on green with `gh pr merge --merge` (operator grant 2026-10-27). Report each merge to
  the orchestrator in plain language.

## Gates (updates to the predecessor's list)

- Plugin gate paths are now version **1.0.1**:
  `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs freshness . docs/wiki`,
  `node ~/.claude/plugins/cache/praxisflux/spec-bridge/1.0.1/gates/cli.mjs check .`,
  `node ~/.claude/plugins/cache/praxisflux/pdlc/1.0.1/scripts/tiers.mjs --root . --check`.
- Expected wiki reviews (NEEDS-REVIEW candidates):
  - TASK-0192: `ai-gateway`, `debug-view`, `database-schema`, `migrations`, `hosted-dev`, `configuration`.
  - TASK-0193: `dm-narration-quality`, `dm-runtime`.
  - TASK-0194: `dm-failure-and-gates`, `dm-runtime`, `dnd5e-engine` if engine use changes.
  - TASK-0189: `dm-narration-quality`, `dm-runtime`.
  - TASK-0191, TASK-0164: `play-route`, `scene-panels`; 0164 also `actor-snapshot` if it changes.
  - TASK-0175: `play-route`, `react-router-app`, `server-entrypoint-and-app`.
  - TASK-0195: `playtest-harness`.

## Escape lines (proposed for C0)

- **E1 — TASK-0189:** card ACs drive. The fix is one prompt view plus one test.
- **E2 — TASK-0191:** card ACs drive. The fix is one layout file; screenshots (Brave) at 1280 px
  and 390 px, light and dark, go in the PR.
- **E3 — TASK-0195:** card ACs drive, as TASK-0186 did. Its rehearsal log is the evidence.

## Task-specific merge conditions

- **TASK-0192:** a fake-gateway test records `truncated` when output equals maxTokens.
- **TASK-0193:** a fake-gateway replay of run 3 seq 150–157 ships a described Snag action.
- **TASK-0194:** a test replays run 3 seq 118 and resolves the free-Pell action; an attack on a
  non-combatant is still refused.
- **TASK-0189:** a prompt-content test on run 3 seq 31 names Tamsin as the speaker.
- **TASK-0164, TASK-0175:** screenshots (Brave), light and dark. No modals.
- **TASK-0195:** a local `DM_FAKE_SCRIPT` rehearsal of runbook A's scenario runs end to end.

## Last step — runbook A's playtest scenario (TASK-0195)

Starts after A1–A5 merge. The scenario aims at this runbook's fixes:

- **Combat-heavy** (0193, 0194): start in or one beat before an encounter with at least two NPC
  turns, one of which has no mechanical step, and a captive or bystander NPC a PC can free.
- **Companion moment** (0189): a PC addresses the companion while another NPC is present.
- **Web** (0191, 0164, 0175): a transcript long enough to scroll; the party slide-out open in
  combat; return to the table from `/play`.
- **Model budget** (0192): hard interpret turns in combat, with the ledger checked for `truncated`.
- `DM_FAKE_SCRIPT` may set the scene up directly to keep the run short.

Then **stop for the operator to play it** (checkpoint C7). The playtest's own run log and cards
follow `.claude/skills/playtest-run/SKILL.md`.

## Operator checkpoints

- **C0 — lane sign-off (now):** the lanes, the overlap re-split (A5), the tier table and escape
  lines E1–E3.
- **C1 — standing opus sign-off** for spec authoring on 0192, 0193, 0194, 0164, 0175 and 0127.
- **C5 — new runtime dependencies.** Stop after `plan.md`.
- **C6 — paid provider runs.** The playtest needs the operator's ceiling, in the operator's words.
- **C7 — the playtest.** The operator plays runbook A's scenario.
- **C9 — vm-104.** Every vm-104 command needs the operator's go on the exact command.
- Any lane amendment from a `plan.md` overlap: tell the operator, amend this file.

## Done means

- TASK-0192, 0193, 0194, 0189, 0191, 0164, 0175 and 0195 Done via their own merged PRs.
- TASK-0181 Done after 0192. TASK-0127's spec set merged; the card stays To Do for runbook B.
- Every card carries its `Dispatch:` lines with real `served=` IDs.
- `pnpm ci:check` green on `main`; wiki freshness `OK`; spec-bridge exits 0.
- No sweep worktrees remain; `pnpm env:prune --check` exits 0.
- The operator has played runbook A's scenario and its findings are carded.

## Execution log

| Date | Task | PR | Merge | Dispatches | Notes |
|---|---|---|---|---|---|

## Later runbooks (order on record; each gets its own runbook and sign-off)

### Runbook B — resolution quality

- TASK-0113 → TASK-0127 (built from the side lane's spec) → TASK-0170.
- TASK-0104 → TASK-0105 and TASK-0128.
- TASK-0171, TASK-0111, TASK-0109.
- Ends with its own playtest scenario (TASK-0195 convention).

### Runbook C — actor state and NPC information

- TASK-0145, TASK-0146, TASK-0147.
- TASK-0148 and TASK-0149 → TASK-0150 and TASK-0151 → TASK-0152.
- TASK-0109 → TASK-0144 (0109 lands in B first).
- TASK-0172 → TASK-0173.
- Ends with its own playtest scenario.

### Runbook D — one chat stream (after TASK-0188's spec 066 merges)

- TASK-0188, then TASK-0187, TASK-0190, TASK-0133 and TASK-0169, then TASK-0132.
- Re-scope TASK-0129 and TASK-0131 against decision-0028 before they are laned.
- Ends with its own playtest scenario.
