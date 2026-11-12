import { INTENT_SCHEMA_VERSION, type Intent } from "@the-stacks/intent";
import {
  activeActorFor,
  currentVersion,
  floorHeld,
  type SessionProjections,
  type StoredEvent,
  suggestionState,
} from "@the-stacks/session-model";
import { floorReason, tableModeReason } from "./frames.ts";
import type {
  AcceptInput,
  EncounterEndInput,
  FloorInput,
  SceneInput,
  TableModeInput,
} from "./source.ts";

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

/**
 * Fixture mode: the `scene.changed` row a `scene` request stands for, with `before` read from
 * the projection. Null when both sides are null (the gate refuses it).
 */
export function localSceneEvents(
  p: SessionProjections,
  input: SceneInput,
): LocalEventInput | null {
  const version = currentVersion("scene.changed");
  if (version === undefined || (p.scene === null && input.after === null)) {
    return null;
  }
  return {
    eventType: "scene.changed",
    payload: { reason: input.reason, before: p.scene, after: input.after },
    payloadVersion: version,
  };
}

/**
 * Fixture mode: the `encounter.ended` mechanics row an end-encounter request stands for.
 * Null with no engine encounter. The fixture does not emit the engine's `condition.removed`
 * rows (the live gate does).
 */
export function localEncounterEndEvents(
  p: SessionProjections,
  input: EncounterEndInput,
): LocalEventInput[] | null {
  const version = currentVersion("encounter.ended");
  if (version === undefined || !p.engine.encounter) return null;
  return [
    {
      eventType: "encounter.ended",
      payload: {
        batchId: `b-local-${p.throughSeq + 1}`,
        index: 0,
        count: 1,
        actionId: null,
        proposalId: null,
        event: {
          type: "encounter.ended",
          v: version,
          reason: input.reason.trim() || tableModeReason("end"),
          before: p.engine.encounter,
          after: null,
        },
      },
      payloadVersion: version,
    },
  ];
}

/** Fixture mode: the `table-mode.changed` row a `table-mode` request stands for. */
export function localTableModeEvents(
  p: SessionProjections,
  input: TableModeInput,
): LocalEventInput | null {
  const version = currentVersion("table-mode.changed");
  if (version === undefined) return null;
  return {
    eventType: "table-mode.changed",
    payload: { reason: input.reason, before: p.tableMode, after: input.after },
    payloadVersion: version,
  };
}

const SPEECH_KINDS = new Set(["say", "say_to", "emote"]);
const OOC_KINDS = new Set(["ooc", "party", "ask_dm"]);

function carrierRow(intent: Intent): LocalEventInput | null {
  const version = currentVersion("intent.recorded");
  if (version === undefined) return null;
  return {
    eventType: "intent.recorded",
    payload: {
      intent,
      schemaVersion: INTENT_SCHEMA_VERSION,
      outcome: intent.commit === "declared" ? "declared" : "settled",
      batchId: null,
      facts: [],
      request: null,
      answers: null,
      stopped: null,
    },
    payloadVersion: version,
  };
}

/**
 * Fixture mode: the rows an `intent` request stands for. The `talk` row for speech and
 * out-of-character kinds comes first, then the `intent.recorded` carrier.
 * ponytail: carrier rows only, no engine rows. A fixture has no gate, and a surface never
 * calls the planner (constitution II), so a fixture shows no mechanical result. Upgrade path:
 * a fixture gate. Null when the schema version has no catalog entry.
 */
export function localIntentEvents(intent: Intent): LocalEventInput[] | null {
  const rows: LocalEventInput[] = [];
  const text = intent.text;
  const talkVersion = currentVersion("talk");
  if (
    text !== undefined &&
    talkVersion !== undefined &&
    (SPEECH_KINDS.has(intent.kind) || OOC_KINDS.has(intent.kind))
  ) {
    rows.push({
      eventType: "talk",
      payload: {
        text,
        channel: SPEECH_KINDS.has(intent.kind) ? "ic" : "ooc",
        characterId:
          SPEECH_KINDS.has(intent.kind) && "id" in intent.actor
            ? intent.actor.id
            : null,
      },
      payloadVersion: talkVersion,
    });
  }
  const carrier = carrierRow(intent);
  if (!carrier) return null;
  return [...rows, carrier];
}

/**
 * Fixture mode: the carrier row a 👍 stands for: the item's Intent at `confirmed`. Null when
 * the item is missing or its suggestion is stale. Carrier row only (see `localIntentEvents`).
 */
export function localAcceptEvents(
  p: SessionProjections,
  input: AcceptInput,
): LocalEventInput[] | null {
  const item = p.suggestions
    .find((s) => s.suggestionId === input.suggestionId)
    ?.items.find((i) => i.itemId === input.itemId);
  if (!item || suggestionState(p, item.intent.id) !== "live") return null;
  const row = carrierRow({
    ...item.intent,
    commit: "confirmed",
    source: "composer",
  });
  return row ? [row] : null;
}
