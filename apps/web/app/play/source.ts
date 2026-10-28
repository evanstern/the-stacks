import type { StoredEvent, Viewer } from "@the-stacks/session-model";
import type { PresenceEntry } from "../ws/types.ts";
import type { PendingProposalView, ProposalCommands } from "./proposals.ts";
import type { SceneStartView, StartBody, StartResult } from "./start-scene.ts";

export type { SceneStartView } from "./start-scene.ts";

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
  /** Who is at the table; null when unknown (connecting, or a server without presence). */
  presence: readonly PresenceEntry[] | null;
  /** The signed-in user's account role; absent on fixtures. */
  role?: string;
  /** Live operator sources only. Absent for a fixture source and for a non-operator. */
  sceneStart?: SceneStartView;
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

export interface WithdrawInput {
  actionId: string;
}

export type FloorOp = "end" | "take" | "return";

/** One floor request: the op, the turn the viewer saw, and an optional reason. */
export interface FloorInput {
  op: FloorOp;
  turn: { round: number; combatantId: string } | null;
  reason?: string;
}

/** One scene change: the request, and the pending proposal it carries out (or null). */
export interface SceneInput {
  /** Trimmed; 1..500 (ReasonSchema). */
  reason: string;
  /** Null clears the scene. */
  after: {
    /** From the seed; never typed by the DM. */
    sceneId: string;
    title: string;
    summary: string;
    location: string | null;
  } | null;
  /** The pending proposal this change carries out, or null. */
  closeProposalId: string | null;
}

export interface TableCommands extends ProposalCommands {
  sendTalk(input: TalkInput): boolean;
  declareAction(input: DeclareInput): boolean;
  comment(input: CommentInput): boolean;
  commit(input: CommitInput): boolean;
  withdraw(input: WithdrawInput): boolean;
  floor(input: FloorInput): boolean;
  /** A `scene` gate request; closes `closeProposalId` after it leaves. True when sent/applied. */
  changeScene(input: SceneInput): boolean;
  /** Operator only; absent on fixtures. Posts to `/dm/sessions/<id>/start`. */
  startScene?(body: StartBody): Promise<StartResult>;
}
