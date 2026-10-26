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
  rejectFrame,
  talkFrame,
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
  const { events, status, caughtUp, notice, sendEvent } = useSession(
    sessionId,
    revalidator.revalidate,
  );
  // Seat and party arrive as events after load, so the viewer is re-derived from them. The
  // seed fold uses the account-role fallback; seat and party rows are public state.
  const viewer = useMemo<Viewer>(
    () =>
      viewerFor(
        user,
        project(
          events,
          user.role === "operator"
            ? { role: "dm" }
            : { role: "player", userId: user.id },
        ),
      ),
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
