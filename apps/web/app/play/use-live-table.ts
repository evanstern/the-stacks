import { project, type Viewer } from "@the-stacks/session-model";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRevalidator } from "react-router";
import { useSession } from "../ws/useSession.ts";
import {
  approveFrame,
  commentFrame,
  commitFrame,
  declareFrame,
  type EventFrame,
  encounterEndFrame,
  floorFrame,
  rejectFrame,
  sceneFrame,
  tableModeFrame,
  tableModeReason,
  talkFrame,
  withdrawFrame,
} from "./frames.ts";
import { selectPendingProposals } from "./proposals.ts";
import type { TableCommands, TableSource } from "./source.ts";
import {
  fetchStartState,
  nextStartView,
  postStart,
  type SceneStartView,
  shouldPollStart,
} from "./start-scene.ts";
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
  const isOperator = user.role === "operator";
  const [startView, setStartView] = useState<SceneStartView>("unknown");
  const refreshStart = useCallback(async () => {
    const state = await fetchStartState(sessionId);
    setStartView((prev) =>
      nextStartView(
        prev,
        state ? { type: "fetched", state } : { type: "fetchFailed" },
      ),
    );
  }, [sessionId]);
  useEffect(() => {
    if (isOperator && caughtUp) void refreshStart();
  }, [isOperator, caughtUp, refreshStart]);
  const polling = shouldPollStart(startView);
  useEffect(() => {
    if (!isOperator || !polling) return;
    const timer = setInterval(() => void refreshStart(), 5000);
    return () => clearInterval(timer);
  }, [isOperator, polling, refreshStart]);
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
      changeScene: (input) => {
        const ok = send(sceneFrame(input));
        if (ok && input.closeProposalId) {
          send(rejectFrame(input.closeProposalId, null));
        }
        return ok;
      },
      endEncounter: (input) => {
        const ok = send(encounterEndFrame(input));
        if (ok && input.thenFree) {
          send(
            tableModeFrame({
              reason: input.reason.trim() || tableModeReason("end"),
              after: { mode: "free" },
            }),
          );
        }
        return ok;
      },
      setTableMode: (input) => send(tableModeFrame(input)),
      startScene: async (body) => {
        const result = await postStart(sessionId, body);
        if (result.ok) {
          setStartView((prev) => nextStartView(prev, { type: "started202" }));
        }
        void refreshStart();
        return result;
      },
      // Decisions leave as gate requests; the panel drops a proposal when the decision
      // event comes back (contracts/proposal-seam.md).
      approve: (proposalId) => send(approveFrame(proposalId)),
      reject: (proposalId, reason) => send(rejectFrame(proposalId, reason)),
    };
  }, [sendEvent, sessionId, refreshStart]);
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
    role: user.role,
    ...(isOperator ? { sceneStart: startView } : {}),
    commands,
  };
}
