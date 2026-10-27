---
id: TASK-0110
title: An action that ends the encounter resolves as refused
status: Done
assignee: []
created_date: '2026-10-26 19:15'
updated_date: '2026-10-27 09:58'
labels:
  - dm
  - engine
milestone: m-3
dependencies: []
priority: medium
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when a committed action's own effect ends the encounter (for example a bargain that meets the morale condition), the action resolves as applied, not refused.

Evidence: TASK-0106 verification run 20261026T183818Z (specs/034-narration-quality/evidence/verify-20261026T183818Z-greyhollow-ford-provider/). Rows 260-265: Odo's bargain (act-odo-5) was committed; encounter.ended and table-mode.changed (morale condition met) followed; then action.resolved 'refused'. The fallback narration said 'Brother Odo cannot do that here.' The playtest auditor reported F54. Operator ruling 2026-10-26: card it; it does not count against TASK-0106's narration bar.

Spec: specs/045-encounter-end-resolves
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A test reproduces rows 260-265: the action whose resolution ends the encounter resolves applied
- [x] #2 The resolution order (encounter end versus action resolution) is documented in the turn-jobs contract
- [x] #3 Spec phase: The resolve order in the contracts (US4, AC #2)
- [x] #4 Spec phase: Resolve runs the new order (US1, US2, US3)
- [x] #5 Spec phase: Reproduce rows 260–265 end to end (US1, AC #1)
- [x] #6 Spec phase: Wiki re-ground
- [x] #7 Spec phase: Constitution Compliance (the-stacks)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-10-27 (via parent session local_415a1f81): "Leave TASK-0110 in m-3: the demo never hit it." It stays in m-3 and does not block M2 close. This answers next action 1 of the runbook handoff of 2026-10-27.

Operator ruling 2026-10-27 (in chat with the third M2 orchestrator session): leave in m-3. The live demo (session e8c848ec) never hit it — no refused outcome; the fight ended by flight. Does not block M2 close.

Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0110, branch task-0110-encounter-end-resolves, cut from origin/main a6c0baa. Spec number 045 claimed with a stub. Session 2 of the M3 orchestrator (2026-10-27). Track C4 (runbook amendment 1).

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(spec authoring, spec 045, commit 86cad07; served verified from the transcript.) Root cause: resolve.ts ran the Director group (encounter end and free mode from the morale condition) before the actions. The UNKNOWN_COMBATANT refusal was a separate interpret step naming a non-combatant (likely pell), which TASK-0112 U6's plan gate covers. ORCHESTRATOR DEFAULTS (reported to the operator; the operator may overturn them): OQ-1 (a) the opening/closing Director split stands as the reading of D17 §4, so encounter start stays ahead of the actions. OQ-2 (a) the landed-row marker risk across a deploy is accepted and recorded in turn-jobs.md (Phase 1); revisit card TASK-0156 holds the trigger.

Phase 1 done (f18b9c2): resolve order (six groups, opening/closing split, hold rule, empty batch-gate slot, OQ-2 reclaim risk accepted, revisit TASK-0156) written in turn-jobs.md, resolve.md, director.md. OQ-1 default (a) stated in the contract.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 1 (f18b9c2): resolve order in turn-jobs.md, resolve.md and director.md; AC #2 ticked.

Phase 2 done (3a28ed2): directorGroup split into directorOpening/directorClosing; resolve runs the decision-0025 §4 order; 6 order tests in resolve.integration.test.ts. ci:check green with REQUIRE_DATABASE=1, no flake. One assertion change: reclaim.integration.test.ts normalizes the marker step number (a reclaim skips an already-resolved action, so a later marker number differs from the clean run; related to OQ-2 / TASK-0156).

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 2 (3a28ed2): resolve runs the decision-0025 §4 order, with 6 order tests; ci:check passed with REQUIRE_DATABASE=1. HELD BY THE ORCHESTRATOR: the reclaim SC-005 test was loosened to normalize the marker step number (#n). The same agent is resumed to check whether markers can collide on reclaim within one code version. If they can, it fixes them on this branch.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 2 follow-up (af0baac): the marker-number difference on reclaim is a label only. Printed rows show no shared marker across steps; findLanded matches by kind. A new double-crash reclaim test passes, and ci:check passed again with REQUIRE_DATABASE=1. The orchestrator accepts the #n normalization and releases the hold.

Phase 3 done (73bc3a3): encounter-end-resolves.integration.test.ts and scripts/encounter-end-bargain.json. Odo's bargain act-odo-5 runs through the real worker with the fake gateway and scripted dice; resolves applied; seq order committed < check.resolved < action.resolved < encounter.ended < table-mode.changed (free) < narration. Reading is reconstructed (Persuasion check). pnpm ci:check green with REQUIRE_DATABASE=1, no re-runs.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 3 (73bc3a3): rows 260-265 reproduced through the real worker; act-odo-5 resolves applied before encounter.ended. The encounter is set up directly through runResolve, as resolve.integration does; the bargain turn itself runs on the worker. ci:check passed with REQUIRE_DATABASE=1 on the first run.

Phase 4 done (2b5158d): wiki re-ground. dm-runtime and dm-turn-jobs amended (six-group resolve order, reclaim marker note) and re-pinned; dm-failure-and-gates and dnd5e-engine re-pinned (sources unchanged, one prose sentence each). CAPSULES.md regenerated, INDEX.md updated. Freshness OK, spec-bridge exit 0, pnpm ci:check green with REQUIRE_DATABASE=1.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 4 (merge 60e3ed1, wiki 2b5158d): dm-runtime and dm-turn-jobs amended (NEEDS-REVIEW); dm-failure-and-gates and dnd5e-engine re-pinned with one sentence each; freshness OK; ci:check passed with REQUIRE_DATABASE=1.

OPERATOR RULING 2026-10-27 (in chat), on spec 045 OQ-1, the reading of §4 as Director opening and closing moves: "Approved". This ratifies option (a).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (The resolve order in the contracts (US4, AC #2): 4/4 · Resolve runs the new order (US1, US2, US3): 10/10 · Reproduce rows 260–265 end to end (US1, AC #1): 4/4 · Wiki re-ground: 6/6 · Constitution Compliance (the-stacks): 3/3). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
