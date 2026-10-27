---
name: dm-failure-and-gates
description: DM runtime robustness (TASK-0102, specs/033-director-robustness) - the TurnFailureResult stored in jobs.result with bounded model-output excerpts, the director normalizer, and the closed rules-term lists (skills, conditions, damage types) rendered into prompts, with spells and modifiers/DCs not yet gated. Read before touching failure handling or model-output schemas.
kind: component
sources:
  - apps/server/src/dm/jobs.ts
  - apps/server/src/dm/worker.ts
  - apps/server/src/dm/pipeline/call.ts
  - apps/server/src/dm/nodes/director.ts
  - apps/server/src/dm/nodes/schemas.ts
  - apps/server/src/dm/prompts/step-grammar.ts
  - apps/server/src/dm/seed/schema.ts
  - specs/033-director-robustness/contracts/rules-terms.md
verified_against: 2b58684eba93e597b951465770a9fa11cc5d4a24
---

# DM failure record and rules-term gates

Part of the DM runtime ([[dm-runtime]]); turn jobs are in [[dm-turn-jobs]]. The director
normalizer is described in [[dm-runtime]].

When a turn fails, the worker writes `jobs.result` as a `TurnFailureResult` (`dm/jobs.ts`):
the last checkpoint, `outcome: { status: "failed" }`, `audit: null`, every model call made (each with provider, model, token, cost and duration fields since TASK-0116), and
`failure: { node, kind, message, detail }`. `node` is a pipeline node, or `presence` when the
marker write before the pipeline failed (`kind` `gate` for a refusal, `internal` for a throw;
`detail` holds the refusal `code` or `null`; [[presence]]). `kind` is a node error kind or `seed` (the bad-seed
path, `detail: null`). The turn's `presenceSeq` sits beside `failure`. An `invalid-output` detail holds `purpose`, `promptVersion`, `issues` and
one `AttemptExcerpt` per attempt (`outputTokens`, `chars`, `issues`, `excerpt`). `excerptOf`
(`pipeline/call.ts`) bounds each excerpt: text up to 8,000 characters whole, else the first
6,000, an elision marker, the last 2,000. The `dm.turn.failed` log line carries the detail
without `attempts`, because they hold model text. `jobs.error` stays a fixed string
([[dm-turn-jobs]]).

A **rules term** is a value with a rules definition that a model writes into node output. The
interpret and adjudicate schemas accept only closed lists derived from engine enums:
`ConditionKeySchema`, `SkillSchema` (`nodes/schemas.ts`, derived from the engine's
`condition.apply` and `check.roll` commands, thrown at load if not an enum), `AbilitySchema`
and `DamageTypeSchema` ([[dnd5e-engine]]). `prompts/step-grammar.ts` renders the same lists
into the interpret and adjudicate prompts (`dm.interpret-v2`, `dm.adjudicate-v2`), so no list is
hand-typed; it is split from `prompts/common.ts` because narrate must import no engine value.
The scene seed's character `skills` keys and clue `check.skill` use the same `SkillSchema`.
A gate never maps, coerces or drops a term to pass output. The audit
(`specs/033-director-robustness/contracts/rules-terms.md`) records two terms **not gated yet**:
spells (TASK-0105; no spell id exists in any output schema) and check/attack modifiers and DCs
(TASK-0104; the model still chooses them inside the expression and `dc`).

