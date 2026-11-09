# Feature Specification: Fact sheet, code-rendered fact rows and State line

**Feature Branch**: `task-0245-fact-sheet`
**Created**: 2026-11-09
**Status**: Draft
**Input**: TASK-0245 (rewritten by replan-2026-11). "Each narrate job receives a fact sheet: the
restate target, the facts the ledger settled, the speakers and the slot names. Code renders every
fact row and the State line from engine state. The model writes no digit and no state. The
four-part reply is a template: restate, describe and optional ask are model slots; State is code."
Runbook: `docs/design/r1-fast-table-runbook.md`, lane LN, merge spine #9, CP-5 ruling F4.
Parent epic TASK-0258. Constitution 3.0.0 VII and IX. Decision P-12.

Authored against `.specify/templates/`. The spec dir was claimed with a stub, so the skills' branch
and directory steps do not apply. `speckit-clarify` was skipped. The card, the operator rulings of
2026-11-04 (State line is code-rendered; restate is a narrator paraphrase; no design round), the
constitution and the code settle every choice except the open questions at the end. Each open
question carries a recommendation, and the plan assumes it.

## Evidence

- **Runbook B playtest run 1** (2026-11-03, session 729a6c5c), finding 6, seq 15-20. Tamsin's party
  action "We move along the timber posts toward the reed camp." became a clarify. The reply
  described the scene, then asked "creep or move straight?". The move never happened, and the reply
  stated no new state. The operator proposed the structure: restate the command, describe, optional
  questions, then the new state.
- **Same run, finding 49** (seq 336-349). Attempt 1 narrating Pell's death was refused for a
  missing death word (claim `omission`). Attempts 2-3 showed off-turn actors. The fallback shipped
  "Pell Marsh is dead. Pell Marsh joins them." A code life-state row would have carried the death.
- **R1 baseline playtest** (2026-11-09). Three fallback lines "Tamsin Vale cannot do that here"
  (seq 123, 278, 322), all TASK-0302 refusals. The line names no reason and no next move.
- **Code today.** `NarrationFacts` (`dm/facts.ts`) feeds `dm.narrate-v21` as text entries. The
  model writes the whole reply, including the clarify question it is told to copy. Code appends
  dice and damage lines only (`renderDiceLines`). `renderChangeLine` returns null for life state,
  conditions, spell slots and assists. No code writes a State line.
- **Planner seam.** Spec 097 (TASK-0267, branch `task-0267-planner`) emits `PlanFact[]`. Its
  contract §4 and OQ-10 name this spec's row type `FactRow`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every reply to an action has one shape (Priority: P1)

A player declares an action. The DM reply restates the action as an intention, describes the
world, optionally asks one question, lists the code-rendered fact rows, and ends on a State line
that names whose move it is.

**Why this priority**: the operator's structure (finding 6) and constitution VII. TASK-0272 builds
the leak and contradiction check on it.

**Independent Test**: `fact-sheet.test.ts` builds a sheet per decision-tree branch and asserts the
slot list, the rows and the exact State line. `narrate.test.ts` asserts template order.

**Acceptance Scenarios**:

1. **Given** an applied attack in turn mode, **When** narrate runs, **Then** the text is restate,
   describe, fact rows, then `State: Tamsin Vale's action is done. It is Snag's turn.`
2. **Given** a model reply with no slot tags, **When** narrate parses it, **Then** the whole reply
   fills `describe`, and code supplies the default restate. Play never blocks.
3. **Given** a model ask slot that ends on "What do you do?" or an either-or menu, **When** narrate
   validates it, **Then** code drops the ask slot and ships the rest.

---

### User Story 2 - Code renders every fact row and the State line (Priority: P1)

Every roll, damage, heal, life-state change, condition, death save, spell-slot spend, assist and
refusal renders as a code row. The State line is code. The model writes no digit and no state.

**Why this priority**: constitution VII ("Code MUST render every fact row"), decision-0021 extended.
Finding 49 shows a missing death word failing three attempts.

**Independent Test**: `fact-sheet.test.ts` asserts a row for every `FactChange` kind and for a
refused action, and that every digit in a shipped reply lies in a fact row or the State line.

**Acceptance Scenarios**:

1. **Given** a crossbow critical that kills Pell, **When** narrate runs, **Then** the rows include
   the roll lines, `Pell Marsh takes 4 piercing (4→0 HP)` and `Pell Marsh: conscious → dead`. The
   audit does not block prose that omits the death word.
2. **Given** a refused action (`STEP_ACTOR_MISMATCH`), **When** narrate runs, **Then** a row reads
   `Tamsin Vale: refused, the step named another character (STEP_ACTOR_MISMATCH)`, and the State
   line says the action did not happen.

---

### User Story 3 - A clarify reply asks, and says nothing happened (Priority: P1)

A clarify reply shows the interpret question verbatim in the ask slot. Its State line says nothing
has happened yet and names who must answer.

**Why this priority**: card AC #5. Finding 6 is the defect this card exists for.

**Independent Test**: `fact-sheet-replay.test.ts` replays run 1 seq 15-20 from a reconstructed
fixture through the narrate node with the fake gateway.

**Acceptance Scenarios**:

1. **Given** run 1 seq 15-20 (party action, clarify "Do you creep along the timbers quietly, or just
   move straight for the camp?", no steps, free mode), **When** narrate runs, **Then** the text holds
   that question as its own block, no fact row, and
   `State: Nothing has happened yet. The party's action waits on Tamsin Vale's answer. Anyone else may act.`
2. **Given** the same beat and a model reply with its own `[ask]`, **When** narrate composes,
   **Then** code discards the model ask and keeps the interpret question.

---

### User Story 4 - The State line never asks "What do you do?" (Priority: P1)

Every State line names whose move it is: the active combatant in turn mode, "anyone" in free play,
the DM after a scene ends. No State line holds a question mark.

**Why this priority**: card AC #6. The TASK-0204 ban stands.

**Independent Test**: a table-driven test in `fact-sheet.test.ts` covers every decision-tree branch
and asserts no State line holds `?`.

**Acceptance Scenarios**:

1. **Given** any branch, **When** the State line renders, **Then** it starts with `State: `, holds
   no `?`, and names a combatant, "Anyone" or "the DM".

---

### Edge Cases

- **Several actions in one beat.** One restate slot covers every restate target. The State line
  carries one status clause per action, in beat order.
- **Party-scope action.** The subject is "The party's action". The answerer of a clarify is the
  declarer's character: the party member whose controller is the action's actor.
- **Restate digits.** "I shoot goblin 3" restates with no digit. The code default restate passes the
  text through `spellDigits`.
- **NPC turn, settling, scene start.** No action was declared, so there is no restate slot and no
  status clause. The State line carries the floor clause only.
- **Action awaiting the DM** (human DM seat). `buildNarrationFacts` already skips it. It has no
  restate target and no status clause.
- **Held party action** (TASK-0244). It is restated. Its status clause names the companion it waits
  for.
- **Talk reply.** No restate and no State line. An `escalate` that starts a fight gets a State line
  (OQ-4).
- **Empty model slots.** Describe falls back to the code `factualSummary` sentences. Restate falls
  back to the code default. The reply still ships.
- **Scene end.** The floor clause names the DM; no turn clause.

## Requirements *(mandatory)*

### Functional Requirements

**Fact sheet (AC #2)**

- **FR-001**: Every narrate job MUST build one `FactSheet` (`contracts/fact-sheet.md`) before its
  model call: restate targets, fact rows, speakers, slot names, the code-settled ask, the State line
  and the settled-facts record.
- **FR-002**: The sheet's input MUST be settled engine events and their projections: the ledger rows
  the gate appended, `action.resolved` outcomes, gate and engine refusals in resolve's submissions,
  the projections after resolve, and the actor snapshot. No model output decides a row or the State
  line.
- **FR-003**: The narrate prompt MUST read the sheet only. It renders the settled facts as today's
  fact entries, plus the restate targets, the speakers and the allowed slots.

**Fact rows (AC #3)**

- **FR-004**: `renderChangeLine` MUST return a row for every `FactChange` kind: `hp`, `life-state`,
  `condition`, `death-saves`, `spell-slot`, `assist`. The `hp` and `death-saves` formats stay.
- **FR-005**: A refused action MUST render one refusal row with a plain reason and its code.
- **FR-006**: The model MUST write no digit. Every digit in a shipped reply MUST lie in a fact row or
  the State line.

**State line (AC #1, #6)**

- **FR-007**: Code MUST render the State line from the sheet: status clauses per action, then a
  floor clause, per the decision tree in contract §4.
- **FR-008**: No State line may hold `?`. Each MUST name whose move it is.

**Slots and template (AC #4)**

- **FR-009**: The narrator MUST fill only the `restate`, `describe` and `ask` slots, as tagged text
  (`[restate]`, `[describe]`, `[ask]`). An untagged reply MUST fill `describe` only.
- **FR-010**: Code MUST compose the reply in template order: restate, describe, ask, fact rows, State
  line. A blank line separates blocks. An empty block is omitted.
- **FR-011**: Code MUST validate model slots with no model call. It replaces a restate that holds a
  digit with the code default. It drops an ask that does not end in `?`, ends on "What do you do?",
  or offers an either-or menu.
- **FR-012**: When the sheet holds a code-settled ask (a clarify), code MUST fill the ask slot with
  it verbatim and discard any model ask.

**Clarify (AC #5)**

- **FR-013**: A clarify reply MUST show the interpret question in the ask slot. Its State line MUST
  say nothing has happened yet and name the answerer.

**Existing loop (kept until TASK-0272)**

- **FR-014**: The audit MUST check the model slots (`prose` = restate, describe and ask joined). Its
  agency checks MUST skip the restate block. Claim `omission` MUST NOT block, because the life-state
  row carries the death.
- **FR-015**: The fallback MUST ship the template: code restate, `factualSummary` as describe (no
  clarify and no refusal sentence), the code ask, the rows and the State line.

### Constitution-Driven Requirements *(mandatory)*

- **CR-004** (VI. Engine owns the numbers): every number in a reply comes from a ledger row the
  engine wrote. The sheet reads rows; it never rolls.
- **CR-005** (VII. Narration around facts): code renders every fact row and the State line. The
  model writes only the three prose slots from the sheet.
- **CR-007** (IX. UX quality bar): no new model call. Rows and the State line render in-process in
  milliseconds. The transcript renders the reply's line breaks. No modal.

### Key Entities

- **FactSheet**: the narrator's whole input for one job. Home `apps/server/src/dm/fact-sheet.ts`.
- **FactRow**: one code-rendered line (`kind`, `text`). Name agreed with spec 097 OQ-10.
- **RestateTarget**: one declared action: subject, text and resolution.
- **Speaker**: a present NPC the narrator may voice, with its settled line when one exists.
- **NarrationSlots**: the model's `restate`, `describe` and `ask` text after validation.

## Card acceptance criteria map

| AC | Text (short) | Requirements | Proof |
|---|---|---|---|
| #1 | Decision tree: slots and State per trigger, resolution, mode | FR-007, contract §4 | `fact-sheet.test.ts` branch table |
| #2 | Sheet schema; every narrate job gets one | FR-001 to FR-003 | `narrate.test.ts` asserts `output.sheet`; contract §2 |
| #3 | Code renders every row and State; model writes no digit or state | FR-004 to FR-006 | `fact-sheet.test.ts` row per kind; digit property |
| #4 | Narrator fills only three slots; template order | FR-009 to FR-012 | `narrate.test.ts` order and validation cases |
| #5 | Clarify: question in ask, State "nothing happened"; run 1 seq 15-20 | FR-012, FR-013 | `fact-sheet-replay.test.ts` |
| #6 | No "What do you do?" in State; names whose move; test per branch | FR-008 | `fact-sheet.test.ts` branch table, no-`?` property |

TASK-0215 AC #2 (retargeted by F3): the sheet's settled facts carry `involuntary`. TASK-0215 adds a
startle trigger there and its prompt line. The sheet shape does not change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every decision-tree branch has a test asserting its exact State line (AC #6).
- **SC-002**: The run 1 seq 15-20 replay ships the question in the ask block and "Nothing has happened
  yet" in State (AC #5).
- **SC-003**: Across the narrate tests, no shipped slot block holds a digit, and every `FactChange`
  kind renders a row.
- **SC-004**: `pnpm ci:check` green. No new model call per turn. No new runtime dependency.

## Assumptions

- Spec 093 (TASK-0273) is merged. `dm.narrate` stays a text purpose (spec 093 D6).
- The audit loop, claim gate and fallback stay until TASK-0272. This card changes only what they
  check and ship.
- The web transcript renders narration as one paragraph today. It gains line-break rendering.
- No spatial event exists yet. TASK-0271 adds a `position` row kind (OQ-9).

## Open questions

- **OQ-1 — Slot transport: tagged text or a JSON slot schema?** (a) Tagged text through `callText`
  (`[restate]`, `[describe]`, `[ask]`). An untagged reply is `describe`, so the 35 fake scripts keep
  working. It streams plainly for TASK-0298, and spec 093 kept `dm.narrate` unstructured. (b)
  `callJson` with a Zod slot schema. Every scripted narrate reply must become JSON, and a streamed
  slot needs an incremental JSON reader. **Recommend (a).** TASK-0272 may switch to (b) if its leak
  check needs it.
- **OQ-2 — Home of `FactSheet` and `FactRow`.** (a) `apps/server/src/dm/fact-sheet.ts`. Every
  consumer is server code: narrate, audit, fallback, talk turn, playtest auditor. The server is the
  only package that will import both `@the-stacks/planner` and `@the-stacks/session-model`, so the
  later `PlanFact` mapping sits beside the sheet. (b) `packages/session-model`. It is shared with the
  web, but its catalog and events are serial hotspots, and it may not import the planner.
  **Recommend (a).** Revisit trigger: TASK-0247 renders fact rows as their own stream rows in the
  web. Then move `FactRow` and the row renderer to `session-model`.
- **OQ-3 — Fact rows ride the narration text.** VII says rows render before narration and never wait
  on it. Today the rows ship in the narration event, after the model call. The ledger panel shows
  the engine rows at resolve time already. **Recommend:** keep rows in the narration text here (no
  catalog change). Add an AC to TASK-0247 (MUD stream): render rows from the ledger at resolve time
  and drop them from the narration text.
- **OQ-4 — State line on talk replies.** A talk post is speech, not a declared action, and replies are
  frequent. **Recommend:** no State line on a talk `reply`. An `escalate` that starts a fight gets
  one.
- **OQ-5 — What happens to `NarrationFacts`?** The audit, fallback and playtest auditor read it.
  TASK-0272 retires the first two. **Recommend:** it survives as `FactSheet.settled`. TASK-0272 slims
  it when its last prose-policing consumer goes.
- **OQ-6 — Claim `omission` in the audit.** It blocks prose that omits a death. The life-state row now
  carries the death in code. **Recommend:** filter `omission` out in `deterministicChecks`, as
  `withholdRefusedInputs` already does. Finding 49's attempt 1 would have passed.
- **OQ-7 — Refusal wording.** **Recommend:** a code table of plain reasons for the codes seen in play
  (contract §3.2), the code in brackets, and "the rules do not allow it" for any other code.
- **OQ-8 — `apps/web/app/play/ledger-format.ts` sits in the runbook footprint.** No AC needs it. The
  ledger panel renders engine rows already. The advantage dice display is TASK-0243.
  **Recommend:** leave it untouched. The orchestrator drops it from the 0245 footprint.
- **OQ-9 — Position rows.** Constitution VII lists positions. No spatial event exists yet.
  **Recommend:** a card note on TASK-0271: add a `position` `FactRow` kind beside its spatial events.
- **OQ-10 — Spec 093's seam note says TASK-0272 gives narrate a slot schema.** Card AC #4 puts the
  slots here. **Recommend:** this card owns the slots (tagged text). TASK-0272 owns the leak and
  contradiction check and any structured-mode switch. The orchestrator notes it on TASK-0272.
