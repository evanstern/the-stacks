---
id: TASK-0023
title: 'AI gateway: provider interface, streaming chat, embeddings, cost accounting'
status: To Do
assignee: []
created_date: '2026-09-29 02:36'
labels:
  - ai
milestone: m-1
dependencies: []
documentation:
  - docs/design/architecture.md
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
First slice of architecture A7. Anthropic for chat; an OpenAI-compatible endpoint for embeddings per decision-0002.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One provider interface covers streaming chat and embeddings
- [ ] #2 Anthropic chat and an OpenAI-compatible embeddings implementation exist behind it; model choice per feature is config
- [ ] #3 Token usage and cost are recorded per call
- [ ] #4 Tests use a fake provider; no test needs a network key
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
