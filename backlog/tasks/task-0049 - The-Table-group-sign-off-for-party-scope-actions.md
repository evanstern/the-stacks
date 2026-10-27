---
id: TASK-0049
title: 'The Table: group sign-off for party-scope actions'
status: In Progress
assignee: []
created_date: '2026-10-25 20:00'
updated_date: '2026-10-27 10:22'
labels:
  - multiplayer
  - gate
milestone: m-3
dependencies:
  - TASK-0048
references:
  - docs/design/architecture.md
priority: medium
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a party-scope action (for example "we take the left tunnel" or "we long rest") commits only after the party signs off, in any table mode. Each player approves or objects. The DM may commit or override at any time.

Why: decision-0016 commit-authority table, party-scope row. In M2 a single human makes every party call; with several humans the gate needs a sign-off policy. It reuses the proposal gate (decision-0015); it is a policy, not a new mechanism.

Spec: specs/044-group-signoff
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The gate classifies an action as party-scope or character-scope, and the classification is recorded on the event.
- [x] #2 A party-scope action commits only after every present player approves.
- [x] #3 Any player objects to a party-scope action, and the objection is visible to the table.
- [x] #4 The DM (human or AI) commits or overrides a party-scope action at any time.
- [x] #5 The play route shows sign-off state per player and an approve or object control.
- [x] #6 Gate tests cover approval, objection and DM override with several players.
- [x] #7 Spec phase: The sign-off rule and commit authority (pure core)
- [x] #8 Spec phase: The planner, the marker rows and the fixture
- [x] #9 Spec phase: Server gate wiring and the two-seat DB test (merge condition)
- [x] #10 Spec phase: The play route shows sign-off (US4)
- [ ] #11 Spec phase: Wiki re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0049, branch task-0049-group-signoff, cut from origin/main adb4527. Spec number 044 claimed with a stub. Session 2 of the M3 orchestrator (2026-10-27).

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Spec author (orchestrator session 2) stopped after spec.md (45dc0ea): every build of group sign-off changes frozen 029 contract text. No new event type or frame change under the recommended options. OPERATOR RULINGS NEEDED before plan.md (recommended first):
FT-1 policy-and-authority.md step 4: A commitAuthority takes an optional present set; >1 human returns group when every present party human's latest stance is approve, else GROUP_SIGNOFF_REQUIRED / B separate signoffStatus check.
FT-2 gate-api.md rows + planner: A planProposal gains optional context {present?} from PresenceReader (TASK-0050's floor reuses it) / B gate appends marker+commit after planning.
FT-3 SC-006 replay check reads present from the batch's signoff marker; add a group-signoff fixture row.
FT-4 gate-api.md §2: GROUP_SIGNOFF_REQUIRED details {waiting, objecting} (additive).
Q1 classification: A declarer sets scope, gate checks party membership, DM fixes by withdraw / B model-inferred / C new action.rescoped event.
Q2 declaring counts as the declarer's approval (A) / must press Approve (B).
Q3 C auto-commit on the completing approval plus explicit commit once quorum met / A auto only / B explicit only.
Q4 new sign-off props on the action card (additive to proposal-seam.md); confirm.
Q5 AI DM override of a stalled sign-off: fold into TASK-0050 or a new card.

OPERATOR RULING 2026-10-27 (in chat): "I accept the defaults on the TASK-0099 and TASK-0049 cards, including the frozen-contract amendments to spec 029 and spec 006." Spec authoring resumes with plan.md and tasks.md.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(The spec author resumed after the operator ruling: plan, tasks, data-model, contracts/signoff.md; commit 346308c. Five phases. Implementation waits for TASK-0099, because the runbook allows one Track A task in implementation at a time. FR-015 to FR-017 were added during planning.)

Phase 1 done (75e51b8): signoff.ts (signoffState), commitAuthority present arg + GROUP_SIGNOFF_REQUIRED waiting/objecting, exports, gate-signoff and gate-authority tests, spec 029 policy-and-authority.md amended (T001-T007). session-model 618 tests green; ci:check fails only on the 5 known adjudicate.integration tests (TASK-0138).

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 1 (merge 1ee88d1, work 75e51b8): signoffState plus commitAuthority with an optional present set. The 029 policy-and-authority.md amendment was made as ruled. session-model passes 618 tests.

Phase 2 done (57d04bc): PlanContext + planProposal context param; multi-human group commit plans [presence.recorded(signoff), action.committed]; completing approve plans [action.commented, marker, action.committed]; GROUP_SIGNOFF_REQUIRED details; group-signoff fixture (8 fixtures); SC-006 replay reads present from the marker; spec 029 gate-api.md and fixtures.md amended (T008-T016). session-model 650 tests green; ci:check fails only on the 5 known adjudicate.integration tests (TASK-0138). A comment without context.present never auto-commits.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 2 (57d04bc): PlanContext; a group commit writes the signoff marker and the commit; the completing approval auto-commits; group-signoff fixture; SC-006 reads present from the marker; 029 gate-api.md and fixtures.md amended as ruled. 650 session-model tests pass. Without context.present a comment never auto-commits, so Phase 3 must pass present into every planProposal call.

Phase 3 done (344e73c): gate.ts passes the presence ids to every planProposal call; gate.signoff.integration.test.ts covers two and three human seats on real Postgres (approval, objection, absent player, DM override, withdraw); companion-react case proves one commit turn and no react job. enqueue.ts unchanged. REQUIRE_DATABASE=1 pnpm ci:check green first run.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 3 (merge fbc7da0, work 344e73c): gate.ts passes presence-reader ids to every planProposal. The two-seat DB test (gate.signoff.integration, 8 cases) passes on stacks-task-0049; this is the runbook merge condition. ci:check passed with REQUIRE_DATABASE=1 on the first run.
Orchestrator ruling on Q2: a non-completing human approval on a companion's open action queuing a react job is intended (TASK-0114 AC #1, any human comment or approval re-runs the companion).

Phase 4 done (3345568): play/signoff.ts, commitAuthorityFor present arg, sign-off rows in view model and action card (own-row Approve/Object, no modal), proposal-seam amendment, 16 Brave shots (light/dark, 1280/390) in specs/044-group-signoff/evidence/. Web tests, typecheck, lint, REQUIRE_DATABASE=1 ci:check green. AC #1 left open (classification recorded on event: not proven in this phase).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
