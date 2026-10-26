import type {
  Combatant,
  ConditionInstance,
  EngineState,
} from "./schema/state.js";

export function conditionsOf(
  state: EngineState,
  combatantId: string,
): ConditionInstance[] {
  const c = state.combatants[combatantId];
  return c ? [...c.conditions] : [];
}

export function activeCombatant(state: EngineState): Combatant | null {
  const enc = state.encounter;
  if (!enc) return null;
  const entry = enc.order[enc.turnIndex];
  if (!entry) return null;
  return state.combatants[entry.combatantId] ?? null;
}
