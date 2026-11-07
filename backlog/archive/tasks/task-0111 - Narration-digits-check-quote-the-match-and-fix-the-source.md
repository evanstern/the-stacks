---
id: TASK-0111
title: 'Narration digits check: quote the match and fix the source'
status: To Do
assignee: []
created_date: '2026-10-26 20:08'
updated_date: '2026-11-07 05:17'
labels:
  - dm
  - narration
  - replan-2026-11
milestone: m-3
dependencies: []
priority: medium
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the deterministic 'prose contains digits' audit check names the characters it matched, and the source of the digits in real-model narration is fixed.

Evidence: TASK-0106 rerun 20261026T192319Z (specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/ classification.md, R1). In 3 of the 4 counted fallback turns (seq 77, 140, 162), all 3 narration attempts failed only this check. The detail does not quote the match, so the source is unknown; combatant names hold no digits. Operator ruling 2026-10-26: card it in m-3; TASK-0106 is accepted at a 20% fallback-rate bar.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The digits check's issue detail quotes the matched text, with a test
- [ ] #2 A captured run identifies where the digits come from, and a fix with a test removes that source
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Source found 2026-10-26 (M2 demo session e8c848ec, seq 124-126): the interpret/adjudicate step's reason text uses combatant ids ('Goblin-2 closes through the mud and swings its scimitar at Tamsin.'). TASK-0106 facts v2 render each roll's reason verbatim to the narrator (factEntries 'roll: <reason> ...'), and the narrator copies 'Goblin-2', so the deterministic digits check fails all 3 attempts. Fix candidates: render reasons with spellDigits or display names before they reach the narrator, or require display names in the interpret/adjudicate reason text. The fallback also names the same combatant two ways ('Goblin two' from the reason, 'Goblin with a pot-helm' from its display name).

Closed (close-superseded) by replan-2026-11: TASK-0272: digits are code-rendered; no digit audit.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
