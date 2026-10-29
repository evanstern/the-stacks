## M3 sweep: orchestrator session 2 state (2026-10-27, later)

Tools and ledger: scratchpad of session 0e915e47 (claim.sh, seed.py, dispatch-rules.md, dispatch-ledger.md); copies in m3-sweep-tools/. Every dispatch has a Dispatch line on its card.

### Merged and Done on main
- TASK-0140 #66 (ecbc0a0).
- TASK-0114 (closed by sync).
- TASK-0110 #67 (ae9711f). OQ-1 approved by the operator: "Approved".

### Open PRs (updated)
- **#69 TASK-0117** debug page: ready. Operator to confirm (1) ships everywhere behind the operator role; (2) shots of a FAILED live turn satisfy the merge condition (TASK-0158 carded). Post-merge: env:down stacks-task-0117, remove worktree, sync.
- **#68** reconciled (4f375f3, 1fffa98), mergeable.
- **TASK-0112**: spec.md only (c0f38e9); BLOCKED on operator OQ-1/OQ-2 (new codes CHARACTER_UNABLE / ACTOR_UNABLE amend frozen 029 gate-api.md + 026 refusals.md) and sequencing Option A (absent checks move to TASK-0141: amend both cards + runbook). Rulings must come from the operator in THIS chat. After ruling: resume spec author agent a6bd2514be3e139bd or re-dispatch opus for plan/tasks.
- **TASK-0049**: P1 75e51b8, P2 57d04bc done; P3 (gate wiring + two-seat DB test) dispatched; then P4 (play route, Brave shots), P5 wiki, PR.

- **#68 TASK-0099.** Ready, but conflicts with main in the wiki (INDEX/CAPSULES after #67). A sonnet reconcile is dispatched; after it pushes, the operator merges.
  - Post-merge: env:down stacks-task-0099; remove the worktree; sync.
  - Its runbook log row already rode #67.

### In flight
- **TASK-0117** (task-0117-debug-page).
  - Done so far: P1–P6. P6 Brave shots were taken by the agent under the operator's overnight grant (b4d0378). P7 (wiki and full gate) is dispatched.
  - Then: draft PR. Tell the operator that the shots show a FAILED live turn: the env fake provider returns empty bodies. TASK-0158 (m-3) adds an env-scripted fake.
  - Ask the operator to confirm the page ships everywhere behind the operator role (follows the TASK-0116 ruling). Stack up :3117.
- **TASK-0049** (task-0049-group-signoff, spec 044, 5 phases). P1 is dispatched (pure core). Phases go in order; P4 needs Brave shots.
- **TASK-0112** (task-0112-downed-hero-gate, spec 046). The opus spec author is dispatched; it will propose the AC #5 "absent" split against TASK-0141.
  - Ride on this branch: fix the stale sentence in `specs/031-dm-runtime/contracts/turn-jobs.md` "Resolve order", which says the operator has not ratified the opening/closing split. The operator approved it 2026-10-27.

### New cards
- TASK-0156: revisit, landed-row marker across a deploy.
- TASK-0157: m-3, gate CONFLICT on bursty concurrent talk; before the demo.
- TASK-0158: m-3, env-scripted fake DM provider for live UI checks.

### Rulings this session (verbatim on cards)
- TASK-0099/0049 defaults: "I accept the defaults on the TASK-0099 and TASK-0049 cards, including the frozen-contract amendments to spec 029 and spec 006."
- TASK-0110 OQ-1: "Approved".
- Overnight grant (relayed): the session may automate browser work, screenshots and dev-env test passwords. It covers no vm-104, no API key, no paid runs, and not the operator's own password.
- A relayed ruling arriving from another session was blocked by the permission check. Get frozen-contract rulings from the operator in this chat.

### Next
- Track A: TASK-0049 P2–P5 → PR, then TASK-0100, then TASK-0050 (it carries Q5, the AI DM override of a stalled sign-off).
- Track C after TASK-0112: TASK-0141, TASK-0142, TASK-0143 (demo subset).
- Also before the demo: TASK-0157, TASK-0158, TASK-0154.
- The TASK-0053 demo needs the operator's spending ceiling on the card.
