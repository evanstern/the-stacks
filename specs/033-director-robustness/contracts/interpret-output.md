# Contract: accepting real interpret output

Added by the 2026-10-26 amendment (operator ruling on TASK-0102). Amends
`specs/031-dm-runtime/contracts/nodes.md` ("interpret") and the shared step grammar used by
interpret and adjudicate. Modules: `apps/server/src/dm/prompts/interpret.ts`,
`apps/server/src/dm/prompts/common.ts` (`STEP_GRAMMAR`), `apps/server/src/dm/prompts/adjudicate.ts`
(version bump only), `apps/server/src/dm/nodes/schemas.ts`, and the skill gate in
[rules-terms.md](rules-terms.md).

This contract is a **catalog**, in the style of [director-output.md](director-output.md). The
captured evidence (`apps/server/test/dm/fixtures/interpret-capture-20261026T152743Z-greyhollow-ford-provider.json`,
research R10) selects rows I1 and I2. Row I3 is selected by the operator requirement, not by the
evidence. A row not in this catalog needs a spec amendment before it is built.

## Invariants (every row)

1. Interpret stays strict. `InterpretOutput`, `StepSchema` and `EffectSchema` gain no leniency.
   No normalizer runs for interpret. `callJson` gets no `normalize` from the interpret node.
2. No invalid condition, skill, damage type, ability or number is mapped, coerced, defaulted
   or dropped (TASK-0042 R8). The schema is the gate. The single re-ask is the only retry.
3. The fix for an invented rules term is the prompt plus the existing re-ask.
4. Every closed list in a prompt is rendered at runtime from its enum's options. No prompt holds
   a hand-typed list of conditions, skills or damage types.
5. A prompt change bumps that prompt's `PROMPT_VERSION`. The interpret prompt becomes
   `dm.interpret-v2`. `STEP_GRAMMAR` is shared, so the adjudicate prompt becomes
   `dm.adjudicate-v2` too.
6. No code cap on output size, and no gateway `finish_reason` passthrough (director-output.md
   "Out of scope" still holds).

## Cause catalog

| Id | Cause | Selected when the record shows | Fix | Test | Selected by |
|---|---|---|---|---|---|
| I1 | Invented rules term: a condition, skill or damage type outside its closed list, often a narrative outcome written as a mechanic | `Invalid option` at `…onSuccess.N.condition`, `…onFailure.N.condition`, `…onHit.N.condition`, `…skill` or `…damageType` | Prompt: render the allowed condition keys, skill keys and damage types from their enums. State that a condition effect may use only those keys. State that a narrative outcome (spotting, learning, noticing) is narration with no effect. Give one complete minimal check step with an empty `onSuccess`. | Prompt snapshot: every key of each enum appears; the narrative-outcome sentence appears; the example parses under `InterpretOutput`. Reproduction: attempt 2 of the fixture fails strict parse at `readings.0.steps.0.onSuccess.0.condition`. | **Evidence** (attempt 2) |
| I2 | Truncation at `maxTokens`, with a code fence opened before the cut | `outputTokens` equals the purpose's `maxTokens`; issue `not valid JSON`; the excerpt opens with a fence and ends mid-JSON | Prompt: "Reply with one JSON object, no prose, no code fence"; one sentence per `reason`; each field cap in words. Operator checkpoint: the operator raises `dm.interpret` `maxTokens` in the operator-owned `.env` before the verification rerun. The orchestrator proposes the value. Implementers never edit `.env`. | Prompt snapshot names the no-fence line and the caps. Reproduction: attempt 1 of the fixture fails with `not valid JSON`. | **Evidence** (attempt 1) |
| I3 | A free-string rules term the schema cannot gate | (none needed) | The skill gate in [rules-terms.md](rules-terms.md): one engine enum, derived in `schemas.ts`, used by `StepSchema` and the seed schema, rendered into the prompts. | Engine scripted tests for `check.roll` skill; a `StepSchema` test that rejects an unknown skill; a seed test that rejects an unknown skill key. | **Operator requirement** (2026-10-26) |
| I4 | Enum drift on interpret's own fields (`intent`, `kind`, `mode`) | `Invalid option` on those fields | Prompt: the values are already listed in the output shape and step grammar; no synonym mapping. | — | Not selected (no such issue in the record) |
| I5 | Reading count or ids that do not match the beat | `interpret readings do not match the beat` | Prompt only: "one reading per beat item" already stated. | — | Not selected (not in the record) |

## Prompt shape (interpret v2)

The interpret system prompt keeps its doctrine and its user-prompt sections. It changes as
follows:

1. `STEP_GRAMMAR` (shared) replaces `"condition":str` with a reference to the condition list,
   `"skill":str|null` with a reference to the skill list, and `"damageType":str` with a
   reference to the damage-type list.
2. `STEP_GRAMMAR` ends with a rules-terms block rendered from the enums:
   - `Conditions (the only allowed values of "condition"): blinded, charmed, …`
   - `Skills (the only allowed values of "skill", or null): acrobatics, animal-handling, …`
   - `Damage types (the only allowed values of "damageType"): acid, bludgeoning, …`
   - "A condition effect may use only a listed condition. A narrative outcome such as spotting,
     learning or noticing something is narration, not an effect: leave `onSuccess` empty."
3. The interpret `OUTPUT_SHAPE` opens with "Reply with one JSON object, no prose, no code
   fence."
4. It states each cap in words: one sentence per `reason` (at most 500 characters);
   `rulesQuestion` at most 500 characters; `clarify` one short question, at most 200
   characters; at most 6 steps per reading; at most 4 effects per list; `source` at most 100
   characters; `expression` at most 200 characters.
5. It gives one complete minimal example: one reading with one check step, a listed skill or
   null, `onSuccess: []` and `onFailure: []`. The example's ids pass `RefIdSchema` and
   `CombatantIdSchema`. A test parses it with `InterpretOutput`.

The adjudicate prompt receives change 1 and change 2 through `STEP_GRAMMAR` and nothing else.

## Out of scope

- A normalizer, a synonym map or a condition-to-narration rewrite for interpret.
- A third model attempt.
- Gating spells and model-chosen modifiers and DCs (rules-terms.md follow-up cards TASK-0105
  and TASK-0104).
