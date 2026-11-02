# Feature Specification: Stakes before dice — outcome bands and pre-declared consequences

**Feature Branch**: `task-0127-stakes-before-dice`

**Created**: 2026-11-02

**Status**: Draft. Spec only (M3 runbook A side lane). Runbook B builds it after TASK-0113 merges.
Open questions OQ-1 and OQ-2 carry a recommended default (a). This spec, plan.md and tasks.md are
written against each (a).

**Input**: TASK-0127. "Every check's consequences are fixed before the engine rolls, and narration
tells the outcome band it is handed instead of inventing a consequence afterwards."

`speckit-specify` ran as authoring guidance only. The spec dir was already claimed with a stub, so
its branch and directory steps were skipped. `speckit-clarify` was skipped: decision-0022 (D14)
and the operator rulings on the card settle the behaviour. The two open questions below are
placement calls the card leaves open; each has a default.

## Decision records and rules this card implements

- **decision-0022 (D14)** point 2 (stakes before dice), point 3 (no stakes, no roll; a retry with
  no new risk succeeds), point 6 (table-rules settings).
- **Operator ruling 2026-10-26** (card notes): "Yes, nat 20 = success nat 1 = failure". It applies
  to every d20 test the `check.roll` command resolves, as a table-rules flag, default ON.
- **decision-0017** ordering is the anti-cheat. This card applies it to consequences.
- **Constitution VI**: the engine owns every number. Margin and band are numbers, so the engine
  computes them.

## Order with neighbouring cards

1. **TASK-0113 lands first** (dependency on the card). It adds the involuntary-effects list to
   `NarrationFacts` and reserves the outcome-band field on each roll fact. This card fills that
   field. Where 0113's merged field name or type differs from this spec, the build follows 0113
   and the plan records the rename.
2. **TASK-0127 (this card)** declares stakes per band before the roll, computes margin and band,
   applies band effects, carries the band and the declared consequence of a non-success band to
   the narrator and the auditor, adds the table-rules settings and the free retry.
3. **TASK-0170 lands after** (it depends on this card). It makes the success-band text required,
   hands the applied outcome text for every band (success included) as settled fact, fails prose
   that does not deliver it (the claw-marks replay), and ties information checks to seed facts.
   This card leaves the success text optional and carries `consequence: null` on a success band,
   so 0170 extends one field instead of adding a second.
4. **Later consumers**: TASK-0128 reads the group-checks flag. TASK-0130 rewrites the fail-forward
   doctrine pairs and adds flavour intensity. TASK-0104 replaces the raw DC with a difficulty tier.
   None of them is in scope here.

## Background: what happens today

1. Interpret writes a `check` step with `dc`, `onSuccess` and `onFailure` effect lists. The step
   grammar tells the model to leave `onSuccess` empty for a narrative outcome. No text says what
   failure means.
2. The engine's `check.roll` returns `success` when total ≥ DC, else `failure`. A natural 20 or 1
   on a check has no effect.
3. Narrate sees only "roll: <reason> -> failure". It invents the consequence after the dice.
   Evidence: verify-20261026T183818Z seq 203–206, a failed grapple narrated as "Tamsin twists her
   arm free" (F6); seq 171–175, a failed toll offer whose consequence the narrator made up.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A check's stakes are fixed before the roll (Priority: P1)

A player's character attempts something uncertain. Before any die is rolled, the DM has written
what success, a near miss, a failure and a bad failure each mean. The engine rolls. The narration
tells the band that came up and the consequence written for it.

**Why this priority**: the card's outcome and AC #1, #2. It removes invented consequences.

**Independent Test**: a scripted DM turn over the greyhollow-ford seed. The interpret output holds
a check with stakes. Scripted dice give total 11 against DC 12. The facts carry band
`success-at-cost` and the declared cost text. The ledger shows the band.

**Acceptance Scenarios**:

1. **Given** interpret returns a check step with no failure consequence, **When** the reading is
   parsed, **Then** the schema rejects it.
2. **Given** an ability check with bands ON and total 10 against DC 12, **When** resolve runs it,
   **Then** the engine records margin −2 and band `success-at-cost`, and resolve applies the
   success effects followed by the cost effects.
3. **Given** an ability check with total 6 against DC 12, **When** resolve runs it, **Then** the
   band is `severe-failure`, and resolve applies the failure effects followed by the severe effects.
4. **Given** a saving throw with total 10 against DC 12, **When** resolve runs it, **Then** the band
   is `failure`: saves stay SRD-binary.
5. **Given** any resolved check, **When** narration facts are built, **Then** the roll fact carries
   the band, the margin and the declared consequence of a non-success band.

---

### User Story 2 - Table rules are visible settings with defaults (Priority: P1)

The operator's house rules are named settings, each with its default. A scene seed may override
any of them. A natural 20 succeeds and a natural 1 fails on any d20 test when that flag is ON.

**Why this priority**: AC #3, #4, #7. The rules move the project off pure SRD for checks; the
settings make that visible and reversible (D14 consequences).

**Independent Test**: engine tests with scripted dice, each flag on and off.

**Acceptance Scenarios**:

1. **Given** a seed with no `tableRules`, **When** it loads, **Then** outcome bands are ON, natural
   20 and 1 are ON, and group checks are OFF.
2. **Given** naturals ON and a natural 20 with total 15 against DC 25, **When** the engine resolves
   the check, **Then** the outcome is `success`.
3. **Given** naturals ON and a natural 1 with total 14 against DC 10, **When** the engine resolves
   the check, **Then** the outcome is `failure`.
4. **Given** naturals OFF, **When** the same rolls resolve, **Then** the outcome follows total ≥ DC.
5. **Given** bands OFF and total 10 against DC 12, **When** the engine resolves an ability check,
   **Then** the band is `failure` and no cost effect applies.

---

### User Story 3 - A retry with no new risk succeeds without a roll (Priority: P2)

A character failed to force a door. Nothing has changed, and nothing new is at risk. The player
tries again. The DM grants the success without a roll.

**Why this priority**: AC #5 and D14 point 3.

**Independent Test**: a resolve test with a failed check in the ledger and a second identical
check step that declares no new risk.

**Acceptance Scenarios**:

1. **Given** the current scene's ledger holds a failed ability check by Tamsin (Strength,
   Athletics), **When** a new step asks the same check of Tamsin with `newRisk: null`, **Then**
   resolve records an auto-success with no dice row and applies the success effects.
2. **Given** the same history, **When** the new step names a new risk, **Then** the engine rolls.
3. **Given** the earlier failure happened before the latest scene change, **When** the same check
   comes again, **Then** the engine rolls.

---

### User Story 4 - The auditor holds the prose to the declared band (Priority: P2)

Odo offers his holy symbol as toll and fails badly. The declared severe consequence is "Snag
spurns the toll and orders Tamsin dragged to the post". The narration has Snag pocket the symbol and call
for quiet instead. The auditor refuses it, and the narrator regenerates.

**Why this priority**: AC #6.

**Independent Test**: a captured-run replay of verify-20261026T183818Z seq 168–175 with a fake
gateway. The test declares the severe consequence above on the captured check (seq 171, 10 vs
DC 15, margin −5). The audit prompt carries the band and the consequence. A scripted `fail` verdict on the
captured seq 175 prose triggers a regenerate.

**Acceptance Scenarios**:

1. **Given** facts with band `severe-failure` and a declared consequence, **When** the audit prompt
   is built, **Then** it names the band and the consequence and states the delivery rule.
2. **Given** the captured seq 175 prose and a scripted audit `fail` with kind `ledger-mismatch`,
   **When** the audit node runs, **Then** the issue blocks and the narrator is asked again.
3. **Given** a band `success-at-cost`, **When** the prose pairs the actor with a failure word,
   **Then** the deterministic check refuses it.

---

### Edge Cases

- **Auto-fail**: a step with `autoFail` records band `failure` and margin null. Its stakes still
  need a failure consequence.
- **Free retry and auto-fail together**: auto-fail wins. A retry never turns a stated impossibility
  into a success.
- **Scene checks**: a step with `combatantId: null` is never a free retry.
- **Bands on a save**: a saving throw never gets `success-at-cost` or `severe-failure`, whatever
  the flag says.
- **Naturals with advantage**: the natural is the kept d20 face, as the engine records it today.
- **Natural 1 that would be severe**: band `severe-failure` when margin ≤ −5, else `failure`.
- **Natural 20 below the DC**: band `success`, margin unchanged (negative).
- **Old rows**: `check.resolved` rows written before this card have no `band` or `margin`. Every
  reader derives the band from `outcome` when `band` is absent.
- **Old checkpoints**: a paused plan saved before this card has check steps with no stakes. Resolve
  runs it with no consequence text; the band is still computed.
- **DM-only text in stakes**: stakes never go into a public row. Only the applied band's
  consequence reaches narrate, which already runs the claim and leak checks.
- **Human DM approval**: a paused `check.roll` proposal carries its table-rules flags, so the
  approved roll resolves with the flags in force when it was proposed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A `check` step MUST carry `stakes` with `success` (text or null), `cost` (text or
  null), `failure` (text, required) and `severe` (text or null). Each text is 1–200 characters.
- **FR-002**: An ability-check step MUST carry non-null `cost` and `severe` texts. A saving-throw
  step MAY carry them; resolve ignores them.
- **FR-003**: A `check` step MUST carry `onCost` and `onSevere` effect lists, at most 4 each,
  default empty.
- **FR-004**: A `check` step MUST carry `newRisk` (text or null, at most 200 characters).
- **FR-005**: The interpret and adjudicate prompts MUST tell the model: declare every band's
  consequence before the roll; use a `none` step when failure has no consequence; name `newRisk`
  on a retry only when something new is at stake.
- **FR-006**: The engine's `check.roll` command MUST accept `houseRules` with `outcomeBands` and
  `naturals` booleans, both default false (SRD behaviour).
- **FR-007**: The engine's `check.resolved` event MUST carry `margin` (total − DC, or null with no
  roll) and `band` (`success`, `success-at-cost`, `failure`, `severe-failure`). Both fields are
  optional on read so older rows parse.
- **FR-008**: With `outcomeBands` true on an ability check, the engine MUST map margin ≥ 0 to
  `success`, −1 to −2 to `success-at-cost`, −3 to −4 to `failure`, and ≤ −5 to `severe-failure`.
  `success-at-cost` carries outcome `success`. `severe-failure` carries outcome `failure`.
- **FR-009**: With `naturals` true, a natural 20 MUST give outcome and band `success`. A natural 1
  MUST give outcome `failure`, with band `severe-failure` at margin ≤ −5 and `failure` otherwise.
- **FR-010**: The engine's `check.roll` MUST accept `autoSuccess` (`{ reason }` or null). It
  records outcome and band `success`, no dice row, and null total, natural and margin. It is
  refused with `INVALID_COMMAND` when `autoFail` is also set.
- **FR-011**: A scene seed MUST accept an optional `tableRules` object with `outcomeBands`
  (default true), `naturals` (default true) and `groupChecks` (default false).
- **FR-012**: Resolve MUST pass the seed's `outcomeBands` and `naturals` as `houseRules` on every
  `check.roll` it submits.
- **FR-013**: Resolve MUST apply effects by band: `success` → `onSuccess`; `success-at-cost` →
  `onSuccess` then `onCost`; `failure` → `onFailure`; `severe-failure` → `onFailure` then
  `onSevere`.
- **FR-014**: Resolve MUST submit an ability-check step as `autoSuccess` when it is a free retry:
  the current scene's ledger holds a failed ability check with the same combatant, ability and
  skill; the step has a non-null combatant, `newRisk: null` and no `autoFail`. A saving throw is
  never a free retry.
- **FR-015**: Resolve MUST record each check submission's declared stakes in its checkpointed
  submission record, never in a public row.
- **FR-016**: Each narration roll fact MUST carry `band`, `margin` and `consequence`: the declared
  text for the applied band when it is `success-at-cost`, `failure` or `severe-failure`, else null.
  It MUST carry `autoSuccess` beside `autoFail`.
- **FR-017**: The narrate prompt MUST present the band and the consequence as decided fact and
  forbid any other consequence.
- **FR-018**: The audit prompt MUST carry the same band and consequence and flag prose that tells
  a different band or consequence as `ledger-mismatch`.
- **FR-019**: The deterministic fallback MUST name the band in its outcome sentence. It MUST add
  the consequence only when that text passes the existing claim check.
- **FR-020**: The plan gate MUST claim-check every stakes text and `newRisk` like a step reason,
  and MUST check the ids in `onCost` and `onSevere` like the other effect lists.
- **FR-021**: The play route's ledger MUST show the band label when the row carries one.

### Acceptance criteria mapping (card TASK-0127)

| Card AC | Requirements | Proving test |
|---|---|---|
| #1 consequence per band before the roll; schema rejects no failure consequence | FR-001–FR-005 | `interpret.test.ts` schema cases |
| #2 code computes margin and band; NarrationFacts carries the band | FR-007, FR-008, FR-016 | engine `attacks.test.ts`; `facts.test.ts` |
| #3 table-rules setting with defaults; each flag on and off | FR-011, FR-012 | `seed.test.ts`; engine tests; `resolve.integration.test.ts` |
| #4 natural 20 succeeds when its flag is on | FR-009 | engine `attacks.test.ts` |
| #5 retry with no new risk resolves without a roll | FR-010, FR-014 | `stakes.test.ts`; `resolve.integration.test.ts` |
| #6 auditor checks prose delivers the declared band, over a captured run | FR-016–FR-018 | `stakes-audit.test.ts` (captured seq 168–175) |
| #7 natural 1 fails when its flag is on | FR-009 | engine `attacks.test.ts` |

The group-checks flag has no behaviour in this card. Its AC #3 test covers the default and the
override. TASK-0128 adds the behaviour and its own on/off test.

### Key Entities

- **Stakes**: the declared consequence text per band on one check step. Written by interpret or
  adjudicate. Kept in the job checkpoint.
- **Outcome band**: `success`, `success-at-cost`, `failure` or `severe-failure`. Computed by the
  engine from total, DC, natural and the flags.
- **Table rules**: the house-rule flags with defaults, on the scene seed.
- **Roll fact** (`FactRoll`): gains `band`, `margin`, `consequence` and `autoSuccess`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of check steps that reach resolve carry a failure consequence.
- **SC-002**: In a fake-gateway replay of each captured check from the 2026-10-26 runs, the facts
  hand the narrator a band and, for every non-success band, a declared consequence.
- **SC-003**: Every flag has a test with the flag on and a test with it off (group checks: default
  and override).
- **SC-004**: A retry with no new risk adds zero dice rows to the ledger.
- **SC-005**: The captured seq 175 prose, replayed against a declared severe consequence, ships
  only after an audit regenerate or the fallback.

## Open questions (operator)

- **OQ-1 — Where table rules live.** (a) An optional `tableRules` object on the scene seed, with
  code defaults. The operator picks rules by picking the seed; tests override per seed. (b) A
  session event through the gate, so a human DM can change a rule mid-session: a new event type,
  proposal kind and slide-out. (c) Server env. **Default (a).** (b) can follow on its own card.
- **OQ-2 — What makes a retry.** (a) Code detects it: same combatant, kind, ability and skill as a
  failed check in the current scene. The model only says whether something new is at risk. (b) The
  model flags a retry itself. **Default (a)**: it is checkable in code, as D14 asks.

## Assumptions

- TASK-0113 has merged and reserved the band field on roll facts.
- Runbook A's TASK-0193 (narrate v7) and TASK-0194 (plan gate, resolve) have merged. Prompt
  versions bump one past whatever is on `main` at build time.
- The DC stays a model-chosen number until TASK-0104.
- No migration: band and margin ride the existing JSON payload; stakes ride `jobs.result`.
