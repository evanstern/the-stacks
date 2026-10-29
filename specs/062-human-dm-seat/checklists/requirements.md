# Specification Quality Checklist: Operator seats a human DM from the web

**Purpose**: Validate specification completeness before planning
**Created**: 2026-10-29
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Focused on the operator's seat control and what each viewer then sees
- [x] Every mandatory section completed
- [x] Implementation names appear only where the card or a contract binds them (the `dm.seat` request, `DmSeatSchema`)

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers; open calls are OQ-1 to OQ-6, each with a recommended (a) and a pending Ruling
- [x] Requirements are testable (FR-001 to FR-018 map to tests or the doc in tasks.md)
- [x] Success criteria are measurable (SC-001 to SC-006)
- [x] All three card stories covered (US1 seat, US2 return, US3 runbook)
- [x] Edge cases listed (unknown presence, no candidate, absent pick, character holder, lost role, bad reason, no-op change, in-flight turn)
- [x] Card AC #1 to #3 mapped (spec.md "Card acceptance criteria map")

## Constraints

- [x] No modal (FR-003, SC-003)
- [x] No frozen contract change under the (a) defaults (FR-010; OQ-6 (b) and DC-1 name the 029 files they would touch)
- [x] No new runtime dependency, no migration, no server source change (plan.md)

## Notes

- `speckit-clarify` skipped: the gate settles what is possible; the OQs are operator calls.
