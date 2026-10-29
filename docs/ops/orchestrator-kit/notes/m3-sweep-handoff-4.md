## Handoff 4: 2026-10-27, M3 orchestrator session 2 (supersedes Handoff 3 and m3-sweep-session2-state.md)

Read Handoff 2 for role, tools, rulings and traps.
- Tools: m3-sweep-tools/ (copy into your scratchpad and fix the scratchpad path in claim.sh and dispatch-rules.md). Session 2's ledger is m3-sweep-tools/dispatch-ledger.md.
- Every dispatch has its `Dispatch:` line on its card.
- Rulings that amend frozen contracts must come from the operator in THIS chat. A ruling relayed from another session was blocked by the permission check.

### Merged and Done this session
- TASK-0140 #66, TASK-0114 (sync), TASK-0110 #67, TASK-0099 #68.
- Each is cleaned up: stack down, worktree and branch removed, synced to Done. The runbook log rows for #66–#68 rode #67.

### Open PR
- **#69 TASK-0117** (debug page).
- A sonnet reconcile with main is dispatched after #68 merged.
- The operator confirms at merge:
  - (1) the page ships everywhere behind the operator role;
  - (2) shots of a FAILED live turn satisfy the merge condition. The env fake provider returns empty bodies; TASK-0158 is carded.
- Post-merge: env:down stacks-task-0117, remove the worktree and branch, sync, then check the TASK-0132 dependency.

### In flight
- **TASK-0049** (task-0049-group-signoff, spec 044).
  - Done: P1 75e51b8, P2 57d04bc.
  - P3 (gate wiring and the two-seat DB test, the merge condition) is dispatched; stack stacks-task-0049.
  - Then P4 (play-route sign-off UI; the agent takes the Brave shots under the overnight grant, no modals), P5 wiki, then PR.
  - Phase 2 note: without context.present a comment never auto-commits, so P3 must pass present everywhere.
- **TASK-0112** (task-0112-downed-hero-gate, spec 046).
  - Operator ruled in chat: OQ-1 (a) CHARACTER_UNABLE, OQ-2 (a) ACTOR_UNABLE, the frozen 029 gate-api.md and 026 refusals.md amendments, OQ-3–5 defaults, Option A.
  - Cards are amended: TASK-0112 has 6 ACs, and TASK-0141 has the 2 absent ACs plus a dependency on TASK-0112.
  - The opus spec author is resumed for plan.md and tasks.md. Its brief includes the fix to the stale "operator has not ratified" sentence in turn-jobs.md.
  - Key finding: AC #4 (death saves) needs a code-only settling loop in resolve.

### New cards this session
- TASK-0156: revisit; the landed-row marker across a deploy.
- TASK-0157: m-3; gate CONFLICT on bursty concurrent talk. Must land before the demo.
- TASK-0158: m-3; env-scriptable fake DM provider for live UI checks.

### Rulings this session (verbatim on the cards)
- TASK-0099 and TASK-0049: "I accept the defaults on the TASK-0099 and TASK-0049 cards, including the frozen-contract amendments to spec 029 and spec 006."
- TASK-0110 OQ-1: "Approved".
- TASK-0112: as above.
- TASK-0049 Q5 folds into TASK-0050.
- Overnight grant (relayed and recorded on TASK-0117): agents may drive Brave, take screenshots, and create local-stack test accounts with generated passwords kept in an untracked scratchpad file.

### Runbook bookkeeping owed
On the next branch, add log rows:
- TASK-0117's row is on its branch.
- TASK-0112 rulings and the Option A amendment across Track C (TASK-0112 → TASK-0141).
- TASK-0049 when it opens.

### Next
- Track A: TASK-0049 → TASK-0100 → TASK-0050 (it carries Q5).
- Track C: TASK-0112 → TASK-0141 → TASK-0142 → TASK-0143 (the demo subset).
- Also before the demo: TASK-0157, TASK-0158, TASK-0154.
- Then the TASK-0053 demo. It needs the operator's spending ceiling on the card, in their words.

### Update (later, 2026-10-27)
- #69 merged as 2c74b6d. TASK-0117's worktree, branch and stack are gone.
- **TASK-0117 stays In Progress until** `specs/041-debug-page/tasks.md` T039–T041 are ticked (the P6 work landed in b4d0378, evidence/live-check.md). The ticks ride the next branch commit, then sync → Done.
- TASK-0112: spec complete (44601a4), 6 phases; P1 (engine ACTOR_UNABLE plus contract amendments) dispatched.
- TASK-0049: P3 done (344e73c, two-seat DB test green); P4 (sign-off UI plus Brave shots) dispatched.

### Update 2 (2026-10-27)
- Open PRs:
  - #70 TASK-0049: ready. Operator UX points are in the PR body.
  - #71 TASK-0112: ready. Orchestrator rulings for the operator to confirm: a landed advance counts as done on reclaim; death-save-only turns are narrated. The TASK-0117 T039–T041 ticks ride this PR, so sync TASK-0117 after it merges.
  - #70 and #71 both touch the wiki, so the second to merge needs a reconcile.
- TASK-0100 (spec 047, c53d50f): BLOCKED on operator R1. The recommended option A adds policy to PendingProposalView in the frozen 030 seam; Dismiss = onReject(id, null).
- TASK-0141 (spec 048): claimed. The opus spec author is dispatched and expected to stop on the new presence event and the AC #7 code.
- New card: TASK-0159 (m-3), a human-DM scene-change command.
- Runbook log rows owed on the next branch: TASK-0112 (#71), the TASK-0100 ruling when given, TASK-0159.
