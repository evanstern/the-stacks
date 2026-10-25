---
id: TASK-0080
title: 'The Dial: self-host docs and compose quickstart'
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
labels:
  - release
  - docs
  - infra
milestone: m-7
dependencies:
  - TASK-0076
priority: medium
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a self-hoster goes from a clean clone to a first played scene by following the public docs.

Why: constitution IX and the vision's audience (public self-hosters). A setup only the author can reproduce has not shipped.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docker compose up from a clean clone produces a working install, verified on a clean machine.
- [ ] #2 The quickstart covers the first operator, model provider config, the first import and the first scene.
- [ ] #3 The docs show the SRD 5.2.1 attribution and the licensing posture.
- [ ] #4 Every environment variable is documented in .env.example.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
