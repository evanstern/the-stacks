---
name: output-claim-gate
description: The output claim gate (TASK-0143, specs/051-output-claim-gate) - checkClaims, a pure lexical checker that tests narration, rulings, goalNote and roll reasons against the S1 snapshot and the S0-to-S1 diff - refuses dead, downed or absent actors acting or speaking, wrong-actor deaths and drops, omitted deaths and wrong counts; where it is wired (audit, narrate withholding, fallback, plan gate). Read before touching claims.ts or a caller.
kind: component
sources:
  - apps/server/src/dm/claims.ts
  - apps/server/src/dm/audit-words.ts
  - apps/server/src/dm/gates/plan-gate.ts
  - specs/051-output-claim-gate/contracts/claim-gate.md
verified_against: 4938e7b26811bd11ff137c128880660b9ecab1b4
---

# Output claim gate

Part of narration quality ([[dm-narration-quality]]) and the DM runtime ([[dm-runtime]]). It reads
the snapshot ([[actor-snapshot]]). Contract: `specs/051-output-claim-gate/contracts/claim-gate.md`.
TASK-0144 (companion `say`, public chronicle entries) calls the same function. So does the plan
gate (`checkPlan` in `dm/gates/plan-gate.ts`, TASK-0161, spec 058): it checks each step reason, each check's stakes texts and `newRisk` (spec 070),
`autoFail.reason`, a check or attack `circumstance.reason` (spec 082) and condition `source` of a non-resumed group against S0 and a presence-only
`plannedDiff` before any step runs, and refuses the group with `REASON_CONTRADICTS_STATE`
([[dm-failure-and-gates]]). Dice-line reasons therefore never reach the log unchecked. The plan gate also refuses a foreign actor (TASK-0208, spec 079): an `attack`, `spell` (caster), `help` (helper) or `move` step whose actor is not the action's own resolves `STEP_ACTOR_MISMATCH`, a refusal of its own that runs no claim check.

`checkClaims` is pure and lexical: no model call, no log read, snapshot types only. It resolves
a term to an actor by `aliases` (whole word, case-insensitive, possessive-aware; a term held by one
actor is unique) and returns `ClaimResult` (`pass`, `issues` of kind `act`, `speech`, `death`,
`down`, `omission` or `count`). It refuses a dead, unconscious, stable or absent actor acting or
speaking (a quote attributed to it too), a death or down word on the wrong actor, a recorded
death or drop that the prose omits, and a count ("N down", "no X left", "last X", "all X down")
that disagrees with S1. An actor with a `life-state` or `presence` change in the diff is exempt
from the act rule. A same-sentence pronoun, body part and act verb binds to the last uniquely
named actor when no other name sits between. Pronouns and descriptions otherwise pass to
`dm.audit`. The word lists (`ACT_VERBS`, `SPEECH_VERBS`, negations, body parts, count patterns)
live in `audit-words.ts`. Contract: `specs/051-output-claim-gate/contracts/claim-gate.md`.

`offTurnActs(state, text, offTurn)` (TASK-0214, spec 085) is a second consumer of the same clause walk. It names an actor on `facts.turn.offTurn` shown as a clause subject taking a turn action (`TURN_ACT_VERBS`: attack, swing, strike, slash, stab, lunge, charge, fire, shoot, loose, throw, hurl, cast) or readying for the next one (`TURN_READY_PHRASE`, TASK-0246: "draws back", "shifts its grip", "raises its blade again") within the four-token window; perceptual verbs (watches, waits, turns its head) are not turn actions and pass. It returns `act` issues. It skips quoted speech, a negated act, "acts next", a barred actor and a shared group noun (unique aliases only). `deterministicChecks` calls it and blocks each hit as `invented-mechanics`.

`withholdRefusedInputs(facts, state)` (`nodes/narrate.ts`) runs the checker once before the first
model call on each `facts.rulings[].ruling` and on `facts.director.goalNote`, ignoring omission
claims. A refused ruling leaves the facts; a refused `goalNote`, or one that states a count (`hasCountClaim`, TASK-0214), becomes `""`. `NarrateOutput.withheld`
carries the refusals; the audit records them as non-blocking issues on attempt 1 only (in the
`AuditAttempt` deterministic issues and the recorded issue list).

