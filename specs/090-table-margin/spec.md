# Feature Specification: Table margin and status strip

**Feature Branch**: `task-0236-mud-ux`

**Created**: 2026-11-05


**Status**: Draft, written against an accepted decision. The direction and OQ1 to OQ4 are ruled
(`docs/design/mud-ux/decision.md`, 2026-11-04). The operator ruled the frozen-contract change
**R2 (a) accept** on 2026-11-05 (under "Frozen-contract items"). On 2026-11-05 the operator also ruled to
build the half that does not depend on spec 066 (TASK-0199) now, and to defer the rest to spec 091
(`specs/091-mud-stream-and-composer/`, TASK-0247).

**Input**: TASK-0236. Decision record: `docs/design/mud-ux/decision.md` ("the decision" below).
Layout and states: `docs/design/mud-ux/round-1/b-margin.html`. Click-to-draft:
`docs/design/mud-ux/round-1/c-split.html`. Pattern rationale:
`docs/research/MUD-Client-UX/Analysis-Table-View-Pattern-Adoption.md` ("the analysis").

Authored against `.specify/templates/`. The spec number and branch were reserved, so the skills'
branch and directory steps were skipped. `speckit-clarify` was skipped: the decision rules every
open question.

## Scope

The decision's sequencing note splits the work. The operator split it again on 2026-11-05. This spec is
the first part. Spec 091 holds the rest.

- **In**: the Margin layout on today's table (party HP and AC, turn order, conditions; a 390 px
  mini-strip); the status strip; a contrast check in light and dark for these surfaces; the R2
  contract amendments for these surfaces.
- **Out, moved to spec 091** (`specs/091-mud-stream-and-composer/`, TASK-0247): R1 scene fields and
  seed ways; the stream items, roll rows, rules lines, room blocks and filter chips; the composer
  history, commands, Tab completion, glossary, nouns and the draft path; screen-reader parity.
  Spec 091 needs TASK-0199 (spec 066) merged and this spec merged.
- **Out, a named dependency**: the slide-out interactive map. It needs map data from milestone M6:
  TASK-0070 (PixiJS table, grid, tokens) and TASK-0071 (the DM drives tokens). The map ships later
  on this layout. It opens from an **Open map** button in the margin, inside the project's one
  slide-out `Panel` (right edge on desktop, bottom sheet at 390 px). A token click calls the same
  draft path spec 091 builds (FR-019). This spec renders no map button.

## Prerequisites

- **TASK-0199 (spec 066) is NOT a prerequisite.** Spec 066 also edits `apps/web/app/play/table-view.tsx`.
  Whichever of the two merges second merges `origin/main` into its branch first and resolves that file.
- R2 is ruled (see "Frozen-contract items").

## Data the UI needs: where it comes from

| Datum | Source today | Status |
|---|---|---|
| Party names, HP, AC, class and level | `p.party[].combatant` (`partyRows`, `play/party.ts`) | **Exists** |
| Conditions on every combatant | `p.party[].combatant.conditions`, `p.encounter.order[].conditions` | **Exists** |
| Turn order, active and next combatant | `p.encounter`, `ModeView.order` (`view-model.ts`) | **Exists** |
| Whose turn it is | `p.tableMode`, `ModeView.activeLabel` | **Exists** |
| Action economy (action, bonus, move) for the status strip | the engine tracks reactions only (`reactionsSpent`) | **Missing; not taken** (Non-goals) |

## Frozen-contract items (ruled 2026-11-05: R2 (a))

R1 (scene fields and seed ways) moved to spec 091.

**R2 — the play-route layout moves the turn-order strip and adds stream surfaces.**
Contracts: `specs/030-play-route/contracts/ui-surfaces.md` (Layout, Components, Accessible names),
`specs/049-turn-floor/contracts/ui-floor.md` ("Turn-order strip": "Under the header").

- The turn-order strip leaves its place under the header. It renders inside the margin on desktop and
  in the mini-strip at 390 px. Its list keeps the accessible name "Turn order".
- New surfaces here: the margin, the status strip and the mini-strip. Spec 091 adds the filter chips,
  room blocks, roll rows, parity lines, noun expansions and the command dropdown. The "Forbidden" list
  is unchanged.
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

## Requirements *(mandatory)*

### Functional Requirements

Requirement ids keep their numbers from the combined draft, so they match the decision and spec 091.

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

**Constraints**

- **FR-021**: No modal. Every new surface is inline or in the existing `Panel`. The 030
  "Forbidden" list holds, including no `localStorage` or `sessionStorage`.
- **FR-022**: New colours come from Daylight tokens in `app/app.css` only. Every text and control
  pair used by a new surface meets WCAG AA (4.5:1 text, 3:1 large text and control boundaries) in
  light and dark, checked by a test that computes the ratios from the tokens.
- **FR-023**: Every surface works at 1280 px and 390 px with no sideways scroll.
- **FR-024**: No new gate request, event type, frame or migration.

### Constitution-Driven Requirements *(mandatory)*

None beyond the constitution as a whole. Every value on these surfaces derives from the projection
(FR-005), so no client code rolls or computes a number. Spec 091 holds CR-001, CR-004 and CR-005.

## Decision gaps settled here

None of the seven gaps in the combined draft applies to the margin or the status strip. All seven
moved to spec 091.

## Non-goals

- The slide-out map, tokens, positions and the "Open map" button (TASK-0070, TASK-0071).
- Action economy in the status strip (action, bonus, move). The engine tracks reactions only. The
  orchestrator should card it as engine work if wanted.
- A per-player rules-detail setting (OQ3: per-row expansion first).
- Player-written aliases, triggers, gags, macros and draggable layouts (rejected in the decision).
- Everything listed under "Out, moved to spec 091" in Scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 1280 px and 390 px, in light and dark, the table shows party HP and AC, the turn
  order and conditions without opening any panel, with 0 sideways scroll.

- **SC-003**: Every text and control pair on the new surfaces measures at least 4.5:1 (3:1 for
  control boundaries) in both themes.

- **SC-007**: 0 `<dialog>`, `aria-modal` or `fixed inset-0` under `app/play/`.


SC-002 (stream parity) moved to spec 091, with the stream lines it measures.

## Assumptions

- Spec 066 may merge before or after this spec. Both edit `table-view.tsx` (see Prerequisites).
- The Ledger slide-out and the Party button stay as they are.
