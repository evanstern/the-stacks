# Contract: the output claim gate (spec 051, decision-0025 §3.4)

Binding for `apps/server/src/dm/claims.ts` and its callers. TASK-0144 (companion `say`, public
chronicle entries) and TASK-0161 (step reasons at the plan gate) call the same function and amend
this file; they do not fork a second checker.

## Seam

```ts
checkClaims(state: { snapshot: ActorSnapshot; diff: SnapshotDiff | null }, text: string):
  { pass: boolean; issues: ClaimIssue[] }
```

Pure and deterministic. It calls no model, reads no log and imports snapshot types only. Types
are in `data-model.md`.

## Rules

1. **References.** A term is an actor alias, matched whole-word, case-insensitive,
   possessive-aware (the party-name-filter pattern, `specs/034-narration-quality/contracts/
   audit-criteria.md`). A term held by one actor is unique. A group noun is a name or alias word
   (not an article, preposition or title word), singular or plural.
2. **Acts and speech.** A unique term followed within four words by an act or speech verb, with
   no negation between them, or a quote attributed to a unique term, is refused when the actor
   is `dead`, `unconscious` or `stable`, or `absent`.
3. **Exemptions.** Rule 2 skips an actor with a `life-state` or `presence` change in the diff,
   and the phrase `<term> acts next` or `<term> moves next`.
4. **Attribution.** A death word within four words of a unique term is refused unless that actor
   is `dead`. A down word within four words of a unique term is refused unless that actor is
   `unconscious`, `stable` or `dead`.
5. **Unattributed.** A death or down word with no unique term in range is refused only when no
   S1 actor holds that state.
6. **Omission.** Each diff change to `dead` (or to `unconscious` or `stable`) needs a clause
   that references the actor by a unique term, a group term or a group noun, and holds a recorded
   death (or drop) word.
7. **Counts.** A count claim compares with S1:
   - "N down" with a noun compares with that noun's actors that are down or dead.
   - "N down" without a noun passes when either the non-party count or the party count equals N.
   - "no X left" needs zero X actors that are neither dead nor `absent`.
   - "last X" needs exactly one such actor.
   - "all X down" needs every X actor down or dead.
   - `yielded` counts as present.
8. **Unresolved references pass.** Pronouns and descriptions are left to `dm.audit`.

## Callers (this spec)

| Caller | Text | State | On refusal |
|---|---|---|---|
| `deterministicChecks` (audit node) | every narration attempt | S1 and the diff | blocking `ledger-mismatch` "Actor state: …"; existing regenerate loop, then fallback |
| narrate node, before the first call | each `facts.rulings[].ruling`, `facts.director.goalNote` | S1 and the diff | withheld from facts; non-blocking issue on attempt 1 |
| `factualSummary` `reasonUsable` | each roll reason | S1 and the diff | the reason is not voiced |
| `checkPlan` (plan gate, resolve step 0) | each step `reason` and `autoFail.reason` of a non-resumed group | S0 and `plannedDiff` (presence only) | the group is refused before any step runs (spec 058) |

Amended by spec 058 / TASK-0161: the `checkPlan` row above.

## Not gated here

- Dice lines: their reasons are checked at the plan gate before resolve logs them (spec 058).
- Companion `say` and public chronicle entries. Owner: TASK-0144.
- The code fallback as a whole. It is code, not model text, and passes by construction (property
  test).

## Amendment 2026-11-03 (specs/085-combat-audit-pass-rate, TASK-0214): `offTurnActs`

`offTurnActs(state, text, offTurn)` in `claims.ts` is a second consumer of the clause walk. It names an
actor on `facts.turn.offTurn` shown, as the subject of a clause, taking a turn action (verb lemmas in
`TURN_ACT_VERBS`: attack, swing, strike, slash, stab, lunge, charge, fire, shoot, loose, throw, hurl,
cast) within the four-token window. It skips quoted speech, a negated act, the turn-order phrase
("acts next", "moves next"), a barred actor (the claim gate reports it) and a shared group noun (unique
aliases only). Each hit is a `ClaimIssue` with `claim: "act"`. `deterministicChecks` is the caller and
blocks each hit as `invented-mechanics`.
