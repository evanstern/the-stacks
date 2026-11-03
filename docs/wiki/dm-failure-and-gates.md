---
name: dm-failure-and-gates
description: DM runtime robustness (TASK-0102, specs/033-director-robustness) - the TurnFailureResult stored in jobs.result with bounded model-output excerpts, the director normalizer, the plan gate's reason check (REASON_CONTRADICTS_STATE, spec 058), and the closed rules-term lists (skills, conditions, damage types) rendered into prompts, with spells and modifiers/DCs not yet gated. Read before touching failure handling or model-output schemas.
kind: component
sources:
  - apps/server/src/dm/jobs.ts
  - apps/server/src/dm/worker.ts
  - apps/server/src/dm/pipeline/call.ts
  - apps/server/src/dm/pipeline/runner.ts
  - apps/server/src/dm/pipeline/context.ts
  - apps/server/src/dm/nodes/director.ts
  - apps/server/src/dm/nodes/schemas.ts
  - apps/server/src/dm/gates/plan-gate.ts
  - apps/server/src/dm/prompts/step-grammar.ts
  - apps/server/src/dm/seed/schema.ts
  - specs/033-director-robustness/contracts/rules-terms.md
verified_against: 5702c95fc4959a9283a2c356043476c3d34d2c9e
---

# DM failure record and rules-term gates

Part of the DM runtime ([[dm-runtime]]); turn jobs are in [[dm-turn-jobs]]. The director
normalizer is described in [[dm-runtime]].

A `floor` job (spec 049) is code only and has no `TurnFailureResult`: a gate refusal finishes it with outcome `refused`, and a throw logs `dm.floor.threw` and fails it with `stopped at floor: internal` ([[dm-turn-jobs]]).

A failed `talk` turn (TASK-0180) writes the same record with `node` `narrate` (a `react` call or a fence loss) or `resolve` (an escalation's opening move). A `talk` turn that ends `none` or refused twice is not a failure: it finishes as `empty-beat` with `jobs.result.talk` ([[dm-turn-jobs]]).

When a turn fails, the worker writes `jobs.result` as a `TurnFailureResult` (`dm/jobs.ts`):
the last checkpoint, `outcome: { status: "failed" }`, `audit: null`, every model call made (each with provider, model, token, cost and duration fields since TASK-0116), and
`failure: { node, kind, message, detail }`. `node` is a pipeline node, or `presence` when the
marker write before the pipeline failed (`kind` `gate` for a refusal, `internal` for a throw;
`detail` holds the refusal `code` or `null`; [[presence]]). `kind` is a node error kind (one is `state-overflow`: an actor snapshot did not fit its cap; `detail`
holds `view`, `tokens`, `cap`, `actors`, `compressed` and the `node`; the runner logs
`dm.node.state-overflow`; [[actor-snapshot]]) or `seed` (the bad-seed
path, `detail: null`). The turn's `presenceSeq` sits beside `failure`. An `invalid-output` detail holds `purpose`, `promptVersion`, `issues` and
one `AttemptExcerpt` per attempt (`outputTokens`, `chars`, `issues`, `excerpt`). `excerptOf`
(`pipeline/call.ts`; a capped attempt settles as `truncated`, not `invalid-json`, TASK-0192) bounds each excerpt: text up to 8,000 characters whole, else the first
6,000, an elision marker, the last 2,000. A think-only reply fails with `not valid JSON: the reply held only a think block`; its excerpt keeps the raw think block (TASK-0181). The parser also accepts one top-level JSON object inside prose, a fence or an unclosed think block, and every unparsable attempt logs a `dm.call.invalid-json` line with a 200-char head and tail (TASK-0203). The `dm.turn.failed` log line carries the detail
without `attempts`, because they hold model text. `jobs.error` stays a fixed string
([[dm-turn-jobs]]).

Since TASK-0110 a gate-refused action resolves before a Director stage change (encounter end, free mode), because resolve runs the action groups before the closing moves ([[dm-runtime]], "Resolve order"). The **plan gate** (`dm/gates/plan-gate.ts`, `checkPlan`, TASK-0112) is pure and runs first in resolve. It checks every actor and target id a step names against the S0 actors' `combatantId`s plus the combatants this turn's encounter start adds. An action group with an unknown id resolves `refused` with `UNKNOWN_COMBATANT` before any step runs; the verdict reason is `not-a-combatant` (the id is an alias with no combatant; an exact NPC id never fails this way), `not-in-snapshot` or `absent` (TASK-0141: the S0 actor's `presence` is `absent`; the code stays `UNKNOWN_COMBATANT`, operator ruling OQ-4). Since TASK-0194 (spec 068) the id check also accepts the exact id of an S0 `npc` actor with no combatant in a `check` `combatantId` or a `condition`/`heal` effect target, and the `ok` verdict lists such actors outside the order as `pull` ([[dm-runtime]]). Since spec 075 (TASK-0210) every non-presence field accepts that exact id, including `attackerId`, `targetId` and `onHit` damage. The operator ruled: "I actually think that the rule itself is incorrect -- we should be able to attack anyone regardless of combatant state." This reverses spec 068 OQ-4. A step that names an absent actor fails unless it is a `presence` effect with reason `arrived`. A `presence` effect may target any S0 actor, combatant or not. It never maps an alias. Since TASK-0161 (spec 058) `checkPlan` also checks model-written text against S0 with `checkClaims` ([[output-claim-gate]]): each step `reason`, a `check` step's `autoFail.reason`, and each condition effect `source` in `effects`, `onSuccess`, `onFailure` and `onHit` (`stepTexts`). The id check runs first and only a group that passes it has its text checked. `plannedDiff` is a presence-only diff: one change per `presence` effect target in any group and one per `arriving` seed NPC (`arrivingNpcs`, mirroring the encounter-start branch of `seedPresence`, [[seed-npc-presence]]), so a reason that names an NPC the same turn marks `arrived` passes. A group whose action id is in `resumed` skips the text check (spec 057 reuses the paused plan). The first refused text is the group's `ReasonFailure` (`stepIndex`, `field`, `text`, `issues`) and the group resolves `refused` with `REASON_CONTRADICTS_STATE`; `resolveAction` takes the code from the verdict. A refused NPC group runs no step and the turn still advances. A passing text is never rewritten. The first-stage cut ([[dm-runtime]], TASK-0182) runs after the interpret and adjudicate schemas pass; `followUps` is a plain bounded string list (at most 6, 200 characters each), not a rules term. Verdicts are stored as `checkpoint.planGate` (absent on older rows). The declare gate refuses a declaration for a downed character with `CHARACTER_UNABLE` ([[proposal-gate]]).

A **rules term** is a value with a rules definition that a model writes into node output. The
interpret and adjudicate schemas accept only closed lists derived from engine enums:
`ConditionKeySchema`, `SkillSchema` (`nodes/schemas.ts`, derived from the engine's
`condition.apply` and `check.roll` commands, thrown at load if not an enum), `AbilitySchema`
and `DamageTypeSchema` ([[dnd5e-engine]]). The `presence` effect (`{effect, targetId, reason}`, strict, no `after` field) adds `PresenceReasonSchema` (`arrived`, `left`, `fled`, `removed`, `surrendered`, `conceded`; [[session-model]]) as a closed term; `step-grammar.ts` renders it too. The seed schema adds a required per-beat `presence` map and NPC `aliases` ([[seed-npc-presence]]). `prompts/step-grammar.ts` renders the same lists
into the interpret and adjudicate prompts (`dm.interpret-v5`, `dm.adjudicate-v4`; v5 adds `followUps`, TASK-0182), so no list is
hand-typed; it is split from `prompts/common.ts` because narrate must import no engine value.
The scene seed's character `skills` keys and clue `check.skill` use the same `SkillSchema`.
A gate never maps, coerces or drops a term to pass output. The audit
(`specs/033-director-robustness/contracts/rules-terms.md`) records two terms **not gated yet**:
spells (TASK-0105; no spell id exists in any output schema) and check/attack modifiers and DCs
(TASK-0104; the model still chooses them inside the expression and `dc`).

