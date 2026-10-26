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
