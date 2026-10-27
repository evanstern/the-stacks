---
id: TASK-0116
title: 'Debug view: operator debug API and persisted model-call usage'
status: To Do
assignee: []
created_date: '2026-10-27 01:47'
labels:
  - debug-view
  - server
  - dm-runtime
milestone: m-3
dependencies: []
documentation:
  - docs/design/debug-view.md
priority: high
ordinal: 38500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the server exposes everything the DM/debug view needs, operator-only, and every DM model call records its usage.

Why: during the M2 demo (TASK-0048) the DM's inner workings were invisible from the table. Turn jobs, companion holds and narration fallbacks had to be diagnosed by SQL. Per-call model, tokens, cost and duration are logged but never stored. Design: docs/design/debug-view.md (card A, decisions D1, D3, D4).

Scope: server only. The web page is the dependent card.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every stored DM model-call record carries provider, model, input tokens, output tokens, costUsd and durationMs, on the callJson, callText, companion and chronicle paths.
- [ ] #2 No stored call record or debug response contains prompt or completion text beyond the existing bounded failure excerpts.
- [ ] #3 An operator-only route returns a session's full event log after a given seq, all visibilities, paginated.
- [ ] #4 An operator-only route returns a session's DM jobs with full input and result: checkpoint, audit, calls and failure.
- [ ] #5 An operator-only route returns the session's scene seed as loaded, DM-only facts included.
- [ ] #6 A non-operator request to each new route gets 403; an unauthenticated request gets 401.
- [ ] #7 GET /dm/sessions/:id/turns keeps its current response contract.
- [ ] #8 The DM API contract and the wiki notes the change touches are updated and re-pinned.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
