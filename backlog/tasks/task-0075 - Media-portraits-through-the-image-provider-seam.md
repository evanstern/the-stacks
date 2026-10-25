---
id: TASK-0075
title: 'Maps and the Table View: portraits through the image-provider seam'
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
updated_date: '2026-10-25 20:19'
labels:
  - media
  - ai
milestone: m-6
dependencies:
  - TASK-0067
references:
  - docs/design/architecture.md
priority: medium
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the operator generates a portrait for any codex entity through a provider-agnostic image seam.

Why: architecture A8 and constitution IX (one image-provider seam). Every asset stores prompt, provider and seed (constitution VII).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An image gateway mirrors the AI gateway: named providers and purposes from config, no vendor SDK.
- [ ] #2 The operator generates a portrait from an entity's portrayal section.
- [ ] #3 Each portrait stores its prompt, provider and seed beside the image.
- [ ] #4 Generation runs as a job, and a fake provider covers tests.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
