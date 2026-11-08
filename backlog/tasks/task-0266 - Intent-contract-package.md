---
id: TASK-0266
title: Intent contract package
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-07 05:13'
updated_date: '2026-11-08 04:37'
labels:
  - 'ws:intent'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies: []
ordinal: 250000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create `packages/intent` with the Intent schema, commit states and every core kind from target-architecture §2. Each kind has a Zod params schema and a text form. Slash grammar parses to Intents and back. This contract freezes at CP-4; every surface lane builds on it.

Prerequisite checkpoints: CP-1 (plan-of-action §7).

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-01).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every kind in target-architecture §2 has a params schema and a fixture.
- [ ] #2 `parse(toText(i))` round-trips for every fixture.
- [ ] #3 A decision record freezes the schema with `INTENT_SCHEMA_VERSION = 1`.
- [ ] #4 Boundary lint forbids imports from apps into the package.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
