import type { MechanicsEvent, SessionNativeEvent } from "../catalog.js";
import type {
  AttackResolvedEvent,
  CheckResolvedEvent,
  DiceRolledEvent,
  LedgerRow,
  RestCompletedEvent,
} from "./types.js";

/** The ledger row for a mechanics event: roll, outcome or change. */
export function mechanicsRow(event: MechanicsEvent): LedgerRow {
  const { payload } = event;
  const e = payload.event;
  const common = {
    seq: event.seq,
    actor: event.actor,
    visibility: event.visibility,
    reason: e.reason,
    batchId: payload.batchId,
    index: payload.index,
    actionId: payload.actionId,
  };
  switch (e.type) {
    case "dice.rolled":
      return { kind: "roll", ...common, roll: e as DiceRolledEvent };
    case "attack.resolved":
    case "check.resolved":
    case "rest.completed":
      return {
        kind: "outcome",
        ...common,
        outcome: e as
          | AttackResolvedEvent
          | CheckResolvedEvent
          | RestCompletedEvent,
      };
    default:
      return {
        kind: "change",
        seq: event.seq,
        actor: event.actor,
        visibility: event.visibility,
        reason: e.reason,
        type: e.type,
        subject: "combatantId" in e ? e.combatantId : null,
        before: e.before,
        after: e.after,
        batchId: payload.batchId,
        index: payload.index,
        actionId: payload.actionId,
      };
  }
}

type StateChange = Extract<
  SessionNativeEvent,
  {
    type:
      | "table-mode.changed"
      | "scene.changed"
      | "party.member.changed"
      | "tracker.changed";
  }
>;

/** The ledger change row for a session-native state change. */
export function sessionChangeRow(event: StateChange): LedgerRow {
  let subject: string | null = null;
  if (event.type === "scene.changed") {
    subject = (event.payload.after ?? event.payload.before)?.sceneId ?? null;
  } else if (event.type === "party.member.changed") {
    subject = event.payload.characterId;
  } else if (event.type === "tracker.changed") {
    subject = event.payload.trackerId;
  }
  return {
    kind: "change",
    seq: event.seq,
    actor: event.actor,
    visibility: event.visibility,
    reason: event.payload.reason,
    type: event.type,
    subject,
    before: event.payload.before,
    after: event.payload.after,
    batchId: null,
    index: null,
    actionId: null,
  };
}
