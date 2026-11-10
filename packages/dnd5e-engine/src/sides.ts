import { isUnable } from "./commands/attacks.js";
import type { ModeSource } from "./derive.js";
import type { Combatant, EngineState } from "./schema/state.js";

/** party vs hostile, either way round. Neutral or missing sides oppose no one. */
export function areHostile(a: Combatant, b: Combatant): boolean {
  return (
    (a.side === "party" && b.side === "hostile") ||
    (a.side === "hostile" && b.side === "party")
  );
}

/** Hostile combatants in the encounter order with lifeState "conscious", in order. [] with no encounter. */
export function hostilesStanding(state: EngineState): string[] {
  if (!state.encounter) return [];
  return state.encounter.order
    .map((e) => state.combatants[e.combatantId])
    .filter(
      (c): c is Combatant =>
        c !== undefined && c.side === "hostile" && c.lifeState === "conscious",
    )
    .map((c) => c.id);
}

/** Active encounter, at least one sided combatant in the order, no hostile standing. */
export function encounterOver(state: EngineState): boolean {
  if (!state.encounter) return false;
  const sided = state.encounter.order.some(
    (e) => state.combatants[e.combatantId]?.side !== undefined,
  );
  return sided && hostilesStanding(state).length === 0;
}

/**
 * SRD 5.2.1 playing-the-game.combat.ranged-attacks.ranged-attacks-in-close-combat.
 * Combatants in the attacker's zone that oppose it, are conscious, not unable (isUnable),
 * and not blinded. [] when the attacker is invisible, unplaced or sideless.
 * ponytail: "within 5 feet" is "same zone" (spec 094 band engaged); grid mode (R5) measures feet.
 */
export function closeCombatFoes(
  state: EngineState,
  attackerId: string,
): string[] {
  const attacker = state.combatants[attackerId];
  const zone = attacker?.placement?.zoneId;
  if (!attacker || !zone || !attacker.side) return [];
  if (attacker.conditions.some((i) => i.condition === "invisible")) return [];
  return Object.values(state.combatants)
    .filter(
      (c) =>
        c.id !== attackerId &&
        c.placement?.zoneId === zone &&
        areHostile(attacker, c) &&
        c.lifeState === "conscious" &&
        !isUnable(c) &&
        !c.conditions.some((i) => i.condition === "blinded"),
    )
    .map((c) => c.id);
}

/** The engine's close-combat mode source for a ranged attack roll (weapon or spell). */
export function closeCombatSources(
  state: EngineState,
  attackerId: string,
  ranged: boolean,
): ModeSource[] {
  return ranged && closeCombatFoes(state, attackerId).length > 0
    ? ["disadvantage"]
    : [];
}
