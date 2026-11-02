# Feature Specification: DM maxTokens headroom and a truncated call outcome

**Feature Branch**: `task-0192-dm-maxtokens-headroom`

**Created**: 2026-11-02

**Status**: Draft

**Input**: TASK-0192. "The default and documented dm.* maxTokens leave room for hidden thinking on
cc/ routes, so a hard turn never fails because thinking spent the whole output budget." Evidence:
alpha run 3 (`docs/playtests/2026-11-01-two-browser-alpha-run-3.md`, findings 11 and 12, session
`e8e8326d`). `dm.interpret` at maxTokens 1200 failed 8 times in combat. Each failed call returned
exactly 1200 output tokens and no JSON. Raising vm-104's value to 4000 fixed it at once.

`speckit-specify` ran as authoring guidance only: the spec dir was already claimed with a stub, so
its branch and directory steps were skipped. `speckit-clarify` was skipped: the card, the run 3 log
and the code settle every choice below.

## Background: what happens today

1. Each `dm.*` purpose in `AI_PURPOSES` may carry `maxTokens`. The gateway sends it to the
   provider as the output cap. On a cc/ route behind 9router, hidden thinking counts against that
   cap, so a hard prompt can spend the whole cap before any visible JSON.
2. `.env.example` suggests 600 (director), 800 (interpret, adjudicate), 500 (narrate), 300
   (audit), 600 (chronicle) and 400 (companion). `PURPOSE_MAX_TOKENS` in code holds the same
   numbers and feeds the playtest cost estimate. All of them would fail as run 3 did.
3. A capped reply is empty or cut off, so it fails to parse. The ledger (`dm_model_calls`) records
   it as `invalid-json`, the same as a model that wrote bad JSON. Run 3's operator had to read token
   counts to see the real cause.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A hard turn has room to think (Priority: P1)

An operator configures a table from `.env.example` or the vm-104 runbook. A combat turn whose
prompt makes the model think hard still returns its JSON, because the cap leaves thinking headroom.

**Why this priority**: run 3's blocker (card AC #1, TASK-0181 AC #1 cause).

**Independent Test**: read `.env.example` and `docs/ops/dev-vm-104.md`. Every `dm.*` purpose has a
maxTokens of at least 4000, and the text states that hidden thinking counts against the cap.

**Acceptance Scenarios**:

1. **Given** the `.env.example` DM `AI_PURPOSES` line, **When** an operator copies it, **Then**
   every `dm.*` entry carries `maxTokens` 4000 and the comment above it gives the reason.
2. **Given** the vm-104 runbook, **When** the operator reads its model budget section, **Then** it
   names the same value and the same reason, and says the cap is a ceiling, not a spend.

---

### User Story 2 - A capped call is named as truncated (Priority: P1)

An operator reads the debug calls ledger after a failed turn. A call whose output hit maxTokens
shows outcome `truncated`, not `invalid-json`, so the cause is plain without reading token counts.

**Why this priority**: card AC #2 and #3, and the runbook merge condition.

**Independent Test**: a fake-gateway test configures a purpose with maxTokens N, scripts a reply of
exactly N output tokens with no JSON, and finds `truncated` in the recorded calls.

**Acceptance Scenarios**:

1. **Given** a JSON call whose reply reaches maxTokens and fails to parse, **When** the attempt
   ends, **Then** its ledger row has outcome `truncated`.
2. **Given** a JSON call whose reply fails to parse below maxTokens, **When** the attempt ends,
   **Then** its row still has outcome `invalid-json`.
3. **Given** a provider that reports `finish_reason: "length"`, **When** the reply fails to parse,
   **Then** the row has outcome `truncated`, even if the reported token count is below the cap.
4. **Given** a prose call (narrate) whose reply reaches maxTokens, **When** the attempt ends,
   **Then** its row has outcome `truncated`, and the text still goes on to the audit as today.

### Edge Cases

- A purpose with no `maxTokens`: only the provider's `finish_reason: "length"` can mark it
  truncated. No token comparison runs.
- A JSON reply that reaches the cap but still parses and validates: outcome `ok`. The value was
  used whole.
- A truncated first attempt: the repair re-ask still runs, as for `invalid-json`. Its own outcome
  is judged afresh.
- A gateway error or an abort: outcome `error` or `aborted` as today. Truncation never overrides
  them.
- Older rows: unchanged. The ledger check accepts the old four values and `truncated`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `.env.example` MUST give each of the seven `dm.*` purposes `maxTokens` 4000, with a
  comment stating that hidden thinking on routed models counts against the cap (card AC #1).
- **FR-002**: `docs/ops/dev-vm-104.md` MUST state the same values and reason in a model budget
  section (card AC #1). It changes the runbook text only, not vm-104's env.
- **FR-003**: The code default per purpose (`PURPOSE_MAX_TOKENS`) MUST match FR-001, so the
  playtest cost estimate uses the documented cap.
- **FR-004**: The gateway's usage record MUST say whether the call was truncated: the provider
  reported `finish_reason: "length"`, or the purpose has `maxTokens` and output tokens reached it.
- **FR-005**: A DM model attempt MUST record outcome `truncated` when the call was truncated and
  its reply was not accepted (JSON calls), or when the call was truncated (prose calls). Otherwise
  the outcome rules stay as today (card AC #2).
- **FR-006**: The `dm_model_calls` outcome check MUST accept `truncated` beside `ok`,
  `invalid-json`, `error` and `aborted`, through a generated migration.
- **FR-007**: The debug API's call shape and the web debug types MUST list `truncated` as an
  outcome value.
- **FR-008**: A test MUST drive the real gateway over the fake provider and assert `truncated` when
  output tokens equal maxTokens (card AC #3, runbook merge condition).

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent reads the truncated outcome through the same debug
  calls route (`GET /dm/sessions/:id/calls`) the operator's page reads.
- **CR-004** (VI. 5e engine boundary): No mechanic changes. The feature touches only model-call
  bookkeeping and configuration.
- **CR-006** (IX. Self-hostable): Caps stay operator configuration in `AI_PURPOSES`. No provider or
  model name enters source (decision-0007).

### Key Entities

- **Usage record**: one per gateway call. Gains a truncated flag.
- **Model call row** (`dm_model_calls`): one per DM attempt. Its outcome gains `truncated`.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 `.env.example` and the vm-104 runbook give dm.* maxTokens with headroom and the reason | FR-001, FR-002, FR-003, User Story 1 |
| #2 A call whose output hits maxTokens is recorded as truncated, distinct from invalid-json | FR-004 to FR-007, User Story 2 |
| #3 A test covers the truncation outcome with the fake gateway | FR-008 |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A combat interpret turn configured from the documented defaults no longer fails from
  a spent output budget. Checked in runbook A's scenario (TASK-0195): the ledger shows no
  `truncated` row for hard interpret turns.
- **SC-002**: 100% of DM attempts whose output reached the cap and could not be used are recorded
  as `truncated`, and none below the cap are.
- **SC-003**: An operator names the cause of a capped failure from the calls ledger alone, with no
  token arithmetic.

## Assumptions

- 4000 is the value proven on vm-104 in run 3. One value for all seven purposes is the boring
  choice: the cap is a ceiling, and a call pays only for the tokens it uses.
- The playtest cost estimate's upper bound rises with the caps. That is honest: it is a ceiling.
- `playtest.audit` (700) is not a `dm.*` purpose and stays out of scope.
- vm-104's env is already 4000 for `dm.interpret`. Any further vm-104 change is checkpoint C9, not
  this task.
- The repair re-ask after a truncated attempt stays. Whether to skip it is an open question for the
  orchestrator to card.
