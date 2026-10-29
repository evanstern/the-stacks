# Specification Quality Checklist: Three-human seed for the M3 demo

**Purpose**: Validate specification completeness before planning
**Created**: 2026-10-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Focused on three humans seated at one AI-DM table and how the operator starts it
- [x] Every mandatory section completed
- [x] Implementation names appear only where the card or existing code binds them (`loadSeed`, the seed file, the slide-out, the runbook path)

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers; open calls are OQ-1 to OQ-6, each with a recommended (a) and a blank Ruling
- [x] Requirements are testable (FR-001 to FR-013 map to tests or evidence in tasks.md)
- [x] Success criteria are measurable (SC-001 to SC-005)
- [x] All three card stories covered (US1 seed, US2 slide-out, US3 runbook)
- [x] Edge cases listed (third human not present, absent human, Director naming Odo, seated operator, fourth account for a human DM)
- [x] Card AC #1, #2 and #3 mapped (spec.md "Card acceptance criteria map")
- [x] Each claim about Odo becoming human cites code (companion jobs, Director prompt and legality, snapshot fiction view, sign-off and floor, playtest harness and auditor, fake DM script)

## Constraints

- [x] No modal (FR-009, SC-004)
- [x] No frozen contract change (FR-012; OQ-3 (b) names the contract it would touch)
- [x] No new runtime dependency, no migration, no server source change (plan.md)

## Notes

- `speckit-clarify` skipped: the loader, start route and slide-out settle what is possible; the OQs are operator calls.
- Findings F-1 (no hosted-dev way to seat a human DM) and F-2 (the harness seats one human) are for the orchestrator, not this card.
