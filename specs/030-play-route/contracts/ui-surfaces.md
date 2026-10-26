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
| `TableHeader` | `{ model, status, ledgerOpen, approvalsOpen, onLedger, onApprovals }` | scene, `ModeBadge`, status, panel triggers (approvals only when `model.isDm`) | #3, #5, #6 |
| `ModeBadge` | `{ mode: ModeView }` | "Free mode" / "Turn mode · Ana's turn" / "Turn mode · Your turn" | #3 |
| `Transcript` | `{ items, commands }` | talk lines (IC/OOC/whisper markers), narration, `ActionCard`s | #1, #2 |
| `ActionCard` | `{ card: ActionCardView, onComment, onCommit }` | text, character, declarer, scope, status chip, comments, inline comment form when open, `CommitControl`, outcome when resolved | #2 |
| `CommitControl` | `{ commit: CommitAuthority, onCommit }` | a "Commit" button (labelled with the authority, e.g. "Commit as DM") or "Waiting for Ana to commit" | #2 |
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
  "Approve", "Object".

## Forbidden

- `<dialog>`, `showModal`, `AlertDialog`, `Dialog` outside `ui/sheet.tsx`, `aria-modal` on anything
  but the Sheet itself, a centred overlay (`fixed inset-0` under `app/play/`).
- Importing `components/ui/sheet` anywhere but `components/panel.tsx`.
- A server `loader` on any table route. Library content on any table route (constitution VIII).
- `localStorage` or `sessionStorage` (chat-ui standing rule).
