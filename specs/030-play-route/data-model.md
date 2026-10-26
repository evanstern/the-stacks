# Data model: play route (TASK-0047)

The route adds no stored state, no event type and no migration. Every type below is a client-side
view type in `apps/web/app/play/`. Play state comes only from `project(events, viewer)`
(`@the-stacks/session-model`).

## Viewer and actor

```ts
import type { Viewer, StoredEvent, SessionProjections, ActionView } from "@the-stacks/session-model";

interface ViewerContext {
  viewer: Viewer;              // { role: "dm" } | { role: "player"; userId }
  actor: string;               // the actor id this viewer writes as
}
```

Live: `actor = user.id`. Fixture: DM → `fixtureIds.dmActor`; player → their user id (research R4).

## TableSource (contracts/table-source.md)

The only input `TableView` takes. Fields: `kind` (`"live" | "fixture"`), `viewer`, `actor`,
`events`, `status`, `caughtUp`, `notice`, `proposals`, `commands`.

## TableCommands

`sendTalk`, `declareAction`, `comment`, `commit`, `approve`, `reject`. Each returns `boolean`:
`true` when the request left (live) or applied (fixture). The view never renders the result itself;
it waits for the event (FR-004).

## TableViewModel (output of `toTableViewModel`)

| Field | Type | Source |
|---|---|---|
| `scene` | `{ title: string; location: string \| null } \| null` | `projections.scene` |
| `mode` | `ModeView` | `projections.tableMode` + `party` |
| `transcript` | `TranscriptItem[]` | `projections.transcript` + `actions` |
| `ledger` | `LedgerItem[]` | `projections.ledger` |
| `proposals` | `PendingProposalView[]` | `source.proposals` (DM only; `[]` for a player) |
| `composer` | `ComposerView` | `party`, viewer |
| `hiddenCount` | `number` | `skippedUnknownType + skippedUnknownVersion + skippedInvalid` |
| `isDm` | `boolean` | viewer |

### ModeView

```ts
type ModeView =
  | { mode: "free" }
  | { mode: "turn"; activeActor: string; activeLabel: string; isViewersTurn: boolean };
```

`activeLabel`: the party member named by `activeCharacterId`, else the member whose controller
matches `activeActor`, else `activeActor` itself.

### TranscriptItem

One per transcript entry of kind `talk`, `narration` or `action.declared`. Lifecycle entries after
`action.declared` fold into their card, not into separate items.

```ts
type TranscriptItem =
  | { kind: "talk"; seq: number; actorLabel: string; text: string; channel: "ic" | "ooc";
      characterLabel: string | null; whisper: boolean }
  | { kind: "narration"; seq: number; text: string }
  | { kind: "action"; seq: number; card: ActionCardView };
```

`whisper` is true when visibility is neither `public` nor `dm`.

### ActionCardView

```ts
interface ActionCardView {
  actionId: string;
  characterLabel: string | null;
  actorLabel: string;
  scope: "character" | "party";
  text: string;
  status: "declared" | "discussed" | "committed" | "resolved";
  comments: { seq: number; actorLabel: string; stance: "comment" | "approve" | "object"; text: string }[];
  open: boolean;                          // status is declared or discussed
  commit: CommitAuthority;                // research R6
  committed: { actorLabel: string; authority: ActionAuthority } | null;
  resolved: { outcome: "applied" | "refused" | "no-effect"; refusalCode: string | null } | null;
}

type CommitAuthority =
  | { canCommit: true; authority: "declarer" | "active-player" | "group" | "dm" }
  | { canCommit: false; holderLabel: string | null };
```

Status transitions are the fold's (specs/028 projections contract); the view never computes them.

### LedgerItem

```ts
type LedgerItem =
  | { kind: "roll"; seq: number; reason: string; expression: string;
      dice: { sides: number; faces: number[]; kept: boolean[] }[]; modifier: number;
      total: number; natural: number | null; hidden: boolean }
  | { kind: "outcome"; seq: number; reason: string; summary: string; hidden: boolean }
  | { kind: "change"; seq: number; reason: string; type: string; subject: string | null;
      fields: { path: string; before: string; after: string }[]; hidden: boolean };
```

`hidden` marks a DM-only row (visibility `dm`) so the DM sees which rows players do not.
`fields` comes from `changedFields(before, after)` (research R7); values are display strings, and a
`null` side is `"none"`.

### ComposerView

```ts
interface ComposerView {
  characters: { characterId: string; label: string }[];  // party members the viewer controls
  actionAvailable: boolean;                               // characters.length > 0
  actionHint: string | null;                              // why Action is unavailable
}
```

A player controls a member whose controller is `{ kind: "player", userId }` matching the viewer.
The DM controls none (the DM commits or overrides; it does not declare).

## PendingProposalView (contracts/proposal-seam.md)

`proposalId`, `kind`, `summary`, `proposer`, `proposerLabel`, `actionId`, `details`, `createdSeq`,
`ts`.

## Fixture table state

```ts
interface FixtureTableState {
  fixture: SessionFixture;       // from @the-stacks/session-model/fixtures
  viewerKey: string;             // "dm" or a player userId
  through: number;               // seq; events with seq <= through are shown
  local: StoredEvent[];          // appended by commands on this page; reset when through or viewer changes
  proposals: PendingProposalView[]; // fixture examples minus decided ones
}
```

`events` given to the source = fixture events with `seq <= through`, then `local`.
