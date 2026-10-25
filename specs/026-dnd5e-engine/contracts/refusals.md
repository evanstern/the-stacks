# Contract: refusals

```ts
export const RefusalCodeSchema = z.enum([ /* the 26 codes below, in this order */ ]);

export const RefusalSchema = z.object({
  code: RefusalCodeSchema,
  message: z.string().min(1),                  // for humans and logs; not for parsing
  details: z.record(z.string(), z.unknown()).optional(), // e.g. { combatantId, level }
});
```

## Rules

- **Refuse before write.** A refusal carries no events. The gate (TASK-0045) appends nothing
  and returns `code` to the proposer (TASK-0045 AC #8).
- **Refuse before draw.** Every precondition is checked before the first die is drawn, so a
  refusal draws zero dice. The one place a draw cannot be avoided (a rolled temporary-HP
  grant that turns out not to be higher) is defined as a success, not a refusal
  (commands.md, "Temporary HP").
- **One code per refusal.** When several preconditions fail, the first in this order wins:
  `INVALID_STATE`, `INVALID_COMMAND`, then the command's own checks in the order its row in
  commands.md lists them. A test pins the order for each command with two failing checks.
- **Closed list.** Adding a code is a contract change; the coverage meta-test (AC #11) fails
  until the new code has a test.

## Codes

| # | Code | Meaning | Commands |
|---|---|---|---|
| 1 | `INVALID_STATE` | The state fails `EngineStateSchema` or its refinements | all |
| 2 | `INVALID_COMMAND` | The command fails `EngineCommandSchema` (wrong shape, out-of-range number, `exhaustion` passed to `condition.apply`/`remove`) | all |
| 3 | `INVALID_DICE_EXPRESSION` | The expression does not match the grammar, or has a zero count, zero sides or zero keep | `roll`, `attack.roll`, `check.roll`, amount-taking commands |
| 4 | `DICE_LIMIT_EXCEEDED` | Count, sides, keep, terms, length or modifier beyond the limits, including a critical-hit doubled count | `roll`, `attack.roll`, `check.roll`, amount-taking commands |
| 5 | `ADVANTAGE_NOT_APPLICABLE` | Advantage or disadvantage on an expression without exactly one plain positive `1d20` term | `roll` |
| 6 | `D20_TERM_REQUIRED` | An attack or check expression without exactly one plain positive `1d20` term | `attack.roll`, `check.roll` |
| 7 | `UNKNOWN_COMBATANT` | A named combatant id (target, attacker, participant or checking combatant) is not in the state | all that name one |
| 8 | `DUPLICATE_COMBATANT` | `combatant.add` with an id already in the state | `combatant.add` |
| 9 | `DUPLICATE_PARTICIPANT` | The same id twice in a participants list | `initiative.roll`, `rest.short`, `rest.long` |
| 10 | `COMBATANT_IN_ENCOUNTER` | Removing a combatant listed in the active encounter | `combatant.remove` |
| 11 | `TARGET_DEAD` | The target, a participant, the attacker or the checking combatant is dead | damage, healing, temp HP, `attack.roll`, `check.roll`, `condition.apply`, `exhaustion.adjust`, initiative, rests, spell slots |
| 12 | `TARGET_AC_UNKNOWN` | The attack carries no `targetAc` and the target record's `ac` is null | `attack.roll` |
| 13 | `NOT_DYING` | Death save or stabilise on a target that is not unconscious under the death-saves rule | `death-save.roll`, `stabilize` |
| 14 | `TEMP_HP_NOT_HIGHER` | A fixed temporary-HP grant not above the current temporary HP | `temp-hp.grant` |
| 15 | `CONDITION_ALREADY_PRESENT` | The target already has that condition | `condition.apply` |
| 16 | `CONDITION_NOT_PRESENT` | The target lacks that condition | `condition.remove` |
| 17 | `EXHAUSTION_OUT_OF_RANGE` | The new exhaustion level would be below 0 or above 6 | `exhaustion.adjust` |
| 18 | `ENCOUNTER_ACTIVE` | Starting an encounter or resting while one is active | `initiative.roll`, `rest.short`, `rest.long` |
| 19 | `NO_ACTIVE_ENCOUNTER` | An encounter command with no active encounter | `initiative.join`, `turn.advance`, `encounter.end` |
| 20 | `ALREADY_IN_ENCOUNTER` | Joining a combatant already in the order | `initiative.join` |
| 21 | `NO_ELIGIBLE_COMBATANT` | Every combatant in the order is dead | `turn.advance` |
| 22 | `INSUFFICIENT_HIT_DICE` | Spending more dice of a size than remain, or a size the combatant lacks | `rest.short` |
| 23 | `LONG_REST_REQUIRES_HP` | A long-rest participant has 0 HP | `rest.long` |
| 24 | `SLOT_LEVEL_UNAVAILABLE` | No slot of that level in that pool | `spell-slot.expend`, `spell-slot.restore` |
| 25 | `NO_SLOT_AVAILABLE` | Every slot of that level and pool is expended | `spell-slot.expend` |
| 26 | `SLOT_NOT_EXPENDED` | Restoring more slots than are expended | `spell-slot.restore` |
