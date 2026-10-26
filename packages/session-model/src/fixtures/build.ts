import type { EngineCommand, EngineEvent } from "@the-stacks/dnd5e-engine";
import type { StoredEvent } from "../stored-event.js";
import type { Viewer } from "../visibility.js";

/** Fixed identities shared by every fixture (contracts/fixtures.md). */
export const fixtureIds = {
  playerUserId: "00000000-0000-4000-8000-000000000001",
  otherPlayerUserId: "00000000-0000-4000-8000-000000000002",
  dmActor: "ai:dm",
  companionActor: "ai:companion:bram",
} as const;

export interface SessionFixture {
  /** Kebab-case, unique. */
  name: string;
  /** One paragraph: what the fixture exercises. */
  description: string;
  /** Fixed UUID, distinct per fixture. */
  sessionId: string;
  /** The viewers the fixture's facts are stated for. */
  viewers: { dm: Viewer; players: Viewer[] };
  /** seq 1..n ascending, fixed ts values. */
  events: readonly StoredEvent[];
}

export interface MechanicsRecipe {
  /** Fixture name. */
  fixture: string;
  batchId: string;
  /** The engine command, as TASK-0045 would send it. */
  command: EngineCommand;
  /** Scripted dice, consumed exactly. */
  faces: number[];
  /** Set when the engine refuses the command: the code the fixture records. */
  refusal?: string;
}

/** One row to number: everything but `seq`, `ts` and `sessionId`. */
export interface RowSpec {
  actor: string;
  type: string;
  payload: unknown;
  /** Default "public". */
  visibility?: string;
  /** Default 1. */
  payloadVersion?: number;
  /** Overrides the running counter; used only for a deliberate duplicate. */
  seq?: number;
}

/** The first timestamp is 2026-10-26T18:00:00.000Z; each seq adds one second. */
export function fixtureTs(seq: number): string {
  const two = (n: number) => String(n).padStart(2, "0");
  const hour = 18 + Math.floor(seq / 3600);
  return `2026-10-26T${two(hour)}:${two(Math.floor(seq / 60) % 60)}:${two(seq % 60)}.000Z`;
}

/**
 * Numbers rows from seq 1 and stamps ts. A row with an explicit `seq` keeps it and does not
 * advance the counter. Pure: no engine call, no clock.
 */
export function numberRows(
  sessionId: string,
  specs: readonly RowSpec[],
): StoredEvent[] {
  let next = 0;
  return specs.map((spec) => {
    const seq = spec.seq ?? ++next;
    return {
      sessionId,
      seq,
      actor: spec.actor,
      type: spec.type,
      payload: spec.payload,
      payloadVersion: spec.payloadVersion ?? 1,
      visibility: spec.visibility ?? "public",
      ts: fixtureTs(seq),
    };
  });
}

/** Wraps recorded engine events in mechanics envelopes (one batch). */
export function mechanicsBatch(
  batch: {
    batchId: string;
    actor: string;
    actionId?: string | null;
    visibility?: string;
  },
  events: readonly EngineEvent[],
): RowSpec[] {
  return events.map((event, index) => ({
    actor: batch.actor,
    type: event.type,
    visibility: batch.visibility ?? "public",
    payload: {
      batchId: batch.batchId,
      index,
      count: events.length,
      actionId: batch.actionId ?? null,
      proposalId: null,
      event,
    },
  }));
}
