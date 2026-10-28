---
id: TASK-0174
title: 'Revisit: act verbs missing from the claim-gate lexicon'
status: To Do
assignee: []
created_date: '2026-10-28 21:44'
labels:
  - rules-gate
  - revisit
dependencies:
  - TASK-0161
priority: low
ordinal: 161000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revisit card (a maybe). TASK-0161 (spec 058) runs the spec 051 checkClaims on roll reasons at the plan gate. Its act check only knows the verbs in the spec 051 lexicon, which has no "staggers": "Pell staggers out of the reeds" passes for an absent Pell, while "Pell steps out of the reeds" is refused. Revisit trigger: a logged reason, narration or condition source shows an absent or downed actor acting through a verb the lexicon lacks. On trigger, spec the lexicon additions under spec 051, or drop this card by a decision record.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The trigger fired and a spec adds the missing verbs, or a decision record drops this card
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
