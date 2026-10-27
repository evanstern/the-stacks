# Contract: the play route's floor surfaces

Binding for spec 049 (ruling Q1 A, Q2 A). Additive to `specs/030-play-route/contracts/`
(like spec 044's Q4). **No modal and no confirmation dialog.** Browser checks use Brave.

## Header (`components/table-header.tsx`)

Beside `ModeBadge`, in turn mode only:

| Viewer | Controls |
|---|---|
| The active player | **End turn** |
| The seated DM | **Pass**; **Take floor** when not held; **Return floor** when held |
| Anyone else | none |

Each control sends one `floor` request carrying the current `turn`. A refusal shows inline
like other refusals (`FLOOR_NOT_HELD`, `TURN_MOVED`, `NOT_TURN_MODE` get labels in
`labels.ts`).

`ModeBadge` shows "Turn mode · The DM has the floor" while held.

## Turn-order strip (`components/turn-order.tsx`, new)

Under the header, turn mode only. One entry per combatant in order: its name; the active
entry marked; the next entry flagged "next"; the viewer's own entries flagged "you". It wraps
at phone width. Built from `ModeView.order`, a pure function of the projection.

## Transcript

One `floor` line per turn-mode `table-mode.changed` row: "Bram's turn", "Your turn", or "The DM
has the floor". Free-mode changes add nothing.

## Action card

- A non-active player's own open character action in turn mode shows "Commits on your turn"
  instead of "Waiting for <active> to commit".
- A non-active party member's comment input on the active player's open character action
  reads "Suggest an alternative". The request is unchanged (`action.comment`, stance
  `comment`).

## Fixture route

`play/fixtures` lists `turn-floor`. Its steps match `floor-request.md` "Fixture".
