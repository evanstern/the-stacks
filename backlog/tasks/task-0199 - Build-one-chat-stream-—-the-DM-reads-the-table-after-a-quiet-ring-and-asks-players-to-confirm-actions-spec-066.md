---
id: TASK-0199
title: >-
  Build: one chat stream — the DM reads the table after a quiet ring and asks
  players to confirm actions (spec 066)
status: To Do
assignee: []
created_date: '2026-11-02 06:46'
updated_date: '2026-11-02 06:49'
labels:
  - web
  - dm
  - playtest
milestone: m-3
dependencies:
  - TASK-0188
priority: high
ordinal: 178000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the play route has one composer and one Send button. The AI DM reads the table after a visible quiet ring (2 s + 8 s, restarted by each in-character or @dm post) and either reacts (D19) or posts a confirm row that the player accepts with 👍. 👍 declares and commits the DM's wording in one step. @dm gets one read-only out-of-character answer. The sign-off UI leaves the player view.

Why: alpha run 3 finding 2 (2026-11-01). Group sign-off had no teeth, and the Talk/Action split meant TASK-0180's talk path never ran. Design: TASK-0188, decision-0028 (D20, accepted 2026-11-02, operator ruling "All (a), amend").

The frozen-contract amendments are already approved and appended on the TASK-0188 branch. Run it as a pdlc:sweep lane after TASK-0188 merges. UI: no modals. Use Brave for the live check.

Spec: specs/066-one-chat-stream
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Spec phase: Session model — events, catalog, projection (card AC #1, #3)
- [ ] #2 Spec phase: Gate — suggest, accept, withdraw, refusal codes (card AC #2, #3)
- [ ] #3 Spec phase: DM runtime — ring window, read marker, confirm, `@dm` answer, interrupt (card AC #1, #2)
- [ ] #4 Spec phase: Web — composer, ring, Thinking, interrupt strip, confirm row (card AC #1, #2)
- [ ] #5 Spec phase: Contract and wiki amendments (card AC #3)
- [ ] #6 Spec phase: Verification **[orchestrator]**
<!-- AC:END -->
