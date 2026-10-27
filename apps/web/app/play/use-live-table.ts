import { project, type Viewer } from "@the-stacks/session-model";
import { useMemo } from "react";
import { useRevalidator } from "react-router";
import { useSession } from "../ws/useSession.ts";
import {
  approveFrame,
  commentFrame,
  commitFrame,
  declareFrame,
  type EventFrame,
  floorFrame,
  rejectFrame,
  talkFrame,
  withdrawFrame,
} from "./frames.ts";
import { selectPendingProposals } from "./proposals.ts";
import type { TableCommands, TableSource } from "./source.ts";
import { type LiveUser, viewerFor } from "./viewer.ts";

export type { LiveUser };

/**
 * A TableSource over one live session. Commands build frames with `play/frames.ts` and send
 * them; nothing renders until the server sends the event back (FR-004).
 */
export function useLiveTable(sessionId: string, user: LiveUser): TableSource {
  const revalidator = useRevalidator();
  const { events, status, caughtUp, notice, present, sendEvent } = useSession(
    sessionId,
    revalidator.revalidate,
  );
  // Seat and party arrive as events after load, so the viewer is re-derived from them. The
  // seed fold reads only the public seat and party rows, so a player seed serves every user.
  const viewer = useMemo<Viewer>(
    () => viewerFor(user, project(events, { role: "player", userId: user.id })),
    [events, user],
  );
  const proposals = useMemo(
    () => selectPendingProposals(events, viewer),
    [events, viewer],
  );
  const commands = useMemo<TableCommands>(() => {
    const send = (frame: EventFrame | null): boolean =>
      frame ? sendEvent(frame) : false;
    return {
      sendTalk: (input) => send(talkFrame(input)),
      declareAction: (input) => send(declareFrame(input)),
      comment: (input) => send(commentFrame(input)),
      commit: (input) => send(commitFrame(input)),
      withdraw: (input) => send(withdrawFrame(input)),
      floor: (input) => send(floorFrame(input)),
      // Decisions leave as gate requests; the panel drops a proposal when the decision
      // event comes back (contracts/proposal-seam.md).
      approve: (proposalId) => send(approveFrame(proposalId)),
      reject: (proposalId, reason) => send(rejectFrame(proposalId, reason)),
    };
  }, [sendEvent]);
  return {
    kind: "live",
    viewer,
    actor: user.id,
    events,
    status,
    caughtUp,
    notice,
    proposals,
    presence: present,
    commands,
  };
}
