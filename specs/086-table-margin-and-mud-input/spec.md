# Feature Specification: Table margin and MUD input baseline

**Feature Branch**: `task-0236-mud-ux`

**Created**: 2026-11-05

**Status**: Draft, written against an accepted decision. The direction and OQ1 to OQ4 are ruled
(`docs/design/mud-ux/decision.md`, 2026-11-04). The operator ruled both frozen-contract changes
**(a) accept** on 2026-11-05: **R1** and **R2** under "Frozen-contract items".

**Input**: TASK-0236. Decision record: `docs/design/mud-ux/decision.md` ("the decision" below).
Layout and states: `docs/design/mud-ux/round-1/b-margin.html`. Click-to-draft:
`docs/design/mud-ux/round-1/c-split.html`. Pattern rationale:
`docs/research/MUD-Client-UX/Analysis-Table-View-Pattern-Adoption.md` ("the analysis").

Authored against `.specify/templates/`. The spec number and branch were reserved, so the skills'
branch and directory steps were skipped. `speckit-clarify` was skipped: the decision rules every
open question.

## Scope

The decision's sequencing note splits the work. This spec is the first half.

- **In**: the Margin layout on today's table (party HP and AC, turn order, conditions; a 390 px
  mini-strip); the MUD input baseline (Up/Down history, an `@`/`/` closed-command dropdown, Tab
  completion of scene entities, clickable nouns with inline expansions, filter chips over one
  stream, one-line roll rows, a status strip, room blocks with clickable ways on that draft into the
  composer); screen-reader parity; a contrast check in light and dark.
- **Out, a named dependency**: the slide-out interactive map. It needs map data from milestone M6:
  TASK-0070 (PixiJS table, grid, tokens) and TASK-0071 (the DM drives tokens). The map ships later
  on this layout. It opens from an **Open map** button in the margin, inside the project's one
  slide-out `Panel` (right edge on desktop, bottom sheet at 390 px). A token click calls the same
  draft path this spec builds (FR-019). This spec renders no map button.

## Prerequisites

- **TASK-0199 (spec 066, one chat stream) is merged.** This spec extends its composer (speaker chip,
  `@` mention dropdown, `((` and `/ooc`), its confirm row and its ring. A draft lands in that
  composer, and the ring → confirm → 👍 flow that follows a sent line is 066's.
- R1 and R2 are ruled (see "Frozen-contract items"). Phases that need neither run first.

## Data the UI needs: where it comes from

| Datum | Source today | Status |
|---|---|---|
| Party names, HP, AC, class and level | `p.party[].combatant` (`partyRows`, `play/party.ts`) | **Exists** |
| Conditions on every combatant | `p.party[].combatant.conditions`, `p.encounter.order[].conditions` | **Exists** |
| Turn order, active and next combatant | `p.encounter`, `ModeView.order` (`view-model.ts`) | **Exists** |
| Whose turn it is | `p.tableMode`, `ModeView.activeLabel` | **Exists** |
| Structured roll rows | `p.ledger` `roll` and `outcome` rows (`dice.rolled`, `check.resolved`, `attack.resolved`), grouped by `batchId` | **Exists** (today shown only in the Ledger slide-out) |
| HP, condition, life-state and initiative changes as text | `p.ledger` `change` rows (`hp.changed`, `condition.*`, `life-state.changed`, `encounter.started`) | **Exists** |
| Stream filter category | the entry kind and `talk.channel` | **Exists** (derived; no server tag) |
| Input history | the viewer's own `talk` rows in `p.transcript` | **Exists** (derived; see gap 1) |
| Glossary: party and combatant names | `p.party`, `p.engine.combatants` | **Exists** |
| Room name | `scene.changed` `after.title`, `after.location` | **Exists** |
| Room description | `SceneSchema.summary` holds the goal statement, not a place description | **Missing → R1** |
| Ways on (label and draft text) | nowhere: not in the seed, not in any event | **Missing → R1** |
| Glossary: non-combatant NPC names and player-safe facts | nowhere on the client (066 recorded the same gap); `PlayerSeedView.npcs` on the server | **Missing → R1** |
| Action economy (action, bonus, move) for the status strip | the engine tracks reactions only (`reactionsSpent`) | **Missing; not taken** (Non-goals) |

## Frozen-contract items (ruled 2026-11-05: R1 (a), R2 (a))

**R1 — `SceneSchema` gains three optional fields; the seed location gains `ways`.**
Contracts: `specs/028-session-model/contracts/session-events.md` (`scene.changed`, `SceneSchema`),
`specs/029-proposal-gate/contracts/proposals.md` (the `scene` proposal reuses `SceneSchema`),
`specs/031-dm-runtime/contracts/scene-seed.md` (`location`), `specs/031-dm-runtime/contracts/director.md`
(the scene-start `scene` proposal).

- `SceneSchema` gains optional `description` (text, max 1000), `ways` (max 6 of `{ label, draft }`)
  and `cast` (max 20 of `{ id, name, role, appearance }`). The payload stays v1, so old rows parse.
- The seed `location` gains optional `ways` (max 6 of `{ label, draft }`). It is player-facing and
  joins `PlayerSeedView.location`.
- At scene start the Director fills `description` from the player-facing location features, `ways`
  from the seed, and `cast` from `PlayerSeedView.npcs`. No DM-only seed field is read.
- **Ruled (a), operator 2026-11-05.** Options were: **(a) accept the additive optional fields** (the spec 072 party precedent).
  (b) Reject. The fallback then ships: room blocks show the name only, with no description and no
  ways on; nouns and Tab completion cover party members and combatants only. US5 shrinks to that.

**R2 — the play-route layout moves the turn-order strip and adds stream surfaces.**
Contracts: `specs/030-play-route/contracts/ui-surfaces.md` (Layout, Components, Accessible names),
`specs/049-turn-floor/contracts/ui-floor.md` ("Turn-order strip": "Under the header").

- The turn-order strip leaves its place under the header. It renders inside the margin on desktop and
  in the mini-strip at 390 px. Its list keeps the accessible name "Turn order".
- New surfaces: the margin, the status strip, the mini-strip, the filter chips, room blocks, roll
  rows, parity lines, noun expansions and the command dropdown. The "Forbidden" list is unchanged.
- **Ruled (a), operator 2026-11-05.** Options were: **(a) accept**; the change is layout plus additive surfaces. (b) Reject. The
  strip then stays under the header, and the margin shows party and conditions only.

## User Scenarios & Testing *(mandatory)*

Copy and states follow `b-margin.html` over the `greyhollow-ford-duo` seed (Kestrel and Tamsin are
human, Brother Odo is an AI companion, Wenna Marsh is a present NPC, Snag leads the goblins).

### User Story 1 - The margin keeps the party in view (Priority: P1)

At 1280 px the stream owns most of the width. A slim right margin shows each party member's HP and
AC, the turn order, and the conditions on each combatant. At 390 px the margin is gone and a
persistent mini-strip above the composer shows the same facts in short form.

**Why this priority**: it is the chosen layout, and every later surface sits in it.

**Independent Test**: render the `turn-mode-combat` fixture at both widths; read the margin and the
mini-strip text.

**Acceptance Scenarios**:

1. **Given** free play with no encounter, **When** Kestrel's player opens the table at 1280 px,
   **Then** the margin lists Kestrel "Rogue 1 · HP 9/9 · AC 14", Tamsin and Brother Odo, and reads
   "Not in combat. Conditions: none."
2. **Given** an encounter where Kestrel acts first, **When** the margin renders, **Then** its "Turn
   order" list names every combatant in order, marks Kestrel as active, flags the next entry "next"
   and Kestrel's entry "you", and shows each combatant's conditions as words.
3. **Given** the same state at 390 px, **When** the page renders, **Then** no margin shows, the
   mini-strip above the composer reads "Tamsin Vale 13/13 · Brother Odo 10/10 · Order: Kestrel ›
   Snag › Tamsin…", and nothing scrolls sideways.
4. **Given** Kestrel takes 4 damage, **When** the `hp.changed` row arrives, **Then** the margin and
   the status strip show HP 5/9 with no reload.

---

### User Story 2 - The status strip says where I stand (Priority: P1)

Above the composer a one-line status strip shows the viewer's own character: HP, AC, conditions,
and whose turn it is.

**Independent Test**: `status-strip` markup over a free and a turn fixture.

**Acceptance Scenarios**:

1. **Given** free play, **Then** the strip reads "Kestrel · HP 9/9 · AC 14 · Conditions: none ·
   Turn: free play".
2. **Given** turn mode on Kestrel's turn, **Then** it reads "… · Turn: Kestrel (you)".
3. **Given** a viewer with no character (an observer or the DM), **Then** the strip shows only the
   turn.

---

### User Story 3 - One stream, filtered and readable (Priority: P1)

The stream carries talk, narration, confirm rows, room blocks, roll rows and rules lines. Filter
chips "All", "In character", "Table talk" and "Rules" narrow the view. A roll is one line that
expands inline.

**Independent Test**: `stream-items.test.mjs` over fixtures; `filter-chips` markup.

**Acceptance Scenarios**:

1. **Given** Kestrel's Stealth check resolves, **Then** the stream shows one row "Kestrel — Stealth
   17 ✓". Activating it expands "d20 (12) + 5 = 17 vs DC 15. Success." in place. (The mockup's
   "+ 3" is wrong for this seed: Kestrel's Stealth is +5.)
2. **Given** an attack, **Then** one row reads "Kestrel — Shortbow vs Goblin lookout: hit" and
   expands to the dice, the total against AC, and the damage rolled.
3. **Given** "In character" is pressed, **Then** only narration, in-character talk and room blocks
   show. Confirm rows and the viewer's own open action stay visible under every chip.
4. **Given** "Table talk" is pressed, **Then** only out-of-character talk, `@dm` posts and DM asides
   show.
5. **Given** any chip, **Then** the log's contents are unchanged; the chip hides rows from view only.

---

### User Story 4 - The input line works like a MUD client (Priority: P1)

Up and Down walk the viewer's earlier lines. Typing `/` at the start opens a dropdown of a small
closed command set. Tab completes a scene entity's name.

**Independent Test**: `composer.test.tsx` and `history.test.mjs`.

**Acceptance Scenarios**:

1. **Given** Kestrel sent "I'll get up there and see who's hiding." and then reloads, **When** she
   presses Up in an empty composer, **Then** that line returns. A line sent twice in a row appears
   once.
2. **Given** she has typed "I look" and presses Up, then Down past the newest entry, **Then** "I
   look" returns.
3. **Given** she types `/`, **Then** a dropdown lists `/ooc` (table talk), `/help` (what you can do
   here) and `@dm` (ask the DM, out of character). Arrow keys move, Enter picks, Escape closes.
4. **Given** she picks `/help`, **Then** an inline panel under the composer lists the commands and
   keys (Up/Down, Tab, `@`, `/`). Nothing is sent or logged.
5. **Given** she types "I ask Sn" and presses Tab, **Then** the line reads "I ask Snag " when Snag is
   the one match. With two matches, the dropdown lists both.
6. **Given** an empty line, or a line that ends in a space, **When** she presses Tab, **Then** focus
   moves to the next control, as the browser does.

---

### User Story 5 - Nouns and ways on (Priority: P2)

A known name in a stream line is a button. It opens an inline expansion with player-safe facts. A
room block names the place, describes it, and lists its ways on. Clicking a way on drafts a line.

**Independent Test**: `glossary.test.mjs`, `room-block` and `noun-text` markup.

**Acceptance Scenarios**:

1. **Given** narration names Snag, **When** Kestrel activates "Snag", **Then** an inline expansion
   under the line reads "Snag — goblin leader. Narrow, yellow-eyed, a notched scimitar." The button
   reports `aria-expanded`.
2. **Given** a party member's name, **Then** its expansion shows class and level, HP, AC and
   conditions. **Given** a monster's name, **Then** its expansion shows its name, conditions and
   whether it is down; it shows no HP or AC numbers.
3. **Given** the scene starts, **Then** a room block shows "Greyhollow Ford", its description, and
   "Ways on: ladder to the loft · causeway downriver · ferry".
4. **Given** Kestrel clicks "ladder to the loft", **Then** the composer reads "I climb the ladder to
   the loft", has focus, and nothing is sent. Kestrel edits or sends it; the 066 flow follows.
5. **Given** the DM viewer, or a viewer with no character, **Then** ways on render as plain text.

---

### User Story 6 - A screen reader hears what the margin shows (Priority: P1)

Every fact the margin and the status strip show also appears as text in the stream.

**Independent Test**: `stream-items.test.mjs` parity cases; a Brave accessibility-tree read.

**Acceptance Scenarios**:

1. **Given** an encounter starts, **Then** the stream gets a Rules line "Initiative: Kestrel, Snag,
   Tamsin, Goblin lookout, Brother Odo, …".
2. **Given** a condition is applied or removed, **Then** a Rules line reads "Tamsin is prone." or
   "Tamsin is no longer prone."
3. **Given** a party member's HP changes, **Then** a Rules line reads "Kestrel: HP 9 → 5 (damage)."
4. **Given** a combatant drops or dies, **Then** a Rules line reads "Goblin lookout is dead."
5. **Given** the scene starts, **Then** the room block lists the party with HP and AC as text.
6. The stream is one `role="log"` region with `aria-live="polite"`. The margin and the status strip
   are not live regions, so no fact is announced twice.

### Edge Cases

- A `dm`-visibility row never reaches a player projection (`canSee`), so it yields no roll row,
  parity line, noun or way. This holds by construction; a test pins it.
- A roll row whose batch has no outcome (a damage roll alone) shows the roll total only.
- A combatant removed from the engine keeps its name in old rows from the ledger `before` value.
- An NPC enters the glossary only after its name appears in a visible stream line or a visible
  `arrived` row names it, so completion never names an NPC the table has not met.
- A noun inside a quoted name that contains another name matches the longest name first.
- History holds at most 50 lines. Text sent before this spec ships is in the log, so it is history
  too.
- A draft into a composer that holds text replaces it. The replaced text becomes the newest history
  entry for this page, so Up brings it back.
- A scene with no `ways` shows no "Ways on" line. A scene changed by the human DM's Change scene
  panel carries no `ways`, `description` or `cast`.

## Requirements *(mandatory)*

### Functional Requirements

**Layout**

- **FR-001**: Above the `narrow:` breakpoint (more than 700 px) the table is a stream column and a
  right margin. The margin is about 240 px wide and holds: a party list (name, class and level, HP,
  AC per member), a "Turn order" list with conditions per combatant, or "Not in combat." with the
  party's conditions. It scrolls on its own.
- **FR-002**: At `narrow:` the margin does not render. A mini-strip above the composer shows each
  other party member's HP, and the order as "Order: A › B › C…" (first three) in turn mode.
- **FR-003**: A status strip directly above the composer shows the viewer's character name, HP, AC,
  conditions and "Turn: free play" or "Turn: <name>" ("(you)" for the viewer). Every value is text.
- **FR-004**: The turn-order strip under the header is removed; FR-001 and FR-002 carry it (R2).
  The header's Party button and Party slide-out stay.
- **FR-005**: Margin, mini-strip and status strip derive only from `project(events, viewer)` and
  presence. They hold no state of their own.

**Stream**

- **FR-006**: Each `roll` ledger row with its batch's `outcome` row renders as one stream row at the
  roll's seq: "<actor> — <skill or attack> <total> ✓/✗" for a check, "<actor> — <attack> vs
  <target>: hit/miss/critical hit" for an attack. The row is a disclosure (`<details>` or a button
  with `aria-expanded`). Its expansion shows the dice faces, modifier, total and the DC or AC, worded
  as the Ledger slide-out words them (`ledger-format.ts`).
- **FR-007**: Rules lines render from ledger `change` rows: initiative at `encounter.started`,
  conditions at `condition.applied` and `condition.removed`, HP for party members at `hp.changed`,
  and life state at `life-state.changed`. Wording follows US6.
- **FR-008**: A `scene.changed` row with a non-null `after` renders as a room block: heading
  `location ?? title`, then `description` and "Ways on: …" when present (R1), then the party with
  HP and AC as text.
- **FR-009**: Every stream item has one category: **In character** (narration, IC talk, room
  blocks), **Table talk** (OOC talk, `@dm` posts, DM asides), **Rules** (roll rows, rules lines,
  floor lines, confirm rows, action cards). Chips "All", "In character", "Table talk", "Rules" form
  a single-select group (`aria-pressed`). "All" is the default. The chip is page state only.
- **FR-010**: Confirm rows the viewer can answer, and the viewer's own open action, show under every
  chip.
- **FR-011**: The stream is one element with `role="log"`, `aria-live="polite"` and the name
  "Table stream".

**Input**

- **FR-012**: History is the viewer's own `talk` rows in this session's projection, newest last,
  consecutive duplicates removed, capped at 50. It persists across reload because the log does.
- **FR-013**: Up recalls the previous history entry when no dropdown is open. Down moves forward.
  Down past the newest restores the unsent text that was in the composer before the first Up.
- **FR-014**: A `/` at the start of the line opens the command dropdown, filtered as typed. The set is
  closed: `/ooc`, `/help`, and `@dm` listed with its description. `/ooc` keeps 066's behaviour.
  `/help` opens an inline help block under the composer and sends nothing. Unknown `/words` are
  sent as typed, like any text.
- **FR-015**: Tab with a word before the caret completes it against the glossary (FR-017),
  case-insensitively by prefix. One match replaces the word with the name and a space. Two or more
  matches open the dropdown. Tab on an empty line, after a space, or with no match is not
  intercepted (WCAG 2.1.2).
- **FR-016**: The command dropdown, the 066 `@` dropdown and the Tab dropdown are one inline listbox
  component under the input: `role="listbox"`, `aria-activedescendant`, arrow keys, Enter, Escape.

**Glossary, nouns and ways**

- **FR-017**: The glossary is derived on the client: each party member (character facts), each
  engine combatant that is not a party member (monster facts), and each `cast` NPC (R1) once its
  name appears in a visible stream line or a visible `arrived` row names its id. Ways on of the
  current scene join the completion list only.
- **FR-018**: In narration and talk text, each whole-word occurrence of a glossary name is a button
  (longest name first). A one-word name matches case-sensitively, so the verb "snag" stays text. A
  name of two or more words matches case-insensitively, so "the goblin lookout" links. It toggles an inline expansion after the line, with
  `aria-expanded` and `aria-controls`. Facts: a character shows class and level, HP, AC,
  conditions; a monster shows name, conditions and down or dead; an NPC shows role and appearance.
  No other field is shown.
- **FR-019**: **The draft path.** `TableView` owns one function, `draft(text)`. It puts the text in
  the composer, sets the speaker to the viewer's character when the speaker is out of character,
  focuses the input with the caret at the end, and sends nothing. A replaced non-empty draft becomes
  the newest page-only history entry. Every click-to-draft caller uses this function: ways on now,
  map tokens and map ways later.
- **FR-020**: A way on renders as a button that calls `draft(way.draft)` for a viewer who controls a
  character. For any other viewer it renders as text.

**Constraints**

- **FR-021**: No modal. Every new surface is inline or in the existing `Panel`. The 030
  "Forbidden" list holds, including no `localStorage` or `sessionStorage`.
- **FR-022**: New colours come from Daylight tokens in `app/app.css` only. Every text and control
  pair used by a new surface meets WCAG AA (4.5:1 text, 3:1 large text and control boundaries) in
  light and dark, checked by a test that computes the ratios from the tokens.
- **FR-023**: Every surface works at 1280 px and 390 px with no sideways scroll.
- **FR-024**: No new gate request, event type, frame or migration. The only event change is R1.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): No capability here is human-only. A draft is a UI step before the
  existing `talk` request, which an agent sends directly. An agent authors `ways`, `description` and
  `cast` through the existing `scene` proposal (R1).
- **CR-004** (VI. 5e engine boundary): Roll rows and rules lines only render engine events from the
  log. No client code rolls or computes a number beyond formatting.
- **CR-005** (VIII. Operator-owned content): Seed `ways` are original text in the shipped seeds. No
  library content reaches the table.

### Key Entities

- **Stream item**: one rendered row with a seq, a category and a kind (talk, narration, confirm,
  action, floor, room, roll, rules line). Derived; never stored.
- **Glossary entry**: `{ name, kind: character | monster | npc, facts }`. Derived per render.
- **Way on**: `{ label, draft }` on the scene (R1).
- **Draft**: text placed in the composer by a click. It is page state until the player sends it.

## Decision gaps settled here

The decision lists the baseline and its constraints. These readings fill what it leaves open.

1. **History storage.** The task asks for history "persisted per browser". The 030 "Forbidden" list
   bans `localStorage` and `sessionStorage`, and cookies cannot hold 50 lines. Settled: history is
   derived from the viewer's own logged lines (FR-012). It survives reload with no storage, and it
   follows the account across browsers. A refused line is not in history; TASK-0162 owns refused
   drafts. Per-browser storage would be a third red item, not taken.
2. **`/roll` is not in the command set.** The mockup lists it, but players have no roll request (the
   engine rolls only through DM `mechanics`). Adding one is a gate change outside this layout spec.
3. **Monster facts show no HP or AC.** The analysis says "player-safe facts only". The margin shows
   party HP only, so a noun expansion does not reveal monster numbers.
4. **Room blocks render on `scene.changed` only.** The mockup's reed-camp block sits at encounter
   start, but encounter terrain is not player-facing seed text. No block at encounter start.
5. **Way drafts are authored.** A template ("I take the <label>") reads badly for labels like "back
   along the causeway", so each way carries its own `draft`.
6. **Confirm rows sit under "Rules".** The mockup tags them so. FR-010 keeps an answerable confirm
   visible under every chip, so a filter never hides a pending decision.
7. **The cast payload names every player-facing NPC.** `PlayerSeedView` is player-facing by contract,
   so no DM-only text leaves the server. The client gates completion and nouns by mention (FR-017).
   A player reading raw frames can see a name early; that is the accepted reach of R1 (a).

## Non-goals

- The slide-out map, tokens, positions and the "Open map" button (TASK-0070, TASK-0071).
- Action economy in the status strip (action, bonus, move). The engine tracks reactions only. The
  orchestrator should card it as engine work if wanted.
- A per-player rules-detail setting (OQ3: per-row expansion first).
- Player-written aliases, triggers, gags, macros and draggable layouts (rejected in the decision).
- `ways`, `description` and `cast` fields in the human DM's Change scene panel.
- Notifications when the tab is unfocused.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 1280 px and 390 px, in light and dark, the table shows party HP and AC, the turn
  order and conditions without opening any panel, with 0 sideways scroll.
- **SC-002**: For each fact the margin or the status strip shows in the combat fixture, a test finds
  the same fact as stream text: 100% parity.
- **SC-003**: Every text and control pair on the new surfaces measures at least 4.5:1 (3:1 for
  control boundaries) in both themes.
- **SC-004**: 0 sends happen from a draft click; the event log is unchanged after any number of
  draft clicks.
- **SC-005**: A player recalls her last line after a reload with 1 key press.
- **SC-006**: A player view never renders a fact from a `dm`-visibility row, an NPC field outside
  `PlayerSeedView`, or a monster HP or AC number in a noun expansion.
- **SC-007**: 0 `<dialog>`, `aria-modal` or `fixed inset-0` under `app/play/`.

## Assumptions

- Spec 066 lands its composer, mention dropdown and confirm row as planned. If it changes, the
  composer phase rebases onto what merged.
- Seeds ship authored `ways` for the Greyhollow Ford location only.
- The Ledger slide-out stays as the full record. Roll rows are a second view of the same rows.
