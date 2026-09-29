---
id: TASK-0023
title: 'AI gateway: provider interface, streaming chat, embeddings, cost accounting'
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 03:12'
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

Spec: specs/011-ai-gateway
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One provider interface covers streaming chat and embeddings
- [ ] #2 Anthropic chat and an OpenAI-compatible embeddings implementation exist behind it; model choice per feature is config
- [ ] #3 Token usage and cost are recorded per call
- [ ] #4 Tests use a fake provider; no test needs a network key
- [ ] #5 Spec phase: Foundational — types, config, fake, usage
- [ ] #6 Spec phase: User Story 1 + 3 + 4 — streaming chat through the gateway (P1) 🎯 MVP
- [ ] #7 Spec phase: User Story 2 — embeddings through the gateway (P1)
- [ ] #8 Spec phase: User Story 2 + 1 — real providers (P1)
- [ ] #9 Spec phase: User Story 5 + wiring — no-key test run and startup
- [ ] #10 Spec phase: Polish & re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec 011 authored via speckit-specify/plan/tasks (c2045eb). speckit-clarify skipped: A7 + decision-0002 settle direction; usage persistence resolved in spec Assumptions (no table this slice — avoids TASK-0022's migrations hotspot). OPERATOR CHECKPOINT before Phase 4 T012: new dependency @anthropic-ai/sdk (plan Complexity Tracking).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
