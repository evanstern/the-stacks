---
id: TASK-0023
title: 'AI gateway: provider interface, streaming chat, embeddings, cost accounting'
status: To Do
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 03:17'
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
First slice of architecture A7, provider-agnostic per decision-0007 (doc-0001): no vendor SDK; providers are named config entries; purposes pick a provider and model. Embeddings per decision-0002.

Spec: specs/011-ai-gateway
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One provider interface covers streaming chat and embeddings
- [ ] #2 Token usage and cost are recorded per call
- [ ] #3 Tests use a fake provider; no test needs a network key
- [ ] #4 Providers are named config entries (adapter kind, base URL, key env var); an openai-compatible adapter covers streaming chat and embeddings on stdlib fetch; no vendor SDK and no hard-coded provider name or key variable; purpose-to-provider-and-model is config
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC 'Anthropic chat + OpenAI-compatible embeddings' replaced 2026-09-28 by operator ruling decision-0007 (provider-agnostic gateway, doc-0001). Supersedes the @anthropic-ai/sdk proposal in spec 011's first plan; spec 011 is revised before any implementation dispatch. Phase ACs will be re-seeded from the revised tasks.md.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
