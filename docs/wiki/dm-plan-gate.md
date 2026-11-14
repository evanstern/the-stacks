---
name: dm-plan-gate
description: The DM plan gate (dm/gates/plan-gate.ts, TASK-0112, TASK-0161, TASK-0244, TASK-0312: the step checks are deleted) - checkPlan's one check (the held off-turn companion), the encounter-phase helpers, and the askUndeclared manner rule. Read before touching checkPlan, askUndeclared, or the plan-stage hold.
kind: component
sources:
  - apps/server/src/dm/gates/plan-gate.ts
  - apps/server/src/dm/pipeline/runner.ts
verified_against: b811b90d03f6e4769956e6db4f8a3cd7fce790df
---

# DM plan gate

Part of the DM runtime ([[dm-runtime]]). The failure record and rules-term lists are in [[dm-failure-and-gates]].

The **plan gate** (`dm/gates/plan-gate.ts`, `checkPlan`, TASK-0112) is pure and runs first in resolve. Spec 110 (TASK-0312) deleted every step check: the id and text checks, `STEP_ACTOR_MISMATCH`, the help, opposition and spell checks, `pull` ids, and the `Step` readings they read. The planner and the Intent runner own those legality checks now ([[planner]], [[proposal-gate]]).

`checkPlan` has one check. `PlanInput` carries `snapshot` (S0), `readings` (Intent readings only), `actors` (action id to the acting character's combatant id, `null` for a party-scope action) and `declarers` (action id to the declarer's combatant id, spec 104 FR-012). For a reading with stages and no clarify, in turn mode, whose action is party scope, `heldFor` returns the declarer's combatant id when that declarer is a conscious AI companion in the order who is off turn (TASK-0244, spec 087). The verdict is then `{ok: false, code: TURN_HELD, heldFor}`; `TURN_HELD` is a plan-gate literal, not a `RefusalCode`, and writes no event. Every other action gets `{ok: true}`. A human PC named off turn still acts. Verdicts are stored as `checkpoint.planGate` (absent on older rows). `stageActors` names the declarer of a staged item (at most one id, since every stage of an item shares the declarer).

A held party action resolves as outcome `held` ([[dm-runtime]]). A gate-refused action resolves before a Director stage change (encounter end, free mode), because resolve runs the action groups before the closing moves ([[dm-runtime]], "Resolve order"). A refused action is narrated as not having happened ([[dm-narration-quality]]). The declare gate refuses a declaration for a downed character with `CHARACTER_UNABLE` ([[proposal-gate]]). A clarify turn ends in its question (specs/073). `checkPlan` maps no alias: the interpret node's `seatActorIds` has already normalized actor fields.

Spec 099 (TASK-0274) adds the encounter-phase helpers to this file: `encounterPhase`, `eligibleMonsters`, `startableEncounterIds`, `joinableMonsters`, `unseenMonsters`, `arrivingMonsters`, `arrivingNpcs`. `joiningCombatants` and `arrivingNpcs` return `[]` for an encounter that already ran (`encounterRan`: active, or an `encounter.started` ledger row whose order holds one of its monsters) ([[dm-runtime]]).

**`askUndeclared`** (`gates/plan-gate.ts`, spec 077) is pure and runs in the runner after the first-stage cut and before `clarifyHolds`. It has one rule, the manner rule: an Intent `check` stage whose skill is Stealth, Deception or Intimidation (`MANNER_SKILLS`) turns the reading into a clarify with a fixed question, unless the declaration's wording names that manner (lexical cues) or the actor is an AI. The clarify reading keeps `stages: []`. The other-player rule cannot fire: code stamps the actor of every stage as the declarer. Resumed actions skip it. Each ask is counted as `asked` on `dm.plan.cut`. The runner no longer branches on adjudication: the post-interpret cut runs once per turn.
