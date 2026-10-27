import {
  project,
  type StoredEvent,
  type Viewer,
} from "@the-stacks/session-model";
import type { SessionFixture } from "@the-stacks/session-model/fixtures";
import { useMemo, useState } from "react";
import type { PresenceEntry } from "../ws/types.ts";
import {
  commentFrame,
  commitFrame,
  declareFrame,
  type EventFrame,
  floorFrame,
  localEventOf,
  talkFrame,
  withdrawFrame,
} from "./frames.ts";
import { appendLocal, localFloorEvents } from "./local-log.ts";
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

/**
 * The static presence list a fixture shows: the human DM seat holder and every player who
 * controls a party member, each named for what the fixture calls them. Nobody is observing.
 */
export function fixturePresence(
  events: readonly StoredEvent[],
): PresenceEntry[] {
  const p = project(events, { role: "player", userId: "fixture-presence" });
  const byUser = new Map<string, string>();
  if (p.gate.seat.kind === "human") byUser.set(p.gate.seat.userId, "DM");
  for (const m of p.party) {
    if (m.controller.kind === "player" && !byUser.has(m.controller.userId)) {
      byUser.set(m.controller.userId, m.name);
    }
  }
  return [...byUser]
    .map(([userId, displayName]) => ({ userId, displayName }))
    .sort((a, b) => a.userId.localeCompare(b.userId));
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

  const presence = useMemo(() => fixturePresence(base), [base]);

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
    function appendFloor(
      input: Parameters<TableCommands["floor"]>[0],
    ): boolean {
      // Same validation as the live path; the rows come from the DM's full projection.
      if (!floorFrame(input)) return false;
      const rows = localFloorEvents(project(events, fixture.viewers.dm), input);
      if (!rows) return false;
      setState((prev) => {
        const cur = prev.key === key ? prev : { key, local: [], decided: [] };
        let all = [...base, ...cur.local];
        for (const row of rows) all = appendLocal(all, row, actor);
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
      floor: appendFloor,
      approve: (id) => decide(id),
      reject: (id) => decide(id),
    };
  }, [key, base, actor, events, fixture]);

  return {
    kind: "fixture",
    viewer,
    actor,
    events,
    status: "fixture",
    caughtUp: true,
    notice: null,
    proposals,
    presence,
    commands,
  };
}
