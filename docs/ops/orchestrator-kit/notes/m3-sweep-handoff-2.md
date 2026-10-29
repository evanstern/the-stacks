## Handoff 2 — 2026-10-27 (first M3 orchestrator session, context exhausted)

**You are the orchestrator.** Dispatch implementation to `sonnet-implementer` (haiku for TASK-0134's
implementation), spec authoring to `opus-implementer`, one fresh agent per tasks.md phase. Verify the
served model from each agent's output file (assistant-message `model` field). One `Dispatch:` line per
dispatch on the card. Never implement inline. Tools and the shared dispatch rules are in
`m3-sweep-tools/` beside this file (copy into your scratchpad; the rules file references a scratchpad path:
update it). Unappended runbook log rows: `m3-sweep-tools/pending-log-rows.md` (append them to the
runbook's Execution log on the next task branch, then empty the file). The runbook on main
(`docs/design/m3-table-sweep-runbook.md`) holds amendment 1 and Handoff 1; this note supersedes Handoff 1's tables.

### Merged / Done
TASK-0055 (#57), TASK-0118 (#58), runbook (#56), TASK-0119 (#59), TASK-0135 (#60), TASK-0123 (#61).

### Open PRs
- **#62 TASK-0116** debug API: ready; operator merges. Post-merge: env:down (stack :3116), cleanup, sync → Done.
- **#63 TASK-0114** companion react + withdraw: DRAFT, held on #62. After #62 merges: merge origin/main into
  task-0114-companion-react, delete its `0005_lean_cable` migration files and re-run `pnpm db:generate`
  (dispatch sonnet), re-run ci:check with REQUIRE_DATABASE=1, re-pin `database-schema`/`migrations` honestly,
  mark ready. Prompt `dm.companion-v4` collides with TASK-0140 (second to merge bumps).

### In flight (agents report to the OLD session; if it is gone, read branch logs + tasks.md ticks)
- TASK-0051 (task-0051-presence): P1–P3 done; P4 (presence strip) dispatched with: timeout baseline for
  scene.integration, and OPERATOR-STEPS.md for Brave screenshots (operator takes them; ruling below). Then P5 wiki, PR.
- TASK-0140 (task-0140-actor-snapshot): P1 done (3ca21d2); P2 dispatched (contract §2/§6.2 amendment first).
  Then P3 (player-facing prompts), P4 wiki. PR after #60 (merged) — OK now.
- TASK-0117 (task-0117-debug-page, spec 041): spec author dispatched. Draft-hold PR until #62 merges.
- TASK-0134 (task-0134-fight-stats-npc-zero, spec 042): spec author dispatched; implementation tier haiku.
- TASK-0129: design-round session card awaiting the operator (C4).

### Rulings since Handoff 1 (verbatim on cards)
- TASK-0116 routes: "Ship everywhere" (no flag). TASK-0140: "Keep three views"; seat cap 2000 and
  ActorCondition.instanceId accepted (orchestrator). TASK-0114 Phase 3b (orchestrator, in-task fix).
- **Brave:** agents cannot drive Brave. Ruling "I take them in Brave": for every Brave merge condition the
  orchestrator gives the operator the stack URL and exact steps; the operator saves shots to the spec's evidence/.

### Next per runbook + amendment 1
TASK-0099 after TASK-0051; TASK-0110, then TASK-0112 (+U6 ACs), TASK-0141, TASK-0142, TASK-0143 after TASK-0140;
TASK-0049 after TASK-0051; TASK-0132 after TASK-0117. Demo TASK-0053 after Track A + B + the Track C subset.
Paid runs need the operator's spending ceiling in their words on the card first.
