# Contract: UI surfaces of the play route

Visual language: `docs/design/chat-ui/decision.md` (Daylight palette, the shared `Panel`, openable
triggers, AA contrast in light and dark). Standing rule: no modals.

## Layout (desktop; `narrow:` is 700 px or less)

```
┌ header ─────────────────────────────────────────────────────────────┐
│ Scene title · location     [Mode badge]  [status]  [Ledger ▸] [Approvals (2) ▸] │
├─────────────────────────────────────────────────────────────────────┤
│ notice: "3 entries not shown" (only when hiddenCount > 0)           │
│ transcript (scrolls): talk lines, narration, action cards           │
├─────────────────────────────────────────────────────────────────────┤
│ composer: (Talk | Action)  [IC | OOC] or [character] [This character | Party] │
│           [ text input .................................... ] [Send] │
│           inline notice (refused request), action hint              │
└─────────────────────────────────────────────────────────────────────┘
fixture mode only, above the header: fixture name · View as (DM | Ana's player | …) · ◂ seq n/N ▸ · "Fixture — changes are local"
```

Under `narrow:` the header wraps to two rows, the panels open as bottom sheets, and nothing
scrolls sideways.

## Components (`apps/web/app/play/components/`)

| Component | Props | Renders | AC |
|---|---|---|---|
| `TableView` (`play/table-view.tsx`) | `{ source: TableSource }` | everything below; owns open-panel and composer UI state | #7 |
| `TableHeader` | `{ model, status, ledgerOpen, approvalsOpen, onLedger, onApprovals, onFloor }` | scene, `ModeBadge`, `FloorControls`, status, panel triggers (approvals only when `model.isDm`) | #3, #5, #6 |
| `ModeBadge` | `{ mode: ModeView }` | "Free mode" / "Turn mode · Ana's turn" / "Turn mode · Your turn" / "Turn mode · The DM has the floor" | #3 |
| `FloorControls` (`components/floor-controls.tsx`) | `{ controls: FloorControls, onFloor }` | "End turn" (the active player); "Pass", "Take floor", "Return floor" (the seated DM). One `floor` request per click, no confirmation | 049 |
| `TurnOrder` (`components/turn-order.tsx`) | `{ order: OrderEntry[] }` | the strip under the header, turn mode only: one entry per combatant, the active entry marked, "next" and "you" flags, wraps at phone width | 049 |
| `Transcript` | `{ items, commands }` | talk lines (IC/OOC/whisper markers), narration, floor lines ("Bram's turn", "Your turn", "The DM has the floor"), `ActionCard`s | #1, #2 |
| `ActionCard` | `{ card: ActionCardView, onComment, onCommit }` | text, character, declarer, scope, status chip, comments, inline comment form when open, `CommitControl`, outcome when resolved | #2 |
| `CommitControl` | `{ commit: CommitAuthority, onCommit }` | a "Commit" button (labelled with the authority, e.g. "Commit as DM"), "Waiting for Ana to commit", or "Commits on your turn" for the viewer's own open action while another player is active | #2 |
| `Composer` | `{ composer: ComposerView, onTalk, onDeclare, disabled, notice }` | Talk/Action radio group, IC/OOC or character + scope radio groups, text input, Send | #1 |
| `LedgerList` | `{ items: LedgerItem[] }` | roll, outcome and change rows; change rows list `path: before → after` | #4 |
| `ProposalList` | `{ proposals, onApprove, onReject }` | each proposal: summary, kind, proposer, action, details; Approve; Reject expands an inline reason field and a confirm button; "No pending proposals" when empty | #5 |
| `FixtureToolbar` (`play/components/fixture-toolbar.tsx`) | `{ fixture, viewerKey, through, onViewer, onThrough }` | rendered by `routes/play-fixture.tsx` above `TableView`, never inside it | #7 |

`LedgerList` and `ProposalList` render inside the shared `Panel` (`components/panel.tsx`): titles
"Ledger" and "Pending proposals". The panels' ids match their triggers' `aria-controls`.

## Accessible names (tests and evidence select by these)

- Composer mode group: `role="radiogroup"`, name "Message type"; options "Talk" and "Action".
- Talk channel group: name "Channel"; options "In character" and "Out of character".
- Scope group: name "Scope"; options "This character" and "Whole party".
- Send button: "Send" (Talk) or "Declare" (Action).
- Panel triggers: "Ledger" and "Pending proposals" (with the count as visible text).
- Commit button: "Commit"; comment form: input "Comment on this action", stances "Comment",
  "Approve", "Object". Amended 2026-10-27 (TASK-0050, operator ruling Q2): on a non-active party
  member's view of the active player's open character action in turn mode, the input is named
  "Suggest an alternative". The request is unchanged (`action.comment`, stance `comment`).
- Floor controls: buttons "End turn", "Pass", "Take floor", "Return floor"; turn-order strip: list
  named "Turn order". Amended 2026-10-27 (TASK-0050, operator ruling Q1).

## Forbidden

- `<dialog>`, `showModal`, `AlertDialog`, `Dialog` outside `ui/sheet.tsx`, `aria-modal` on anything
  but the Sheet itself, a centred overlay (`fixed inset-0` under `app/play/`).
- Importing `components/ui/sheet` anywhere but `components/panel.tsx`.
- A server `loader` on any table route. Library content on any table route (constitution VIII).
- `localStorage` or `sessionStorage` (chat-ui standing rule).

Amended 2026-10-27 (TASK-0050, operator ruling Q1, Q2): the floor surfaces above (`FloorControls`,
`TurnOrder`, the floor transcript line, the held-floor badge text, "Commits on your turn", the
"Suggest an alternative" label). Additive: no existing surface changes. The operator's words:
"TASK-0050: I accept the recommended defaults FT-1 to FT-5 and Q1 to Q6, including the
frozen-contract amendments to 029, 031 and 044 and the one jobs migration." Detail:
`specs/049-turn-floor/contracts/ui-floor.md`.

Amendment (TASK-0159, operator ruling 2026-10-28, D-1): the human DM's "Change scene" slide-out.
Additive: no existing surface changes. The operator's words: "TASK-0159: I accept the recommended
defaults OQ-1 to OQ-7 (A), including the 030 TableHeader amendment. Card DC-1 (human DM ends an
encounter or changes table mode) in m-3; card DC-2 as a revisit."

| Surface | Change |
|---|---|
| `TableHeader` | gains `sceneOpen: boolean` and `onScene?: () => void`. When `model.isDm` and `onScene` is set, it renders a button named "Change scene" with `aria-controls="scene-panel"` and `aria-expanded={sceneOpen}`. |
| `ScenePanel` | `components/scene-panel.tsx`; props `view: SceneChangeView`, `onApply(input: SceneInput): boolean`. `TableView` mounts it in the shared `Panel` (title "Change scene", id `scene-panel`) only when `model.sceneChange` is not null. |

Accessible names: seed buttons "Use: <label>" under the headings "Suggestions" and "Earlier suggestions"
(tags "Suggestion", "Proposal"); "Use: Current scene"; fields "Scene id" (read-only), "Scene title",
"Scene summary", "Scene location", "Reason for the change"; checkbox "Clear the scene"; button
"Apply"; texts "The table stays in turn mode." and "No scene to change yet. Start a scene, or wait
for the AI DM's suggestion." Detail: `specs/055-human-dm-scene-change/contracts/scene-change.md`.

Amendment, TASK-0167 (additive, 2026-10-28): the header's start note.

`TableHeader` takes `startNote?: "queued" | "pending"` in place of `startQueued?: boolean`. It renders
a `role="status"` text: `Scene start queued.` for `queued`, `Scene start waiting for the DM.` for
`pending`. The "Start scene" button shows only while the source's `sceneStart` is `none`.
Detail: `specs/059-start-scene-queued/contracts/scene-start-state.md`.

Amendment, TASK-0165 (additive, 2026-10-28): the Table mode slide-out.

Operator ruling (card, 2026-10-28), answering "Do you accept the recommended defaults (a) for TASK-0165's OQ-1 to OQ-6?": "Accept all (a)".

| Surface | Change |
|---|---|
| `TableHeader` | gains `modeOpen: boolean` and `onMode?: () => void`. When `model.isDm` and `onMode` is set, it renders a button named "Table mode" with `aria-controls="table-mode-panel"` and `aria-expanded={modeOpen}`. |
| `TableModePanel` | `components/table-mode-panel.tsx`; props `view: TableModeView`, `onEndEncounter(input): boolean`, `onSetMode(input): boolean`. `TableView` mounts it in the shared `Panel` (title "Table mode", id `table-mode-panel`) only when `model.tableMode` is not null. |

Accessible names: field "Reason (optional)"; buttons "End encounter", "Switch to free mode",
"Switch to turn mode", each shown only when allowed; texts "Encounter active.", "No encounter.",
"The encounter stays active." and "Turn mode needs an encounter. The AI DM starts one." No dialog.
Detail: `specs/060-human-dm-encounter-mode/contracts/table-mode-control.md`.

Amendment, TASK-0177 (additive, 2026-10-29): the operator's "DM seat" slide-out. Operator ruling 2026-10-29: OQ-1 to OQ-6 all (a). See `specs/062-human-dm-seat/contracts/dm-seat-control.md`.
`TableHeader` gains `seatOpen: boolean` and `onSeat?: () => void`; with `onSeat` set it renders a button named "DM seat" (`aria-controls="dm-seat-panel"`) beside "Start scene". `DmSeatPanel` (`components/dm-seat-panel.tsx`; props `view`, `onSeat`) mounts in the shared `Panel` only when `canSeat` (live, operator, caught up, `commands.seatDm` set). Accessible names: select "Seat a human DM", buttons "Seat as DM" and "Return the seat to the AI DM". `StartScenePanel` and `StartSceneForm` gain `dmUserId: string | null`; a seat naming it shows "The DM cannot hold a character seat.". No dialog.

Amended by spec 072 (TASK-0164, additive): the Party slide-out. `TableHeader` gains `partyOpen: boolean` and `onParty: () => void`, and renders a button named "Party" (`aria-controls="party-panel"`, `aria-expanded={partyOpen}`) before "Ledger", for every viewer. `PartyPanel` (`components/party-panel.tsx`; props `rows: PartyRow[]`, `order: OrderEntry[]`) mounts in the shared `Panel` (title "Party", id `party-panel`); rows come from `partyRows` in `play/party.ts`. `TurnOrder` gains an optional `label` prop (default "Turn order"). Accessible names: list "Party", list "Initiative", badge "Your character", label "AI companion". No dialog.
