# Feature Specification: Party slide-out

**Feature Branch**: `task-0164-party-slideout`

**Created**: 2026-11-02

**Status**: Draft

**Input**: TASK-0164. "Every viewer at a table opens a party slide-out (no modal) that lists each
party character. Each entry shows who controls the character (a named human, or an AI companion),
marks the viewer's own character, and shows class, level, HP and AC. When turn order applies, the
slide-out also shows initiative order and whose turn it is." Evidence: the 2026-10-28 two-browser
alpha playtest, item 5 (the operator did not know Brother Odo was an AI party member until he
spoke), and TASK-0163 Phase 2 `evidence/two-human-check.md`.

`speckit-specify` ran as authoring guidance only: the spec dir was already claimed with a stub, so
its branch and directory steps were skipped. `speckit-clarify` was skipped: the card, the runbook
and the code settle every choice below. The remaining choices are open questions with a
recommended default (see the end).

## Background: what happens today

1. The play header shows presence chips for humans and the AI DM only. An AI companion has no
   chip. A seat sees no marker for its own character; a player learns it only from the composer's
   speaker select.
2. The party roster is in the session log: each `party.member.changed` row carries the character
   id, name, controller (a player's user id, or an AI companion actor) and engine combatant id.
   The client's projection joins each member to its combatant, so current HP, max HP and AC are
   already on the client.
3. Class and level exist nowhere. The scene seed's characters carry ability modifiers, saves,
   skills, attacks and spells, but no class and no level.
4. In turn mode the turn-order strip under the header lists the initiative order, marks the active
   combatant and flags the viewer's own entry.
5. The table header and the turn-order strip stay pinned while only the transcript scrolls
   (TASK-0191).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Anyone at the table sees who plays whom (Priority: P1)

A player opens the party slide-out from the table header. It lists every party character. Each
entry says who controls it: a named human, "You", or an AI companion. The player's own character
is marked.

**Why this priority**: card AC #1, #2 and #5, and the playtest finding that started the card.

**Independent Test**: render the table for a player viewer of a fixture with one human-controlled
and one companion-controlled character. Open the Party trigger. The slide-out lists both, labels
the companion "AI companion", and marks the viewer's own character.

**Acceptance Scenarios**:

1. **Given** a party with a human-controlled and an AI-controlled character, **When** any viewer
   opens the party slide-out, **Then** each entry names its controller: the human's display name
   (or "You" for the viewer) and "AI companion" for the AI.
2. **Given** a player viewer who controls a character, **When** the slide-out opens, **Then** that
   character's entry is marked as the viewer's own, and no other entry is.
3. **Given** a DM viewer or a spectator, **When** the slide-out opens, **Then** no entry is marked
   as the viewer's own.
4. **Given** a human controller who is not at the table, **When** the slide-out opens, **Then** the
   entry says a player controls it and that the player is away.

---

### User Story 2 - The party's vitals at a glance (Priority: P1)

The slide-out shows each character's class, level, current and max HP, and AC. Every shipped
scene seed declares class and level for each character, so a scene started from any shipped seed
shows them.

**Why this priority**: card AC #3.

**Independent Test**: start a scene from each shipped seed. Each party member carries the seed's
class and level. The slide-out shows "Cleric 1", "HP 10/10" and "AC 16" for Brother Odo.

**Acceptance Scenarios**:

1. **Given** a scene started from a shipped seed, **When** the slide-out opens, **Then** each entry
   shows the character's class and level from the seed.
2. **Given** a character that took damage, **When** the slide-out opens, **Then** its entry shows
   the new current HP against its max, and its AC.
3. **Given** a seed character with no class or no level, **When** the seed loads, **Then** the load
   fails and names the missing field.
4. **Given** a session started before this change (party rows without class and level), **When**
   the slide-out opens, **Then** the entry shows the rest of its data and says class and level are
   not recorded.

---

### User Story 3 - Whose turn it is, in the same place (Priority: P2)

In an encounter in turn mode, the slide-out also lists the initiative order and marks whose turn
it is.

**Why this priority**: card AC #4, and the runbook merge condition (screenshots with the
slide-out open in combat, turn order shown).

**Independent Test**: render the turn-mode combat fixture and open the slide-out. An initiative
list shows every combatant in order with the active one marked.

**Acceptance Scenarios**:

1. **Given** the table in turn mode with an encounter, **When** the slide-out opens, **Then** it
   lists every combatant in initiative order and marks the active one.
2. **Given** the table in free mode, **When** the slide-out opens, **Then** it shows no initiative
   list.

---

### User Story 4 - A slide-out like the others (Priority: P1)

The Party trigger sits in the table header beside Ledger. It opens a slide-out from the right on
desktop and from the bottom at phone width, in light and dark mode. It never opens a modal. The
header and the transcript-only scrolling stay as TASK-0191 left them.

**Why this priority**: card AC #5, and the standing no-modals rule.

**Independent Test**: Brave screenshots at 1280 and 390 px, light and dark, with the slide-out
open in combat and the turn order shown. The no-dialog test still passes.

**Acceptance Scenarios**:

1. **Given** any viewer, **When** the table renders, **Then** the header shows a Party trigger
   with `aria-expanded` and `aria-controls` like the Ledger trigger.
2. **Given** a 390 px viewport, **When** the slide-out opens, **Then** it is a bottom sheet, as the
   other panels are.
3. **Given** a long transcript, **When** the slide-out is closed, **Then** only the transcript
   scrolls and the header stays in view.

### Edge Cases

- No party yet (no scene started): the slide-out says the party is empty.
- Presence unknown (connecting): a human controller's entry names neither a display name nor
  "away"; it says a player controls it.
- A party member with no engine combatant: HP and AC show as not known.
- A character with temporary HP: the entry shows the temporary HP beside current and max.
- Turn mode with no encounter: no initiative list.
- One user controls two characters: both entries are marked as the viewer's own.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The scene seed's character MUST declare a class name and a level (1 to 20). A seed
  without either MUST fail to load with an issue that names the field.
- **FR-002**: Every shipped seed MUST fill class and level for every character.
- **FR-003**: A party member in the session log MAY carry a class name and a level. Rows without
  them MUST still parse and project, so existing sessions replay unchanged.
- **FR-004**: Scene start MUST record each seed character's class and level on its party member.
- **FR-005**: The table header MUST offer a Party trigger to every viewer: player, DM and
  spectator.
- **FR-006**: The Party trigger MUST open a slide-out panel built on the app's one panel
  component. It MUST NOT open a modal.
- **FR-007**: The slide-out MUST list every party member in party order. Each entry MUST show the
  name, the controller, the class and level, current and max HP (and temporary HP when above
  zero), and AC.
- **FR-008**: The controller label MUST be "AI companion" for an AI controller. For a human
  controller it MUST be "You" when the viewer is that player, else the display name when the
  player is present, else "Player (away)" when presence is known, else "Player".
- **FR-009**: The entry of each character the viewer controls MUST carry a visible "Your
  character" marker and an accessible equivalent.
- **FR-010**: In turn mode with an encounter, the slide-out MUST list the initiative order and
  mark the active combatant, from the same data as the turn-order strip.
- **FR-011**: The slide-out MUST render legibly in light and dark mode, at 1280 px and 390 px.
- **FR-012**: The route layout MUST keep TASK-0191's behaviour: the header and the turn-order
  strip stay pinned, and only the transcript scrolls.

### Key Entities

- **Seed character**: gains class name and level.
- **Party member** (session log): gains an optional class name and level, copied from the seed at
  scene start.
- **Party row** (client view): name, controller label, own-character marker, class and level, HP,
  AC. Derived from the projected party, presence and viewer. Never stored.

### Card acceptance criteria map

| Card AC | Requirements | Stories |
|---------|--------------|---------|
| #1 each party character with its controller | FR-007, FR-008 | US1 |
| #2 a player's own character is marked | FR-009 | US1 |
| #3 class, level, HP, AC; seed schema adds class and level; shipped seeds fill them | FR-001 to FR-004, FR-007 | US2 |
| #4 initiative order and the active turn | FR-010 | US3 |
| #5 a slide-out from the header, never a modal, light and dark | FR-005, FR-006, FR-011, FR-012 | US4 |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A viewer finds who controls any party character in one action (open the slide-out),
  with no need to wait for that character to speak.
- **SC-002**: 3 of 3 shipped seeds load with class and level on every character.
- **SC-003**: Brave screenshots at 1280 and 390 px, in light and dark mode (4 shots), show the
  slide-out open in combat with the initiative list and the active turn marked.
- **SC-004**: The no-modals test and every existing play-route test pass unchanged.

## Assumptions

- Display names come from presence, the only source of other users' names on the client. An
  absent player's name is not known to the client; the entry says "Player (away)" (OQ-2).
- Class is free text authored in the seed (for example "Fighter"), not an SRD class id. This keeps
  operator-authored content open to classes outside the SRD.
- The initiative list names combatants only. It shows no monster HP: players do not see monster
  vitals today.
- The slide-out reads only what the client already projects. No new server route.
- Full character sheets stay TASK-0058 (m-4).

## Open questions (orchestrator rules; default in bold)

- **OQ-1. The party member payload gains two optional fields.** **Resolved 2026-11-02: (a), operator ruling "Accept additive change (Recommended)".** `PartyMemberSchema` (session-model)
  is named by the frozen `specs/029-proposal-gate/contracts/proposals.md` as the `party`
  proposal's `after`. Adding optional `class` and `level` widens that proposal's accepted shape
  without editing the frozen file. (a) **Accept: additive optional fields, payload stays v1, the
  028 session-events contract is amended, no 029 file changes.** (b) Treat it as a frozen-contract
  change and get an operator ruling first. (c) Avoid the log: serve class and level from a new
  read route that loads the seed (adds a server route and its auth).
- **OQ-2. An absent player's name.** **Resolved 2026-11-02: (a) default, taken by the orchestrator.** (a) **"Player (away)"; no name.** (b) Record the display name
  on the party member at scene start (needs a user lookup in resolve, and the name goes stale on
  a rename).
