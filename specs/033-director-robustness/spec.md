# Feature Specification: First Scene — director output survives real models; failed jobs keep their error detail

**Feature Branch**: `task-0102-director-robustness`

**Created**: 2026-10-26

**Status**: Draft

**Input**: Board card TASK-0102, M2 First Scene sweep, lane 5 amendment (operator ruling
2026-10-26, `docs/design/m2-first-scene-sweep-runbook.md`). It fixes code from TASK-0046
(`specs/031-dm-runtime`) and blocks TASK-0048's demo phase. Grounding: decision-0007 (no vendor
SDK), decision-0020 (no unplanned "for now"), TASK-0042 R8 (the engine owns every number).

**Evidence**: the TASK-0048 paid provider playtests, on the TASK-0048 branch under
`docs/design/m2-demo/`:

| Run | Directory | `dm.director` maxTokens | Failing turn | Director output tokens (attempt 1, attempt 2) | Job error |
|---|---|---|---|---|---|
| 2 | `provider-playtest-failed-2/` | 600 | 4th commit (`act-advance`, "follow the old timber posts into the reeds") | 600, 395 | `stopped at director: invalid-output` |
| 4 | `provider-playtest/` | 1500 | 3rd commit (`act-persuade`, "ask Wenna for the safe path") | 962, 280 | `stopped at director: invalid-output` |

Run 2's first attempt hit its cap and its JSON was truncated. Run 4's attempts were under the
cap and both still failed the schema. The schema issues are unknown: `callJson` builds them in
`detail.issues`, but the worker stores only the fixed string `stopped at <node>: <kind>`.

**Clarify**: skipped. The card, the runbook amendment and the dispatch settle every decision
this spec needs. The remaining choices have defaults recorded under Assumptions and in
`research.md`; none changes scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A failed turn says why it failed (Priority: P1)

The operator reads a failed turn job and sees which node failed, the gateway purpose, the
schema issues, and a bounded excerpt of each raw model output. No re-run is needed to diagnose
a schema failure.

**Why this priority**: every later story depends on it. Two paid runs failed with no usable
evidence. A third paid run without diagnostics would waste its spend the same way.

**Independent Test**: a scripted gateway returns two schema-invalid director outputs. The turn
job fails. Its row holds the failure record with the issues, the purpose and both excerpts.

**Acceptance Scenarios**:

1. **Given** a turn whose director returns schema-invalid JSON twice, **When** the worker
   finishes the job, **Then** `jobs.result.failure` holds the node, the error kind, the
   purpose, the issues and one bounded excerpt per attempt, and `jobs.error` still reads
   `stopped at director: invalid-output`.
2. **Given** a raw output longer than the excerpt bound, **When** the failure is stored,
   **Then** the excerpt keeps the head and the tail and names the elided character count.
3. **Given** any turn failure, **When** the worker logs `dm.turn.failed`, **Then** the log line
   carries no model output text.

---

### User Story 2 - The real failure is reproducible in a test (Priority: P1)

The orchestrator captures the real failing director output from one paid provider run and
commits it as a fixture. A test reproduces the failure from that fixture with no provider.

**Why this priority**: the fix must be driven by evidence, not by guesses. A committed fixture
makes the evidence durable and keeps the fix honest.

**Independent Test**: the fixture test runs offline. It shows that the strict v1 parse rejects
the captured output with the captured issues.

**Acceptance Scenarios**:

1. **Given** the Phase 1 diagnostics, **When** the orchestrator runs one provider playtest
   under an operator-approved ceiling and a turn fails, **Then** the failed job's failure
   record is copied into a committed fixture.
2. **Given** the fixture, **When** the reproduction test runs, **Then** the strict v1 parse
   reports the captured issue paths.

---

### User Story 3 - The scene plays past the old failure point (Priority: P1)

With real models through the gateway, the director yields output the pipeline accepts. A
provider-mode playtest of Greyhollow Ford passes the turn where runs 2 and 4 failed.

**Why this priority**: it is the card's outcome. The M2 demo cannot reach the scene's end
without it.

**Independent Test**: one operator-approved provider playtest completes the 4th committed move's
turn with no director `invalid-output`.

**Acceptance Scenarios**:

1. **Given** the fix, **When** the fixture's attempts are fed through the director's model call,
   **Then** the call succeeds, or the fix row in `contracts/director-output.md` names why the
   fixture cannot pass offline (a prompt-only fix).
2. **Given** the fix, **When** the orchestrator runs the verification playtest, **Then** no turn
   job fails at the director with `invalid-output`, and the run's committed moves pass the
   `act-advance` turn.

---

### User Story 4 - Nothing else regresses (Priority: P2)

Every existing dm test and the scripted Greyhollow Ford run stay green. The engine still owns
every number.

**Why this priority**: a looser parse or a new prompt can break the scripted fixtures. A
leniency rule must never touch an engine-owned number.

**Independent Test**: the full gate and the scripted CI playtest pass on the branch.

**Acceptance Scenarios**:

1. **Given** the changes, **When** `pnpm ci:check` and the database suites run, **Then** both
   pass.
2. **Given** the changes, **When** the scripted CI playtest runs, **Then** it passes.

### Edge Cases

- The capture run does not reproduce the failure (model output is not deterministic). The
  orchestrator stops at the ceiling and asks the operator; see FR-011.
- The capture run fails at a node other than the director. Its failure record is still
  captured and committed. The director fix still needs a director failure, so FR-011 applies.
- A raw output is longer than the excerpt bound. The fixture holds the elided excerpt. The
  reproduction test still works, because elision keeps the output invalid.
- The failure is a gateway error, not a schema failure. The failure record holds the gateway
  error kind; no excerpt exists.
- A reclaimed job fails. The failure record replaces only `outcome`, `calls` and `failure`; the
  checkpoint stays.
- A leniency rule would change a number. It is not allowed; the output stays invalid and the
  re-ask runs.

## Requirements *(mandatory)*

### Functional Requirements

**Diagnostics (AC #1)**

- **FR-001**: A failed turn job MUST store a failure record at `jobs.result.failure` with the
  failed node, the error kind, the error message and the error detail.
- **FR-002**: For `invalid-output`, the detail MUST hold the purpose, the prompt version, the
  schema issues, and one entry per attempt with the attempt number, the output token count,
  the character count and a bounded excerpt of the raw text.
- **FR-003**: An excerpt MUST be the whole text up to 8000 characters. A longer text MUST keep
  the first 6000 and the last 2000 characters around a marker that names the elided count.
- **FR-004**: `jobs.error` MUST keep the fixed string `stopped at <node>: <kind>`. The operator
  route serves it, and it never holds model text.
- **FR-005**: A failed turn job's `jobs.result` MUST also keep the last saved checkpoint and the
  model call records, as a completed job's does.
- **FR-006**: The `dm.turn.failed` log line MUST NOT carry any excerpt.
- **FR-007**: The tracker `advance` rule MUST report a readable issue ("advance must be a
  non-zero integer from -3 to 3") instead of "Invalid input".

**Capture (AC #2)**

- **FR-008**: The orchestrator MUST run the capture, not an implementer. It MUST run one
  provider playtest under an operator-approved spend ceiling with the TASK-0048 harness.
- **FR-009**: The captured failure record MUST be committed as a fixture under
  `apps/server/test/dm/fixtures/`, with the run id, commit, model, prompt version and maxTokens.
- **FR-010**: A test MUST reproduce the failure from the fixture with no provider.
- **FR-011**: When the capture run shows no director failure, the orchestrator MUST stop and
  ask the operator. It MUST NOT pick a fix without evidence.

**Fix (AC #3)**

- **FR-012**: The fix MUST be chosen by classifying the captured output against the cause
  catalog in `contracts/director-output.md`. The classification MUST be recorded in
  `evidence/classification.md` before the fix lands.
- **FR-013**: The strict `DirectorOutput` schema MUST NOT be loosened. Any leniency MUST live
  in a named pre-validation step that is tested rule by rule.
- **FR-014**: A leniency rule MUST NOT coerce, default, clamp or drop any number. It MUST NOT
  infer an id or a discriminant that carries a payload.
- **FR-015**: A prompt change MUST bump the director's prompt version.
- **FR-016**: A provider-mode playtest MUST pass the turn where runs 2 and 4 failed with no
  director `invalid-output`. The orchestrator runs it under an operator-approved ceiling.

**Regression (AC #4)**

- **FR-017**: Every existing dm test, the full gate and the scripted CI playtest MUST pass.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST be able to read a turn failure's diagnostics
  from the job row, the same record the operator reads.
- **CR-002** (II. Content contract): No new codex entity. The failure record and the fixture
  each have a TypeScript type and a documented shape (`contracts/`).
- **CR-003** (V. Citations): Not applicable. This feature draws no claim from the library.
- **CR-004** (VI. 5e engine boundary): No mechanics change. No leniency rule touches a number;
  the engine still owns every number (TASK-0042 R8).
- **CR-005** (VIII. Operator-owned content): The fixture holds model output about the shipped
  Greyhollow Ford seed only. The director prompt carries no library passage, so no book text
  can reach the fixture.

### Key Entities

- **Turn failure record**: `jobs.result.failure` on a failed turn job. Node, kind, message,
  detail. Defined in `contracts/failure-record.md`.
- **Attempt excerpt**: one per model attempt inside an `invalid-output` detail. Attempt number,
  output tokens, character count, bounded text.
- **Captured director fixture**: a committed JSON file holding one real failure record plus the
  run's provenance.
- **Normalization step**: the named pre-validation function that applies the allowed leniency
  rules to parsed director JSON before the strict schema runs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator diagnoses a director schema failure from the job row alone, with no
  re-run.
- **SC-002**: The verification playtest commits at least 4 moves and every turn job after them
  either completes or fails at a node other than the director with a stored failure record.
- **SC-003**: Zero leniency rules act on a numeric field (checked by a test over the rule
  list).
- **SC-004**: Paid spend for this task stays within the two operator-approved ceilings.

## Assumptions

- The failure record lives in `jobs.result` (jsonb). `jobs.error` (text) keeps its fixed
  string. No migration is needed: both columns exist and already accept these values.
- The operator route `GET /dm/sessions/:id/turns` keeps its shape. It now returns the call
  records of a failed turn, which hold no text. It does not return the failure record, because
  dm-api.md bars model text from that route. The operator reads the failure record from the
  database (`quickstart.md`).
- Side jobs (companion, chronicle) keep their current failure handling. The card scopes the
  record to turn jobs.
- `maxTokens` per purpose is operator configuration (`AI_PURPOSES`), not code. The verification
  run uses the operator's current setting; this spec raises no default.
- The TASK-0048 harness is not on `main`. The orchestrator runs capture and verification in a
  local composite worktree that merges this branch onto the TASK-0048 branch tip. Nothing in
  that worktree is pushed.
- No new dependency.
