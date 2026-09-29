---
id: TASK-0023
title: 'AI gateway: provider interface, streaming chat, embeddings, cost accounting'
status: Done
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 04:26'
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
- [x] #1 One provider interface covers streaming chat and embeddings
- [x] #2 Token usage and cost are recorded per call
- [x] #3 Tests use a fake provider; no test needs a network key
- [x] #4 Providers are named config entries (adapter kind, base URL, key env var); an openai-compatible adapter covers streaming chat and embeddings on stdlib fetch; no vendor SDK and no hard-coded provider name or key variable; purpose-to-provider-and-model is config
- [x] #5 Spec phase: Foundational — types, config, usage, fake
- [x] #6 Spec phase: US1 + US3 + US4 — streaming chat through the gateway (P1) 🎯 MVP
- [x] #7 Spec phase: US2 — embeddings through the gateway (P1)
- [x] #8 Spec phase: US5 + US1 + US2 — gateway-owned HTTP: SSE, retry, OpenAI-compatible adapter (P1)
- [x] #9 Spec phase: US6 + wiring — no-key test run and startup
- [x] #10 Spec phase: Polish & re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec 011 authored via speckit-specify/plan/tasks (c2045eb). speckit-clarify skipped: A7 + decision-0002 settle direction; usage persistence resolved in spec Assumptions (no table this slice — avoids TASK-0022's migrations hotspot). OPERATOR CHECKPOINT before Phase 4 T012: new dependency @anthropic-ai/sdk (plan Complexity Tracking).

AC 'Anthropic chat + OpenAI-compatible embeddings' replaced 2026-09-28 by operator ruling decision-0007 (provider-agnostic gateway, doc-0001). Supersedes the @anthropic-ai/sdk proposal in spec 011's first plan; spec 011 is revised before any implementation dispatch. Phase ACs will be re-seeded from the revised tasks.md.

Spec 011 revised for decision-0007 (a0958e9, 4031722): vendor SDK rejected; providers are named AI_PROVIDERS entries; openai-compatible + fake adapter kinds; gateway owns SSE, error mapping, bounded retry. No new dependency. The earlier @anthropic-ai/sdk checkpoint is withdrawn.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 1 (T001-T005) done in ca2fbf6: types, config (AI_PROVIDERS/AI_PURPOSES/AI_PRICES), usage, fake adapter; 11 tests; ci:check green. Orchestrator grep: only 'openai-compatible' (protocol kind) appears, no vendor or key names. crossValidate op-support guard is unreachable with current kinds (both support chat+embed); kept as a tested forward guard. ~154k subagent tokens.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 2 (T006-T007) done in d1e1ec6: gateway.chat(); 6 tests (orchestrator re-ran: 6/6). Invariants 1,2,3,6,7 covered. Judgment calls: config errors emit no usage record; attempts=1 until Phase 4 retry. ~155k subagent tokens.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 3 (T008-T009) done in a612dfa: gateway.embed(); invariants 4,5 covered; 11/11 gateway tests (orchestrator re-ran).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 4 (T010-T014) done in 162682c: sse.ts, retry.ts (bounded, jittered, Retry-After, abort-aware), openai-compatible adapter on stdlib fetch; 38 new tests, no network. Deviations accepted: optional attempts on UsageSummary/embed result; adapter registered in gateway DEFAULT_ADAPTERS.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phases 5-6 (T015-T019) done in ba9fcbb/8b6e23f/02e09d4: gateway wired into config.ts/index.ts (inert without AI env), invariant-10 no-vendor-names test, .env.example block, ci-evidence.txt. Wiki: new ai-gateway note; configuration, server-entrypoint-and-app, overview amended and re-pinned; compose-stack RE-PIN-ONLY (orchestrator reviewed the overview/compose-stack diffs). Freshness OK 28 notes. ~158k subagent tokens.

spec-bridge sync: Foundational — types, config, usage, fake: 5/5 · US1 + US3 + US4 — streaming chat through the gateway (P1) 🎯 MVP: 2/2 · US2 — embeddings through the gateway (P1): 2/2 · US5 + US1 + US2 — gateway-owned HTTP: SSE, retry, OpenAI-compatible adapter (P1): 5/5 · US6 + wiring — no-key test run and startup: 4/4 · Polish & re-ground: 2/2 — status In Progress → Done

Human-authored ACs verified at close (2026-09-29): #1 Gateway chat()+embed() behind one Provider interface (contracts/gateway.md, ai.gateway.test.ts); #2 UsageRecord per call with tokens/costUsd (ai.usage.test.ts, invariants 6-7); #3 all AI tests use fake adapter or fetch double, no keys (ci-evidence.txt no-AI-env run); #4 named AI_PROVIDERS/AI_PURPOSES, stdlib fetch openai-compatible adapter, invariant-10 test forbids vendor/key names. Landed in PR #21 + follow-up PR #22 (host-script import fix, check:host-scripts gate). main CI green at cee6c24.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Foundational — types, config, usage, fake: 5/5 · US1 + US3 + US4 — streaming chat through the gateway (P1) 🎯 MVP: 2/2 · US2 — embeddings through the gateway (P1): 2/2 · US5 + US1 + US2 — gateway-owned HTTP: SSE, retry, OpenAI-compatible adapter (P1): 5/5 · US6 + wiring — no-key test run and startup: 4/4 · Polish & re-ground: 2/2). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
