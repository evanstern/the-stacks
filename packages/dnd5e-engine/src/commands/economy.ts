import type { Handler } from "../handler.js";
import { refuse } from "../schema/refusals.js";
import type { Encounter, EngineState } from "../schema/state.js";
import { actorUnable, isUnable } from "./attacks.js";
import { effectiveSpeed } from "./move.js";

type Economy = NonNullable<Encounter["economy"]>;

/** The economy record of the active turn, or null when it is stale or absent (the movement rule). */
function currentEconomy(state: EngineState, id: string): Economy | null {
  const enc = state.encounter;
  if (!enc) return null;
  const active = enc.order[enc.turnIndex]?.combatantId;
  const e = enc.economy;
  if (active !== id || !e || e.combatantId !== id || e.round !== enc.round) {
    return null;
  }
  return e;
}

/** Spec 117 FR-005. null outside an encounter or for an id not in the order. */
export function actionsLeft(
  state: EngineState,
  combatantId: string,
): { action: boolean; bonusAction: boolean } | null {
  const enc = state.encounter;
  if (!enc || !enc.order.some((o) => o.combatantId === combatantId)) {
    return null;
  }
  const e = currentEconomy(state, combatantId);
  return { action: !e?.actionUsed, bonusAction: !e?.bonusActionUsed };
}

/** Spec 117 FR-010. */
export function isDodging(state: EngineState, combatantId: string): boolean {
  const c = state.combatants[combatantId];
  if (!c || !state.encounter?.dodging?.includes(combatantId)) return false;
  // ponytail: the benefit is computed, not removed. If Incapacitated or Speed 0 ends before the dodger's next turn, the benefit returns. Emit a removal when a condition hook exists.
  return !isUnable(c) && effectiveSpeed(c) !== 0;
}

/** Shared refusal ladder of FR-003 and FR-008 (everything before the slot check). */
function turnGate(state: EngineState, id: string) {
  if (!state.combatants[id]) {
    return refuse("UNKNOWN_COMBATANT", `no combatant "${id}"`, {
      combatantId: id,
    });
  }
  const enc = state.encounter;
  if (!enc) return refuse("NO_ACTIVE_ENCOUNTER", "no encounter is active");
  if (enc.order[enc.turnIndex]?.combatantId !== id) {
    return refuse("MOVE_OFF_TURN", `it is not "${id}"'s turn`, {
      combatantId: id,
    });
  }
  return actorUnable(state, id, "actor");
}

export const handleActionSpend: Handler<"action.spend"> = (state, command) => {
  const id = command.combatantId;
  const refused = turnGate(state, id);
  if (refused) return refused;
  const enc = state.encounter as Encounter;
  const slot = command.cost === "action" ? "actionUsed" : "bonusActionUsed";
  const base = currentEconomy(state, id) ?? {
    combatantId: id,
    round: enc.round,
    actionUsed: false,
    bonusActionUsed: false,
  };
  if (base[slot]) {
    return refuse(
      "ACTION_SPENT",
      `"${id}" has used its ${command.cost === "action" ? "Action" : "Bonus Action"} this turn`,
      { combatantId: id, cost: command.cost },
    );
  }
  return {
    ok: true,
    events: [
      {
        type: "encounter.changed",
        v: 1,
        reason: command.reason,
        combatantId: id,
        before: enc,
        after: { ...enc, economy: { ...base, [slot]: true } },
      },
    ],
  };
};

export const handleDodge: Handler<"dodge"> = (state, command) => {
  const id = command.combatantId;
  const refused = turnGate(state, id);
  if (refused) return refused;
  const enc = state.encounter as Encounter;
  return {
    ok: true,
    events: [
      {
        type: "encounter.changed",
        v: 1,
        reason: command.reason,
        combatantId: id,
        before: enc,
        after: { ...enc, dodging: [...new Set([...(enc.dodging ?? []), id])] },
      },
    ],
  };
};
