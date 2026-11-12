# Contract: TableSource — the one input of the shared table view (AC #7)

Binding inside this task. Module: `apps/web/app/play/source.ts` (types only, erasable TypeScript).
Both table routes render `<TableView source={source} />`; nothing else from `app/play/components/`
is imported by a route module.

```ts
import type { StoredEvent, Viewer } from "@the-stacks/session-model";
import type { PendingProposalView, ProposalCommands } from "./proposals";

export type SourceStatus = "connecting" | "open" | "retrying" | "fixture";

export interface TableSource {
  kind: "live" | "fixture";
  viewer: Viewer;
  /** The actor id this viewer's writes are recorded as. */
  actor: string;
  /** Every event visible to the viewer, ascending seq. Replayed and live arrive the same way. */
  events: readonly StoredEvent[];
  status: SourceStatus;
  /** False until replay completes (live); always true (fixture). */
  caughtUp: boolean;
  /** The last refused request, shown inline near the composer; null when none. */
  notice: string | null;
  /** Pending proposals for a DM viewer; always [] for a player viewer. */
  proposals: readonly PendingProposalView[];
  commands: TableCommands;
}

export interface TalkInput { text: string; channel: "ic" | "ooc"; characterId: string | null }
export interface DeclareInput { text: string; characterId: string | null; scope: "character" | "party" }
export interface CommentInput { actionId: string; stance: "comment" | "approve" | "object"; text: string }
export interface CommitInput { actionId: string; authority: "declarer" | "active-player" | "group" | "dm" }

export interface TableCommands extends ProposalCommands {
  sendTalk(input: TalkInput): boolean;
  declareAction(input: DeclareInput): boolean;
  comment(input: CommentInput): boolean;
  commit(input: CommitInput): boolean;
}
```

## Rules

1. `TableView` derives every rendered value from `project(source.events, source.viewer)`,
   `source.proposals` and `source.viewer` through `toTableViewModel`. It holds no play state of its
   own; only UI state (draft text, composer choice, which panel is open).
2. A command never inserts into `events` directly in live mode. The event appears when the server
   sends it back (no optimistic rendering, FR-004).
3. In fixture mode a command appends to the page's local copy (`play/local-log.ts`), which then
   flows back through `events` the same way.
4. A command returns `false` when it did not leave (socket closed, payload failed its schema, or
   no handler wired). The composer keeps the draft on `false`.
5. Equivalence (FR-025): for any event list `E` and viewer `V`, a fixture source and a live source
   whose `events` equal `E` and whose `viewer` equals `V` produce equal `TableViewModel`s and equal
   `renderToStaticMarkup(<TableView …/>)` output, apart from the `status` badge text.

## Builders

| Hook | Module | Builds |
|---|---|---|
| `useLiveTable(sessionId, user)` | `play/use-live-table.ts` | `kind: "live"`, events from `useSession`, commands from `play/frames.ts` (contracts/live-frames.md), proposals from `liveProposals` (contracts/proposal-seam.md) |
| `useFixtureTable(fixture, viewerKey, through)` | `play/use-fixture-table.ts` | `kind: "fixture"`, status `"fixture"`, events = fixture rows `seq <= through` then local appends, proposals from `play/fixtures/proposals.ts` for the DM |

Amendment (TASK-0159, operator ruling 2026-10-28, D-1): `TableCommands.changeScene`. Additive.

`TableCommands` gains `changeScene(input: SceneInput): boolean`. It returns true when the scene request
left (live) or was applied to the local log (fixture). `SceneInput` is `{ reason, after | null,
closeProposalId | null }`. Detail: `specs/055-human-dm-scene-change/contracts/scene-change.md`.

Amendment, TASK-0167 (additive, 2026-10-28): `TableSource.sceneStart`.

`TableSource` gains `sceneStart?: "unknown" | "none" | "queued" | "pending" | "started"`. Only a live
source for a user whose role is `operator` carries it; a fixture source and any other role leave it
absent. `useLiveTable` fills it from `GET /dm/sessions/:sessionId/start`. `TableView` offers
"Start scene" only on `none`. Detail: `specs/059-start-scene-queued/contracts/scene-start-state.md`.

Amendment, TASK-0165 (additive, 2026-10-28): two commands on `TableCommands`.

Operator ruling (card, 2026-10-28), answering "Do you accept the recommended defaults (a) for TASK-0165's OQ-1 to OQ-6?": "Accept all (a)".

`TableCommands` gains `endEncounter(input: EncounterEndInput): boolean` and
`setTableMode(input: TableModeInput): boolean`. A live source sends the frames in `live-frames.md`;
a fixture source appends `encounter.ended` and `table-mode.changed` rows. Each returns false when
the input fails its schema. Detail: `specs/060-human-dm-encounter-mode/contracts/table-mode-control.md`.

Amendment, TASK-0177 (additive, 2026-10-29): `TableCommands.seatDm?(input: DmSeatInput): boolean`. Live sources only; fixtures leave it absent. Operator ruling 2026-10-29: OQ-1 to OQ-6 all (a). See `specs/062-human-dm-seat/contracts/dm-seat-control.md`.

Amendment (TASK-0188, decision-0028 §8; operator ruling 2026-11-02: "All (a), amend"). Spec `specs/066-one-chat-stream`, D20 §1.

`TableCommands` loses `declareAction` and `comment`. It gains `accept(input: { suggestionId,
itemId }): boolean` and `suggest(input: { readSeq, items }): boolean`. `commit` stays, used by
the DM viewer only. Rule 1's UI state gains the speaker choice, the open dropdown, the interrupt
strip and the open confirm editor. The ring and Thinking are derived from `events` and the clock.

**Amendment (TASK-0199).** Amended 2026-11-11 (spec `specs/066-one-chat-stream`, plan.md "Frozen-contract amendments", row C-7; P-04, decision-0030).

> "Approve all" (operator, C-GATE ruling, 2026-11-11: approves C-1 to C-9 as written in spec 066 plan.md)

The composer sends `intent` requests in place of `talk` lines: parsed Intents, `declared` in free
mode and `confirmed` in turn mode. The active player's prose in turn mode goes as `action.declare`
then `action.commit`. `accept` and `suggest` stay. No `The party` speaker remains.
