# Research: DM calls survive a leading think block (TASK-0181)

Sources read: `apps/server/src/ai/` (all files), `apps/server/src/dm/pipeline/call.ts`,
`apps/server/src/dm/purposes.ts`, `apps/server/src/playtest/budget.ts`, `.env.example`,
`docs/playtests/2026-10-28-two-browser-alpha.md` (run 2), TASK-0101 notes,
`docs/design/m2-first-scene-sweep-runbook.md` (AI config), `docs/ops/orchestrator-handoff.md` §4,
`specs/033-director-robustness/research.md` R10 and `contracts/director-output.md`, wiki notes
`ai-gateway`, `dm-runtime`, `dm-failure-and-gates`, `debug-view`. No vm-104 or 9router access.

## R1. Cause (card AC #1)

**Finding**: the 9router `cc/` chat routes on vm-103 run the Claude models with extended
thinking on, and translate each thinking block into literal `<think>…</think>` text inside
`choices[].delta.content`. The thinking text itself is mostly withheld (empty block), but its
tokens count against `max_tokens`. When thinking uses the whole cap, the reply is the bare
`<think></think>` and nothing else.

**Confidence**:

| Claim | Confidence | Why |
|---|---|---|
| The tag is produced upstream of the app, not by the app | High | The app requests no thinking (R2) and reads only `delta.content` (R3). Nothing in the repo writes `<think>`. |
| Hidden reasoning tokens count against the cap | High | Run 2: three of four interpret attempts were `<think></think>` at exactly 1,200 output tokens, the configured cap (R4). 033 R10 saw the same gap on 2026-10-26: 1,200 tokens for 331 visible characters. |
| The router (not the model) turns thinking into `<think>` text | Medium | The OpenAI-compatible translation is the router's job. The same `cc/` models through the local 9router on 2026-10-26 showed the token gap but no tag (033 `classification.md`: "no reasoning text"). |
| Why the tag appears on hosted dev and not in the 10-26 local runs | Low | Hosted dev uses the realm 9router on vm-103 (`http://9router.local.infinity-node.win/v1`). The 10-26 runs used a local 9router (`host.docker.internal:20128`). The two instances may differ in version or route settings. Only the probe (tasks.md Phase 3) can tell. |

**Not the cause**: a code change in the app. `openai-compatible.ts` was last touched 2026-10-18
(TASK-0028) and `call.ts` 2026-10-26 (TASK-0116). Neither reads a reasoning field.

## R2. Is thinking requested or configured anywhere in the repo?

No.

- `openai-compatible.ts` `chat()` sends exactly `model`, `messages`, optional `max_tokens`,
  `stream: true` and `stream_options.include_usage`. No `reasoning_effort`, `thinking`,
  `reasoning` or vendor field.
- `ProviderConfig` (`kind`, `baseUrl`, `apiKeyEnv`) and `PurposeConfig` (`provider`, `model`,
  `op`, `maxTokens`, `batchSize`) have no field for request options. The config cannot ask for
  thinking.
- The model IDs live only in env (`AI_PURPOSES`), never in source (decision-0007). Hosted dev
  uses the local mapping (TASK-0101, m2 runbook): director, adjudicate, playtest.audit →
  `cc/claude-opus-5`; interpret, narrate, companion → `cc/claude-sonnet-5`; dm.audit,
  chronicle → `cc/claude-haiku-4-5-20251001`. None carries a thinking suffix in the repo's
  record. The exact strings in `/home/stacks/dev/.env` are unverified from here.

## R3. How replies are extracted

`openai-compatible.ts` yields `delta.content` and nothing else. A `reasoning_content`,
`reasoning` or `thinking` delta is dropped. So a `<think>` the app sees is text the router put
into `content`. `call.ts` `collect()` joins the text events. `parseAgainst` runs
`JSON.parse(stripFence(text))`. `stripFence` removes only a whole-text code fence, so a leading
`<think></think>` is the first bad token.

033 already catalogued this shape as C1 ("a reasoning block … before the JSON") with an
`extractJson` fix that drops `<think>` blocks. C1 was not selected because the 10-26 evidence
held bare JSON, so the fix was never built.

## R4. The effective `maxTokens`

The card's lead asked why failed attempts show 1,200 tokens when `PURPOSE_MAX_TOKENS` caps
interpret at 800. Answer: `PURPOSE_MAX_TOKENS` (`dm/purposes.ts`) is read only by the playtest
budget estimator (`playtest/budget.ts` `outputCap`). The gateway sends
`AI_PURPOSES[purpose].maxTokens` from env (`gateway.ts` line 115). The operator raised those on
2026-10-26: director 1500, adjudicate 1500, interpret 1200, companion 800, chronicle 1000,
narrate 500. So 1,200 is the configured interpret cap, and a think-only reply at 1,200 is a
`finish_reason: "length"` cut inside thinking.

Note for the source fix: narrate at 500 and dm.audit at 300 are the tightest caps. If thinking
spends them, narration can come back think-only too.

## R5. Where the strip belongs (OQ-3)

**Decision**: a pure `stripThink` in `dm/pipeline/call.ts`, applied in `parseAgainst` before
`stripFence`, and to the text `callText` returns.

**Rationale**: the DM is the failing caller. The raw text stays intact for the re-ask message
and the failure excerpt, so the debug view still shows what the model sent. No streaming
buffer is needed. The strip is a few lines and needs no dependency.

**Alternatives considered**:
- In the adapter: covers the library answerer and the playtest auditor too, but must buffer a
  stream until `</think>` closes, and hides the raw text from every excerpt.
- In the gateway: same reach, and it breaks the gateway's pass-through stream contract.
- Full `extractJson` (033 C1 balanced-brace scan): larger than this blocker needs. The evidence
  shows only a leading block. Prose around JSON has not been observed.

## R6. Should think content reach `dm_model_calls`? (OQ-2)

**Decision**: no. `dm_model_calls` holds no prompt or completion text by contract
(`schema/dm-model-calls.ts`, specs/037 data-model). The raw text, think block included, already
lands in the failed-turn excerpt in `jobs.result` (`AttemptExcerpt`), which the debug view
shows. The thinking text is mostly empty anyway (R1).

**Alternative**: an integer `think_chars` column. It costs a migration and shows only a
character count of mostly-empty blocks. The `outputTokens` column already exposes the hidden
spend.

## R7. Source fix (OQ-1)

Stripping cannot rescue a think-only reply: it holds no JSON. Run 2 items 5 and 7 show
think-only attempts are common on interpret. AC #4 therefore needs a source change too. The
candidates, cheapest first, are decided by the probe:

1. Turn thinking off on the 9router `cc/` routes (vm-103, operator).
2. A request field the router honors to disable thinking (for example `reasoning_effort` or a
   `thinking` object). This needs a new optional request-options field on `PurposeConfig` or
   `ProviderConfig`. That is a code change outside this spec; the orchestrator cards it if the
   probe proves a field works.
3. Raise `maxTokens` in vm-104's `AI_PURPOSES` so thinking plus JSON fits (operator, vm-104
   `.env`). This raises cost per call.

## R8. Probe (for the orchestrator, under the operator's go)

The probe confirms R1 and picks the R7 option. It runs inside `stacks-dev-app-1`, so the key
stays in the container env and is never printed. The `cc/` routes are subscription-backed; the
probe makes two short model calls. The exact commands are in `quickstart.md` §Probe.

It answers four questions:
1. Does `<think>` arrive inside `delta.content`, or in a separate delta field?
2. Is the block empty, and does `usage.completion_tokens` exceed the visible text?
3. Does a think-only reply end with `finish_reason: "length"`?
4. Does a thinking-off request field remove the block?

## R9. Dependencies

None. `stripThink` is one regular expression in `call.ts`.
