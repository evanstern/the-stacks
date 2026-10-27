import {
  activeActorFor,
  currentVersion,
  floorHeld,
  type SessionProjections,
  type StoredEvent,
} from "@the-stacks/session-model";
import { floorReason } from "./frames.ts";
import type { FloorInput } from "./source.ts";

export interface LocalEventInput {
  eventType: string;
  payload: unknown;
  payloadVersion: number;
}

const EMPTY_LOG_TS = "2026-01-01T00:00:00.000Z";

/**
 * A new array with one appended event: seq = last + 1, ts = last + 1 s (no clock read),
 * visibility public. Never mutates `events`.
 */
export function appendLocal(
  events: readonly StoredEvent[],
  input: LocalEventInput,
  actor: string,
): StoredEvent[] {
  const last = events.at(-1);
  const ts = new Date(
    Date.parse(last?.ts ?? EMPTY_LOG_TS) + (last ? 1000 : 0),
  ).toISOString();
  return [
    ...events,
    {
      sessionId: last?.sessionId ?? "00000000-0000-4000-8000-000000000000",
      seq: (last?.seq ?? 0) + 1,
      actor,
      type: input.eventType,
      payload: input.payload,
      payloadVersion: input.payloadVersion,
      visibility: "public",
      ts,
    },
  ];
}

/**
 * Fixture mode: the catalog events a `floor` request stands for, built from the projection
 * the way the live gate plans them (floor-request.md "Rows"). `take` and `return` are one
 * `table-mode.changed`; `end` is a `turn.advanced` batch of one, then `table-mode.changed`.
 * The fixture does not settle downed combatants (the live gate does). Null when the request
 * would be refused: a stale turn, no encounter, not turn mode, a wrong held state, or `take`
 * without a human DM seated.
 */
export function localFloorEvents(
  p: SessionProjections,
  input: FloorInput,
): LocalEventInput[] | null {
  const enc = p.encounter;
  if (p.tableMode.mode !== "turn" || !enc || !input.turn) return null;
  if (
    input.turn.round !== enc.round ||
    input.turn.combatantId !== enc.activeCombatantId
  ) {
    return null;
  }
  const reason = input.reason?.trim() || floorReason(input.op);
  const held = floorHeld(p);
  const modeChange = (after: {
    activeActor: string;
    activeCharacterId: string | null;
  }): LocalEventInput | null => {
    const version = currentVersion("table-mode.changed");
    if (version === undefined) return null;
    return {
      eventType: "table-mode.changed",
      payload: {
        reason,
        before: p.tableMode,
        after: { mode: "turn", ...after },
      },
      payloadVersion: version,
    };
  };

  if (input.op === "take") {
    if (held || p.gate.seat.kind !== "human") return null;
    const row = modeChange({
      activeActor: p.gate.seat.userId,
      activeCharacterId: null,
    });
    return row ? [row] : null;
  }
  if (input.op === "return") {
    if (!held) return null;
    const row = modeChange(activeActorFor(p, enc.activeCombatantId));
    return row ? [row] : null;
  }

  const next = (enc.turnIndex + 1) % enc.order.length;
  const nextId = enc.order[next]?.combatantId;
  const advanceVersion = currentVersion("turn.advanced");
  if (nextId === undefined || advanceVersion === undefined) return null;
  const advance: LocalEventInput = {
    eventType: "turn.advanced",
    payload: {
      batchId: `b-local-${p.throughSeq + 1}`,
      index: 0,
      count: 1,
      actionId: null,
      proposalId: null,
      event: {
        type: "turn.advanced",
        v: advanceVersion,
        reason,
        skipped: [],
        before: {
          round: enc.round,
          turnIndex: enc.turnIndex,
          combatantId: enc.activeCombatantId,
        },
        after: {
          round: next === 0 ? enc.round + 1 : enc.round,
          turnIndex: next,
          combatantId: nextId,
        },
      },
    },
    payloadVersion: advanceVersion,
  };
  const row = modeChange(activeActorFor(p, nextId));
  return row ? [advance, row] : null;
}
