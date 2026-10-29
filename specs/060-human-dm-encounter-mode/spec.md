# Feature Specification: Human DM ends an encounter or changes table mode from the table

**Feature Branch**: `task-0165-human-dm-encounter-mode`

**Created**: 2026-10-28

**Status**: Draft. OQ-1 to OQ-6 await the operator's ruling.

**Input**: TASK-0165. "A seated human DM can end an encounter and change table mode from the play
route, with no modal." Evidence: the TASK-0159 spec author (spec 055, commit 212a4f8, finding DC-1)
found that the play route gives a human DM no control for either. TASK-0159 keeps the table in turn
mode when the scene changes (spec 055 D-5). Why: the M3 demo's second run is `ask` mode with a human
DM (runbook checkpoint C7), and that DM may need to leave an encounter.

`speckit-clarify` was skipped. The code settles what the gate accepts. The open calls are operator
rulings (player-facing behaviour and who may act), listed as OQ-1 to OQ-6.

## Background: what exists today

### The gate already accepts both requests

No gate, schema or catalog change is needed. Both requests exist in the frozen 029 contracts.

- **End an encounter** is a `mechanics` proposal whose `command` is the engine's
  `{ type: "encounter.end", reason }` (`packages/dnd5e-engine/src/schema/commands.ts`). The engine
  (`commands/encounter.ts`, `handleEncounterEnd`) refuses `NO_ACTIVE_ENCOUNTER` with no encounter.
  Otherwise it emits one `condition.removed` per condition with an expiry, then one
  `encounter.ended` (`before`: the engine encounter, `after: null`). The gate writes them as one
  mechanics batch (`packages/session-model/src/gate/plan.ts`, `case "mechanics"`, `mechanicsRows`).
  Visibility defaults to `public`.
- **Change table mode** is a `table-mode` proposal: `{ kind: "table-mode", reason, after:
  TableModeSchema }`. `TableModeSchema` (`packages/session-model/src/events/table-mode.ts`) is
  `{ mode: "free" }` or `{ mode: "turn", activeActor, activeCharacterId | null }`. The planner
  writes one `table-mode.changed` row and fills `before` from the projection. It checks nothing
  else: it does not require an encounter for turn mode.
- **Permission** (`specs/029-proposal-gate/contracts/proposals.md`, matrix): a seated human DM's
  `mechanics` and `table-mode` requests are "applied directly". They skip the policy table. A
  player or an AI companion is `NOT_AUTHORIZED`.
- **Wire** (`specs/029-proposal-gate/contracts/ws-delivery.md`): a `send` frame with `eventType`
  `mechanics` or `table-mode`, the request without its `kind`, and `payloadVersion:
  GATE_REQUEST_VERSION`.

### The play route cannot send either

`apps/web/app/play/frames.ts` builds `talk`, `action.declare`, `action.comment`, `action.commit`,
`action.withdraw`, `floor`, `scene`, `proposal.approve` and `proposal.reject` frames. It builds no
`mechanics` frame and no `table-mode` frame. `TableCommands` (`apps/web/app/play/source.ts`) has no
command for either. The header (`components/table-header.tsx`) shows the mode badge and, in turn
mode, the floor controls (End turn, Pass, Take floor, Return floor; spec 049). None of them ends the
encounter or leaves turn mode.

A human DM can only approve or reject the AI DM's own encounter-end and table-mode proposals in the
approvals slide-out (policy `ask`, `DEFAULT_POLICIES`). The AI DM proposes them only when its
Director decides `tableMode.to = "free"` or ends the scene (`apps/server/src/dm/nodes/resolve.ts`,
`directorClosing`). The human DM cannot start that.

### How the AI DM leaves an encounter

`directorClosing` runs `encounter.end` (only when an encounter is active), then `table-mode`
`{ mode: "free" }`. The scene end does the same before its `scene` proposal. This spec mirrors that
order.

### What the AI DM does after a human-written row

`apps/server/src/dm/enqueue.ts`:

- Rule 4: a turn-mode `table-mode.changed` row written by a human queues the AI follow-up. An
  `ai:dm` active actor queues an `npc-turn`. A companion active actor queues a companion `turn`.
- A free-mode row, or a mechanics batch written by a human, queues nothing.

### The turn rules read the encounter

`currentTurn` (`packages/session-model/src/gate/turn.ts`) is null with no encounter. The floor
planner then refuses every `floor` request with `NOT_TURN_MODE`, and the header shows no floor
control. A table in turn mode with no encounter therefore has no way to pass the turn.
`activeActorFor(p, combatantId)` gives the table-mode actor for a combatant's turn.

### Sibling work

- Spec 055 (TASK-0159): the human DM's Change scene slide-out. It set the pattern this spec
  follows: a DM-only header button, a `Panel` slide-out, a schema-checked frame builder, a
  `TableCommands` method, a fixture-mode local-log builder, and additive 030 amendments.
- Spec 049 (TASK-0050): the floor controls and `localFloorEvents`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The DM ends an encounter (Priority: P1)

A human DM holds the seat. The table is in turn mode with an active encounter. The goblins flee.
The DM opens the "Table mode" slide-out, types a reason or leaves it blank, and clicks "End
encounter". The
turn-order strip leaves. The header badge reads "Free mode". Every player sees the same.

**Why this priority**: card AC #1. The C7 demo's human DM needs it to leave a fight.

**Independent Test**: render the table for the `turn-mode-combat` fixture's DM viewer at a step
with an active encounter in turn mode. Open the panel. Click "End encounter" (live: assert one
`mechanics` frame with `command.type: "encounter.end"` then one `table-mode` frame with
`after: { mode: "free" }`; fixture: assert an `encounter.ended` row and a `table-mode.changed`
row, and the badge reads "Free mode").

**Acceptance Scenarios**:

1. **Given** turn mode with an active encounter, **When** the DM clicks "End encounter", **Then**
   the client sends one `mechanics` request with `{ type: "encounter.end", reason }`, then one
   `table-mode` request with `after: { mode: "free" }` (OQ-2 (a)).
2. **Given** free mode with an active encounter (OQ-4 (a)), **When** the DM clicks "End
   encounter", **Then** the client sends only the `mechanics` request.
3. **Given** no active encounter, **When** the DM opens the panel, **Then** no "End encounter"
   button shows.
4. **Given** a live table, **When** the rows arrive, **Then** the header shows "Free mode" and no
   turn-order strip, for the DM and for each player.
5. **Given** a refused request, **When** the error frame arrives, **Then** the composer notice
   shows the refusal and the panel keeps its reason draft.

### User Story 2 - The DM changes table mode (Priority: P1)

A human DM holds the seat. An encounter is active. The DM wants a moment of free talk without
ending the fight. The DM opens the panel and clicks "Switch to free mode". Later the DM clicks
"Switch to turn mode", and the turn returns to the encounter's active combatant.

**Why this priority**: card AC #2.

**Independent Test**: render the panel for a DM viewer in turn mode. Click "Switch to free mode".
Assert one `table-mode` request with `after: { mode: "free" }`. Render it in free mode with an
encounter. Click "Switch to turn mode". Assert `after` is `{ mode: "turn", ...activeActorFor(p,
encounter.activeCombatantId) }`.

**Acceptance Scenarios**:

1. **Given** turn mode, **When** the DM clicks "Switch to free mode", **Then** the client sends one
   `table-mode` request with `after: { mode: "free" }`. The encounter stays (OQ-4 (a)).
2. **Given** free mode with an active encounter, **When** the DM clicks "Switch to turn mode",
   **Then** the request names the encounter's active combatant's actor (OQ-3 (a)).
3. **Given** free mode with no encounter, **When** the DM opens the panel, **Then** no turn-mode
   button shows, and the panel says "Turn mode needs an encounter. The AI DM starts one." (OQ-3 (a)).
4. **Given** turn mode switched on with an AI active actor, **When** the row lands, **Then** the
   server queues the AI follow-up (`enqueue.ts` rule 4, unchanged).

### Edge Cases

- A player viewer, or an operator who is not seated: no "Table mode" button and no panel (FR-008).
- The DM loses the seat while the panel is open: the gate refuses `NOT_AUTHORIZED`; the notice
  shows it.
- An AI DM turn ends the encounter between render and click: the engine refuses
  `NO_ACTIVE_ENCOUNTER`; the notice shows it. The free-mode request still lands, which is the end
  state the DM wanted.
- An empty reason, or one over 500 characters: the frame fails `ReasonSchema` and is not sent. The
  command returns `false` and the draft stays.
- The DM holds the floor (spec 049) and ends the encounter: the free-mode row replaces the held
  turn-mode row. Take floor and Return floor leave with the encounter.
- A pending AI DM `table-mode` or encounter-end proposal while the DM acts: it stays pending. The
  DM may reject it (OQ-6 consequences).
- A scene change in turn mode (spec 055 D-5): unchanged. The DM may now end the encounter first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The play route MUST build a `mechanics` gate request frame for an encounter end:
  `eventType: "mechanics"`, `payloadVersion: GATE_REQUEST_VERSION`, `payload: { command: { type:
  "encounter.end", reason }, actionId: null, visibility: "public", summary, rationale: null }`. It
  MUST parse `reason` with `ReasonSchema` before sending. A failing payload MUST NOT be sent.
  *(Card AC #1.)*
- **FR-002**: The play route MUST build a `table-mode` gate request frame: `eventType:
  "table-mode"`, `payloadVersion: GATE_REQUEST_VERSION`, `payload: { reason, after, summary,
  rationale: null }`. It MUST parse `after` with `TableModeSchema` and `reason` with
  `ReasonSchema`. *(Card AC #2.)*
- **FR-003**: `TableCommands` MUST gain `endEncounter(input)` and `setTableMode(input)`. Live mode
  sends the frames. `endEncounter` sends the free-mode frame after the mechanics frame, and only
  when the mechanics frame left and the table is in turn mode (OQ-2 (a)). Fixture mode appends the
  matching rows. Each returns `false` when its first request did not leave. *(Card AC #1, #2.)*
- **FR-004**: The play route MUST give a seated human DM a "Table mode" slide-out (`Panel`), opened
  from a DM-only header button (OQ-1 (a)). It MUST use no modal and no confirmation dialog.
  *(Card AC #1, #2.)*
- **FR-005**: The panel MUST show the current mode and whether an encounter is active, one optional
  reason field, and only the actions the state allows (FR-006). A blank reason sends the clicked
  action's default.
- **FR-006**: The panel MUST offer "End encounter" only with an active encounter, "Switch to free
  mode" only in turn mode, and "Switch to turn mode" only in free mode with an active encounter
  (OQ-3 (a), OQ-4 (a)).
- **FR-007**: "Switch to turn mode" MUST build `after` from `activeActorFor(p,
  encounter.activeCombatantId)`. The DM never types an actor id.
- **FR-008**: The button and the panel MUST render only when the viewer is the DM (`model.isDm`;
  live: the seated human DM) (OQ-5 (a)).
- **FR-009**: A refusal MUST show in the existing notice. The panel MUST keep its reason draft when
  a command returns `false`, and close when it returns `true`.
- **FR-010**: The change MUST add no gate request kind, proposal kind, event type, policy entry,
  engine command or server source change. It reuses `mechanics` and `table-mode`.
- **FR-011**: A test MUST render the panel for a DM viewer in turn mode with an encounter, assert
  "End encounter" and "Switch to free mode" show, and assert the encounter-end command sends the
  mechanics frame then the free-mode frame. *(Card AC #1.)*
- **FR-012**: A test MUST assert the table-mode command sends `after: { mode: "free" }` from turn
  mode, and the encounter's active actor from free mode. *(Card AC #2.)*
- **FR-013**: A test MUST assert the frame builders refuse an empty and an over-long reason and a
  malformed `after`.
- **FR-014**: A test MUST assert a player viewer sees no "Table mode" button.
- **FR-015**: The fixture and live sources MUST stay equivalent with the panel closed
  (`specs/030-play-route/contracts/table-source.md` rule 5).
- **FR-016**: A DB test MUST prove, on the real gate and enqueuer, that a seated human DM's
  encounter-end and free-mode requests apply directly and queue no AI DM turn, and that a
  turn-mode request naming a companion queues its companion turn.

### Card acceptance criteria map

| Card AC | Requirements | Proof |
|---|---|---|
| #1 The play route offers a seated human DM an end-encounter control built from a gate request, with no modal, and a test | FR-001, FR-003 to FR-006, FR-008, FR-009, FR-011, FR-013 to FR-016 | `frames.test.mjs`, `local-log.test.mjs`, `table-mode-panel.test.tsx`, `table-view.test.tsx`, `no-dialog.test.mjs`, the DB test, the Brave live check |
| #2 The play route offers a seated human DM a table-mode control built from a gate request, with no modal, and a test | FR-002 to FR-009, FR-012 to FR-016 | the same files |

### Key Entities

- **Encounter-end request** (029, unchanged): `mechanics` with `command: { type: "encounter.end",
  reason }`.
- **Table-mode request** (029, unchanged): `{ kind: "table-mode", reason, after: TableMode }`.
- **Table-mode view** (new, web-local): what the panel shows: `mode`, `encounterActive`,
  `canEnd`, `canFree`, `turnAfter` (the turn-mode `after`, or null when turn mode is not offered).

## Open questions

Each question changes what a DM or a player sees, or who may act. The recommended option is (a).
The operator rules each one; "Ruling:" stays blank until then.

### OQ-1 — Where the controls live

- **(a) Recommended.** One "Table mode" slide-out (`Panel`), opened from a DM-only "Table mode"
  header button. It holds the mode line, a reason field and the allowed action buttons.
  `TableHeader` gains `modeOpen` and `onMode` props.
  Consequences: one additive amendment to `specs/030-play-route/contracts/ui-surfaces.md`, the
  same shape as the ruled TASK-0159 `sceneOpen`/`onScene` amendment. The DM can read and edit a
  reason. Ending an encounter takes two clicks, which guards a misclick without a dialog.
- **(b)** Inline header buttons beside the floor controls ("End encounter", "Free mode", "Turn
  mode") with fixed reasons.
  Consequences: one click, no panel. The crowded header wraps more at 390 px. A misclick ends a
  fight with no undo (a new encounter rerolls initiative). No reason entry.
- **(c)** Add the controls to the Change scene slide-out.
  Consequences: no new header button. Mixes two concerns in one panel. The DM must open "Change
  scene" to leave a fight.

Ruling:

### OQ-2 — What "End encounter" sends

- **(a) Recommended.** The `mechanics` encounter-end request, then, when the table is in turn
  mode, `table-mode` `{ mode: "free" }`, back to back. The second is sent only when the first left.
  This mirrors the AI DM's closing move (`directorClosing`) and spec 055 D-3.
  Consequences: one click leaves a working table. If the engine refuses the end (no encounter), the
  free-mode row still lands, which is harmless.
- **(b)** Only the encounter-end request. The DM switches mode separately.
  Consequences: the table sits in turn mode with no encounter. `currentTurn` is null, so the floor
  controls vanish and no one can pass the turn until the DM clicks "Switch to free mode".
- **(c)** Send the free-mode request after the `encounter.ended` row arrives.
  Consequences: never sends free mode on a refused end. Needs pending-send state in the live source
  and a different fixture path.

Ruling:

### OQ-3 — What "Switch to turn mode" offers

- **(a) Recommended.** Offered only with an active encounter. `after` names the encounter's active
  combatant's actor (`activeActorFor`). With no encounter the panel says "Turn mode needs an
  encounter. The AI DM starts one."
  Consequences: turn mode always has a turn to pass, so the floor controls work. The human DM cannot
  start a fight from the table; the AI DM's Director proposes initiative (policy `ask`).
- **(b)** Also offered with no encounter: the DM picks the active actor (a party member, or the DM).
  Consequences: the gate accepts it. Floor requests refuse `NOT_TURN_MODE` (no encounter), so
  nobody can end the turn; only another mode change frees the table. The AI DM's turn rules assume
  an encounter.
- **(c)** With no encounter, "Start encounter": roll initiative for the party and a seed
  encounter's monsters, then set turn mode.
  Consequences: needs a participant picker, monster combatants and a seed read the play route lacks.
  Larger than this card; it would be a new card.

Ruling:

### OQ-4 — Free mode while an encounter is active

- **(a) Recommended.** "Switch to free mode" keeps the encounter. The turn-order strip hides
  (free mode). "Switch to turn mode" resumes at the encounter's active combatant. The panel says
  "The encounter stays active." beside the button.
  Consequences: the DM can pause a fight for talk. The AI DM's next turn sees free mode with an
  encounter; its Director may propose turn mode again (policy `ask`, the DM's call).
- **(b)** Offer "Switch to free mode" only with no encounter. The DM ends the encounter instead.
  Consequences: one path out of a fight. AC #2 then covers only "Switch to turn mode" with an
  encounter, and the free switch after an engine-side end with turn mode left behind.
- **(c)** "Switch to free mode" also ends the encounter.
  Consequences: AC #2 collapses into AC #1. No way to pause a fight.

Ruling:

### OQ-5 — Who may use the controls

- **(a) Recommended.** Only the seated human DM: the button renders when `model.isDm`, as spec 055
  D-6.
  Consequences: matches the 029 matrix. No gate change. An operator seats themself first
  (`dm.seat`).
- **(b)** Also an unseated operator.
  Consequences: amends the frozen 029 permission matrix and `viewerFor` (an operator views as a
  player on `/play`).

Ruling:

### OQ-6 — What the AI DM does after the human DM ends an encounter

- **(a) Recommended.** No server change. A human-written encounter end and free-mode row queue no
  AI DM turn (`enqueue.ts`, unchanged). The AI DM acts at the next commit. The DM narrates the end
  in talk if they wish. A pending AI DM encounter-end or table-mode proposal stays pending until the
  DM rejects it.
  Consequences: no surprise model call. The table is quiet until a player acts.
- **(b)** Queue an AI DM turn on a human-written `encounter.ended` row, so the AI DM narrates the
  aftermath.
  Consequences: changes `enqueue.ts` and `specs/031-dm-runtime/contracts/turn-jobs.md` "Enqueue".
  Each end costs a model turn. With a human seat that narration is itself an `ask` proposal.
- **(c)** Also reject pending AI DM `table-mode` and encounter-end proposals when the DM ends the
  encounter.
  Consequences: the approvals list stays clean. Each reject queues an `approval` turn (rule 2), so
  one click can trigger several AI DM turns.

Ruling:

### Deferral candidates (cards for the orchestrator, not rulings on this card)

- **DC-1** (only if OQ-3 is ruled (c) or later wanted): a human DM starts an encounter from the
  table (initiative for chosen participants). Today only the AI DM starts one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A seated human DM ends an active encounter in at most two clicks from the table, and
  the table leaves turn mode in the same action.
- **SC-002**: A seated human DM switches between free and turn mode in at most two clicks while an
  encounter is active.
- **SC-003**: Zero modals or confirmation dialogs appear in either flow.
- **SC-004**: The change adds zero gate request kinds, proposal kinds, event types, engine commands
  or server source changes.
- **SC-005**: No existing play-route or DB test regresses.

## Assumptions

- `summary` is "End the encounter", "Table mode: free" or "Table mode: turn". `rationale` is null.
- Default reasons, sent when the reason field is blank: "The DM ends the encounter.", "The DM
  switches to free mode.", "The DM switches to turn mode."
- The web tests run in Node with no DOM library. Clicks are proven by the Brave live check.
- Fixture mode builds the `encounter.ended` row by hand, as `localFloorEvents` does. It does not
  emit the engine's `condition.removed` rows for expiring conditions (the live gate does).
