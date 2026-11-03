---
id: TASK-0232
title: House-rule group checks behind tableRules.groupChecks
status: To Do
assignee: []
created_date: '2026-11-03 09:53'
labels:
  - engine
  - rules
  - dm
milestone: m-3
dependencies:
  - TASK-0128
ordinal: 218000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 084 (TASK-0128) OQ-5: SRD 5.2.1 has no group-check rule, so tableRules.groupChecks stays unread (default off). Build the house rule behind the flag (e.g. the group succeeds if at least half succeed) and decide its default with the operator.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With groupChecks on, a party-scope check rolls for each participant and resolves by the stated rule, with tests; off, behaviour is unchanged
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
