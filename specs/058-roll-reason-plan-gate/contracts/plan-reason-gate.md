# Contract: the plan gate checks roll reasons (spec 058, decision-0025 §3.2 and §3.4)

Amends `specs/031-dm-runtime/contracts/resolve.md` ("Order of work", step 0) and
`specs/051-output-claim-gate/contracts/claim-gate.md` ("Callers" and "Not gated here"). Under OQ-2
(a) it also amends `specs/026-dnd5e-engine/contracts/refusals.md`. Changes no frozen contract: no
`specs/029-proposal-gate/contracts/` file, no `specs/030-play-route/contracts/proposal-seam.md`, no
ws-protocol frame shape, no event or proposal schema shape. `action.resolved` stays payload v1.

## Seam

```ts
interface PlanInput {
  snapshot: ActorSnapshot;                 // S0
  readings: readonly InterpretReading[];
  rulings: readonly { actionId: string | null; steps: readonly Step[] }[];
  joining: readonly string[];              // unchanged
  arriving: readonly string[];             // new: seed NPC ids the encounter start marks `arrived`
  resumed: readonly string[];              // new: action ids with a resumed plan (spec 057)
}

type PlanVerdict =
  | { actionId: string | null; ok: true; pull?: string[] }   // spec 068
  | { actionId: string | null; ok: false; code: "UNKNOWN_COMBATANT"; failure: PlanFailure }
  | { actionId: string | null; ok: false; code: ReasonRefusalCode; failure: ReasonFailure };

interface ReasonFailure {
  stepIndex: number;
  field: "reason" | "autoFail.reason";     // OQ-3 (a) adds `effects[j].source`-style paths
  text: string;                            // the refused model text, as written
  issues: ClaimIssue[];                    // from checkClaims
}
```

`ReasonRefusalCode` is `REASON_CONTRADICTS_STATE` under OQ-2 (a), or `INVALID_COMMAND` under OQ-2
(b). `checkPlan` stays pure and synchronous.

## Rules

1. **Groups.** The groups are the existing ones: a ruling replaces its reading's steps; a `clarify`
   reading has no steps.
2. **Order.** The id check runs first. Only a group that passes it has its reasons checked.
3. **Skip.** A group whose action id is in `resumed` skips the reason check. The id check still runs.
4. **Text.** Each step's `reason`, then a `check` step's `autoFail.reason`, in step order.
5. **State.** `checkClaims({ snapshot: S0, diff: plannedDiff }, text)`. `plannedDiff` is
   `{ fromSeq: S0.throughSeq, toSeq: S0.throughSeq, stage: [], actors }`. `actors` holds one
   `presence` change for each presence-effect target in any group's steps (`after` is the effect
   reason's presence, `REASON_TO_PRESENCE`) and each id in `arriving` (`after` is `present`).
   `before` is the actor's S0 presence. An id with no S0 actor is left out. It holds no other
   change kind.
6. **Verdict.** The first text with `pass: false` is the group's failure. One failure per group.
7. **Never rewrites.** A passing text reaches the engine command unchanged.

## Resolve (amends resolve.md step 0)

Append to step 0: "Amended by `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md`: the
plan gate also checks each step reason against S0 with `checkClaims`. A reason-refused action group
submits `action.resolve` `refused` with the verdict's code and runs no step. A reason-refused NPC
group runs no step; the turn still advances." `resolveAction` takes the refusal code from the
verdict instead of the literal `UNKNOWN_COMBATANT`.

## Claim gate (amends claim-gate.md)

Add a "Callers" row:

| Caller | Text | State | On refusal |
|---|---|---|---|
| `checkPlan` (plan gate, resolve step 0) | each step `reason` and `autoFail.reason` of a non-resumed group | S0 and `plannedDiff` (presence only) | the group is refused before any step runs (spec 058) |

Replace "Dice lines, which hold roll reasons. Owner: TASK-0161." with "Dice lines: their reasons are
checked at the plan gate before resolve logs them (spec 058)."

## Engine refusals (OQ-2 (a) only)

Append a row to `specs/026-dnd5e-engine/contracts/refusals.md`: `REASON_CONTRADICTS_STATE` — "A DM
step reason contradicts actor state. Plan gate only (spec 058); `execute` never returns it."

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

Amended by spec 078: `arriving` also holds the Director's legal arrivals, and the id check does not treat an arriving id as absent.

## Amended by specs/082-engine-derived-numbers (TASK-0104)

- `circumstance.reason` on a check or attack step is a model-written text. The reason check
  covers it, field `circumstance.reason`.
- New rule: for each check with a combatant and each attack, `checkModifier` or `findAttack` over
  the engine combatant must succeed. Joining combatants are skipped. A failure refuses the group
  with `STAT_UNDEFINED` and a `PlanFailure` (`reason` `stat-undefined`, `field` `ability`, `skill`
  or `attack`). The stat check runs after the id walk and before the reason check.
