# Feature Specification: Narration as prose slots; retire the audit loop

**Feature Branch**: `task-0272-prose-slots`
**Created**: 2026-11-11
**Status**: Draft
**Board**: TASK-0272 (parent epic TASK-0258; source `docs/design/replan-2026-11/board-rework-map.md` N-07)
**Runbook**: `docs/design/r1-fast-table-runbook.md` (lane LN, merge spine #14, checkpoint C-AUD)

## Upstream artifacts this spec was authored against

| Artifact | Commit |
|---|---|
| `specs/098-fact-sheet/plan.md` and `contracts/fact-sheet.md` (§5 slots, §6 `PlanFact` seam) | `a370041c` |
| `specs/093-structured-output/plan.md` | `beae54aa` |
| `specs/097-planner/plan.md` and `contracts/planner.md` (§4 `PlanFact`) | `a34d5d39` |
| `specs/102-gate-intents/plan.md` (`intent.recorded` carries `facts: PlanFact[]`) | `86d425b6` |
| Branch base (`origin/main`) | `0b3c378b` |

Spec 098 OQ-10 ruled the split: TASK-0245 owns the prose slots and the code-composed reply.
This spec retires the audit loop, adds the code leak and contradiction checks, and renders
`PlanFact` as `why` rows (spec 098 contract §6). It does not re-specify slots or composition.

`speckit-clarify` was skipped: the card, spec 098 §5–§6 and constitution VII settle the
behaviour. The judgment calls that remain are listed under Open questions.

## Summary

Today a turn's narration runs `narrate`, then an `audit` node: deterministic checks, a
`dm.audit` model call, and up to three `dm.narrate` attempts. When every attempt fails, an
in-fiction fallback summary ships and a DM journal flag is written. The B2 playtest passed 71%
of combat narrations on the first attempt and shipped 3 fallbacks in 17.

After this feature a turn makes exactly one `dm.narrate` call. Code then runs two checks on the
slots: a **leak check** (unrevealed ids and DM-only text) and a **contradiction check** (digits,
dice words with no roll, life state against the settled facts). A failed check never re-asks the
model and never blocks play. It appends a correction row. A leak hit also drops the leaking
sentence before the reply ships, because a player must never receive hidden information
(constitution III). The `dm.audit` purpose, `dm/claims.ts`, `dm/fallback.ts` and the audit
prompt are deleted.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One narration call per turn (Priority: P1)

A player declares an action. The DM reply arrives after one `dm.narrate` call. No reply waits on
a second model call to approve it.

**Independent test**: run a turn under the fake gateway with prose that names an off-turn act.
The ledger holds one `dm.narrate` call and no `dm.audit` call. The reply ships.

**Acceptance scenarios**:

1. **Given** a resolved beat, **When** narrate returns slots, **Then** the reply ships with no
   further model call.
2. **Given** the narrate call fails (error, truncated, aborted), **When** the turn finishes,
   **Then** the reply ships as the code default restate, the fact rows and the State line, with
   an empty describe slot. No fallback summary ships.
3. **Given** a talk post triggers a react call, **When** the react text fails a check, **Then**
   no second react call runs.

### User Story 2 - Numbers come only from rows (Priority: P1)

**Independent test**: a fact-sheet test feeds slots with digits. Every digit in the composed reply
sits in a fact row or the State line.

**Acceptance scenarios**:

1. **Given** a describe or ask slot holds a digit, **When** the slots parse, **Then** code drops
   that sentence and records a contradiction hit.
2. **Given** an Intent turn whose `intent.recorded` row carries `PlanFact`s, **When** the sheet
   builds, **Then** each fact renders as a `why` row per spec 098 contract §6.

### User Story 3 - A wrong line is corrected, never blocking (Priority: P1)

**Acceptance scenarios**:

1. **Given** prose says a goblin dies and the settled facts leave it standing, **When** the check
   runs, **Then** the reply ships and a public correction row follows it, quoting the fact row.
2. **Given** prose names an absent NPC or a fogged zone, **When** the check runs, **Then** the
   leaking sentence is dropped before ship and a `dm`-visibility correction row records it.
3. **Given** any check hit, **When** the turn ends, **Then** the turn job completes and the next
   turn can queue.

### User Story 4 - The one-way door is evidenced (Priority: P2)

The orchestrator replays the B2 session's shipped narrations through the new checks and attaches
the counts to the PR before the operator approves the merge (C-AUD).

**Independent test**: the replay script reads a small fixture export and prints the count table.

### Edge cases

- Nothing to narrate (`nothingToNarrate`): no call, no check, no correction.
- A reclaim after the narration landed ships nothing and runs no check (today's runner rule).
- Every sentence of describe leaks: describe ships empty; restate, rows and State still ship.
- A correction row is itself code-rendered text and is never checked.

## Requirements *(mandatory)*

- **FR-001**: A turn MUST make at most one `dm.narrate` call. No code path re-calls narrate or
  react because of a check result.
- **FR-002**: The `dm.audit` purpose, its prompt and its node MUST be removed.
- **FR-003**: `dm/claims.ts` and `dm/fallback.ts` MUST be deleted. Callers that survive use the
  replacements named in plan.md.
- **FR-004**: Code MUST drop any describe or ask sentence that holds a digit before ship. Restate
  keeps spec 098's rule (a digit falls back to the code default).
- **FR-005**: The leak check MUST compare the slots against: actors with `presence: "absent"` in
  the S1 snapshot, zones with `revealed: false`, DM-only seed text (`dmOnlySeedText`), and each
  roll's `unmetSuccess` text.
- **FR-006**: The contradiction check MUST compare the slots against the sheet's rows, the
  settled facts and the S1 snapshot: dice language with no roll row, a death or down word on an
  actor whose settled life state is otherwise, and a digit (FR-004).
- **FR-007**: A leak hit MUST drop the leaking sentence before ship and append a `dm`-visibility
  correction row.
- **FR-008**: A contradiction hit MUST ship the reply and append a public correction row that
  quotes the contradicted fact row or State line.
- **FR-009**: A check hit MUST NOT fail, hold or retry the turn job.
- **FR-010**: The fact sheet MUST render each `PlanFact` of the beat's `intent.recorded` rows as a
  `why` row per spec 098 contract §6. `unserved` renders no row.
- **FR-011**: The turn job result MUST record the check outcome (hits per check, corrected flag,
  shipped prose hash) in place of `AuditRecord`.
- **FR-012**: The repo MUST carry a replay script that reads a B2 export and prints the C-AUD
  count table (plan.md "C-AUD replay").

### Key entities

- **CheckIssue**: `{ check: "leak" | "contradiction"; kind; actorIds; matched; detail }`.
- **CheckRecord**: `{ leak: CheckIssue[]; contradiction: CheckIssue[]; corrected: boolean;
  shippedProseSha256 }`. Stored at `jobs.result.check`.
- **Correction row**: a `talk` proposal from the AI DM seat, text `Correction: …`.
- **`why` row**: `FactRow` kind `why`, rendered from one `PlanFact`.

## Card acceptance criteria map

| Card AC | Met by | Proof |
|---|---|---|
| #1 No narration path regenerates for audit reasons. | FR-001, FR-002, FR-009 | Turn and talk tests under the fake gateway assert one call; `narrateAttempt` and the react `ask` take no `prior`. |
| #2 Narration writes no digits; fact rows carry every number. | FR-004, FR-006, FR-010 | Fact-sheet test: every digit in `composeReply` output lies in a row or the State line (constitution VII gate). |
| #3 The R1 playtest shows zero fallback lines. | FR-003 (no fallback exists) | **Hosted AC.** Ticked at CP-7 from the R1 playtest log (runbook "Hosted ACs"). The card stays In Progress after merge until CP-7. |
| #4 `dm/claims.ts` lexical gate is deleted. | FR-003 | File absent; `git grep claims.js` empty. |

## Success criteria

- **SC-001**: Per narrated turn, `dm.narrate` calls = 1 and `dm.audit` calls = 0 (ledger).
- **SC-002**: The C-AUD replay table is attached to the PR before merge.
- **SC-003**: No turn job of the R1 playtest ships a fallback summary (hosted, CP-7).

## Out of scope

- Streaming narration to clients (TASK-0298).
- Rendering fact rows before narration as a separate row. Rows still ride the narration row, as
  spec 098 composes them. TASK-0298 owns the split.
- New prose slots or composition changes (TASK-0245, shipped).

## Open questions

- **OQ-1 — The plan gate's reason check (spec 058) calls `checkClaims`.** Deleting `claims.ts`
  (AC #4) deletes that check and its `REASON_CONTRADICTS_STATE` refusal. **Recommend:** delete
  it. The planner path (TASK-0269) writes no model reasons into the engine, and constitution VII
  forbids post-hoc lexical gating as the primary defence. Name it in the PR body so the operator
  rules on it at C-AUD.
- **OQ-2 — Where does a correction row go?** The runbook footprint expected a catalog change.
  **Recommend:** no catalog change. Reuse the `talk` proposal from the AI DM seat (as
  `submitFailureNotice` does): public for a contradiction, `dm` for a leak. This also drops
  TASK-0272 from the `catalog.ts` hotspot.
- **OQ-3 — A leak hit ships or withholds?** The card says a failed check "never blocks play".
  **Recommend:** drop the leaking sentence before ship, then append the `dm` correction. Dropping
  a sentence does not block play, and shipping a leak breaks constitution III.
- **OQ-4 — Node name.** **Recommend:** rename node `audit` to `check` in `NodeName`, runner and
  context. Old `jobs.result` rows keep their `audit` field; the debug view reads either.
- **OQ-5 — `dm/audit-words.ts` survivors** (`EITHER_OR_END`, `STOCK_ENDING`, `hasCountClaim`,
  `DEATH_WORDS`, `UNCONSCIOUS_WORDS`, `DICE_LANGUAGE`). **Recommend:** keep only those, and
  rename the file `dm/narration-words.ts`. One name per concept: there is no audit left.
- **OQ-6 — `namedActorIds` (resolve's arrival hold, spec 089) lives in `claims.ts`.**
  **Recommend:** reimplement it in `snapshot/aliases.ts` on `nameTerms` with a whole-word,
  unique-alias match. The leak check uses the same function.
- **OQ-7 — The `PlanFact` type import.** Contract §6 says `fact-sheet.ts` imports `PlanFact`.
  **Recommend:** derive it as `IntentRecorded["facts"][number]` from `@the-stacks/session-model`.
  No new workspace dependency for `apps/server`.
- **OQ-8 — Source of a beat's `PlanFact`s.** **Recommend:** narrate reads the `intent.recorded`
  rows inside the turn's seq window (the rows the beat covers plus `resolve.appendedRows`) and
  concatenates their `facts` in seq order. The implementer confirms the window in `enqueue.ts`.
- **OQ-9 — The B2 replay cannot re-check rejected attempts.** `AuditRecord` stores only prose
  hashes, and `dm_model_calls` stores no text. **Recommend:** accept it. The replay checks the
  shipped narration of every passed turn, and reports fallback turns as not replayable with the
  old audit's issue kinds beside them.
