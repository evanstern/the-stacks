# Specification Quality Checklist: Human DM ends an encounter or changes table mode from the table

**Purpose**: Validate specification completeness before planning
**Created**: 2026-10-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Focused on the human DM's table controls and what every viewer then sees
- [x] Every mandatory section completed
- [x] Implementation names appear only where the card or a contract binds them (gate request kinds, the engine command)

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers; open calls are OQ-1 to OQ-6, each with a recommended (a) and a blank Ruling
- [x] Requirements are testable (FR-001 to FR-016 map to tests in tasks.md)
- [x] Success criteria are measurable (SC-001 to SC-005)
- [x] Both card stories covered (US1 end an encounter, US2 change table mode)
- [x] Edge cases listed (lost seat, stale encounter, bad reason, held floor, pending AI proposals, scene change)
- [x] Card AC #1 and #2 mapped (spec.md "Card acceptance criteria map")

## Constraints

- [x] No modal (FR-004, SC-003)
- [x] No frozen contract change (FR-010; OQ-5 (b) and OQ-6 (b) name the contracts they would touch)
- [x] No new runtime dependency, no migration, no server source change (plan.md)

## Notes

- `speckit-clarify` skipped: the gate and engine settle what is possible; the OQs are operator calls.
- DC-1 (a human DM starts an encounter) is a deferral candidate only if OQ-3 is not ruled (a).
