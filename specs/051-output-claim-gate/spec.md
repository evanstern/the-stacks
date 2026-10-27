# Feature Specification: Output claim gate — actor-aware checks over shipped narration

**Feature Branch**: `task-0143-output-claim-gate`
**Spec dir**: `specs/051-output-claim-gate`
**Created**: 2026-10-27
**Status**: Draft — awaiting operator rulings on OQ-1 to OQ-6. `plan.md` and `tasks.md` are
not written until the rulings land.
**Board card**: TASK-0143 (Track C10, runbook amendment 1; demo subset)
**Input**: TASK-0143, decision-0025 (D17) card U3, `docs/design/actor-state-gate.md` §2 (G1,
G2), §4.1 point 4, §5.3 (U3); specs/040-actor-snapshot (U1), specs/048-scene-presence (U2),
specs/050-seed-npc-presence (U8), all merged.

## Governing decision

This card implements decision-0025 (D17, "Actor-state rule gate", TASK-0135) card **U3, the
output claim gate**. It implements these rules:

- **§3.4 Output claim gate.** A checker keyed to snapshot aliases tests narrate prose and the
  ruling and `goalNote` text that reach narrate. It refuses a dead, downed or absent actor shown
  acting or speaking, a death or drop named on the wrong actor, and a count or quantifier that
  disagrees with the snapshot. A refusal feeds the existing regenerate loop and code fallback.
- **§2.1 (prose half).** Prose may not assert an actor state the snapshot does not hold.
- **§2.7 (prose half).** NPC speech inside narration may not assert a state the snapshot does
  not hold ("Two down!" for one death).
- **§4 pipeline order.** The claim gate runs against S1, before `dm.audit`.

It implements none of these, each owned by a card:

- The claim gate on companion `say` and public chronicle entries (§3.4, second half): TASK-0144
  (U4). U4 reuses this card's checker, so the checker's interface is a public module seam.
- `dm.audit` receiving S1 and the diff (§3.5): TASK-0146 (U7).
- Disposition, offers and anything else the gate cannot parse: `dm.audit` (§3.5).
- Director legality over state (§2.5): TASK-0145 (U5). The resolve batch gate (§3.3): TASK-0147.

## Dependencies (all merged into this branch's base)

- **TASK-0140 (spec 040).** `ActorSnapshot` with `aliases`, `kind`, `lifeState`, `presence`;
  `resolve` returns S1 and `diffSnapshots(S0, S1)`; the audit node already holds
  `resolved.snapshot` (`apps/server/src/dm/nodes/audit.ts`).
- **TASK-0141 (spec 048).** `presence` is read from logged `scene-presence.changed` rows.
- **TASK-0142 (spec 050, PR #75).** Seed NPCs are actors with presence and seed aliases
  (Snag: "the goblin leader"; Pell: "the boy").

## Evidence (each located in the repository)

| Card name | Where it lives | What it shows |
|---|---|---|
| **M2 seq 225** | `docs/design/m2-demo/demo-session/transcript.jsonl` seq 225 (narration); `transcript.md:500`; job audit in `docs/design/m2-demo/demo-session/jobs.json` (step `d6b08b46…`) | The pot-helmed goblin (goblin-2, alive) shrieks "Two down! Two of ours down, Snag!" One goblin is dead (goblin-3, `life-state.changed` seq 216; the only death in the log). The deterministic checks passed and `dm.audit` raised only advisory issues, so it shipped. The same prose also says "his last goblin" while two goblins and Snag still stand. |
| **M2 seq 221 (found while grounding)** | same transcript, seq 221 `dice.rolled` reason | The interpret step reason "shouting that two kin have fallen" is model text. It ships verbatim on the seq 225 dice line and reaches narrate as a roll fact. It is the likely source of the "Two down" claim. See OQ-1. |
| **Run 192319Z row 162** | `specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/transcript.jsonl` seq 162; `classification.md:27`; `jobs.json` job `ab5ba4ae…` | Row 162 is the DM-visibility audit-flag journal entry for the turn whose fallback shipped at seq 161. Tamsin has been `unconscious` since seq 135. Attempt 2 showed her "alive and aware" ("hand twitches", "fingers curling", "breath against the night air"); only `dm.audit` caught it. |
| **F52** | `docs/design/m2-demo.md:245` (findings table), M2 transcript seq 307 | Narration: "No goblins left to fight for it now." The engine holds goblin-2, goblin-4 and Snag alive. At M2 no presence fact existed, so the operator ruled the auditor's fail a false positive from the Director's reason text (seq 300–301). With U2 and U8 merged, the snapshot decides it. |
| **Run 192319Z seq 216 (found while grounding)** | same evidence dir, `jobs.json` job `39fab4c5…`, attempt 2 | The actor-anonymous check refused "The prose says a character is unconscious, and no fact records it" while Tamsin was already unconscious from seq 135. This is the false positive AC #6 removes. |
| **M2 seq 220 (control)** | M2 transcript seq 220 | "the goblin hauling Pell jerks once and goes still, dead" for goblin-3 ("Goblin lookout"). Correct prose that names the dying actor by description, not by alias. A keyed omission check must still pass it. |

**Substitute recorded for row 162.** The audit stores a prose hash, not the prose
(`AuditAttempt.proseSha256`). The row 162 prose cannot be replayed verbatim. The tests rebuild
it from the fragments the audit quoted (row 162 body, `jobs.json` attempts 2 and 3) and name
the rebuilt sentence in the test. Run 192319Z also predates U6: the seat's declarations for a
downed Tamsin are now refused at the declare gate (TASK-0112). The test therefore places the
rebuilt prose on the turn shape that exists today, a settled death-save turn (`facts.settled`).
This is the nearest honest substitute; no open question is needed for it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A downed, dead or absent actor never acts or speaks in shipped narration (Priority: P1)

A player at the table reads the DM's narration. When the state says Tamsin is unconscious, the
goblin lookout is dead, or Snag has fled, the narration never shows that actor doing or saying
something. Today only the model auditor can catch this, and sometimes it does not.

**Why this priority**: It is the most visible contradiction in the M2 and TASK-0106 runs, and
the demo (TASK-0053) runs after this card.

**Independent Test**: Run the checker over a snapshot and a prose string. No model is called.

**Acceptance Scenarios**:

1. **Given** S1 holds Tamsin `unconscious` (run 192319Z, row 162), **When** the prose says
   "Tamsin's hand twitches toward her sword, her fingers curling around the hilt", **Then** the
   checker refuses it and the issue names Tamsin and the matched text.
2. **Given** the same S1, **When** the prose says "Tamsin lies where she fell, her breath
   shallow against the night air", **Then** the checker passes it (a state, not an act).
3. **Given** the same S1, **When** the prose says "Tamsin cannot speak" (run 192319Z seq 201
   shape), **Then** the checker passes it (a negated act).
4. **Given** S1 at M2 seq 225 (goblin-3 dead; goblin-2, goblin-4, Snag alive and present),
   **When** the shipped seq 225 prose is checked, **Then** no acting-or-speaking issue is raised:
   the speaker is the pot-helmed goblin, which is alive (control).
5. **Given** the same S1, **When** the prose says "The goblin lookout shrieks at Snag" (a seq 225
   variant naming the dead actor by its alias), **Then** the checker refuses it.
6. **Given** S1 holds Snag `absent`, **When** the prose says "Snag laughs from the reeds",
   **Then** the checker refuses it.
7. **Given** S1 holds Snag `yielded`, **When** the prose says "Snag begs for his life",
   **Then** the checker passes it (yielded actors are present).

---

### User Story 2 — Deaths and drops land on the right actor (Priority: P1)

When the engine records one actor dying or dropping, the narration names that actor, and never
names a different actor as dead or down.

**Independent Test**: The checker over a snapshot, the S0-to-S1 diff and prose.

**Acceptance Scenarios**:

1. **Given** the diff records goblin-3 dying this turn (M2 seq 216), **When** the prose says
   "Snag falls dead", **Then** the checker refuses it: Snag is alive in S1.
2. **Given** the same diff, **When** the M2 seq 220 prose is checked, **Then** it passes: the
   sentence that names a goblin holds a death word.
3. **Given** S1 holds Tamsin `unconscious` since an earlier turn (run 192319Z seq 216), **When**
   the prose calls Tamsin unconscious, **Then** the checker passes it. Today's check refuses
   it.
4. **Given** S1 holds goblin-3 dead since an earlier turn, **When** later prose mentions "the
   dead lookout", **Then** the checker passes it. Today's check refuses any death word on a turn
   with no death fact.
5. **Given** the diff records Kestrel dropping to `unconscious`, **When** the prose never
   describes a drop, **Then** the checker refuses it (omission, unchanged from today).

---

### User Story 3 — Counts and quantifiers agree with the snapshot (Priority: P1)

When narration or an NPC's line states how many are down or left ("two down", "no goblins left",
"his last goblin"), the number agrees with the snapshot.

**Acceptance Scenarios**:

1. **Given** S1 at M2 seq 225 (one dead on the monster side, none down in the party), **When**
   the seq 225 prose is checked, **Then** the checker refuses "Two down! Two of ours down".
2. **Given** S1 at M2 seq 307 built from the M2 log as recorded (no presence rows; goblin-2,
   goblin-4 and Snag alive and present), **When** the seq 307 prose is checked, **Then** the
   checker refuses "No goblins left to fight for it now" (F52).
3. **Given** the same S1 with presence rows making goblin-2, goblin-4 and Snag `absent`,
   **When** the same prose is checked, **Then** it passes. F52 now turns on recorded state, as
   the operator's false-positive ruling implied.
4. **Given** two goblins dead in S1, **When** the prose says "two goblins lie dead", **Then** it
   passes.

---

### User Story 4 — The gate covers the model text that reaches narrate, and its refusals feed the existing loop (Priority: P2)

The claim checker also reads the adjudicate ruling text and the Director's `goalNote`, the two
model texts narrate is told to treat as true or as guidance. A refused narration regenerates
through the existing loop. After three attempts the code fallback ships, and the fallback itself
passes the checker.

**Acceptance Scenarios**:

1. **Given** a ruling that says "The goblin lookout rallies the others" while goblin-3 is dead,
   **When** the turn reaches narrate, **Then** the ruling is refused (handling per OQ-2).
2. **Given** a `goalNote` that says "Two goblins are down; press the survivors" with one dead,
   **When** the turn reaches narrate, **Then** the note is refused (handling per OQ-2).
3. **Given** a fake gateway that returns refused prose three times, **When** the audit loop
   runs, **Then** each attempt records the claim issue as blocking, `dm.audit` is skipped on
   those attempts, regeneration receives the issue detail, and the fallback ships with a DM
   journal flag.
4. **Given** the fallback for the M2 seq 225 facts, **When** it is checked, **Then** it passes.
   A roll reason that fails the checker is not voiced in fallback prose.

### Edge Cases

- **References the gate cannot resolve.** "it", "the pot-helmed goblin", "his kin". A pronoun or
  a free description resolves to no actor. The gate passes it (fail-open) and leaves it to
  `dm.audit`. Only a reference to exactly one actor can trigger an acting or wrong-actor
  refusal (OQ-5).
- **Shared words.** "goblin" is a word in four actors' names or aliases. It is a group noun for
  counts and for the omission check. It never selects one actor for a refusal.
- **Negation.** "cannot", "can't", "does not", "doesn't", "no longer", "fails to", "too weak to"
  before an act verb turn the act into a state.
- **Involuntary states.** "lies", "breathes", "bleeds", "is still", "slumps" describe a downed
  actor without an act. They pass.
- **Possessives.** "Tamsin's hand reaches" attributes the act to Tamsin. "Snag's goblins flee"
  attributes it to the goblins, not to Snag.
- **Quoted speech.** A quote attributed to an actor ("… it shrieks", "Snag calls") is speech by
  that actor. Numbers inside a quote are claims too (US3.1).
- **`yielded`.** Present and not opposing. It may act and speak. It counts as "left" for "no
  goblins left" (a yielded goblin is still there).
- **Stable.** A `stable` actor is downed: it may not act or speak.
- **Scene start.** S0 equals S1. The opening framing is model prose and is checked the same way
  (decision-0025 §2.6).
- **Number words.** "one" to "twelve", "both", "all", "none", "no", "last", "only". Digits never
  reach a check: the digits check refuses them first.
- **Party versus world.** "two down" with no noun is compared with both sides' downed-or-dead
  counts. It passes when either matches (OQ-5).

## Requirements *(mandatory)*

### Functional Requirements

**The checker (AC #1, #2, #3)**

- **FR-001**: Provide one pure claim checker. Its inputs are an actor snapshot, an optional
  S0-to-S1 diff and one text. Its output is a pass flag and a list of issues. It calls no model
  and reads no log. (AC #1–#3; reused by TASK-0144.)
- **FR-002**: Resolve actor references from snapshot `aliases`, matched as whole words, case-
  insensitive, possessive-aware, by the same rule as the audit's party-name filter
  (`specs/034-narration-quality/contracts/audit-criteria.md`). A term that matches more than one
  actor is a group term, never a unique reference. (AC #1, #2)
- **FR-003**: Derive group nouns from the words of each actor's name and aliases, with plurals
  ("goblin", "goblins"). Title words, articles and prepositions are not nouns. (AC #3)
- **FR-004**: Refuse a unique reference to an actor that is `dead`, `unconscious` or `stable`,
  or whose presence is `absent`, when the same clause pairs it with an act verb or attributes
  quoted speech to it. Negated acts and involuntary-state verbs pass. The issue names the actor,
  its state and the matched text. (AC #1)
- **FR-005**: Refuse a death word attributed to a unique actor that is not `dead` in S1. Refuse a
  down word attributed to a unique actor that is not `unconscious`, `stable` or `dead` in S1.
  (AC #2)
- **FR-006**: Refuse a diff-recorded death or drop this turn when no sentence pairs a death or
  down word with a reference to that actor (unique or group term). (AC #2, #6)
- **FR-007**: Refuse a count claim that disagrees with S1:
  - a number word with "down", "dead", "fallen" or "dropped", with or without a group noun;
  - "no", "none" or "not one" with a group noun and "left" or "remain";
  - "last", "only" or "lone" with a group noun.
  A count with a noun compares with the matching actors. A count with no noun compares with the
  monster-and-NPC side and the party side; it passes when either matches. (AC #3)

**Where it runs (AC #4, #5)**

- **FR-008**: Run the checker inside `deterministicChecks` on every narration attempt, against
  S1 and the diff. Every claim issue blocks. (AC #4, #5)
- **FR-009**: Run the checker on each adjudicate ruling text and on the Director `goalNote`
  before they reach the narrate prompt. Handle a refusal as OQ-2 rules. (AC #4)
- **FR-010**: A claim issue feeds the existing loop unchanged: `dm.audit` is skipped on that
  attempt, the issue detail reaches regeneration, `MAX_NARRATION_ATTEMPTS` stays 3, and the code
  fallback ships on exhaustion with its journal flag. (AC #5)
- **FR-011**: The code fallback passes the checker by construction. A roll reason the checker
  refuses is not voiced in fallback prose (`reasonUsable`). Dice lines are unchanged here (OQ-1).
  (AC #5)

**The audit-words checks (AC #6)**

- **FR-012**: Retire the four actor-anonymous checks in `deterministicChecks` ("says a character
  dies", "says a character is unconscious", "a recorded death omitted", "a recorded drop
  omitted"). FR-005 and FR-006 replace them. (AC #6)
- **FR-013**: An unattributed death or down word passes when S1 holds at least one actor in that
  state. Otherwise it is refused, as today. (AC #6)
- **FR-014**: Keep the word lists exported from `audit-words.ts` where other readers use them as
  lexicons (`fallback.ts`, `playtest/auditor/checks.ts`). Add the act, speech, involuntary-state,
  negation and number lexicons there. (AC #6)
- **FR-015**: Leave the outcome-pairing check (`namePairsWith`) as it is. It is already keyed
  to the acting character. (AC #6)

**Records and contracts**

- **FR-016**: Record a claim issue in the existing `AuditAttempt.deterministic.issues` with the
  kind OQ-4 rules. `AuditRecord` keeps its shape. (AC #5)
- **FR-017**: Write a binding contract for the checker in this spec dir. Amend
  `specs/034-narration-quality/contracts/audit-criteria.md` (deterministic checks) and the
  consumers list in `specs/040-actor-snapshot/contracts/actor-snapshot.md`. Touch no frozen
  contract (`ws-protocol`, `specs/029-proposal-gate/contracts/`,
  `specs/030-play-route/contracts/proposal-seam.md`).

**Evidence tests**

- **FR-018**: Build the evidence fixtures from the recorded logs: the S1 snapshots at M2 seq 220,
  225 and 307 and at run 192319Z row 162, and the shipped prose for M2 seq 220, 225 and 307.
  Name the source file and seq in each fixture. (AC #1, #3)
- **FR-019**: Add a fake-gateway regenerate test (US4.3) and keep the scripted CI playtest
  green. (AC #5)

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The checker is a plain function with typed input and output.
  An agent or the playtest auditor can call it over any snapshot and text with no server.
- **CR-004** (VI. 5e engine boundary): The checker reads engine state only through the snapshot.
  It computes no game number and calls no engine command. The narrate import boundary
  (`boundary.test.ts`) still holds: the checker imports snapshot types only.
- CR-002, CR-003 and CR-005 do not apply: the feature creates no content entity, draws no
  library claim and ships no book text.

### Key Entities

- **Claim**: a span of text that asserts an actor's act, speech, life state or a count. It has
  a kind (`act`, `speech`, `death`, `down`, `count`), the matched text and the referenced actors.
- **Claim issue**: a refused claim with the actor names, the snapshot state that contradicts it
  and the matched text (at most 60 characters quoted).
- **Reference**: a unique actor or a group (a group noun or a shared alias term).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four card evidence cases are decided by code: M2 seq 225 (count refused),
  F52 (refused against recorded presence, passed against `absent` rows), row 162 (act refused)
  and the seq 225 alias variant (speech refused).
- **SC-002**: Every control passes: M2 seq 220, the shipped seq 225 speaker, "Tamsin lies where
  she fell", "Tamsin cannot speak", and an already-unconscious Tamsin called unconscious (run
  192319Z seq 216). Zero false positives across the controls.
- **SC-003**: The fallback passes the checker for every fixture in this spec.
- **SC-004**: Existing `dm` tests and the scripted CI playtest stay green; the fake-gateway
  playtest's fallback count does not rise.

## Card acceptance criteria mapping

| Card AC | FRs | Tests |
|---|---|---|
| #1 dead, downed or absent actor acting or speaking; M2 seq 225 and row 162 | FR-001, FR-002, FR-004, FR-018 | US1.1–1.7 |
| #2 death or drop on the wrong actor | FR-005, FR-006 | US2.1, US2.2, US2.5 |
| #3 count or quantifier; M2 seq 225 and F52 | FR-003, FR-007, FR-018 | US3.1–3.4 |
| #4 runs on narrate prose, ruling and `goalNote` | FR-008, FR-009 | US4.1, US4.2 |
| #5 refusal feeds the regenerate loop and fallback | FR-010, FR-011, FR-016, FR-019 | US4.3, US4.4 |
| #6 actor-anonymous word checks replaced or keyed | FR-012–FR-015 | US2.3, US2.4 |

## Assumptions

- The checker is lexical and deterministic. It does not parse grammar fully. A clause is the
  text between sentence ends, semicolons, dashes and commas that open a new verb phrase; act
  pairing is the referenced term followed within four words by an act verb.
- Fail-open on unresolved references is deliberate. Fail-closed would refuse most prose, because
  narration names monsters by description ("the pot-helmed goblin"), not by alias.
- `goalNote` and ruling text use the same checker. They are not shipped to players: the ruling
  is a DM-visibility journal row, the note is private.
- The fiction view of S1 already shows narrate which actors are dead, down or absent
  (`characterSections`). No new state section is added.
- The concurrent card TASK-0146 (U7) changes `prompts/audit.ts`; this card changes
  `nodes/audit.ts` and does not touch the audit prompt.

## Out of scope (each owned by a card)

- Companion `say` and public chronicle entries: TASK-0144 (U4).
- `dm.audit` reading S1 and the diff: TASK-0146 (U7).
- Disposition, offers, flight-in-prose with no fact beyond the count and acting rules: `dm.audit`
  and TASK-0130 doctrine.
- The playtest auditor's own life-state check (`playtest/auditor/checks.ts`). It is already
  name-keyed and judges captured runs offline.
- Step reasons on dice lines: OQ-1 recommends a follow-up card.

## Open questions

Each question changes a prompt or output schema, a prompt version, or what a player sees. Each
gives options, a recommended default and why. The FRs above assume each recommended default.

### OQ-1 — Model-written roll reasons (behaviour a player sees; AC #4)

The interpret and adjudicate step `reason` is model text. It reaches narrate as a roll fact, it
ships verbatim on the dice line, and the fallback may voice it. M2 seq 221 carried "shouting that
two kin have fallen" onto the seq 225 dice line. AC #4 names only the ruling and `goalNote`.

- **(a) Recommended.** Out of U3's gate, with two guards here: the fallback stops voicing a
  refused reason (FR-011), and the orchestrator cards a follow-up that checks step reasons at the
  plan gate, before `resolve` writes them.
  *Why:* `resolve` logs the reason before narrate runs, and the log is append-only. A narrate-time
  gate cannot retract it. The plan gate (TASK-0112) is the only point before the write.
- **(b)** In U3: check reasons at narrate time and render a code-built reason ("<name> attacks
  <target>") on a refused reason's dice line. It changes the dice-line text players see and the
  `renderDiceLines` contract; the logged reason still disagrees with the shipped line.
- **(c)** In U3: refuse the step at the plan gate. It changes resolve outcomes and overlaps
  TASK-0112 and TASK-0147.

### OQ-2 — What happens when a ruling or `goalNote` is refused (prompt input; AC #4, #5)

Both are narrate inputs, not shipped text. Regenerating narration cannot fix a bad input.

- **(a) Recommended.** Check both once before the first narrate call. Withhold a refused ruling
  from `facts.rulings`; replace a refused `goalNote` with an empty note. Record each as a
  non-blocking claim issue on attempt 1 (logged with the `[advisory]` prefix, so it reaches the
  fallback journal flag). Narration proceeds.
  *Why:* the false claim never reaches the narrator, the turn does not fail, no new loop or model
  call is added, and the prompt builder and its version do not change (`goalNote` allows an empty
  string). The DM-visibility ruling journal row written by `resolve` stays as logged.
- **(b)** Count it as a blocking issue so narration regenerates. Wasteful: the input is the
  same on every attempt, so the turn reaches the fallback.
- **(c)** Fail the turn with a new node error kind (`claim-refused`). It changes the failure
  record contract and stalls the table on a private note.
- **(d)** Re-run the Director or adjudicate with the issue. It adds a model call and a new loop.

### OQ-3 — Narrate prompt wording (prompt version; AC #1–#3, #6)

The narrate rule "Name a character as dead or unconscious only when a fact says so" now
conflicts with the gate: a goblin dead since an earlier turn may be named dead (FR-013). The
prompt never tells the model that a downed actor may not act.

- **(a) Recommended.** Bump `dm.narrate-v4` to `dm.narrate-v5`. Change that rule to "only when a
  fact or the state sections say so". Add one rule: "A dead, unconscious, stable or absent
  character does not act or speak. Count only what the state sections show."
  *Why:* a gate the prompt does not describe raises the regenerate and fallback rate. The change
  is two lines in `RULES`. TASK-0130 still owns the doctrine pass.
- **(b)** No prompt change. The gate alone teaches the model through regeneration issues. More
  regenerations and fallbacks, and the prompt keeps a rule the gate contradicts.

### OQ-4 — The issue kind for a claim refusal (output schema; AC #5)

`AUDIT_ISSUE_KINDS` is shared by the deterministic checks and the `dm.audit` output schema
(`AuditModelOutput`).

- **(a) Recommended.** Reuse `ledger-mismatch`. Prefix the detail with "Actor state:".
  *Why:* no schema change, the `dm.audit` prompt and version stay put, and the debug view and
  playtest auditor already read the kind.
- **(b)** Add a kind `actor-state`. It widens the model output schema, so `dm.audit` may emit it
  too, and it collides with TASK-0146's audit prompt work.

### OQ-5 — How strict the matcher is (what text is refused; AC #1–#3)

- **(a) Recommended.** The FR-002 to FR-007 rules: act and wrong-actor refusals fire only on a
  unique reference; group nouns serve counts and omission; unresolved references pass; a bare
  "N down" passes when either side's count matches; `yielded` counts as present.
  *Why:* every card evidence case is decided, and every control passes (SC-001, SC-002). Stricter
  rules refuse correct prose such as M2 seq 220.
- **(b)** Stricter: resolve descriptions ("the pot-helmed goblin") to actors by name-word
  overlap, so descriptions also trigger refusals. More coverage, and a real risk of refusing
  correct prose when several goblins share words.
- **(c)** Looser: counts only with a noun. "Two down!" at seq 225 has no noun and would pass,
  failing AC #3.

### OQ-6 — Replacing the actor-anonymous checks (what text is refused; AC #6)

- **(a) Recommended.** Replace all four with FR-005, FR-006 and FR-013. An earlier death or drop
  held in S1 may be named; a drop this turn must be named on that actor or its group.
  *Why:* it removes the run 192319Z seq 216 false positive and keeps the omission guard.
- **(b)** Keep the anonymous checks and add the keyed ones. It satisfies "keyed" literally and
  keeps the false positive.
- **(c)** Replace the attribution checks and drop the omission checks. Fewer regenerations; a
  recorded death may go unnarrated.
