---
name: dm-failure-and-gates
description: DM runtime robustness (TASK-0102, specs/033-director-robustness) - the TurnFailureResult stored in jobs.result with bounded model-output excerpts, the director normalizer, and the closed rules-term lists (skills, conditions, damage types) rendered into prompts, with spells and modifiers/DCs not yet gated. Read before touching failure handling or model-output schemas.
kind: component
sources:
  - apps/server/src/dm/jobs.ts
  - apps/server/src/dm/worker.ts
  - apps/server/src/dm/pipeline/call.ts
  - apps/server/src/dm/pipeline/runner.ts
  - apps/server/src/dm/pipeline/context.ts
  - apps/server/src/dm/nodes/director.ts
  - apps/server/src/dm/nodes/schemas.ts
  - apps/server/src/dm/prompts/step-grammar.ts
  - apps/server/src/dm/seed/schema.ts
  - specs/033-director-robustness/contracts/rules-terms.md
verified_against: 4af9ecbd6436d6529ceb61b058a9df75fb805925
---

# DM failure record and rules-term gates

Part of the DM runtime ([[dm-runtime]]); turn jobs are in [[dm-turn-jobs]]. The director
normalizer is described in [[dm-runtime]].

A `floor` job (spec 049) is code only and has no `TurnFailureResult`: a gate refusal finishes it with outcome `refused`, and a throw logs `dm.floor.threw` and fails it with `stopped at floor: internal` ([[dm-turn-jobs]]).

When a turn fails, the worker writes `jobs.result` as a `TurnFailureResult` (`dm/jobs.ts`):
the last checkpoint, `outcome: { status: "failed" }`, `audit: null`, every model call made (each with provider, model, token, cost and duration fields since TASK-0116), and
`failure: { node, kind, message, detail }`. `node` is a pipeline node, or `presence` when the
marker write before the pipeline failed (`kind` `gate` for a refusal, `internal` for a throw;
`detail` holds the refusal `code` or `null`; [[presence]]). `kind` is a node error kind (one is `state-overflow`: an actor snapshot did not fit its cap; `detail`
holds `view`, `tokens`, `cap`, `actors`, `compressed` and the `node`; the runner logs
`dm.node.state-overflow`; [[actor-snapshot]]) or `seed` (the bad-seed
path, `detail: null`). The turn's `presenceSeq` sits beside `failure`. An `invalid-output` detail holds `purpose`, `promptVersion`, `issues` and
one `AttemptExcerpt` per attempt (`outputTokens`, `chars`, `issues`, `excerpt`). `excerptOf`
(`pipeline/call.ts`) bounds each excerpt: text up to 8,000 characters whole, else the first
6,000, an elision marker, the last 2,000. The `dm.turn.failed` log line carries the detail
without `attempts`, because they hold model text. `jobs.error` stays a fixed string
([[dm-turn-jobs]]).

Since TASK-0110 a gate-refused action resolves before a Director stage change (encounter end, free mode), because resolve runs the action groups before the closing moves ([[dm-runtime]], "Resolve order"). The **plan gate** (`dm/gates/plan-gate.ts`, `checkPlan`, TASK-0112) is pure and runs first in resolve. It checks every actor and target id a step names against the S0 actors' `combatantId`s plus the combatants this turn's encounter start adds. An action group with an unknown id resolves `refused` with `UNKNOWN_COMBATANT` before any step runs; the verdict reason is `not-a-combatant` (the id is an NPC or alias with no combatant), `not-in-snapshot` or `absent` (TASK-0141: the S0 actor's `presence` is `absent`; the code stays `UNKNOWN_COMBATANT`, operator ruling OQ-4). A step that names an absent actor fails unless it is a `presence` effect with reason `arrived`. A `presence` effect may target any S0 actor, combatant or not. It never maps an alias. Verdicts are stored as `checkpoint.planGate` (absent on older rows). The declare gate refuses a declaration for a downed character with `CHARACTER_UNABLE` ([[proposal-gate]]).

A **rules term** is a value with a rules definition that a model writes into node output. The
interpret and adjudicate schemas accept only closed lists derived from engine enums:
`ConditionKeySchema`, `SkillSchema` (`nodes/schemas.ts`, derived from the engine's
`condition.apply` and `check.roll` commands, thrown at load if not an enum), `AbilitySchema`
and `DamageTypeSchema` ([[dnd5e-engine]]). The `presence` effect (`{effect, targetId, reason}`, strict, no `after` field) adds `PresenceReasonSchema` (`arrived`, `left`, `fled`, `removed`, `surrendered`, `conceded`; [[session-model]]) as a closed term; `step-grammar.ts` renders it too. `prompts/step-grammar.ts` renders the same lists
into the interpret and adjudicate prompts (`dm.interpret-v4`, `dm.adjudicate-v4`), so no list is
hand-typed; it is split from `prompts/common.ts` because narrate must import no engine value.
The scene seed's character `skills` keys and clue `check.skill` use the same `SkillSchema`.
A gate never maps, coerces or drops a term to pass output. The audit
(`specs/033-director-robustness/contracts/rules-terms.md`) records two terms **not gated yet**:
spells (TASK-0105; no spell id exists in any output schema) and check/attack modifiers and DCs
(TASK-0104; the model still chooses them inside the expression and `dc`).

