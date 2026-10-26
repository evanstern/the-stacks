import type { StoredEvent, Viewer } from "@the-stacks/session-model";
import type { PendingProposalView, ProposalCommands } from "./proposals.ts";

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

export interface TalkInput {
  text: string;
  channel: "ic" | "ooc";
  characterId: string | null;
}
export interface DeclareInput {
  text: string;
  characterId: string | null;
  scope: "character" | "party";
}
export interface CommentInput {
  actionId: string;
  stance: "comment" | "approve" | "object";
  text: string;
}
export interface CommitInput {
  actionId: string;
  authority: "declarer" | "active-player" | "group" | "dm";
}

export interface TableCommands extends ProposalCommands {
  sendTalk(input: TalkInput): boolean;
  declareAction(input: DeclareInput): boolean;
  comment(input: CommentInput): boolean;
  commit(input: CommitInput): boolean;
}
