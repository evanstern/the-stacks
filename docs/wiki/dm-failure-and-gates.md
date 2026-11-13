---
name: dm-failure-and-gates
description: DM runtime robustness (TASK-0102, specs/033-director-robustness) - the TurnFailureResult stored in jobs.result with bounded model-output excerpts, the director normalizer, the plan gate's held party action (TASK-0244; spec 110 cut its step checks; the spec 058 reason check is removed by TASK-0272), and the closed rules-term lists (skills, conditions, damage types) rendered into prompts, with spells and modifiers/DCs not yet gated. Read before touching failure handling or output schemas.
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
  - apps/server/src/dm/seed/schema.ts
  - specs/033-director-robustness/contracts/rules-terms.md
verified_against: 0882dcb94032fa81551a3e9225721939e4cb7179
---

# DM failure record and rules-term gates

Part of the DM runtime ([[dm-runtime]]); turn jobs are in [[dm-turn-jobs]]. The director
normalizer is described in [[dm-runtime]].

A `floor` job (spec 049) is code only and has no `TurnFailureResult`: a gate refusal finishes it with outcome `refused`, and a throw logs `dm.floor.threw` and fails it with `stopped at floor: internal` ([[dm-turn-jobs]]).

The Director legality override reasons include, since spec 099, "no foe of the encounter can fight" for a `turn` decision on an ended encounter with no eligible monster ([[dm-runtime]]). A failed `talk` turn (TASK-0180) writes the same record with `node` `narrate` (a `react` call or a fence loss) or `resolve` (an escalation's opening move). A `talk` turn that ends `none` or refused twice is not a failure: it finishes as `empty-beat` with `jobs.result.talk` ([[dm-turn-jobs]]). Spec 066: `talk.outcome` also takes `confirm` and `interrupted` (a read ended by a later post, by `interruptRead` or `SUGGESTION_STALE`); neither is a failure, and an interrupted read writes no failure record.

A failed ruling call (spec 102) logs `dm.ruling.call-failed`, leaves the request open and never fails the turn. A failed `narrate` or `check` stores `factsThrough` (the current `throughSeq`) in the failure's checkpoint, so the next beat's narrate window does not render the same `why` rows again (spec 104 FR-018, [[dm-runtime]]). An interpret stage that is not a valid Intent after stamping fails the turn `invalid-output` with `detail` `{ actionId, stage, path }`.

When a turn fails, the worker writes `jobs.result` as a `TurnFailureResult` (`dm/jobs.ts`):
the last checkpoint, `outcome: { status: "failed" }`, `check: null`, every model call made (each with provider, model, token, cost and duration fields since TASK-0116), and
`failure: { node, kind, message, detail }`. `node` is a pipeline node, or `presence` when the
marker write before the pipeline failed (`kind` `gate` for a refusal, `internal` for a throw;
`detail` holds the refusal `code` or `null`; [[presence]]). `kind` is a node error kind (one is `state-overflow`: an actor snapshot did not fit its cap; `detail`
holds `view`, `tokens`, `cap`, `actors`, `compressed` and the `node`; the runner logs
`dm.node.state-overflow`; [[actor-snapshot]]) or `seed` (the bad-seed
path, `detail: null`). The turn's `presenceSeq` sits beside `failure`. An `invalid-output` detail holds `purpose`, `promptVersion`, `issues` and
one `AttemptExcerpt` per attempt (`outputTokens`, `chars`, `issues`, `excerpt`). `excerptOf`
(`pipeline/call.ts`; a capped attempt settles as `truncated`, not `invalid-json`, and logs `dm.call.truncated`, TASK-0192, TASK-0273; a parsed reply that fails the schema settles `schema-mismatch`, TASK-0203) bounds each excerpt: text up to 8,000 characters whole, else the first
6,000, an elision marker, the last 2,000. A think-only reply fails with `not valid JSON: the reply held only a think block`; its excerpt keeps the raw think block (TASK-0181). The parser also accepts one top-level JSON object inside prose, a fence or an unclosed think block, and every unparsable attempt logs a `dm.call.invalid-json` line, and every schema failure a `dm.call.schema-mismatch` line, with a 200-char head and tail (TASK-0203). The `dm.turn.failed` log line carries the detail
without `attempts`, because they hold model text. `jobs.error` stays a fixed string
([[dm-turn-jobs]]).

A **rules term** is a value with a rules definition that a model writes into node output. The
interpret schema accepts only closed lists derived from engine enums:
`ConditionKeySchema`, `SkillSchema` (`nodes/schemas.ts`, derived from the engine's
`condition.apply` and `check.roll` commands, thrown at load if not an enum), `AbilitySchema`
and `DamageTypeSchema` ([[dnd5e-engine]]). The `presence` effect (`{effect, targetId, reason}`, strict, no `after` field) adds `PresenceReasonSchema` (`arrived`, `left`, `fled`, `removed`, `surrendered`, `conceded`; [[session-model]]) as a closed term. The seed schema adds a required per-beat `presence` map and NPC `aliases` ([[seed-npc-presence]]). `INTENT_GRAMMAR` in `prompts/interpret.ts` renders the same lists into the interpret prompt (`dm.interpret-v18`; spec 107 drops the monster-turn lines): it lists the Intent kinds and renders the effect, condition, presence-reason, skill and damage-type lists. Spec 110 deleted `prompts/step-grammar.ts` and the `dm.adjudicate-v10` prompt (the `dm.adjudicate` purpose stays for `rulings.ts`), so no list is
hand-typed; the interpret body schema is derived the same way from the Intent contract (`IntentBodySchema` in `nodes/schemas.ts`: `INTERPRET_KINDS`, each kind's `KIND_RULES` target bounds and `paramsSchemaOf` with the `dc` key removed, CR-004). The stamped Intent re-runs the full `IntentSchema`. It is split from `prompts/common.ts` because narrate must import no engine value.
The scene seed's character `skills` keys and clue `check.skill` use the same `SkillSchema`.
A gate never maps, coerces or drops a term to pass output. The `beside` block is a strict object, and an ability-check stage needs `stakes.cost` and `stakes.severe` (a `superRefine` on the stage; a save may set them null). The rules-terms contract
(`specs/033-director-robustness/contracts/rules-terms.md`) records spells as the term **not gated yet**; since spec 083 (TASK-0105) they are gated, now by the planner ([[planner]]). Since TASK-0104 schemas refuse `expression`, `dc`, `targetAc` and `onHit` damage. Spec 110 removed the plan gate's `STAT_UNDEFINED` check (the planner raises it).

Spec 100: `SceneSeedSchema` gained an optional `space` and zone fields, checked in `crossCheckSeed`; a bad zone is a `SeedError` at load, not a turn failure ([[seed-npc-presence]]).
