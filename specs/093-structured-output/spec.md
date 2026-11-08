# Feature Specification: Structured output in the gateway

**Feature Branch**: `task-0273-structured-output`
**Created**: 2026-11-08
**Status**: Draft
**Input**: TASK-0273. "Add a structured-output mode (tool call or JSON schema) per purpose in
`apps/server/src/ai`. Log truncation separately from invalid JSON. Absorbs TASK-0203, 0256, 0197."
Runbook: `docs/design/r1-fast-table-runbook.md`, lane LF, merge spine #4. Parent epic TASK-0258.

Authored against the Spec Kit templates in `.specify/templates/`. The spec dir was claimed with a
stub, so the skills' branch and directory steps do not apply. `speckit-clarify` was skipped: the
card, the three absorbed cards, constitution 3.0.0 and the code settle every choice below except
the open questions at the end. Each open question carries a recommendation, and the plan assumes it.

## Evidence

- **Today's path is prompt-only JSON.** `callJson` (`dm/pipeline/call.ts`) asks for JSON in the
  prompt, strips think blocks and fences, scans for one object, then runs Zod. The
  `openai-compatible` adapter sends no `response_format` and no `tools`.
- **Runbook B playtest run 1** (2026-11-03, 37 turns): 17 of 224 calls failed attempt 1. The
  vm-104 log lines (TASK-0203 root-cause note) show every one parsed and failed the schema (shapes
  S1 to S8 in spec 086). Spec 086 coerced S1 to S4 and stated the S5 to S8 fields in the prompts.
- **Runbook B2 playtest run 1** (2026-11-06, 141 calls): 3 attempt-1 failures (2.1%). One
  `dm.audit` `invalid-json` (a true parse failure, shape not read) and two `dm.interpret`
  `truncated` (TASK-0256). The two truncated turns were the slowest of the run: 88.7 s and 77.5 s.
- **The watch script** (`.claude/skills/playtest-run/scripts/watch.mjs`) prints `invalid-json=`
  and `schema=`. A truncated call shows only in `not-ok=` (TASK-0197).
- **Truncated replies log under their parse kind.** `logInvalid` emits `dm.call.invalid-json` or
  `dm.call.schema-mismatch` for a capped reply; only the ledger row says `truncated`. `callText`
  logs nothing for a capped narration.
- **The installed Zod (4.6.5) exports `z.toJSONSchema`.** It converts discriminated unions,
  nullables and optionals. It drops `.refine`, so Zod stays the validator of record.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A DM purpose asks the provider for its schema (Priority: P1)

An operator sets `"structured": "tool"` (or `"json-schema"`) on a `dm.*` entry in `AI_PURPOSES`.
Every JSON call on that purpose sends its output schema to the provider. The provider constrains
the reply, so attempt 1 parses and passes Zod.

**Why this priority**: constitution XII requires structured output with a declared schema per
purpose. R1 exit criterion 5 requires attempt-1 schema failures under 1%. Each repair re-ask costs
a full model call on the turn's critical path (IX, P-14).

**Independent Test**: `ai.openai-compatible.test.ts` asserts the request body carries `tools` and
`tool_choice` (tool mode) or `response_format` (json-schema mode), and that streamed tool-call
argument deltas arrive as `text` events. `call.test.ts` asserts `callJson` sends the schema of
the call it makes.

**Acceptance Scenarios**:

1. **Given** a purpose with `structured: "tool"` and a `callJson` call, **When** the adapter
   builds the request, **Then** the body has one function tool named for the purpose, with the
   schema as `parameters`, and `tool_choice` forces it.
2. **Given** a purpose with `structured: "json-schema"`, **When** the adapter builds the request,
   **Then** the body has `response_format: {type: "json_schema", json_schema: {name, schema}}`.
3. **Given** a purpose with no `structured` key, **When** any call runs, **Then** the request
   body is byte-identical to today's.
4. **Given** a structured purpose and a `callText` call (no schema), **When** the adapter builds
   the request, **Then** it sends no `tools` and no `response_format`.
5. **Given** tool mode, **When** the provider streams `delta.tool_calls[0].function.arguments`,
   **Then** each fragment is yielded as a `text` event, in order, and `callJson` parses the joined
   text unchanged.

---

### User Story 2 - Truncation is logged apart from invalid JSON (Priority: P1)

An operator reading the server log sees `dm.call.truncated` for any failed attempt that hit its
output cap. `dm.call.invalid-json` and `dm.call.schema-mismatch` mean an uncapped reply failed.

**Why this priority**: the card names it. A capped reply nearly always fails to parse; today it
logs as `invalid-json`, which sends the reader to the prompt instead of the cap.

**Independent Test**: `call.test.ts` scripts a capped reply for `callJson` and for `callText` and
asserts one `dm.call.truncated` line each, with no `dm.call.invalid-json` line.

**Acceptance Scenarios**:

1. **Given** a `callJson` attempt whose usage is `truncated` and whose reply fails to parse,
   **When** it settles, **Then** the log line is `dm.call.truncated` with `parse: "invalid-json"`,
   and the ledger outcome stays `truncated`.
2. **Given** a capped `callJson` reply that parses and fails the schema, **When** it settles,
   **Then** the line is `dm.call.truncated` with `parse: "schema-mismatch"`.
3. **Given** a capped `callJson` reply that parses and passes, **When** it settles, **Then** the
   outcome is `ok` and no line is logged, as today.
4. **Given** a capped `callText` reply, **When** it settles, **Then** one `dm.call.truncated` line
   is logged with `parse: null`, head and tail, and the outcome stays `truncated`.

---

### User Story 3 - The playtest watch counts truncation and attempt-1 failures (Priority: P1)

The operator watching a playtest sees `truncated=<n>` beside `invalid-json=<n>` on each turn. The
spend line also shows the attempt-1 failure rate and each purpose's largest output.

**Why this priority**: card AC #3 (TASK-0197). AC #2 is measured from this line at CP-7.

**Independent Test**: run `watch.mjs --input <fixture> --state <tmp>` on a hand-built input with
one truncated call and read the output.

**Acceptance Scenarios**:

1. **Given** a finished turn with one `truncated` call, **When** the watch reports it, **Then**
   the calls line reads `... invalid-json=0 truncated=1 schema=0 ...`.
2. **Given** a session ledger, **When** the watch prints the spend line, **Then** the next line
   reads `attempt-1 failures <f>/<n> = <p>%`. It counts outcomes `invalid-json`,
   `schema-mismatch` and `truncated` on `callAttempt` 1, over all attempt-1 calls.
3. **Given** a session ledger, **Then** the line after it lists `out-max <purpose>=<tokens>` for
   each purpose seen.

---

### User Story 4 - The TASK-0203 shapes stay fixed as regression fixtures (Priority: P2)

Every reply shape from the TASK-0203 vm-104 log stays a named fixture. The fixtures run through
the prompt-only path and through the tool-call path.

**Why this priority**: card AC #4. Structured output must not regress what spec 086 fixed.

**Independent Test**: `schema-coercions.test.ts` reads the shared fixture module.
`ai.openai-compatible.test.ts` streams each S1 to S4 shape as tool-call arguments, and `callJson`
returns `ok` on attempt 1.

**Acceptance Scenarios**:

1. **Given** fixtures S1 to S8 with the fence and empty-think wrappers, **When** the prompt-only
   tests run, **Then** S1 to S4 settle `ok` on attempt 1 and S5 to S8 settle `schema-mismatch`
   and re-ask, as today.
2. **Given** S1 to S4 streamed as tool-call argument deltas, **When** `callJson` parses them,
   **Then** each settles `ok` on attempt 1.
3. **Given** a tool-call argument stream cut at the cap (`finish_reason: "length"`), **When**
   attempt 1 settles, **Then** the outcome is `truncated` and the log line is `dm.call.truncated`.

---

### User Story 5 - The interpret cap fits its measured output (Priority: P2)

`dm.interpret` attempt 1 fits its output cap, so a turn does not pay a full retry (TASK-0256).

**Why this priority**: the two truncated interpret calls in the B2 run were the slowest turns.

**Independent Test**: `call-schemas.test.ts` pins the `dm.interpret` value in
`PURPOSE_MAX_TOKENS` and asserts `.env.example` carries the same value.

**Acceptance Scenarios**:

1. **Given** the measured `dm.interpret` output tokens (OQ-3), **When** the cap is set, **Then**
   it is at least 1.5 times the largest measured attempt-1 output. The card records the
   measurement and the value.

### Edge Cases

- **Provider rejects the mode.** A provider that refuses `tools` or `response_format` returns a
  4xx. The adapter maps it to error kind `config`, as today. The turn fails loudly. The operator
  sets the purpose's `structured` to the other mode or removes it. There is no silent downgrade.
- **Tool mode, model writes content instead.** A router may ignore `tool_choice` and stream
  `delta.content`. In tool mode the adapter holds content deltas. At stream end it yields the held
  content as one `text` event only when no tool-call argument arrived. Mixed output never joins.
- **Tool mode, more than one tool call.** Only `tool_calls` index 0 is read. Other indexes drop.
- **Think blocks.** `reasoning_content` deltas are ignored, as today. `stripThink` still runs.
- **Finish reasons.** `content_filter` stays a `refusal` error. `length` stays `truncated`.
  `tool_calls` and `stop` both count as a completion signal.
- **Repair re-ask.** Attempt 2 sends the same schema. Its prompt text is unchanged.
- **Normalizers.** `normalizeAudit`, `normalizeChronicle` and `normalizeDirector` still run on the
  parsed JSON before Zod, in every mode.
- **Unrepresentable schema parts.** `.refine` and `.superRefine` checks drop from the sent schema.
  Zod still enforces them after parse.
- **Script mode (`DM_FAKE_SCRIPT`).** The scripted adapter ignores the output spec. Scripts replay
  unchanged.
- **Other gateway callers.** The library answerer and `playtest.audit` send no output spec. Their
  requests are unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `PurposeConfig` MUST accept an optional `structured` key with values `"tool"` or
  `"json-schema"`. Config validation MUST reject any other value. Absent means prompt-only.
- **FR-002**: `ChatRequest` MUST accept an optional `output: {name, schema}`, where `schema` is a
  JSON Schema object. The gateway MUST pass it to the provider only when the purpose sets
  `structured`, together with the mode.
- **FR-003**: The `openai-compatible` adapter MUST send, in tool mode, one function tool with the
  schema as `parameters` and a `tool_choice` naming it. In json-schema mode it MUST send
  `response_format: {type: "json_schema", json_schema: {name, schema, strict: false}}`.
- **FR-004**: In tool mode the adapter MUST yield each tool-call argument fragment (index 0) as a
  `text` event. It MUST hold content deltas per the edge case above.
- **FR-005**: `ChatEvent` MUST keep its shape. Structured modes add no event type.
- **FR-006**: `callJson` MUST send `output` on every attempt. `name` is the purpose with `.`
  replaced by `_`. `schema` is `z.toJSONSchema(req.schema, {target: "draft-7", io: "input",
  unrepresentable: "any"})` without its `$schema` key, computed once per schema object.
- **FR-007**: Zod MUST still validate every parsed reply. The repair re-ask, the normalizers and
  the ledger outcomes MUST keep their behavior.
- **FR-008**: `callJson` MUST log a truncated failed attempt as `dm.call.truncated`, with a
  `parse` field naming the parse kind. It MUST log an uncapped failed attempt as today.
- **FR-009**: `callText` MUST log a truncated attempt as `dm.call.truncated` with `parse: null`.
- **FR-010**: Boot MUST warn once, naming each configured `dm.*` purpose without `structured`,
  except `dm.narrate`.
- **FR-011**: `.env.example` MUST show `"structured": "tool"` on every `dm.*` purpose except
  `dm.narrate`, and its comment MUST explain both modes.
- **FR-012**: `watch.mjs` MUST print `truncated=<n>` on each turn, the attempt-1 failure rate and
  `out-max` per purpose. `SKILL.md` MUST tell the watcher to flag `truncated`.
- **FR-013**: The TASK-0203 shapes S1 to S8 MUST live in one test fixture module, read by
  `schema-coercions.test.ts` and by the tool-mode adapter test.
- **FR-014**: The `dm.interpret` cap in `PURPOSE_MAX_TOKENS` and `.env.example` MUST be set from
  measured output, per OQ-3.
- **FR-015**: A test MUST convert every schema a DM `callJson` site passes, without a throw.

### Constitution-Driven Requirements *(mandatory)*

- **CR-007** (IX. UX quality bar): A structured purpose MUST NOT add a model call to a turn. Each
  avoided repair re-ask removes one call from the turn's critical path. The R1 playtest (CP-7)
  measures the result against the IX budgets through TASK-0278.
- **CR-010** (XII. Self-hostable): Every model call MUST still pass through the one gateway seam.
  Each JSON purpose MUST send its declared schema in structured mode. The mode MUST be a config
  entry, so a local model behind the `openai-compatible` kind needs no code change.

Rows I to VIII, X and XI do not apply: no Intent, event, view, mechanic, narration rule, content,
citation or rulebook text changes. `dm.narrate` prose stays a text call; its slot schema arrives
with TASK-0272 (see plan "Seams").

### Key Entities

- **Purpose structured mode**: the `structured` key on an `AI_PURPOSES` entry. Operator-owned.
- **Output spec**: `{name, schema}` on one chat request. `callJson` builds it from the call's Zod
  schema.
- **Shape fixture**: one TASK-0203 reply shape, with its id (S1 to S8), purpose, wrapper and
  expected outcome.

## Card acceptance criteria map

| Card AC | Met by |
|---|---|
| #1 Each DM purpose declares its output schema in config | US1, FR-001, FR-006, FR-010, FR-011, FR-015 (reading: OQ-1) |
| #2 Attempt-1 schema failures under 1% over the R1 playtest | US1, US5; measured by US3 at CP-7 (hosted; counting rule: OQ-2) |
| #3 The playtest watch shows a `truncated=` count | US3, FR-012 |
| #4 The vm-104 log shapes from TASK-0203 are regression fixtures | US4, FR-013 |

Absorbed cards: TASK-0203 AC #2 is card AC #2. TASK-0256 AC #1 is US5. TASK-0256 AC #2 is part of
card AC #2. TASK-0197 AC #1 is card AC #3.

## Success Criteria *(mandatory)*

- **SC-001**: Over the R1 hosted playtest, attempt-1 failures (`invalid-json`, `schema-mismatch`
  and `truncated` on call attempt 1) are under 1% of attempt-1 calls.
- **SC-002**: No `dm.interpret` attempt 1 is `truncated` over 10 or more hosted turns.
- **SC-003**: Every `pnpm ci:check` step is green with no paid model call.

## Assumptions

- The hosted route (9router, `cc/` model ids) translates OpenAI-style `tools` and `tool_choice`
  to the upstream model. This is unproven until CP-7. The mode is per purpose, so the operator can
  switch it without a code change (OQ-4).
- The vm-104 `.env` is the operator's. Setting `structured` there for the R1 run is a CP-7 prep
  step at C9, not part of this PR.
- No migration. `dm_model_calls` already has the `truncated` outcome (migration 0008).

## Open questions

- **OQ-1 — Where does a purpose "declare its output schema in config"?** (a) The env entry
  declares the mode (`structured`). The call site declares the Zod schema, as today. A test proves
  every DM JSON site's schema converts. (b) A code registry maps each purpose to one schema.
  (b) breaks on `dm.narrate`, which serves two outputs: narrate's prose (`callText`) and the talk
  turn's `ReactOutput` (`callJson`). It also creates an import cycle (`purposes.ts` and the node
  files). **Recommend (a).**
- **OQ-2 — Does `truncated` count toward AC #2's "schema failures"?** (a) Yes: any attempt-1
  outcome that costs a re-ask counts (`invalid-json`, `schema-mismatch`, `truncated`). (b) Only
  the two parse kinds. **Recommend (a).** It matches spec 086 OQ-1, and a truncated attempt costs
  the same retry.
- **OQ-3 — Where does the interpret cap measurement come from?** The B2 ledger rows sit in the
  vm-104 database. Reading them needs a vm-104 command at C9. (a) The orchestrator runs one
  read-only query at C9 before the Phase 3 dispatch: max and p95 `output_tokens` for
  `dm.interpret` attempt 1 in session `bb4952dc`, truncated rows included. The cap is
  `max(4000, ceil(1.5 × max))`, rounded up to the next 1000. (b) If the read is refused, set 8000
  with a `ponytail:` comment naming the CP-7 `out-max` line as the upgrade path. **Recommend (a).**
- **OQ-4 — Which mode does `.env.example` show?** (a) `tool`: the form most widely translated by
  OpenAI-compatible routers and local servers. (b) `json-schema`. **Recommend (a)**, with
  `json-schema` documented as the alternative. The vm-104 value is chosen at CP-7 prep. If the
  route rejects tools, switch to `json-schema` there.
- **OQ-5 — Should the ledger record the mode per call?** It needs a migration. The mode is
  constant per purpose for a run, so the env records it. **Recommend no.** Revisit trigger: a run
  that mixes modes on one purpose.
- **OQ-6 — The B2 run's one true `dm.audit` parse failure has no fixture.** Its shape sits in a
  vm-104 `dm.call.invalid-json` log line (session `bb4952dc`, seq 109-113). (a) Read it in the
  same C9 read as OQ-3 and add it as fixture S9. (b) Ship S1 to S8 only; AC #4 names the
  TASK-0203 shapes, which S1 to S8 cover. **Recommend (a) when the C9 read happens, else (b).**
