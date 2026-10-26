---
id: TASK-0111
title: 'Narration digits check: quote the match and fix the source'
status: To Do
assignee: []
created_date: '2026-10-26 20:08'
labels:
  - dm
  - narration
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

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
