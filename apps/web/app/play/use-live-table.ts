import type { Viewer } from "@the-stacks/session-model";
import { useMemo } from "react";
import { useRevalidator } from "react-router";
import { useSession } from "../ws/useSession.ts";
import {
  approveFrame,
  commentFrame,
  commitFrame,
  declareFrame,
  type EventFrame,
  rejectFrame,
  talkFrame,
} from "./frames.ts";
import { selectPendingProposals } from "./proposals.ts";
import type { TableCommands, TableSource } from "./source.ts";

/** The signed-in user as the root loader supplies it. */
export interface LiveUser {
  id: string;
  role: string;
}

/** Operator is the DM viewer; a player views as themselves (research R4). */
export function viewerForUser(user: LiveUser): Viewer {
  return user.role === "operator"
    ? { role: "dm" }
    : { role: "player", userId: user.id };
}

/**
 * A TableSource over one live session. Commands build frames with `play/frames.ts` and send
 * them; nothing renders until the server sends the event back (FR-004).
 */
export function useLiveTable(sessionId: string, user: LiveUser): TableSource {
  const revalidator = useRevalidator();
  const { events, status, caughtUp, notice, sendEvent } = useSession(
    sessionId,
    revalidator.revalidate,
  );
  const viewer = useMemo(() => viewerForUser(user), [user]);
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
    commands,
  };
}
