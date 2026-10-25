---
id: TASK-0057
title: 'The Codex: campaign storage, versioning, typed links and CRUD API'
status: To Do
assignee: []
created_date: '2026-10-25 20:13'
labels:
  - codex
  - server
milestone: m-4
dependencies:
  - TASK-0056
references:
  - docs/design/architecture.md
priority: medium
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the codex data plane. Campaigns own versioned entities and typed links between them, behind an operator-scoped CRUD API that validates every write against the contracts.

Why: architecture A3 (codex is mutable and versioned) and A5. Every later codex consumer (browser UI, DM runtime, agents, exports) reads and writes through this API.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The operator creates, lists, renames and deletes campaigns.
- [ ] #2 The API creates, reads, updates and deletes entities, and validates every write against its contract.
- [ ] #3 Every update stores a new version, and the API returns an entity's version history.
- [ ] #4 Typed links connect entities, and the API returns an entity with its linked neighbours.
- [ ] #5 The cross-plane boundary check covers the codex package.
- [ ] #6 An agent reaches every operation through the same API a human uses (constitution I).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
