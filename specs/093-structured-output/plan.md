# Implementation Plan: Structured output in the gateway

**Branch**: `task-0273-structured-output` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: `specs/093-structured-output/spec.md`; TASK-0273 and the absorbed TASK-0203, 0256,
0197; runbook `docs/design/r1-fast-table-runbook.md` (lane LF, merge spine #4, footprint row
0273, finding F5/G1). Authored against `main` at `a8bda4ab`. This plan assumes OQ-1 to OQ-6 as
recommended. Research and design are small, so they live in this file. There is no separate
research.md, data-model.md, contracts/ or quickstart.md.

## Summary

Add an optional per-purpose `structured` mode (`"tool"` or `"json-schema"`) to `AI_PURPOSES`.
`callJson` converts its Zod schema to JSON Schema once and sends it on the chat request. The
gateway forwards it only to a structured purpose. The `openai-compatible` adapter sends `tools` +
`tool_choice` or `response_format`, and streams tool-call arguments as ordinary `text` events, so
everything above the adapter (parse, normalize, Zod, repair re-ask, ledger) is unchanged. Split
the truncated log line from the parse-failure lines. Teach the playtest watch `truncated=`, the
attempt-1 failure rate and `out-max`. Move the TASK-0203 shapes into one fixture module and run
them through both paths. Re-size the `dm.interpret` cap from measured output.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod 4.6.5 (`z.toJSONSchema`, already installed in `apps/server`),
Vitest. **No new runtime dependency.** No vendor SDK (decision-0007).
**Storage**: none new. **No migration.** `truncated` is already a ledger outcome (migration 0008).
**Testing**: Vitest unit tests with stubbed `fetch` (adapter) and the scripted fake gateway
(`callJson`). No DB test changes. No paid model run.
**Constraints**: no frozen contract change (`docs/wiki/ws-protocol.md` frames,
`specs/029-proposal-gate/contracts/`, `specs/030-play-route/contracts/proposal-seam.md`).
`ChatEvent` keeps its shape. A purpose without `structured` sends a byte-identical request.
**Scale/Scope**: 9 source files, 1 new test fixture module, 1 new test file, 5 extended test
files, 2 contract amendments, 1 skill script, 1 skill doc.

## Constitution Check

Against `.specify/memory/constitution.md` 3.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: no new surface. The mode is env config, readable by an agent. The
      watch output is a script an agent runs.
- [x] **II. One Intent vocabulary**: no write path changes. N/A.
- [x] **III. Event sourcing**: no event change. N/A.
- [x] **IV. Data planes**: no new state. The ledger is untouched.
- [x] **V. Many views, one state**: no view change. N/A.
- [x] **VI. Engine owns the numbers**: no mechanic touched. The sent schema constrains shape, not
      numbers; the model still writes no digit the engine owns.
- [x] **VII. Narration around facts**: `dm.narrate` prose stays a text call. TASK-0272 adds the
      slot schema and TASK-0298 the stream (see "Seams"). Nothing here makes fact rows wait.
- [x] **VIII. Campaign is data**: no content. N/A.
- [x] **IX. UX quality bar**: touches the turn's model-call count. Fewer repair re-asks and no
      interpret truncation cut critical-path calls toward first token < 10 s p50 and the 4v4
      round < 60 s. Measured at CP-7 by TASK-0278. No UI.
- [x] **X. Citations**: no library claim. N/A.
- [x] **XI. Operator-owned content**: no content. N/A.
- [x] **XII. Self-hostable**: this task is the XII line "Each model purpose MUST use structured
      output with a declared schema." All calls stay behind the one gateway seam. The mode is a
      config entry, so a local `openai-compatible` server needs no code (XII last line).
- [x] **XIII. Just-in-time**: R1 card on milestone m-10. Deferrals are open questions with a
      revisit trigger (OQ-5) for the orchestrator to card. The seams it builds on are the
      gateway contract (spec 011) and the node seam (spec 031), both stable.

**Stack conformance**: within the table ("Model output: structured output (tool call or JSON
schema) per purpose, through the gateway"; "Validation: Zod"). **Complexity Tracking**: none.

## Research

- **R1 — One seam carries both modes.** The gateway owns routing; only the adapter knows wire
  formats. So the request carries a vendor-neutral `output: {name, schema}` and the purpose
  carries the mode. The adapter maps the pair to the wire. A future native adapter maps the same
  pair to its own form.
- **R2 — Tool arguments stream as text.** OpenAI-compatible streams put tool arguments in
  `choices[0].delta.tool_calls[i].function.arguments` fragments. Yielding them as `text` events
  keeps `collect()`, `parseAgainst()`, the excerpt and log code unchanged. The parse chain
  (`stripThink` → `stripFence` → `extractObject`) is a no-op on clean JSON, so it stays as the
  fallback for routers that ignore the mode.
- **R3 — Zod is the schema source.** `z.toJSONSchema(schema, {target: "draft-7", io: "input",
  unrepresentable: "any"})` handles every construct the DM schemas use (discriminated unions,
  nullables, defaults, optionals). It drops `.refine` and `.superRefine`
  (`AuditModelOutput`, `CompanionOutput`, `InterpretOutput` step rules). Those stay enforced by
  the post-parse `safeParse`. `io: "input"` matters: normalizers and defaults run before Zod, so
  the model writes the input shape. `draft-7` is the widest-accepted dialect. Strip `$schema`:
  some routers reject it inside `parameters`.
- **R4 — No strict mode.** OpenAI `strict: true` needs `additionalProperties: false` and every key
  required. The DM schemas have optional keys (`actor`, `reveals`). `strict: false` keeps them.
  Strict mode is not needed to meet AC #2: the failures seen were enum and missing-key errors,
  which a sent schema alone states to the model.
- **R5 — Where the truncated line is logged.** `logInvalid` already receives the settled kind's
  inputs. `callJson` already picks `truncated` for the ledger from `usage.truncated`. The log line
  picks from the same flag. `callText` gains one call to the same helper.
- **R6 — The interpret cap is a measured number.** `PURPOSE_MAX_TOKENS` (`dm/purposes.ts`) and
  `.env.example` both say 4000. `playtest/budget.ts` reads `PURPOSE_MAX_TOKENS` for estimates, so
  a raised cap also raises the estimate. That is correct.
- **R7 — Who else calls `chat()`.** `library/answer.ts`, `playtest/auditor/audit.ts` and the
  budget wrapper (`playtest/budget.ts`) pass requests through. None sets `output`, so none changes.
  The scripted DM adapter (`dm/script/load.ts`) and `FakeProvider` ignore `output`.

## Design

### D1 — Config and types (`ai/types.ts`, `ai/config.ts`)

- `PurposeConfig.structured?: "tool" | "json-schema"`. `PurposeConfigSchema` gains
  `structured: z.enum(["tool", "json-schema"]).optional()`.
- `ChatRequest.output?: { name: string; schema: Record<string, unknown> }`.
- `Provider.chat` opts widen to `{ maxTokens?: number; structured?: "tool" | "json-schema" }`.
- `crossValidate` rejects `structured` on an `op: "embed"` purpose with a named error.

### D2 — Gateway (`ai/gateway.ts`)

Pass `structured: purpose.structured` in the `provider.chat` opts. Pass `req` unchanged. When
`purpose.structured` is unset, the adapter never reads `req.output`. The gateway does not inspect
the schema.

### D3 — Adapter (`ai/adapters/openai-compatible.ts`)

- Body: when `opts.structured && req.output`:
  - `tool`: `tools: [{type: "function", function: {name, description: "Return the reply.",
    parameters: schema}}]`, `tool_choice: {type: "function", function: {name}}`.
  - `json-schema`: `response_format: {type: "json_schema", json_schema: {name, schema,
    strict: false}}`.
- `ChatCompletionChunk.choices[].delta` gains `tool_calls?: {index?: number; function?:
  {arguments?: string}}[]`.
- Stream loop in tool mode: yield `arguments` fragments of index 0 as `text`. Buffer
  `delta.content`. After the loop, if no argument fragment arrived and the buffer is non-empty,
  yield it as one `text` event before `done`. Outside tool mode the loop is unchanged.
- `finish_reason: "tool_calls"` already counts as `sawFinish` (any non-null reason). Keep it.

### D4 — `callJson` output spec (`dm/pipeline/call.ts`)

- `outputSpecOf(purpose, schema)`: a module `WeakMap<ZodType, Record<string, unknown>>` caches
  the converted schema. Name is `purpose.replaceAll(".", "_")`.
- `collect()` takes an optional `output` and puts it on the `chat()` request. `callJson` passes
  it on both attempts. `callText` passes none.

### D5 — Truncated log line (`dm/pipeline/call.ts`)

- `logInvalid` becomes `logFailed(deps, req, attempt, collected, issues, kind, truncated)`. When
  `truncated`, the event is `dm.call.truncated` with `parse: kind`. Otherwise it is
  `dm.call.${kind}` as today. The payload is otherwise unchanged.
- `callText`: when `usage.truncated`, log `dm.call.truncated` with `parse: null`, `issues: ""`,
  head and tail. The ledger settle is unchanged.
- `collected` gains `truncated: boolean` (from `usage?.truncated === true`), so the decision has
  one source.

### D6 — Boot warning and env (`index.ts`, `dm/purposes.ts`, `.env.example`)

- `dm/purposes.ts`: `unstructuredDmPurposes(purposes)` returns each configured `dm.*` purpose
  whose entry lacks `structured`, except `dm.narrate`. `index.ts` warns once beside the
  `missingDmPurposes` line.
- `dm/purposes.ts`: `PURPOSE_MAX_TOKENS["dm.interpret"]` takes the OQ-3 value. The comment names
  the measurement (session, max, p95) and the date.
- `.env.example`: every `dm.*` entry except `dm.narrate` gains `"structured":"tool"`.
  `dm.interpret` carries the new cap. The comment states both modes, that `dm.narrate` stays
  unstructured (it is also the talk turn's JSON purpose; see OQ-1 and "Seams"), and that a
  provider rejecting a mode fails the turn with a `config` error.

### D7 — Shape fixtures (`apps/server/test/dm/fixtures/task-0203-shapes.ts`)

One exported array of `{id: "S1".."S8", purpose, wrapper: "fence" | "think" | "bare", reply,
expect: "ok" | "schema-mismatch"}`, rebuilt from the TASK-0203 root-cause note (spec 086
"Evidence limits"). `schema-coercions.test.ts` drops its inline builders and iterates this
array. When the OQ-6 read returns the B2 `dm.audit` parse-failure excerpt, add it as `S9` with
its observed `expect`; otherwise the module carries S1 to S8 only.

### D8 — Playtest watch (`.claude/skills/playtest-run/scripts/watch.mjs`, `SKILL.md`)

- Per turn: `truncated=${n}` placed after `invalid-json=`.
- After the spend line: `attempt-1 failures f/n = p%` and `out-max purpose=tokens ...`, computed
  over `data.calls`.
- `SKILL.md` line 72 and 74 name `truncated` and the two new lines.

### D9 — Contract amendments

- `specs/011-ai-gateway/contracts/gateway.md`: `PurposeConfig.structured`, `ChatRequest.output`,
  the adapter wire mapping (D3).
- `specs/031-dm-runtime/contracts/node-seam.md` ("Model calls"): `callJson` sends the output spec;
  the `dm.call.truncated` log event.

## Seams

- **TASK-0298 (narration streaming, lane LN, after TASK-0272).** G1 says `call.ts` collects the
  whole reply. This plan keeps the gateway's `text` event stream as the one carrier in both
  structured modes, and keeps `collect()` as the only accumulator. TASK-0298 can add a
  streaming variant beside `collect()` (an `onText` callback or an async iterator) without
  touching the adapter. Tool-mode argument fragments are partial JSON. A prose slot streamed from
  a structured reply needs an incremental JSON reader over those fragments; this plan does not
  preclude it, because fragments arrive unmerged and in order. Narration may also stay a text
  call per slot. This plan forces neither choice: `dm.narrate` keeps no `structured` mode here.
- **TASK-0272 (prose slots, lane LN).** It will give narrate a slot schema through `callJson` and
  may then set `structured` on `dm.narrate`. The OQ-1 split (mode in env, schema at call site)
  admits that with no gateway change. Hotspot: `dm/pipeline/call.ts` and `apps/server/src/ai/`
  are serial between 0273 and 0272 (runbook "Concurrency"). 0272 builds after this merges.
- **TASK-0269 (interpret emits Intents).** It changes `InterpretOutput`. The conversion test
  (FR-015) catches an unconvertible schema at 0269's PR. Hotspot: `dm/nodes/schemas.ts`. This
  plan does not edit `schemas.ts`.
- **TASK-0245 (fact sheet).** Builds after this merges (F4). No shared file.

## Files touched

| File | Change | Design |
|---|---|---|
| `apps/server/src/ai/types.ts` | `structured`, `output`, chat opts | D1 |
| `apps/server/src/ai/config.ts` | schema key, embed rejection | D1 |
| `apps/server/src/ai/gateway.ts` | forward mode | D2 |
| `apps/server/src/ai/adapters/openai-compatible.ts` | body + tool-call stream | D3 |
| `apps/server/src/dm/pipeline/call.ts` | output spec, truncated log | D4, D5 |
| `apps/server/src/dm/purposes.ts` | `unstructuredDmPurposes`, interpret cap | D6 |
| `apps/server/src/index.ts` | boot warning | D6 |
| `.env.example` | `structured`, interpret cap, comment | D6 |
| `.claude/skills/playtest-run/scripts/watch.mjs` | three counts | D8 |
| `.claude/skills/playtest-run/SKILL.md` | flag `truncated` | D8 |
| `apps/server/test/dm/fixtures/task-0203-shapes.ts` (new) | shape fixtures | D7 |
| `apps/server/test/dm/call-schemas.test.ts` (new) | FR-015 conversion; interpret cap pin | D4, D6 |
| `apps/server/test/ai.config.test.ts` | `structured` accepted/rejected | D1 |
| `apps/server/test/ai.gateway.test.ts` | mode forwarded; unset unchanged | D2 |
| `apps/server/test/ai.openai-compatible.test.ts` | bodies, tool stream, content fallback, S1–S4 | D3, D7 |
| `apps/server/test/dm/call.test.ts` | output sent; truncated log lines | D4, D5 |
| `apps/server/test/dm/schema-coercions.test.ts` | read fixture module | D7 |
| `specs/011-ai-gateway/contracts/gateway.md` | amendment | D9 |
| `specs/031-dm-runtime/contracts/node-seam.md` | amendment | D9 |
| `docs/wiki/{ai-gateway,dm-runtime,dm-turn-jobs,playtest-harness}.md`, `INDEX.md`, `CAPSULES.md` | re-ground | Phase 5 |

Not touched: `dm/model-calls.ts` and `schema/dm-model-calls.ts` (the runbook footprint lists
`model-calls.ts`; no ledger change is needed), `dm/nodes/*`, `dm/prompts/*` (no prompt version
bump), `ws/protocol.ts`, `apps/web/`.

**Migrations**: none. **New runtime dependencies**: none (`z.toJSONSchema` ships in the
installed Zod 4.6.5).

## Risks

- **The hosted route may not translate tools.** Unit tests cannot prove it. The mode is per
  purpose, the failure is loud (`config` error), and CP-7 prep picks the vm-104 value (OQ-4).
- **A sent schema can be large.** `InterpretOutput` converts to a sizeable schema and adds input
  tokens per call. Cost is not the constraint (P-14). The usage ledger shows the change.
