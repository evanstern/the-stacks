# @the-stacks/planner

The deterministic planner: `plan(state, space, intent)` returns engine commands, a refusal, or a
ruling request. It calls no model and does no I/O.

- Contract (normative): `specs/097-planner/contracts/planner.md`.
- Runtime dependencies: `@the-stacks/intent`, `@the-stacks/space`, `@the-stacks/dnd5e-engine`, `zod`.
- Caller: the gate (TASK-0268). No other surface imports this package.
- Exports: `plan`, `stepOutcome`, `hostilesStanding`, `PLAN_KINDS`, the types and the Zod schemas
  `PlanStateSchema`, `PlanFactSchema`, `RulingRequestSchema`.

## Versioning

- Additive changes (a new fact kind, a newly served kind, a new optional state field) are minor.
  Add a CHANGELOG line.
- Renaming or removing a result branch, a field or a fact kind is breaking. It needs a decision
  record before the gate merges against it.

## CHANGELOG

- 1.0 — initial planner (spec 097, TASK-0267).
