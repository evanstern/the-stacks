# Contract: accepting real director output

Amends `specs/031-dm-runtime/contracts/node-seam.md` ("Model calls", step 3) and
`contracts/director.md` ("Output schema"). Modules: `apps/server/src/dm/pipeline/call.ts`,
`apps/server/src/dm/nodes/director.ts`, `apps/server/src/dm/nodes/schemas.ts`,
`apps/server/src/dm/prompts/director.ts`, and (C9 only) `apps/server/src/ai/adapters/`.

This contract is a **catalog**. Phase 3 implements only the rows the captured evidence selects
(`evidence/classification.md`). A row the evidence does not select is not built. A row not in
this catalog needs a spec amendment before it is built.

## Invariants (every row)

1. `DirectorOutput` in `schemas.ts` stays exactly as specified in 031's director.md. The only
   schema edit is the `advance` refine message (failure-record.md).
2. Leniency lives in `normalizeDirector(json: unknown): unknown`, exported from
   `nodes/director.ts`. It runs after `JSON.parse` and before `DirectorOutput.safeParse`.
3. `normalizeDirector` never coerces, defaults, clamps or drops a number. It never infers an id.
   It never infers a discriminant whose variant carries a payload.
4. `normalizeDirector` returns its input unchanged when the input is not a plain object.
5. Each rule has its own unit test. A table test asserts that no rule touches
   `trackers[].advance` or any other number.
6. `callJson` gains an optional `normalize?: (json: unknown) => unknown` on its request. Only
   the director passes it. Other nodes are unchanged unless the C1 row is selected (C1 is
   parse-level and applies to every `callJson` caller).
7. The re-ask still runs once. The second attempt goes through the same parse and
   normalization.

## Pipeline order (after this contract)

```
joined text → [C9 adapter fix, if selected] → stripFence → [C1 extractJson, if selected]
  → JSON.parse → [normalize, if passed] → schema.safeParse
```

## Cause catalog

| Id | Cause | Selected when the record shows | Fix | Test |
|---|---|---|---|---|
| C1 | Prose, a reasoning block, or a fence before or after the JSON | `not valid JSON` and the excerpt holds a JSON object inside other text | `extractJson(text)` in `call.ts`: drop `<think>…</think>` blocks; try `JSON.parse` of the stripped text; on failure, scan for each `{` and take the first string-aware balanced object that parses. Try at most 20 starts. | prose-before, prose-after, think-block, fence-mid-text, braces inside strings, no object at all |
| C2 | Truncation | `outputTokens` equals the purpose's `maxTokens` and the excerpt ends mid-JSON | Prompt: one sentence per `reason`, `goalNote` 1–2 sentences, no whitespace padding. Record in quickstart the operator's `maxTokens` for `dm.director` (at least 1500). No code cap. | prompt snapshot names the limits |
| C3 | A "no change" decision as null, a bare string or omitted | issue at `beat`, `tableMode`, `scene`, `trackers` or `companionPrompts` with null, a string or undefined | Normalize: `beat` null/missing/`"resolve"` → `{decision:"resolve"}`; `tableMode` null/missing/`"stay"` → `{to:"stay"}`; `scene` null/missing/`"continue"` → `{status:"continue"}`; `trackers` and `companionPrompts` null/missing → `[]`; `goalNote` null/missing → `""`; `pacing.spotlight` and `pacing.beatId` missing → `null`. Each fallback is the legality table's own fallback. | one test per field |
| C4 | Prose over its cap | `Too big` on `goalNote` or a `reason` | Normalize: cut `goalNote` to 300 characters and each `reason` to 300, at the last space before the cap, then trim. Prose only. | over-cap goalNote, over-cap reason, no-space string |
| C5 | Soft pacing hint in the wrong format | issue at `pacing.spotlight` or `pacing.beatId` | Normalize: a `spotlight` that fails `RefIdSchema`, or a `beatId` longer than 64 characters or not a string, becomes `null`. Never mapped to an id. | name-as-spotlight, long beatId |
| C6 | Enum drift | `Invalid option` on `tension`, `outcome`, `decision`, `to` or `status` | Prompt: list each enum's values in the worked examples. No synonym mapping. | prompt snapshot |
| C7 | Payload variant missing a field | issue inside `beat.hold`, `tableMode.turn`, `tableMode.free` or `scene.end` | Prompt: one complete example per payload variant. No default reason, no inferred id. | prompt snapshot |
| C8 | Number drift | issue at `trackers.N.advance` | Prompt: "advance is an integer from -3 to 3, never 0; omit the tracker to leave it". Re-ask text already carries the readable issue (failure-record.md). Never coerced. | prompt snapshot |
| C9 | Streaming concatenation | the excerpt holds the JSON twice, or reasoning text the model did not write as its answer | Fix the `openai-compatible` adapter: ignore a final chunk that repeats the whole text, or skip non-`content` reasoning deltas. Exact shape decided from the captured stream. | `ai.openai-compatible.test.ts` SSE case reproducing the shape |

C2, C6, C7 and C8 change the prompt. Any prompt change bumps `PROMPT_VERSION` to
`dm.director-v2` (FR-015).

## Prompt shape (when a prompt row is selected)

- Replace the pseudo-grammar `OUTPUT_SHAPE` with: one line stating "Reply with one JSON object,
  no prose, no code fence"; then a complete minimal example (resolve, stay, no trackers,
  continue); then one complete example per payload variant the evidence implicates.
- State each cap in words next to its field.
- Keep the doctrine and every user-prompt section as they are.

## Amendment: goalNote sentence (spec 086, TASK-0203)

`OUTPUT_SHAPE` ends with: "Write every top-level key. `goalNote` is its own top-level key, always
written (an empty string when you have no note), never inside `pacing`." Version `dm.director-v8`.
Run 1 showed the model nesting `goalNote` inside `pacing`. The prompt states the rule; code adds no
new coercion.

## Out of scope

- Loosening `InterpretOutput`, `AdjudicateModelOutput` or any step or effect schema. They carry
  mechanics inputs (TASK-0042 R8).
- A third model attempt. One re-ask stays the rule (node-seam.md).
- Gateway `finish_reason` passthrough. Revisit only if C2 is selected and the token count
  cannot tell truncation apart; that needs its own card.
