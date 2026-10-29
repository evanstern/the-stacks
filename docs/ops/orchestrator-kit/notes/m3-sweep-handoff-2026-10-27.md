
## Handoff — 2026-10-27 (first M3 orchestrator session, context near 70%)

**You are the orchestrator.** Dispatch implementation to `sonnet-implementer` and spec authoring
to `opus-implementer`, one fresh agent per `tasks.md` phase. Verify the served model from each
transcript's assistant-message `model` field. Record one `Dispatch:` line per dispatch on the card.
Never implement inline. Shared dispatch rules for every brief:
`/private/tmp/claude-501/-Users-evanstern-projects-the-stacks/05e444ca-72b0-4a28-837a-bc40357b48cd/scratchpad/dispatch-rules.md`
(copy it into your own scratchpad; it is session-local). Helper scripts there: `claim.sh`
(worktree + claim + stub + Spec marker), `seed.py` (phase ACs + notes), `mkcards.py`.

### Board and branches (state at handoff)

| Card | Branch / PR | State | Next action |
|---|---|---|---|
| TASK-0055 | #57 merged | Done | — |
| TASK-0118 | #58 merged | Done | — |
| (runbook) | #56 merged | — | — |
| TASK-0119 | PR #59 open | ACs 1–4 ticked; decision-0026 accepted | Operator merges; then set Done with final summary (escape line E2, not linked). |
| TASK-0135 | PR #60 open | ACs 1–4 ticked; decision-0025; runbook amendment 1 + this handoff | Operator merges BEFORE TASK-0140's PR; then Done with final summary (E3). |
| TASK-0051 | task-0051-presence | P1, P2 done (d3cd2d5, cf378f6); P3 dispatched | P4 presence strip (web, Brave screenshots = merge condition), P5 wiki, PR. Stack up :3051. |
| TASK-0114 | task-0114-companion-react | P1, P2 done (6688ab7, f99b4df, 2932c20); P3 withdraw (W-A) dispatched | P4 wiki, PR. Migration 0005_lean_cable. Stack up :3114. |
| TASK-0116 | task-0116-debug-api | P1, P2 done (d13f1e3, bdfeb05); P3 routes dispatched | P4 wiki, PR. Migration 0005_unknown_lizard — collides with 0114's 0005: the second to merge regenerates after merging main. Ask the operator to confirm open Q1 (routes ship everywhere behind the operator gate, no flag) before merge. Stack up :3116. |
| TASK-0123 | task-0123-srd-rules-text | P1, P2 done (9c0fc2c, fcebdb5); P3 wiki dispatched | PR after P3. Stack `stacks-task-0123` up. |
| TASK-0140 | task-0140-actor-snapshot | spec 040 (1fd1f48); P1 dispatched | P2–P5. Prompt version collision with TASK-0114 on dm.companion-v3 (noted on both cards). |
| TASK-0129 | — | design-round session proposed (C4) | Operator starts it. |

Dispatch lines for P1/P2 dispatches already in flight at handoff are on the cards up to the last
completed phase. For a phase that completes after handoff, read the served model from the agent's
output file under `/private/tmp/claude-501/-Users-evanstern-projects-the-stacks/05e444ca-72b0-4a28-837a-bc40357b48cd/tasks/`
(ledger: `scratchpad/dispatch-ledger.md`) or, if gone, from the commit trailer plus the card note, and say so.

### New cards this session (all on main)

TASK-0134 (fight stats undercount NPC drops; Track B before the demo), TASK-0138 (adjudicate suite
fails instead of skipping without a DB; Track B tail), TASK-0154 (DB integration tests time out at
5 s under load), TASK-0140–0147 (decision-0025 U-cards), TASK-0148–0152 (decision-0026 K-cards,
after the demo subset). Revisits outside m-3: TASK-0136, 0137, 0139, 0153.

### Standing operator rulings this session (verbatim on the cards)

- R1 TASK-0055 option A; R3 debug view first; C0 sign-off; C1 standing opus sign-off.
- C2 (TASK-0051): carriage D; observers shown; timings stand; multi-process revisit.
- C3 (TASK-0135): formulation 3 "ledger + opposition dice"; seed NPCs minimal presence in M3.
- W (TASK-0114): W-A add withdraw.
- TASK-0123: download the SRD PDF (done; outside the repo).
- decision-0025 cards: add all in D17 order; U6 folded into TASK-0112; demo after the subset.
- decision-0026: K3 now, K1–K6 after demo; attitude per character; clue lint warns (fails only core); SRD Influence DC.
- Orchestrator defaults reported, not yet confirmed: TASK-0140's three snapshot views (dm/seat/fiction).

### Known traps

- Decision ids are assigned per checkout: before `backlog decision create`, copy in the ids held on
  open branches (untracked), check the CLI auto-commit holds only the new file, then delete copies.
- Never commit `.specify/feature.json`.
- Root-guard: `git -C <literal path>`; stage and commit in separate calls.
- A merged branch whose card is not spec-linked (escape lines) closes by hand: final summary + Done.
- A finished agent may leave background work running in its worktree: TaskStop it before the next phase.

### Exact next action

1. Collect the reports of the five in-flight dispatches (0051 P3, 0114 P3, 0116 P3, 0123 P3, 0140 P1);
   record Dispatch lines; dispatch each next phase.
2. Open PRs as tasks finish their wiki phase (0123 first). Post-merge: verify merged, `pnpm env:down`,
   remove worktree, delete branch, ff root, tick, sync → Done, log row.
3. Wave 2 per runbook + amendment 1: TASK-0099 after 0051; TASK-0117 after 0116 (draft-held);
   TASK-0110 and TASK-0112 after 0140; TASK-0134 any time (haiku).
4. Before any paid run (TASK-0053 demo, TASK-0130 capture): get the operator's spending ceiling in their words on the card.
