# Contract amendment: attacks and damage may name anyone present (spec 075, TASK-0210)

Target: `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md`, section
"Non-combatant targets (spec 068)".

This amendment is the PR's stated reason for human review: it reverses a contract rule that spec
068 made binding. It changes no frozen contract: no `specs/029-proposal-gate/contracts/` file, no
`specs/030-play-route/contracts/proposal-seam.md`, no ws-protocol frame shape, no event or proposal
schema shape. The `PlanVerdict` type is unchanged.

## Operator ruling (verbatim)

2026-11-02, runbook A playtest run 1 (session 9296c653), `docs/playtests/2026-11-02-runbook-a-playtest.md`
finding 23:

> "I actually think that the rule itself is incorrect -- we should be able to attack anyone
> regardless of combatant state."

It reverses spec 068 OQ-4 (a) and card TASK-0194 AC #2.

## Text to apply

Replace the whole paragraph under "## Non-combatant targets (spec 068)" with:

```markdown
## Non-combatant targets (spec 068, amended by spec 075)

*Amended by spec 068 (TASK-0194), then by spec 075 (TASK-0210):* the id check also accepts the
exact id of an S0 `npc` actor with no combatant, in every named-id field: `check` `combatantId`,
`attack` `attackerId` and `targetId`, and every `condition`, `heal` and `damage` effect target.
An accepted actor outside the encounter order (or any such actor in free mode) is listed in the
`ok` verdict as `pull`, in first-seen order and without duplicates. An alias still fails
`not-a-combatant`. An absent actor still fails `absent`, except as the target of a `presence`
effect with reason `arrived`.

Spec 075 removes spec 068's attack and damage exception. Operator ruling, 2026-11-02 (TASK-0210):
"I actually think that the rule itself is incorrect -- we should be able to attack anyone
regardless of combatant state." A pulled attack target starts no encounter and records no
disposition (spec 075 OQ-1 (a)).
```

## Consequences for callers

- `resolve.md` step 0 (spec 068 amendment) is unchanged: resolve pulls every `pull` id, whatever
  field named it.
- `not-a-combatant` now fires only for an alias of an actor with no combatant.
