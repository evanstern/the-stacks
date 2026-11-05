# Feature Specification: Schema outcome and safe coercions

**Feature Branch**: `task-0203-schema-outcome`

**Created**: 2026-11-05

**Status**: Draft

**Input**: TASK-0203. "dm.audit and dm.chronicle parse on their first attempt, so a turn does not
pay for a repair re-ask." Evidence: runbook B playtest run 1 (2026-11-03, session `729a6c5c`,
37 turns): 17 of 224 calls failed attempt 1, all recovered on attempt 2. Root cause (card notes,
vm-104 log lines `dm.call.invalid-json`, read 2026-11-04 with the operator's go): every reply
parsed as JSON and failed the Zod schema, and `callJson` labels that `invalid-json`. Runbook:
`docs/design/m3-runbook-b2-playtest-fixes.md`, merge spine #3, lane note for 0203.

Authored against the Spec Kit templates in `.specify/templates/`. The spec dir was claimed with a
stub, so the skills' branch and directory steps do not apply. `speckit-clarify` was skipped: the
card's root-cause note, the runbook lane note and the code settle every choice below except the
four open questions at the end, which each carry a stated default.

## Evidence limits

- The vm-104 log lines hold a 200-character head and tail per reply. They are not in the repo.
  The card note names each shape (the field, the wrong value, the wrapper). The test fixtures are
  rebuilt from that note and marked "rebuilt from the TASK-0203 root-cause note".
- Wrappers seen: a whole-reply code fence, and an empty `<think></think>` before the object.
  The current parser already strips both. The fixtures use them so the tests cover the real path.

## The 17 attempt-1 failures (card root-cause note)

| # | Purpose | Shape | Count | This spec |
|---|---|---|---|---|
| S1 | dm.audit | issue `kind` outside the enum (`turn-mode`) | 8 | coerce to `other` |
| S2 | dm.audit | issue `detail` over 300 characters | 3 | clip to 300 |
| S3 | dm.audit | issue `actor: null` | 1 | drop the null key |
| S4 | dm.chronicle | `sourceActionIds` entries as numbers | 1 | coerce to strings |
| S5 | dm.companion | `comment` key missing | 1 | prompt states the key; still re-asks |
| S6 | dm.director | `goalNote` missing (written inside `pacing`) | 1 | prompt states the key; still re-asks |
| S7 | dm.interpret | NPC attack step missing `attack` | 1 of 2 | prompt states the field; still re-asks |
| S8 | dm.interpret | check `stakes.severe: null` | 1 of 2 | prompt states the field; still re-asks |

Card AC #4 names exactly S1 to S4 as safe. S5 to S8 change meaning if coerced: a missing comment,
goal note or attack name has no safe default. They keep the repair re-ask.

## Scope

In scope: the ledger outcome (AC #3), the four coercions (AC #4), and one prompt sentence per
producing prompt for the fields that failed (audit, director, companion, interpret). Each prompt
change bumps that prompt's version.

Out of scope: any coercion beyond S1 to S4; the chronicle prompt; the repair re-ask text; the
`invalid-output` failure record shape; the parser's prose and fence handling (AC #1, merged in
2f9b45c4).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A schema mismatch is named for what it is (Priority: P1)

An operator reading the model-call ledger or the playtest watcher sees `schema-mismatch` when a
reply parsed as JSON and failed its schema, and `invalid-json` only when the reply did not parse.

**Why this priority**: run 1 spent a vm-104 read to learn that 17 "invalid-json" calls were valid
JSON. The ledger must tell the two apart without a log read.

**Independent Test**: `call.test.ts` and `model-calls.integration.test.ts` pass with the new cases.

**Acceptance Scenarios**:

1. **Given** a reply that parses and fails the schema, **When** `callJson` settles attempt 1,
   **Then** the record's outcome is `schema-mismatch` and the re-ask is sent.
2. **Given** a reply that does not parse, **When** attempt 1 settles, **Then** the outcome is
   `invalid-json`, as before.
3. **Given** a capped reply (usage `truncated`), **When** it fails either way, **Then** the
   outcome is `truncated`, as before.
4. **Given** a `schema-mismatch` record, **When** the ledger inserts it, **Then** the
   `dm_model_calls_outcome_valid` CHECK accepts it and the row reads back with that outcome.

---

### User Story 2 - The four safe shapes pass on attempt 1 (Priority: P1)

A turn whose audit reply invents a kind, overruns the detail cap or writes a null actor, or whose
chronicle reply writes numeric ids, parses on attempt 1 and pays for no re-ask.

**Why this priority**: S1 to S4 are 13 of the 17 failures, 12 of them on dm.audit.

**Independent Test**: `schema-coercions.test.ts` passes one test per shape S1 to S4: one call,
outcome `ok`, the coerced value in the result.

**Acceptance Scenarios**:

1. **Given** an audit issue with `kind: "turn-mode"`, **When** it parses, **Then** the issue has
   kind `other` and its detail starts `[turn-mode] `.
2. **Given** an audit issue detail of 450 characters, **When** it parses, **Then** the detail is
   cut at the last space at or before 300 characters.
3. **Given** an audit issue with `actor: null`, **When** it parses, **Then** the issue has no
   `actor` key.
4. **Given** a chronicle entry with `sourceActionIds: [12, 14]`, **When** it parses, **Then** the
   ids are `["12", "14"]`.

---

### User Story 3 - Every other mismatch still re-asks (Priority: P1)

A reply with any other schema failure gets the repair re-ask, now recorded as `schema-mismatch`.

**Why this priority**: a coercion with no safe default would ship a wrong turn.

**Independent Test**: `schema-coercions.test.ts` passes one test per shape S5 to S8: attempt 1
records `schema-mismatch`, attempt 2 is sent.

**Acceptance Scenarios**:

1. **Given** S5, S6, S7 or S8, **When** attempt 1 settles, **Then** the outcome is
   `schema-mismatch` and a second attempt runs.
2. **Given** an audit `kind` that is not a string (a number, an object), **When** it parses,
   **Then** it is not coerced and the reply re-asks.

---

### User Story 4 - The prompts state what failed (Priority: P2)

Each producing prompt states the enum or required field its model got wrong in run 1.

**Why this priority**: coercion covers S1 to S4 only. S5 to S8 need the model to write the field.

**Independent Test**: each prompt test pins the new version and the new sentence.

**Acceptance Scenarios**:

1. **Given** the audit prompt, **Then** it says the five kinds are the only kinds, an off-turn act
   is `invented-mechanics`, `detail` is at most 300 characters, and `actor` is omitted, never null.
2. **Given** the director prompt, **Then** it says `goalNote` is a top-level key, always written,
   never inside `pacing`.
3. **Given** the companion prompt, **Then** it says every key is written, with `comment` null
   when there is no comment.
4. **Given** the interpret prompt, **Then** it says every attack step names `attack`, monster
   turns included, and an ability check writes `stakes.cost` and `stakes.severe` as text.

### Edge Cases

- An unknown kind becomes `other`, which never blocks. TASK-0214's code check still blocks an
  off-turn turn action before the `dm.audit` call, so S1 loses no block that code holds. OQ-2
  asks whether to keep this.
- The prefix can push a detail over 300 characters. The prefix is added first, then the clip.
- An empty detail (`""`) is not coerced. `min(1)` still fails and re-asks.
- An `actor` over 80 characters is not coerced.
- A chronicle id that is a non-integer number, a negative number or an object is not coerced.
- The normalizer never throws on any JSON value. A non-object passes through unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `callJson` MUST settle an attempt that parsed and failed its schema as
  `schema-mismatch`, one that did not parse as `invalid-json`, and either one with usage
  `truncated` as `truncated`.
- **FR-002**: Each failed attempt MUST log one line: `dm.call.schema-mismatch` for a schema
  failure, `dm.call.invalid-json` for a parse failure, with the existing payload.
- **FR-003**: `ModelCallRecord.outcome`, the `dm_model_calls_outcome_valid` CHECK, the debug API
  types and the playtest watcher MUST accept and show `schema-mismatch`.
- **FR-004**: The CHECK change MUST ship as a generated drizzle migration. Nobody hand-edits
  `apps/server/drizzle/meta/_journal.json`.
- **FR-005**: The `dm.audit` call MUST pass a normalizer that maps a string `kind` outside
  `AUDIT_ISSUE_KINDS` to `other`, with the original kind as a `[kind] ` detail prefix.
- **FR-006**: The same normalizer MUST clip a string `detail` over 300 characters at the last
  space at or before 300, or hard at 300 when it has no space.
- **FR-007**: The same normalizer MUST remove an `actor` key whose value is `null`.
- **FR-008**: The `dm.chronicle` call MUST pass a normalizer that maps each non-negative integer in
  `sourceActionIds` to its decimal string.
- **FR-009**: No other field MAY be coerced. Every other schema failure MUST keep the repair
  re-ask.
- **FR-010**: The audit, director, companion and interpret prompts MUST each gain the sentence in
  US4 and bump `PROMPT_VERSION` to one past the version on `main` when its phase starts.
- **FR-011**: One test per shape S1 to S8 MUST run through `callJson` with the scripted fake
  gateway, using the S-row's wrapper (fence or empty think block).

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): the ledger outcome MUST be readable through the existing debug
  route an agent already uses. No human-only view.
- **CR-004** (VI. 5e engine boundary): no coercion MAY touch a number the engine owns. The
  chronicle ids are references, not mechanics.

### Key Entities

- **Schema mismatch**: a reply that parsed as JSON and failed its Zod schema.
- **Safe coercion**: a rewrite of one named field that keeps the reply's meaning (S1 to S4 only).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a hosted run of 10 or more turns, no dm.audit or dm.chronicle attempt 1 settles
  as `invalid-json` or `schema-mismatch` (card AC #2, read per OQ-1).
- **SC-002**: The ledger stores and reads back `schema-mismatch` on a fresh stack (card AC #3).
- **SC-003**: Tests for S1 to S4 pass with one call each. Tests for S5 to S8 pass with two (AC #4).

## Assumptions

- Prompt versions on `main` at authoring (`8128fb3a`): audit-v12, director-v7, companion-v7,
  interpret-v13, chronicle-v4. TASK-0240 bumps audit first. Phase 3 takes one past what `main`
  holds then.
- `RefIdSchema` (`^[a-z0-9][a-z0-9_.:-]{0,63}$`) accepts a decimal string.
- `other` is not in `BLOCKING_LLM_KINDS`.

## Card acceptance criteria map

| Card AC | Covered by | When it ticks |
|---|---|---|
| #1 Cause identified and recorded | card note, 2f9b45c4 and the 2026-11-04 root cause | already ticked |
| #2 Hosted 10+ turns, no attempt-1 invalid-json on audit/chronicle | SC-001, OQ-1 | **Hosted.** At runbook B2's playtest, not at merge |
| #3 Ledger records schema mismatch as its own outcome, with a test | US1, FR-001 to FR-004, SC-002 | At merge |
| #4 Safe coercions accept the run 1 shapes on attempt 1, a test per shape | US2, US3, FR-005 to FR-009, FR-011, SC-003 | At merge |

## Open questions (each with a stated default)

- **OQ-1 — Reading AC #2.** After this change a schema failure no longer counts as `invalid-json`,
  so AC #2 could pass by the rename alone. **Default (a):** AC #2 counts both `invalid-json` and
  `schema-mismatch` on attempt 1. (b) Count `invalid-json` only, as the card's words say.
- **OQ-2 — An unknown kind does not block.** `other` never blocks, so a coerced `turn-mode` issue
  no longer refuses the prose. **Default (a):** keep the card's rule. TASK-0214's code check holds
  the off-turn block, and the `[turn-mode]` prefix keeps the evidence. (b) Map an unknown kind to
  `invented-mechanics`, which blocks.
- **OQ-3 — Numeric chronicle ids.** A number is likely a transcript `[seq]`, not an action id, so
  the stringified ref may point at no action. **Default (a):** stringify, as the card says.
  (b) Stringify, then drop any id that no transcript entry carries as its `actionId`.
- **OQ-4 — Log event name.** **Default (a):** two events, `dm.call.invalid-json` and
  `dm.call.schema-mismatch`. (b) Keep one `dm.call.invalid-json` event with an `outcome` field.
