---
id: TASK-0266
title: Intent contract package
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-07 05:13'
updated_date: '2026-11-08 21:26'
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

Spec: specs/092-intent-contract
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every kind in target-architecture §2 has a params schema and a fixture.
- [x] #2 `parse(toText(i))` round-trips for every fixture.
- [x] #3 A decision record freezes the schema with `INTENT_SCHEMA_VERSION = 1`.
- [x] #4 Boundary lint forbids imports from apps into the package.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Spec specs/092-intent-contract (spec, plan, tasks, contracts/intent-schema.md). Freeze the contract at CP-4 (operator rules Q1-Q9). Then 4 sonnet phases: (1) skeleton, scalars, refs, boundary lint; (2) 57 kinds, KIND_RULES, refusals, fixtures; (3) parse/toText; (4) property, totality, latency tests. Phase 5 orchestrator: CP-4 decision record, card 066/091 amendments, wiki update.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec authored for CP-4. Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5

CP-4 2026-11-08: operator ruled Q1–Q9 as recommended and froze the contract as v1 (decision-0030). AC #3 met by the decision record. Implementation (AC #1, #2, #4) follows per specs/092-intent-contract/tasks.md.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5
Phases 1-2 done (529c762e, 8af1a7e1): 57 kinds, KIND_RULES, refusals, fixtures; 89 tests green. Open contract question: IntentBody excludes ruling and whisper (ponytail comment in kinds.ts), pending operator confirmation.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phases 3-4)
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (close: v1.1, ci:check, wiki)
AC #1 57 kinds with schemas and fixtures; AC #2 round-trip 57/57 plus seeded property tests; AC #4 boundary 20/20 fixtures flagged. pnpm ci:check exit 0 (DB suites skipped, REQUIRE_DATABASE unset). Contract v1.1 (operator C-CON). Orchestrator verified the 4 unchanged-prose re-pins: only biome.json changed under their sources (new intent rule block, \u2014 re-encoded).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
