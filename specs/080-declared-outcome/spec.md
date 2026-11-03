# Feature Specification: Declared outcome — success means the attempted task happens

**Feature Branch**: `task-0170-declared-outcome`

**Created**: 2026-11-02

**Status**: Draft. M3 runbook B, lane B1, spine #9. Builds after TASK-0127 (spec 070) merges.

**Input**: TASK-0170. "A check that comes from a player's action resolves to a definite outcome for
the task that player attempted, and the narrator receives that outcome as a fact. The narrator
describes the outcome; it never decides it."

`speckit-specify` ran as authoring guidance only. The spec dir was claimed with a stub, so its
branch and directory steps were skipped. `speckit-clarify` was skipped: the operator's 2026-10-28
rule on the card and spec 070 settle the behaviour. The open questions at the end are seed and scope
calls the card leaves open. Each has a default, and spec, plan and tasks are written against each
default.

## Operator rule this card implements

**2026-10-28 (card):** success means the attempted task happens. "I push the tree over" plus a
success means the tree falls. "I sneak past the guards" plus a success means the sneak works. "I look
for what made these claw marks" plus a success means the player learns what made them, taken from
the seed's own facts.

## Evidence

Two-browser alpha playtest 2026-10-28, run 1, item 2 (`docs/playtests/2026-10-28-two-browser-alpha.md`).
Tamsin investigated "what may have made these claw marks" and rolled 23 vs DC 12. The narration
described the marks in more detail and never named a creature. The success read as a failure. Run 1
was lost to a reboot: no ledger or prose capture exists (OQ-3).

Two defects sit upstream of the narrator:

1. The narrator gets the roll and no outcome for the attempt, so it improvises one.
2. Nothing in the `greyhollow-ford*` seeds names the creature behind the tracks. The ferry-house
   clue says "Small clawed footprints" and stops. Interpret never sees the beat's clues at all.
   Even a perfect narrator had no seed fact to deliver (OQ-2).

## What spec 070 (TASK-0127) already delivers, and what this card adds

Spec 070 is merged as a spec and builds right before this card. This card is a delta on its D1 step
contract, its D4 resolve seam and its D6 facts seam. It adds no second outcome field.

| Concern | Spec 070 | This card (delta) |
|---|---|---|
| Stakes per band | `stakes.success` nullable; `failure` required; `cost`, `severe` required on an ability check | `stakes.success` **required** on every check step |
| What a band text says | "the consequence" of the band | a **concrete outcome for this attempt**; success states the attempted task happening |
| Information checks | none | a check may name one **discoverable seed clue** (`reveals`); its success states what is learned |
| Facts | `FactRoll.consequence` = the text of a non-success band, else null | `consequence` carries the applied band's text **for every band, success included**; `FactRoll.revealed` carries the clue's seed text on a success |
| Narrate | band and consequence are decided; invent no other | the applied outcome is **settled fact the prose must deliver**; a revealed fact is stated plainly |
| Audit | prose telling another band or consequence is `ledger-mismatch` | prose that **does not deliver** the outcome or the revealed fact is `ledger-mismatch` (claw-marks replay) |
| Fallback | appends a non-success consequence when the claim check passes | the same path now covers the success text and the revealed fact |

Not repeated here: bands, margin, naturals, table rules, free retry, `onCost`/`onSevere`, the plan
gate's claim check of stakes texts, the ledger band label. Spec 070 owns them.

## Order with neighbouring cards

1. **TASK-0127 (spec 070, spine #8)** lands first. Where its merged names differ from this spec
   (`stakes`, `consequence`, `consequenceFor`, `stakes.ts`, `Submission.stakes`), the build follows
   the merged names and plan.md records the rename.
2. **TASK-0208 (spec 079, spine #7)** adds a `move` step, `FactRoll.reaction` and a reaction line in
   `narrate.ts`. This card's hunks sit beside them (plan.md "Shared-file hunks").
3. **TASK-0104 (spec 082, spine #13)** lands after this card and replaces the model's modifier and DC
   with a difficulty tier. This card adds no number, renders no DC, and reads no DC.
4. **TASK-0148 (later)** gives seed clues stable ids and records an `info.revealed` fact. This card's
   `reveals` reference is positional (`<beatId>#<n>`); 0148 replaces it with its stable id.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A success makes the attempted task happen (Priority: P1)

A player declares a task with an uncertain outcome. Before the roll, the DM writes what each band
means for this attempt, success included. The engine rolls a success. The narration shows the task
done, as written.

**Why this priority**: the operator's rule and card AC #1–#3. It removes successes that read as
failures.

**Independent Test**: a scripted turn where Kestrel pushes a rotten post over. The check step's
`stakes.success` reads "The rotten post gives way and falls into the reeds." Scripted dice give a
success. The narration facts carry that text beside the roll. The narrate prompt states it as
settled fact.

**Acceptance Scenarios**:

1. **Given** interpret returns a check step with `stakes.success: null`, **When** the reading is
   parsed, **Then** the schema rejects it (card AC #1).
2. **Given** a resolved check with band `success`, **When** narration facts are built, **Then** the
   roll fact's `consequence` is the declared success text (card AC #2).
3. **Given** a resolved check with band `failure`, **When** narration facts are built, **Then** the
   roll fact's `consequence` is the declared failure text, as in spec 070.
4. **Given** facts with a success outcome, **When** the narrate prompt is built, **Then** it presents
   the outcome text as settled fact and states that the prose must deliver it (card AC #3).

---

### User Story 2 - An information success names what the seed holds (Priority: P1)

Tamsin looks for what made the claw marks. Interpret sees the ferry-house beat's discoverable clues.
It names the clue that answers her question and writes a success that states what she learns. She
succeeds. The narration names the goblins.

**Why this priority**: card AC #5 and the claw-marks case itself.

**Independent Test**: an interpret prompt over the `greyhollow-ford-duo` seed at beat `ferry-house`
lists that beat's clues with their references. A captured reading with `reveals: "ferry-house#1"`
resolves to a success. The roll fact carries the clue's seed text as `revealed`.

**Acceptance Scenarios**:

1. **Given** the Director's beat is `ferry-house`, **When** the interpret prompt is built, **Then** it
   lists each clue of that beat as `ferry-house#<n>` with its text and its ability and skill, no DC,
   and no other beat's clues.
2. **Given** a location secret or an NPC secret in the seed, **When** the interpret prompt is built,
   **Then** neither appears in the discoverable list.
3. **Given** a check step with `reveals: "ferry-house#1"` and band `success` or `success-at-cost`,
   **When** narration facts are built, **Then** the roll fact's `revealed` is that clue's text (card
   AC #5).
4. **Given** the same step with band `failure` or `severe-failure`, **When** facts are built, **Then**
   `revealed` is null.
5. **Given** a `reveals` reference that names no clue of the seed, **When** resolve runs the step,
   **Then** the step still runs, `revealed` is null, and resolve logs `dm.reveals.unknown`.

---

### User Story 3 - The auditor refuses prose that does not deliver the outcome (Priority: P1)

The narrator receives "Tamsin reads the prints as goblin feet" and the revealed clue. Its draft
describes the marks in more detail and names no creature. The auditor fails the draft. The narrator
regenerates, and the second draft names the goblins.

**Why this priority**: card AC #4 and the runbook's merge condition for this card ("a replay of the
claw-marks case names the creature on success").

**Independent Test**: the claw-marks replay (`declared-outcome-audit.test.ts`) over a reconstructed
fixture (OQ-3) with a fake gateway.

**Acceptance Scenarios**:

1. **Given** facts with a success outcome and a revealed fact, **When** the audit prompt is built,
   **Then** it carries both and states the delivery rule.
2. **Given** the reconstructed marks-only prose and a scripted audit `fail` of kind
   `ledger-mismatch`, **When** the audit node runs, **Then** the issue blocks and the narrator is
   asked again.
3. **Given** a second draft that names the goblins and a scripted `pass`, **When** the audit node
   runs, **Then** that draft ships.
4. **Given** every draft fails, **When** the fallback ships, **Then** the fallback prose names the
   goblins (it carries the revealed fact when the claim check passes it).

---

### Edge Cases

- **Saving throws and monster-turn checks**: `stakes.success` is required on every check step, not
  only on a player's. One schema rule is simpler than two, and a save's success text ("Tamsin keeps
  her feet") is just as useful to the narrator.
- **Old checkpoints**: a reading saved before this card may hold `success: null` and no `reveals`.
  Resumed readings are not re-parsed. Every reader treats a null text as "no outcome text" and a
  missing `reveals` as null.
- **No clue answers the question**: interpret states the outcome from what is in view, or uses a
  `none` step when nothing is uncertain (decision-0022 D14 point 3). It never invents a seed fact.
- **No Director beat**: with `pacing.beatId` null, the discoverable list is empty and `reveals` must
  be null.
- **Clue already found**: revealing it again is allowed. Spec 070's free retry may also grant it.
- **Agency**: an outcome text states what happens to the attempted task and what the world does. It
  never adds a further choice for a party member (TASK-0113's agency rule). "Tamsin follows the
  tracks" in a success text is a violation; "the tracks lead to the causeway" is not.
- **DM-only text**: a clue is DM-only until found. Only the clue named by `reveals`, and only on a
  success band, reaches narrate. Location and NPC `secrets` and NPC `hooks.knows` never enter the
  discoverable list (OQ-1).
- **Public rows**: outcome texts and clue text never enter a public event row. They ride the job
  checkpoint and the narration facts, as spec 070's stakes do.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Spec 070's `stakes.success` MUST be a required text (1–200 characters) on every
  `check` step. A check step with a null or missing success text fails the schema.
- **FR-002**: A `check` step MUST carry `reveals`: a clue reference `<beatId>#<n>` (n counts from 1
  in the beat's `clues` order) or null. It defaults to null.
- **FR-003**: The interpret prompt MUST tell the model: write each band's text as the concrete outcome
  of this attempt; a success text states the attempted task happening; an information-seeking
  success states what is learned; set `reveals` to the listed clue that answers the question; name
  no seed fact that is not listed; use a `none` step when nothing is uncertain.
- **FR-004**: The interpret prompt MUST list the discoverable clues of the Director's current beat as
  `<beatId>#<n>: <text> (found with <ability> <skill>)`. It MUST list no DC, no other beat's clues,
  and no location or NPC secret.
- **FR-005**: Resolve MUST record each check submission's `reveals` reference and its resolved clue
  text in the checkpointed submission record, never in a public row. An unknown reference resolves to
  null and is logged as `dm.reveals.unknown`.
- **FR-006**: Each narration roll fact's `consequence` MUST carry the declared text of the applied
  band for every band, success included. It is null only when the text is missing (old
  checkpoints).
- **FR-007**: Each narration roll fact MUST carry `revealed`: the clue text when the band is
  `success` or `success-at-cost` and the submission has one, else null.
- **FR-008**: The narrate prompt MUST present a roll's outcome text and its revealed fact as settled
  fact that the prose must deliver, and MUST say that a success means the attempted task happens.
- **FR-009**: The audit prompt MUST carry the same outcome text and revealed fact, and MUST flag prose
  that does not deliver either as `ledger-mismatch`.
- **FR-010**: The deterministic fallback MUST append the success outcome text and the revealed fact
  when each passes the existing claim check, through spec 070's consequence path.
- **FR-011**: The `greyhollow-ford` seeds MUST name the creature behind the ferry-house tracks in a
  discoverable clue (OQ-2).

### Acceptance criteria mapping (card TASK-0170)

| Card AC | Requirements | Proving test |
|---|---|---|
| #1 concrete outcome for every band, success included; schema rejects no success outcome | FR-001, FR-003 | `interpret.test.ts`; `interpret-prompt.test.ts` |
| #2 NarrationFacts carries the applied outcome beside the roll | FR-005, FR-006, FR-007 | `facts.test.ts`; `stakes.test.ts` |
| #3 narrate presents the applied outcome as settled fact the prose must deliver | FR-008 | `narrate.test.ts` |
| #4 auditor fails undelivered prose, claw-marks replay over a captured run | FR-009, FR-010 | `declared-outcome-audit.test.ts` (reconstructed fixture, OQ-3) |
| #5 an information success names seed information | FR-002, FR-004, FR-005, FR-007, FR-011 | `interpret-prompt.test.ts`; `stakes.test.ts`; `declared-outcome-audit.test.ts` |

### Key Entities

- **Outcome text**: spec 070's per-band stakes text, now required for success and written as the
  concrete result of this attempt.
- **Clue reference** (`reveals`): `<beatId>#<n>`, naming one discoverable seed clue. Positional until
  TASK-0148.
- **Revealed fact** (`FactRoll.revealed`): the seed text of the named clue, carried on a success.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of check steps that reach resolve carry a success outcome text.
- **SC-002**: In the claw-marks replay, the shipped prose names the goblins on every path: the
  regenerated draft and the fallback.
- **SC-003**: Every successful roll fact hands the narrator its outcome text; zero successes reach the
  narrator with only "success".
- **SC-004**: Zero location or NPC secrets appear in any interpret prompt's discoverable list or any
  narrate prompt (existing leak tests stay green).

## Open questions (operator)

- **OQ-1 — Which seed facts an information success may name.** (a) Only the current beat's `clues`:
  they are the seed's facts marked discoverable (each carries its own check). Location and NPC
  `secrets` and NPC `hooks.knows` stay out; an NPC's knowledge moves by talk and, later, TASK-0148's
  reveal fact. (b) (a) plus any seed text not in `dmOnlySeedText`. (c) Every seed string, secrets
  included. **Default (a).** It is the narrowest set that answers the claw-marks case, and it never
  sends a secret to narrate.
- **OQ-2 — The seed names no creature for the claw marks.** (a) Amend ferry-house clue 1 in
  `greyhollow-ford.json`, `greyhollow-ford-duo.json`, `greyhollow-ford-trio.json` and the spec copy
  `specs/031-dm-runtime/data/greyhollow-ford.seed.json` to: "Small clawed footprints, goblin feet by
  their size and splayed toes, lead from the ferry-house down to the causeway." (b) Add a fourth
  ferry-house clue instead. (c) Let interpret name the creature from the encounter roster. **Default
  (a)**: a one-line content edit per seed, same check, same count. (c) would expose encounter data
  that is DM-only.
- **OQ-3 — The claw-marks capture does not exist.** Run 1 was lost to a reboot. (a) Reconstruct the
  fixture from the playtest log's item 2 (actor Tamsin, the quoted action, 23 vs DC 12, success,
  marks-only prose), using real row shapes copied from run 5 seq 199–204
  (`specs/034-narration-quality/evidence/run5-20261026T171359Z-greyhollow-ford-provider/`, Kestrel's
  23 vs DC 12 tracking check). The fixture says "reconstructed" in its header. (b) Wait for a new
  hosted capture at runbook B's playtest. **Default (a)**; the playtest's "Stakes and outcome" row
  re-checks it live.
- **OQ-4 — A deterministic delivery check.** (a) None in this card: the `dm.audit` criterion carries
  delivery, as spec 070 does for bands. (b) A lexical check that the prose holds a content word of the
  revealed fact. **Default (a)**. The orchestrator cards (b) as a revisit task, triggered by any
  playtest finding of an undelivered success that passed the audit (decision-0020).

## Assumptions

- Spec 070 has merged and built: `stakes`, the band, `Submission.stakes`, `FactRoll.consequence`,
  `consequenceFor`, the stakes delivery rule in narrate and audit, and the fallback consequence path.
- Prompt versions bump one past whatever is on `main` at build time (interpret, adjudicate, narrate,
  audit).
- The DC stays model-chosen until TASK-0104. This card never touches it.
- No migration: `reveals` rides interpret output and `jobs.result`; facts are in-memory.
