# Feature Specification: Player agency — one rule for Director, interpret, narrate and audit

**Feature Branch**: `task-0113-player-agency`

**Created**: 2026-11-02

**Status**: Draft. M3 runbook B, lane B1, spine #3.

**Input**: TASK-0113 (widened 2026-11-02). "Real-model narration does not move the human player's
hero at scene start or on a foe's miss, and the playtest auditor treats AI companions according to
a stated rule." Widened: "The Director's goal notes and interpret must not decide a PC's volitional
acts, methods or skills the player did not declare."

`speckit-specify` ran as authoring guidance only. The spec dir was claimed with a stub, so its
branch and directory steps were skipped. `speckit-clarify` was skipped: the operator ruling of
2026-10-26, the research findings (a)–(e) and the 2026-11-02 widening on the card settle the
behaviour. The three open questions below are scope calls the card leaves open. The operator ruled
OQ-1 on 2026-11-02 (option b). OQ-2 and OQ-3 carry defaults. This spec, plan.md and tasks.md are
written against the OQ-1 ruling and the other two defaults.

## Decision records and rules this card implements

- **Operator ruling 2026-10-26** (card notes): the DM may narrate a character's reaction after a
  hit "if the roll makes sense"; it never narrates a decision for the player. The ruling makes
  narrate-v3's miss rule E3 and audit's `player-agency` definition stricter than intended.
- **Research findings 2026-10-26** (card notes, decision-0022 D14 point 1):
  (a) code derives one involuntary-effects list from the ledger; narrator and auditor read it;
  (b) operator-confirmed reflex triggers: a critical hit allows a stagger; damage of half the
  character's maximum HP or more allows a heavy-hit reaction; a failed save allows a flinch matched
  to the effect; surprise allows startlement;
  (c) small displacement inside a reflex is colour; a position change that matters needs a fact;
  (d) control effects compel only through a recorded fact naming the effect;
  (e) `player-agency` blocks volitional acts only: intent, speech, purposeful movement, choices,
  chosen emotions.
- **Operator ruling 2026-11-02 on OQ-1**, verbatim, answering "May the narration show a reflexive
  flinch when a foe misses a PC?": "Yes, allow a flinch". A foe's miss on a party member is a fifth
  reflex trigger, `avoid`. It allows a reflexive flinch. A chosen dodge, a twist with intent and a
  meaningful reposition stay blocked: they are volitional. Small displacement inside the flinch is
  colour, as for the other triggers.
- **Widening 2026-11-02** (card notes, runbook B lane B1): the rule covers the Director's goal note
  and interpret. Evidence: runbook A playtest run 1 (`docs/playtests/2026-11-02-runbook-a-playtest.md`,
  PR #109) findings 4, 14 and 19. The goal note prescribed "call Stealth (Kestrel leads…)" and "a
  reaction swing"; interpret followed both.

## Order with neighbouring cards (lane B1)

This card sets the **shared player-agency rule**. Later B1 cards apply it and must not restate it.

| Card | Owns | Does not own |
|---|---|---|
| **TASK-0113 (this card)** | The rule text, one source, rendered into the director, interpret, narrate, `dm.audit` and playtest-auditor prompts. The revised `hero-is-theirs` doctrine pair. The code-derived involuntary-effects facts. The reserved `band` field on roll facts. Scene-start hero framing (AC #1). The miss-rule measurement and fix (AC #2). The playtest auditor's companion rule (AC #3). The goal-note rule (AC #4). The interpret step rule (AC #5). | Any replay test of a playtest seq. Any plan-gate or engine rule. |
| TASK-0205 | Interpret asks (clarify) instead of assuming a method (its AC #1, replay of run 1 seq 24–30). A check from one player's action rolls only for that player's PC — a plan-gate rule (its AC #2). | Its AC #3 (goal note prescribes no skill) is delivered by this card's AC #4 text and test. 0205's spec ticks AC #3 by citing this card's test, and adds the replay only. |
| TASK-0208 | Opportunity attacks only from an engine reaction rule; the fallback names the attacker; follow-ups never shown as done. | Nothing of the agency rule; it cites it. |
| TASK-0127 (spec 070) | Fills the `band` field this card reserves on `FactRoll`, plus `margin`, `consequence`, `autoSuccess` (spec 070 plan D6, R10). | — |
| TASK-0130 | Flavour intensity and the fail-forward doctrine rewrite. | — |

## Background: what happens today

1. The narrate rule (narrate-v8 on `main`, TASK-0209) forbids any party-member feeling or choice,
   and on a foe's miss it
   says "unchanged and unmoved: no wound, no dodge, no twisting free". It names no allowed reflex.
2. The `dm.audit` definition of `player-agency` blocks "says, feels or chooses beyond their
   declared action". It names no allowed reflex either.
3. The doctrine pair `hero-is-theirs` says "Never decide the hero's words, feelings or moves". It is
   rendered into narrate, audit, companion and the playtest auditor. It bans a stagger on a crit.
4. The Director's `goalNote` has no rule at all. Interpret reads it as "note: …" beside the beat.
5. Narration facts carry no involuntary effect. The narrator cannot tell a stagger the dice earned
   from one it invents.
6. The playtest auditor (`apps/server/src/playtest/auditor/prompt.ts`) has no party list. It cannot
   tell an AI companion from a player's hero (TASK-0106 verify F7).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The DM never plays the player's character (Priority: P1)

A player declares an action. The Director plans the beat and interpret plans the steps. Neither
adds a method, a skill, a move, a reaction or a line of speech for any party member that its player
did not declare.

**Why this priority**: card AC #4 and #5, the widening. Run 1 findings 4, 14 and 19 are this bug.

**Independent Test**: build the director and interpret prompts from a fixture context. Both system
prompts hold the shared rule text and their node line. The interpret user prompt labels the goal
note as pacing advice that never adds a step.

**Acceptance Scenarios**:

1. **Given** any turn, **When** the director prompt is built, **Then** its system prompt holds the
   shared agency rule and the line that the goal note never states a party member's act, method,
   skill or reaction the player did not declare, and the `goalNote` shape line says the same.
2. **Given** any turn, **When** the interpret prompt is built, **Then** its system prompt holds the
   shared agency rule and the line that a step for a party member carries only what that member's
   player declared.
3. **Given** a goal note that says "call Stealth (Kestrel leads…)", **When** the interpret prompt
   is built, **Then** the note is labelled as the Director's pacing note, which never adds a step or
   a method.

---

### User Story 2 - Reflexes the dice decided may be narrated; choices may not (Priority: P1)

A goblin lands a critical hit on Tamsin. The narrator may show her staggered back a step. A
goblin's attack misses Tamsin. The narrator tells the miss from the goblin's side and may show
Tamsin flinch. Neither prose shows Tamsin choosing anything: no dodge, no duck, no twist that times
the blow.

**Why this priority**: the operator rulings (2026-10-26, 2026-11-02 OQ-1), research (a)–(e), and
card AC #2.

**Independent Test**: facts built from ledger rows with a critical hit, a heavy hit and a failed
save on party members carry one involuntary effect each. A foe's miss on a party member carries
`avoid`. The narrate and audit prompts render them. On a miss, prose that pairs the missed member
with a defence verb fails the deterministic audit. Prose that pairs the member with a reflex verb
passes, unless an intent marker follows the reflex verb.

**Acceptance Scenarios**:

1. **Given** an attack row with outcome `critical-hit` on a party member, **When** facts are built,
   **Then** the facts list an involuntary effect `stagger` for that member.
2. **Given** an `hp.changed` damage row on a party member whose loss is half the member's maximum HP
   or more, **When** facts are built, **Then** the facts list `heavy-hit` for that member.
3. **Given** a failed saving throw by a party member, **When** facts are built, **Then** the facts
   list `flinch` for that member, naming the save's ability.
4. **Given** an attack row with outcome `miss` whose target is a party member, **When** facts are
   built, **Then** the facts list an involuntary effect `avoid` for that member, naming the attacker.
5. **Given** the same rows on a monster or a seed NPC, **When** facts are built, **Then** no
   involuntary effect is listed (the world's characters are the narrator's to move).
6. **Given** a foe's missed attack on Tamsin and the prose "Tamsin twists just enough" (verify
   20261026T192319Z seq 82), **When** the deterministic audit runs, **Then** it reports a blocking
   `player-agency` issue naming Tamsin and the matched words. "Just enough" times the twist to the
   blow: a twist with intent, not a flinch.
7. **Given** the same miss and the prose of seq 87 or seq 126, **When** the deterministic audit runs,
   **Then** no `player-agency` issue is reported.
8. **Given** the same miss and the prose "Tamsin flinches as the dagger hisses past her ribs",
   **When** the deterministic audit runs, **Then** no `player-agency` issue is reported.
9. **Given** the same miss and the prose "Tamsin ducks under the dagger" or "Tamsin jerks aside just
   in time", **When** the deterministic audit runs, **Then** it reports a blocking `player-agency`
   issue naming Tamsin.
10. **Given** any turn, **When** the `dm.audit` prompt is built, **Then** its `player-agency`
   definition blocks volitional acts only and allows a listed involuntary effect shown as a reflex.

---

### User Story 3 - The scene opens on the world, not on the hero's moves (Priority: P1)

A scene starts. The narrator frames where the party is and what they see. It never leads, moves or
voices a party member.

**Why this priority**: card AC #1 (TASK-0106 verify F1: "Tamsin Vale leads the way up from the
bank").

**Independent Test**: at scene start, prose that pairs a party name with an act or speech verb fails
the deterministic audit. Every shipped seed's opening framing passes the same check.

**Acceptance Scenarios**:

1. **Given** a scene-start turn and the captured opening (verify 20261026T192319Z seq 10), **When**
   the deterministic audit runs, **Then** it reports a blocking `player-agency` issue on "Tamsin
   Vale leads".
2. **Given** a scene-start turn and each seed's `opening.framing` in `apps/server/seeds/*.json`,
   **When** the deterministic audit runs, **Then** no `player-agency` issue is reported.
3. **Given** a scene-start turn, **When** the narrate prompt is built, **Then** the scene-start
   section holds the line that the opening never moves, leads or voices a party member.

---

### User Story 4 - The playtest auditor says whether companions count (Priority: P2)

The operator reads a playtest report. A `hero-is-theirs` finding on an AI companion means the same
thing in every report, because the auditor's prompt states the rule.

**Why this priority**: card AC #3 (TASK-0106 verify F7).

**Independent Test**: build the auditor prompt from a segment and a seed with one human seat and one
companion seat. The prompt lists both with their controller and states the companion rule.

**Acceptance Scenarios**:

1. **Given** a seed with Tamsin (`human`) and Brother Odo (`companion`), **When** the auditor
   prompt is built, **Then** it lists both as party members with their controller.
2. **Given** the same, **When** the auditor prompt is built, **Then** it states that
   `hero-is-theirs` covers every party member, AI companions included, and that a companion's own
   `talk` rows and declared actions are its own choices, never `player-agency`.
3. **Given** the same, **When** the auditor prompt is built, **Then** it holds the shared agency
   rule text.

### Edge Cases

- A party member's own declared action names a defence ("I take the Dodge action", "I duck behind
  the post"). The miss check skips that member for that beat.
- A party member succeeds on a save against a foe's effect, or a foe's grab fails. The ruling names
  a foe's miss only, so no `avoid` is derived. The narrator tells it from the foe's side; the miss
  check does not run on it.
- A foe's attack misses one party member and hits another in the same beat. Each member gets its own
  effect; the miss check runs only on the missed member.
- A party member at 0 HP takes damage. The heavy-hit rule still applies on the damage row; the
  life-state change stays a separate fact.
- A critical hit that also deals heavy damage lists both effects. The narrator may use either.
- A party member with maximum HP 0 or missing from the engine combatants lists no heavy-hit.
- Surprise: the engine records no surprise today. No startlement effect is derived (OQ-2).
- A control effect (Command, Suggestion, Dominate Person): no engine fact names one today, so no
  fact compels. The rule text states that only a recorded fact naming the effect may compel.
- A talk turn (`talk-turn.ts`) builds facts with no rows. It lists no involuntary effect.
- Death saves are not saving throws against an effect. A failed death save lists no flinch.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST hold the player-agency rule text in one source. The director,
  interpret, narrate, `dm.audit` and playtest-auditor prompts MUST render that source.
- **FR-002**: The rule MUST state: volitional acts of a party member (intent, speech, purposeful
  movement, choices, chosen emotions, the method or skill used) belong to its player; listed
  involuntary effects are reflexes the dice decided; small displacement inside a reflex is colour; a
  position change that matters needs a fact; a condition limits what a character can do and never
  decides what it chooses; only a recorded fact naming a control effect compels.
- **FR-003**: The director prompt MUST forbid a goal note that states a party member's act, method,
  skill or reaction its player did not declare.
- **FR-004**: The interpret prompt MUST forbid a step that carries a party member's volitional act
  its player did not declare, and MUST label the goal note as pacing advice that never adds a step.
- **FR-005**: The doctrine pair `hero-is-theirs` MUST be revised to block decisions, not reflexes.
- **FR-006**: Narration facts MUST carry a code-derived list of involuntary effects for party
  members: `stagger` (critical hit), `heavy-hit` (damage of half maximum HP or more), `flinch`
  (failed saving throw), `avoid` (a foe's attack missed them; OQ-1 ruling). Monsters and seed NPCs
  get none.
- **FR-007**: The narrate and `dm.audit` prompts MUST render the same involuntary-effects lines.
- **FR-008**: The narrate miss rule MUST tell a foe's miss from the foe's side, MUST allow a
  reflexive flinch by the missed party member, and MUST forbid a chosen defence: a dodge, a twist
  with intent, a meaningful reposition. A deterministic check MUST block prose that pairs the missed
  party member with a defence verb, or with a reflex verb followed by an intent marker. It MUST pass
  a reflex verb with no intent marker. It skips a member whose own declared action this beat names
  the defence.
- **FR-009**: At scene start, the narrate prompt MUST forbid moving, leading or voicing a party
  member, and a deterministic check MUST block prose that pairs a party name with an act or speech
  verb.
- **FR-010**: The `dm.audit` `player-agency` definition MUST block volitional acts only and allow a
  listed involuntary effect shown as a reflex.
- **FR-011**: The playtest auditor prompt MUST list the party with controllers and state that
  `hero-is-theirs` covers AI companions, while a companion's own talk and declared actions are its
  own.
- **FR-012**: `FactRoll` MUST reserve an optional `band` field (`success`, `success-at-cost`,
  `failure`, `severe-failure`, or null) for TASK-0127. This card never sets it.
- **FR-013**: Each changed prompt MUST bump its version one past `main`.
- **FR-014**: The shared `AGENCY_RULE` reflex line MUST name the fifth trigger: a flinch on a foe's
  miss.

### Acceptance criteria mapping (card TASK-0113)

| Card AC | Requirements | Proof |
|---|---|---|
| #1 scene-start hero framing, with a test over the opening framing | FR-009 | US3 scenarios 1–3 |
| #2 v3 miss rule measured on a captured run; fix with a test below a stated rate | FR-006, FR-008, FR-014 | Measurement in plan.md R2, re-classified under the OQ-1 ruling (2 of 3 = 67%, below the 90% bar); US2 scenarios 4, 6–9 |
| #3 playtest auditor states whether companions count, with a test | FR-011 | US4 scenarios 1–3 |
| #4 goal notes state no undeclared act, method or skill, with a prompt test | FR-001, FR-002, FR-003 | US1 scenario 1 |
| #5 interpret steps carry no undeclared volitional act, with a test | FR-001, FR-002, FR-004 | US1 scenarios 2–3 |
| Rulings and research (a)–(e) | FR-002, FR-005, FR-006, FR-007, FR-010, FR-012, FR-014 | US2 scenarios 1–5, 10 |

### Key Entities

- **Agency rule**: the shared rule text plus one line per node.
- **Involuntary effect**: `{ name, trigger: "stagger" | "heavy-hit" | "flinch" | "avoid", detail }`, derived
  by code from this turn's ledger rows for a party member.
- **Roll band** (reserved): an optional field on each roll fact, filled by TASK-0127.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the three captured misses of verify 20261026T192319Z, the deterministic check
  blocks exactly the one breach (seq 82, a twist with intent under the OQ-1 ruling) and passes the
  other two. A plain flinch on a miss passes.
- **SC-002**: The captured scene-start breach (seq 10) is blocked; all four shipped seed framings
  pass.
- **SC-003**: Every prompt that decides or audits a party member's action (director, interpret,
  narrate, `dm.audit`, playtest auditor) carries the same rule text, proven by one test per prompt.
- **SC-004**: At runbook B's playtest (hosted, checkpoint C6), no Director goal note names a skill or
  a reaction for a party member that its player did not declare. This is observed, not gated here.

## Open questions (operator)

- **OQ-1 — Is a foe's miss a reflex trigger? RESOLVED 2026-11-02: (b).** The 2026-10-26 ruling
  names "after being hit, or missing"; research (b) listed four triggers and a miss was not one. The
  operator was asked "May the narration show a reflexive flinch when a foe misses a PC?" and ruled:
  "Yes, allow a flinch". A miss is the fifth trigger, `avoid`. A chosen dodge, a twist with intent
  and a meaningful reposition stay blocked. The earlier note that (b) "would reclassify seq 82 as
  allowed" does not hold: seq 82's "twists just enough" times the twist to the blow, so it is a twist
  with intent and stays a breach (plan R2). OQ-4 asks the operator to confirm that reading.
- **OQ-2 — Surprise.** The engine records no surprise, so the startlement trigger has no fact to
  derive from. **Default:** derive none in this card. The orchestrator cards "engine records
  surprise; facts derive startlement" for a later runbook (no "for now" without a card).
- **OQ-3 — Do AI companions count for `hero-is-theirs`?** **Default (a):** yes. Narrate already
  treats companions as player characters ("companions speak for themselves"). TASK-0106 verify F7
  ("Brother Odo steps forward, weighing the line") is then a real narration finding. (b) would scope
  `hero-is-theirs` to human seats only and let the narrator move companions.
- **OQ-4 — Is seq 82 a flinch or a twist with intent?** Raised by the OQ-1 ruling. **Default:**
  a twist with intent. "Tamsin twists just enough, and the blade bites smoke instead of flesh" makes
  her movement the reason the blade misses, and "just enough" measures it against the blow. A flinch
  happens to her; it never decides the outcome. The check draws that line with intent markers (plan
  R5). If the operator rules seq 82 a flinch, drop "just enough" from the markers; adherence becomes
  3 of 3 and the deterministic miss check still ships for "dodge"/"duck" breaches like verify
  183818Z seq 250 ("She wrenches clear").

## Assumptions

- No paid model run. AC #2's measurement uses the captured narrate-v3 run
  `specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/` (the only
  captured run on the v3 rule). A fresh measurement on narrate-v9 needs a hosted run (C6); runbook
  B's playtest takes it.
- The 90% adherence bar is this spec's stated rate. Three samples cannot prove a rate above it; the
  deterministic check makes the rule hold by code instead.
- The playtest auditor lives at `apps/server/src/playtest/auditor/`, not under `.claude/`. The
  runbook's footprint line names `.claude/skills/playtest-run/scripts/`; those scripts hold no
  agency check. No `.claude/` edit is needed.
- `facts.ts` keeps importing no engine value (its import-closure test).
