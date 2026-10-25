---
id: TASK-0041
title: 'Re-center the design: First Scene slice, 5e-only, gate and table modes'
status: In Progress
assignee: []
created_date: '2026-10-25 19:52'
updated_date: '2026-10-25 20:03'
labels:
  - design
  - docs
dependencies: []
priority: high
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Record the 2026-10-25 re-design session as durable artifacts. The session (operator + Claude, informed by a study of github.com/bradbushSFAI/tabletop-dm and of Fantasy Grounds / Atlas / Foundry / Owlbear integration surfaces) re-centred the project: First Scene (AI-run game loop) is the next milestone ahead of the Codex; 5e only; own table view plus VTT adapters; SRD 5.2 baseline mechanics plus imports; solo-plus-companions first; one proposal/sign-off gate serving AI DM, assisted DM and player actions; talk vs action events with turn and free table modes; Director node from day 1; no LangGraph with a revisit trigger; no unplanned 'for now' deferrals. The handoff brief .handoff/task-0041-design-revision.md holds every decision verbatim.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backlog decision records exist for each decision listed in the handoff brief, each with context, decision, rationale and consequences
- [ ] #2 docs/design/vision.md, architecture.md and milestones.md are revised to the new design and name what they supersede
- [x] #3 First Scene milestone tasks exist on the board with acceptance criteria and dependency order
- [x] #4 The multiplayer slice tasks exist on the board ordered after First Scene
- [ ] #5 A LangGraph revisit task exists, names its trigger, and milestones.md gates the Codex milestone's first agent task on it
- [x] #6 A revisit task for the parked tabletop-dm combat rules (Grit save, fight budgeting) exists and depends on the First Scene playtest task
- [ ] #7 constitution.md Principle VI is amended to 5e-only with a version bump and sync impact report
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator checkpoint 2026-10-25: operator chose the opus-implementer (escalation) tier for drafting this revision from a handoff brief.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Recorded decision-0009..0021 (D1..D13, one record each; bodies set through the Backlog browser API PUT /api/decisions/:id because the CLI has no decision-body option; Rationale sits inside the Decision section because the Backlog decision parser keeps only Context/Decision/Consequences/Alternatives). Session record doc-0004. Milestones m-2..m-9. Cards: M2 TASK-0042..0048, M3 TASK-0049..0053, revisit TASK-0054 (LangGraph), TASK-0055 (parked combat rules).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
