# Feature Specification: DM calls survive a leading think block

**Feature Branch**: `task-0181-think-block`
**Created**: 2026-10-29
**Status**: Draft
**Board task**: TASK-0181 (blocker, m-3)
**Input**: Two-browser alpha run 2 (`docs/playtests/2026-10-28-two-browser-alpha.md`, items 3, 5 and 7).
DM model calls on hosted dev return `<think></think>` before the JSON. The parse rejects it, the
re-ask doubles turn time and cost, and some turns fail outright.

**Clarify**: `speckit-clarify` was skipped. The open choices are rulings, not ambiguities in the
card, so they are listed as OQ-1 to OQ-4 below, each with a default.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A turn survives a reply that starts with a think block (Priority: P1)

Players at a hosted-dev table commit an action. The DM's model reply starts with a think block and
then holds valid JSON. The turn proceeds on the first attempt, with no re-ask.

**Why this priority**: run 2 ended on this. The 00:59 director attempt was `<think></think>` plus
valid JSON, so a parse-side fix alone would have saved that turn.

**Independent Test**: feed `callJson` a scripted reply of `<think></think>` plus valid JSON, and
one of `<think>some reasoning</think>` plus valid JSON. Both return `ok` on attempt 1.

**Acceptance Scenarios**:

1. **Given** a reply `<think></think>{...valid...}`, **When** the DM parses it, **Then** the
   attempt is `ok` and no re-ask is sent.
2. **Given** a reply `<think>reasoning text</think>\n{...valid...}`, **When** the DM parses it,
   **Then** the attempt is `ok`.
3. **Given** a narration reply that starts with a think block, **When** the DM returns the prose,
   **Then** players never see the think block.

### User Story 2 - The cause is known and the source is addressed (Priority: P1)

The operator knows why hosted dev emits think blocks and why some attempts return only
`<think></think>` after spending the whole output cap. The operator decides what changes at the
source.

**Why this priority**: a think-only reply carries no JSON. Stripping cannot save it. Three of four
interpret attempts at 00:50–00:53 were think-only, so AC #4 needs the source addressed too.

**Independent Test**: `research.md` names the cause with evidence and confidence. The probe
(tasks.md Phase 3) records the raw router stream for one call.

**Acceptance Scenarios**:

1. **Given** the repo's code and config, **When** the spec author investigates, **Then**
   `research.md` records the best-supported cause with confidence.
2. **Given** the operator's go, **When** the orchestrator runs the probe, **Then** the result is
   recorded in `evidence/probe.md` and the card.

### User Story 3 - A hosted-dev turn after deploy shows no invalid-json attempts (Priority: P2)

After the fix deploys, one hosted-dev turn completes. Its model calls in the debug view show no
`invalid-json` outcome.

**Independent Test**: tasks.md Phase 5, orchestrator-run under the operator's go.

### Edge Cases

- A think block with no closing tag (the cap cut the reply mid-thinking): left as is. The parse
  fails as before and the re-ask runs.
- A reply that is only `<think></think>`: the stripped text is empty. The parse fails with an
  issue that names the think-only reply, so the record reads clearly.
- Whitespace or newlines before, inside or after the block: tolerated.
- Two think blocks in a row before the JSON: both are stripped.
- `<think>` inside a JSON string value later in the reply: untouched. Only a leading block is
  stripped.
- A fenced JSON body after the think block: the fence strip still applies after the think strip.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The DM's JSON parse MUST remove every leading `<think>…</think>` block, and the
  whitespace around it, before the code-fence strip and the JSON parse.
- **FR-002**: The DM's prose call (narrate) MUST remove the same leading blocks from the text it
  returns.
- **FR-003**: Text after the leading blocks MUST pass through unchanged. An unclosed `<think>` is
  not stripped.
- **FR-004**: The failure record excerpt and the re-ask MUST keep the raw model text, think block
  included, so the debug view shows what the model sent.
- **FR-005**: A think-only reply MUST fail with an issue string that says the reply held only a
  think block.
- **FR-006**: `dm_model_calls` gains no text column (OQ-2 default). The ledger keeps its rule:
  no prompt or completion text.
- **FR-007**: The cause is recorded in `research.md` and on the card (card AC #1). The source
  change is decided by OQ-1 and the probe.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): the fix lives in the shared call helper that every DM node
  uses. It needs no human step at play time.
- **CR-004** (VI. 5e engine boundary): no number moves. The fix changes only which text reaches
  the JSON parse.

II, III, IV, V, VII and VIII do not apply: no content entity, no new state, no event, no library
claim, no generated asset and no rulebook content.

### Key Entities

- **Model attempt**: one model reply inside a DM call. Its raw text keeps the think block. Its
  parsed text does not.

### Card acceptance criteria map

| Card AC | Where it is met |
|---|---|
| #1 cause identified and recorded on the card | `research.md` R1; Phase 3 probe confirms; orchestrator records it on the card |
| #2 parse a think-prefixed reply, or stop the source; the spec decides | OQ-1 default (a): both. Phase 1 (parse), Phase 3 (source, operator's go) |
| #3 a test covers a leading empty and non-empty think block | Phase 1 tests T001–T003; Phase 2 mutation guard |
| #4 a hosted-dev turn after deploy shows no invalid-json attempts | Phase 5 [orchestrator] |

## Open Questions

Each has a recommended default (a). The tasks implement (a).

- **OQ-1: Strip at parse, stop the source, or both?**
  (a) **Both.** Strip leading think blocks in `call.ts` now. Address the source after the probe
  (Phase 3): send a thinking-off request field if 9router honors one, else the operator changes
  the 9router route or raises `maxTokens` in vm-104's `.env`. Stripping saves think-plus-JSON
  replies. Only the source fix saves think-only replies, and AC #4 needs both.
  (b) Strip only. Smallest diff. Think-only replies keep failing, so AC #4 can fail.
  (c) Source only. Depends on vm-103/vm-104 changes outside the repo. Any router change that
  brings the tags back breaks every turn again.
- **OQ-2: Should think content land in `dm_model_calls`?**
  (a) **No.** The ledger holds no completion text by contract (specs/037 data-model, ai-gateway
  FR-011). The raw think block already shows in the failure excerpt in `jobs.result`.
  (b) Add an integer `think_chars` column (one migration). It shows thinking per attempt
  without text.
  (c) Store the think text. Rejected: it breaks the no-completion-text rule.
- **OQ-3: Where in the call path does the strip belong?**
  (a) **`dm/pipeline/call.ts`**, in `parseAgainst` and `callText`. Pure function, DM-only, raw
  text kept for excerpts. The library answerer and the playtest auditor also stream from the same
  router and are not covered. The orchestrator cards them if the probe shows the tags there.
  (b) The `openai-compatible` adapter. Covers every caller. Needs a streaming buffer until
  `</think>` closes, and the excerpt loses the raw text.
  (c) The gateway. Same reach as (b) and it breaks the gateway's pass-through contract.
- **OQ-4: Should the adapter surface `finish_reason: "length"`?**
  (a) **No, not in this task.** 033 ruling 3 refused finish-reason passthrough. The ledger's
  `outputTokens` equal to the cap already shows truncation.
  (b) Pass it through as a usage field. A follow-up card if the operator wants it.

## Frozen-contract impact

None. `docs/wiki/ws-protocol.md` frame shapes, `specs/029-proposal-gate/contracts/` and
`specs/030-play-route/contracts/proposal-seam.md` are untouched. The 031 DM contract
`contracts/node-seam.md` "Model calls" step 3 is amended additively: strip leading think blocks
before the fence strip.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reply with a leading think block and valid JSON is accepted on attempt 1, in tests
  and on hosted dev.
- **SC-002**: One hosted-dev turn after deploy has zero `invalid-json` attempts.
- **SC-003**: A hosted-dev turn returns to the clean-turn range seen in run 2: 10–21 s and
  $0.04–0.08, against 30–42 s and $0.13–0.16 for affected turns.

## Assumptions

- The router puts the think block in `delta.content` (research R1). The adapter reads no other
  field, so no other path exists.
- Tests use the fake gateway. No paid model call runs in this task. The probe and the hosted
  check run only under the operator's go.
