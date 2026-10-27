import type { StoredEvent, Viewer } from "@the-stacks/session-model";
import type { SessionFixture } from "@the-stacks/session-model/fixtures";
import { useMemo, useState } from "react";
import {
  commentFrame,
  commitFrame,
  declareFrame,
  type EventFrame,
  localEventOf,
  talkFrame,
  withdrawFrame,
} from "./frames.ts";
import { appendLocal } from "./local-log.ts";
import {
  type PendingProposalView,
  selectPendingProposals,
} from "./proposals.ts";
import type { TableCommands, TableSource } from "./source.ts";

/** "dm", or the user id of one of the fixture's listed players (falls back to the DM). */
export function viewerForKey(
  fixture: SessionFixture,
  viewerKey: string,
): Viewer {
  const player = fixture.viewers.players.find(
    (v) => v.role === "player" && v.userId === viewerKey,
  );
  return player ?? fixture.viewers.dm;
}

/**
 * The proposals a viewer sees in a fixture: pending ones derived from its `proposal.*` events
 * through `selectPendingProposals`, minus those decided locally.
 */
export function proposalsFor(
  events: readonly StoredEvent[],
  viewer: Viewer,
  decided: ReadonlySet<string>,
): PendingProposalView[] {
  return selectPendingProposals(events, viewer).filter(
    (p) => !decided.has(p.proposalId),
  );
}

interface LocalState {
  /** Identity of the (fixture, viewer, step) the state belongs to. */
  key: string;
  local: StoredEvent[];
  decided: string[];
}

/**
 * A TableSource over a committed fixture. Commands append to a page-local copy (research R13);
 * the local copy and the decided proposals reset when the viewer or the step changes.
 */
export function useFixtureTable(
  fixture: SessionFixture,
  viewerKey: string,
  through: number,
  dmActor: string,
): TableSource {
  const key = `${fixture.name}|${viewerKey}|${through}`;
  const [state, setState] = useState<LocalState>({
    key,
    local: [],
    decided: [],
  });
  const current = state.key === key ? state : { key, local: [], decided: [] };

  const viewer = useMemo(
    () => viewerForKey(fixture, viewerKey),
    [fixture, viewerKey],
  );
  const actor = viewer.role === "dm" ? dmActor : viewer.userId;
  const base = useMemo(
    () => fixture.events.filter((e) => e.seq <= through),
    [fixture, through],
  );
  const events = useMemo(
    () => [...base, ...current.local],
    [base, current.local],
  );
  const decided = useMemo(() => new Set(current.decided), [current.decided]);
  const proposals = useMemo(
    () => proposalsFor(base, viewer, decided),
    [base, viewer, decided],
  );

  const commands = useMemo<TableCommands>(() => {
    function append(frame: EventFrame | null, authority?: string): boolean {
      const local = frame ? localEventOf(frame, authority) : null;
      if (!local) return false;
      setState((prev) => {
        const cur = prev.key === key ? prev : { key, local: [], decided: [] };
        const all = appendLocal([...base, ...cur.local], local, actor);
        return { ...cur, local: all.slice(base.length) };
      });
      return true;
    }
    function decide(proposalId: string): boolean {
      setState((prev) => {
        const cur = prev.key === key ? prev : { key, local: [], decided: [] };
        return { ...cur, decided: [...cur.decided, proposalId] };
      });
      return true;
    }
    return {
      sendTalk: (input) => append(talkFrame(input)),
      declareAction: (input) => append(declareFrame(input)),
      comment: (input) => append(commentFrame(input)),
      commit: (input) => append(commitFrame(input), input.authority),
      withdraw: (input) => append(withdrawFrame(input)),
      approve: (id) => decide(id),
      reject: (id) => decide(id),
    };
  }, [key, base, actor]);

  return {
    kind: "fixture",
    viewer,
    actor,
    events,
    status: "fixture",
    caughtUp: true,
    notice: null,
    proposals,
    commands,
  };
}
