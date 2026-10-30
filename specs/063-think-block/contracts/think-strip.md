# Contract: leading think blocks are stripped before parse

Amends `specs/031-dm-runtime/contracts/node-seam.md` "Model calls" additively. Pipeline order
after `specs/033-director-robustness/contracts/director-output.md`:

```
joined text → stripThink → stripFence → JSON.parse → [normalize, if passed] → schema.safeParse
```

## `stripThink(text: string): string` (exported from `dm/pipeline/call.ts`)

1. Remove every `<think>…</think>` block at the start of the text, with the whitespace before,
   between and after them. Matching is case-sensitive and non-greedy.
2. Leave the rest unchanged. A `<think>` later in the text is not touched.
3. An unclosed leading `<think>` is not stripped.
4. Return the remainder. A text with no leading block is returned unchanged.

## Callers

- `parseAgainst`: parses `stripFence(stripThink(text))`. When `stripThink` returns an empty
  string, the issue is `not valid JSON: the reply held only a think block`.
- `callText`: returns `stripThink(text)` as its `text`.

## Unchanged

- The re-ask's `assistant` message and every `AttemptExcerpt` carry the raw text.
- `dm_model_calls` gains no column. No completion text is stored there.
- The gateway, the `openai-compatible` adapter and `ChatEvent` are unchanged.
