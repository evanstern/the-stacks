---
id: TASK-0041
title: 'Re-center the design: First Scene slice, 5e-only, gate and table modes'
status: Done
assignee: []
created_date: '2026-10-25 19:52'
updated_date: '2026-10-25 20:30'
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
- [x] #2 docs/design/vision.md, architecture.md and milestones.md are revised to the new design and name what they supersede
- [x] #3 First Scene milestone tasks exist on the board with acceptance criteria and dependency order
- [x] #4 The multiplayer slice tasks exist on the board ordered after First Scene
- [x] #5 A LangGraph revisit task exists, names its trigger, and milestones.md gates the Codex milestone's first agent task on it
- [x] #6 A revisit task for the parked tabletop-dm combat rules (Grit save, fight budgeting) exists and depends on the First Scene playtest task
- [x] #7 constitution.md Principle VI is amended to 5e-only with a version bump and sync impact report
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator checkpoint 2026-10-25: operator chose the opus-implementer (escalation) tier for drafting this revision from a handoff brief.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Recorded decision-0009..0021 (D1..D13, one record each; bodies set through the Backlog browser API PUT /api/decisions/:id because the CLI has no decision-body option; Rationale sits inside the Decision section because the Backlog decision parser keeps only Context/Decision/Consequences/Alternatives). Session record doc-0004. Milestones m-2..m-9. Cards: M2 TASK-0042..0048, M3 TASK-0049..0053, revisit TASK-0054 (LangGraph), TASK-0055 (parked combat rules).

Docs revised (bfe38be): vision.md, architecture.md (A4/A6/A7/A8 revised with superseded notes; A10-A14 added), milestones.md (M2-M9, re-baselined from 2026-10-27; M4 first agent task gated on TASK-0054). Constitution 2.0.0 (2800651): VI 5e only, VIII permits SRD data with attribution, IV validates through the gate and engine; plan/spec/tasks templates synced. Wiki not re-pinned (orchestrator owns wiki-update): docs/wiki/overview.md sources architecture.md, milestones.md and constitution.md. Code checks not run: docs-only change, worktree has no node_modules.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Follow-up (operator ruling on judgment call 6): carded M4-M9 up front. M4 TASK-0056..0063 (NPC-smith TASK-0061 depends on TASK-0054; TASK-0058/0062 depend on TASK-0055), M5 TASK-0064..0067, M6 TASK-0068..0076, M7 TASK-0077..0082, M8 TASK-0083..0086, M9 TASK-0087..0091 (TASK-0087 re-plan gates the rest). decision-0020 body, doc-0004, architecture A14 and milestones.md updated (522b14a). M4 re-baselined to 4 wk and M6 to 5 wk; board milestone descriptions m-4..m-8 still carry the old targets because the Backlog tooling cannot edit a milestone description.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Merged as PR #41 (a3c82c1). CI check passed (run 40230427203). Wiki freshness gate: 37 notes fresh.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Recorded the 2026-10-25 design re-centre: decision-0009..0021 and doc-0004; revised vision, architecture (A4/A6/A7/A8, new A10-A14) and milestones (M2 First Scene through M9); constitution 2.0.0 (5e only, attributed SRD data, gate validation); milestones m-2..m-9 with cards TASK-0042..0091 carded up front under decision-0020; wiki overview re-pinned. Verified by CI on PR #41 and the wiki freshness gate. Known loose end: board milestone descriptions for m-4..m-8 carry pre-carding target dates; milestones.md is authoritative.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
