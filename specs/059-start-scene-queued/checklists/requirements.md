# Specification Quality Checklist: The header stops offering Start scene once a scene start is queued

**Purpose**: Validate specification completeness before planning
**Created**: 2026-10-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Focused on the operator's visible header and the route's refusal
- [x] Every mandatory section completed
- [x] Implementation names appear only where the card or a contract binds them

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers; open calls are OQ-1 to OQ-4 with a recommended (a)
- [x] Requirements are testable (FR-001 to FR-007 map to tests in tasks.md)
- [x] Success criteria are measurable (SC-001 to SC-003)
- [x] Both DM paths covered (US1 human DM, US2 AI DM)
- [x] Edge cases listed (fetch failure, Dismiss, reload, two tabs, fixtures, equivalence)
- [x] Card AC #1 mapped (spec.md "Card acceptance criteria map")

## Constraints

- [x] No modal (D4)
- [x] No frozen contract change (D3)
- [x] No new runtime dependency, no migration (plan.md)

## Notes

- `speckit-clarify` skipped: the code settles where the state lives; the OQs are operator calls.
- Background 5 is a reading of the route; T003 proves it red-first before the route changes.
