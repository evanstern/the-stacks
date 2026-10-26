# Feature Specification: First Scene — narration stays in fiction, keeps DM secrets and matches the ledger

**Feature Branch**: `task-0106-narration-quality`

**Created**: 2026-10-26

**Status**: Draft

**Input**: Board card TASK-0106, M2 First Scene sweep (operator ruling 2026-10-26: own spec and
PR, merged before the live demo, TASK-0048 Phase 6). It fixes code from TASK-0046
(`specs/031-dm-runtime`). Grounding: TASK-0042 R8 (the engine owns every number),
decision-0020 (no unplanned "for now").

**Evidence**: TASK-0048 paid provider run 5, copied to
`evidence/run5-20261026T171359Z-greyhollow-ford-provider/`. No job failed. The playtest auditor
reported 13 fail, 64 warn and 32 note findings. The classification is
[research.md](research.md); the per-turn table is `evidence/run5-classification.json`.

| Problem | Run 5 | Selected causes (research.md) |
|---|---|---|
| Fallback rate | 23 of 39 narrated turns shipped the factual fallback, from the first action | A1 no party roster for narrate or audit; A2 `no-effect` undefined; A3 clarify relayed as an option menu; A4 craft judgments block the gate |
| Fallback text | "X acts, and nothing changes. One action needs a clearer description." on 21 turns | Out-of-fiction templates; no sentence for encounter start or end, turn order, or joiners |
| Hidden-info leaks | 6 fails (4 Odo talk, 2 narration) | A doctrine example names the secret; Snag's `want` restates it; Odo's `knows` implies it; the location secret overlaps a public detail |
| Ledger contradictions | 5 fails | NPC roll reasons missing from the facts (F17); the fallback (F23); unnamed transcript actors mislead the chronicle (F76); narrate decides a companion's state (F81). F77 is a playtest-auditor false positive. |

**Rulings in force (not reopened)**: the engine owns every number. The attempt budget stays 3.
No new runtime dependency. No migration. The seat's repeated fallback move is fixed on the
TASK-0048 branch. Verification is an orchestrator-run paid provider playtest in a composite
worktree under an operator-approved ceiling. Every changed prompt bumps its `PROMPT_VERSION`.

**Clarify**: skipped. The card, the dispatch rulings and the run-5 evidence settle every
decision. Two judgment calls have recorded defaults under Assumptions (the seat-fallback cut and
the location-secret edit); neither changes scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Player-facing text keeps DM secrets (Priority: P1)

A player hears narration and companion talk that never reveals a DM-only seed fact.

**Why this priority**: 6 of 13 run-5 fails. The M2 demo cannot show a spoiled mystery.

**Independent Test**: build every narrate and companion prompt for the Greyhollow Ford seed and
assert none holds a DM-only seed string or the secret's key terms (card AC #1).

**Acceptance Scenarios**:

1. **Given** the shipped seed, **When** any narrate or companion prompt is assembled, **Then**
   it holds no text from a DM-only field (contracts/player-facing-context.md) and no
   `river-things` or `ward` term.
2. **Given** a DM-visibility transcript entry, **When** a player-facing prompt is assembled,
   **Then** the entry is absent.
3. **Given** a human player's declaration, **When** narrate, companion or chronicle reads the
   transcript, **Then** the line names the character and never the user id.

---

### User Story 2 - The fallback reads as the story (Priority: P1)

When the audit cannot pass a narration, the player gets plain in-fiction prose that states
every public change of the turn and no number.

**Why this priority**: the fallback shipped on most turns of run 5 and caused F23.

**Independent Test**: unit and property tests over `factualSummary` (card AC #2).

**Acceptance Scenarios**:

1. **Given** a turn where an encounter ends, **When** the fallback ships, **Then** it says the
   fighting stops and never says nothing changed.
2. **Given** an encounter start with four goblins, **When** the fallback ships, **Then** it says
   a fight breaks out, names who joins, and names who moves first.
3. **Given** a clarify, **When** the fallback ships, **Then** it ends with one open question to
   that character and holds no system word.
4. **Given** any generated facts, **Then** the fallback holds no digit, no system word, no
   tracker, and passes the deterministic checks.

---

### User Story 3 - The audit gates facts, not taste (Priority: P1)

The in-runtime audit rejects narration only for real errors: a contradicted fact, an invented
result, or a decision made for a party member. Craft advice is recorded, not enforced.

**Why this priority**: 68 of 184 run-5 audit issues were the auditor's error and 85 were craft
judgments (research.md R1).

**Independent Test**: scripted-gateway and unit tests over the audit node and both prompts (card
AC #3).

**Acceptance Scenarios**:

1. **Given** a `dm.audit` reply with only `doctrine` issues, **When** the attempt is judged,
   **Then** the narration ships on that attempt with the issues recorded as advisory.
2. **Given** a reply with a `player-agency` issue, **When** the attempt is judged, **Then** the
   narration regenerates with only blocking issues.
3. **Given** facts with a clarify, **When** the prose does not end with a question, **Then** the
   deterministic check fails it.
4. **Given** the narrate and audit prompts, **Then** both name the party members as player
   characters and every other character as the world, and both define "no rules effect".
5. **Given** an NPC attack, **Then** the facts carry its roll reason and target.

---

### User Story 4 - A paid run proves it (Priority: P1)

A provider playtest shows the fallback on at most 10% of narrated turns and no hidden-info-leak
or ledger-contradiction fail (card AC #4).

**Independent Test**: quickstart.md C.

**Acceptance Scenarios**:

1. **Given** the composite worktree and an approved ceiling, **When** the run finishes, **Then**
   the fallback rate (research.md R5) is at most 10% and the report has zero
   `hidden-info-leak` and zero `ledger-contradiction` fails.
2. **Given** a fail of another kind, **When** the run finishes, **Then** the evidence is
   committed and the work stops for an operator ruling.

---

### User Story 5 - Nothing else breaks (Priority: P2)

Existing dm tests and the scripted CI playtest stay green (card AC #5).

### Edge Cases

- A roll reason that fails the deterministic checks or holds a system word: the fallback drops
  the reason and keeps the outcome sentence.
- A name with digits ("Goblin-3"): the fallback writes "Goblin three".
- A turn with both a clarify and changes: the changes come first; the question is last.
- A mixed turn (a seat-fallback action plus a companion action): it counts as a narrated turn.
- An audit call failure: the fallback still ships, now in fiction.
- A tracker change: never in the facts, never in the fallback.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The seed fields are classed player-facing or DM-only as in
  contracts/player-facing-context.md.
- **FR-002**: Narrate and companion prompt builders take a `PlayerSeedView` and never a
  `SceneSeed`.
- **FR-003**: The shipped seed keeps every DM-only fact out of player-facing fields (four edits,
  contracts/player-facing-context.md).
- **FR-004**: No doctrine example names a person, place or fact of a shipped seed.
- **FR-005**: Narrate, companion and chronicle read public transcript entries only, with
  speakers named by character.
- **FR-006**: The facts carry the party roster, NPC names, roll reasons and targets, public
  events and the setting (contracts/narration-facts.md).
- **FR-007**: The facts render `no-effect` as "no rules effect" and a clarify as "on hold".
- **FR-008**: The narrate prompt v2 applies the party, world, no-rules-effect, open-question and
  event rules.
- **FR-009**: `dm.audit` `doctrine` and `other` issues are advisory. Deterministic checks and
  `ledger-mismatch`, `invented-mechanics`, `player-agency` block.
- **FR-010**: Code derives the attempt result from the issue kinds. Regeneration carries only
  blocking issues.
- **FR-011**: A clarify requires the prose to end with a question (deterministic).
- **FR-012**: Deterministic details quote the matched words and the word count. Each attempt
  records its word count.
- **FR-013**: `factualSummary` follows contracts/fallback-summary.md.
- **FR-014**: `PROMPT_VERSION` bumps: `dm.narrate-v2`, `dm.audit-v2`, `dm.companion-v2`,
  `dm.chronicle-v2`, `dm.director-v2`. Interpret and adjudicate do not change.
- **FR-015**: The attempt budget stays 3. No number is coerced or invented.
- **FR-016**: Each run-5 defect has a reproduction test that passes on the unfixed code before
  the fix.

### Key Entities

- **PlayerSeedView**: the player-facing projection of a scene seed.
- **NarrationFacts v2**: facts plus party, NPC names, events, roll reasons and setting.
- **RecordedIssue**: an audit issue with its `blocking` flag.

## Success Criteria *(mandatory)*

- **SC-001**: Zero DM-only seed strings in any assembled narrate or companion prompt for the
  Greyhollow Ford seed (test).
- **SC-002**: The fallback holds no system word and no digit over generated facts (property
  test).
- **SC-003**: Fallback rate at most 10% of narrated turns, excluding seat-fallback turns, in the
  Phase 5 run.
- **SC-004**: Zero `hidden-info-leak` and zero `ledger-contradiction` fails in the Phase 5 run.
- **SC-005**: `pnpm ci:check` green; the scripted CI playtest exits 0.

## Assumptions

- **Seat-fallback cut**: the dispatch named "the 12 turns from pt-19 on". The evidence shows the
  seat's fallback move from `pt-4` (research.md R0). Default: exclude every narrated turn whose
  actions are all seat fallback moves (research.md R5), and report the all-turns rate beside it.
- **Location secret edit**: the first clause ("goblins took the clapper") is public by the
  seed's own design (Snag's visible strap, Wenna's check-free clue). Default: drop that clause
  from the secret (contracts/player-facing-context.md).
- The playtest auditor (TASK-0048 code) is not changed here. Its F77 false positive is recorded
  for TASK-0048.
- The Director keeps the full seed and its `goalNote` still reaches narrate.
