import { isUnable } from "./commands/attacks.js";
import type { ModeSource } from "./derive.js";
import type { Combatant, Encounter, EngineState } from "./schema/state.js";

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

/** Spec 101: ids paired with `id` in melee in the active encounter. [] with no encounter. */
export function meleeFoes(state: EngineState, id: string): string[] {
  return (state.encounter?.melee ?? []).flatMap(([a, b]) =>
    a === id ? [b] : b === id ? [a] : [],
  );
}

/** The encounter with the sorted pair added; null when the pair already exists. */
export function withMeleePair(
  enc: Encounter,
  a: string,
  b: string,
): Encounter | null {
  const pair: [string, string] = a < b ? [a, b] : [b, a];
  const melee = enc.melee ?? [];
  if (melee.some(([x, y]) => x === pair[0] && y === pair[1])) return null;
  return { ...enc, melee: [...melee, pair] };
}

/** The `melee` slice with every pair holding `id` removed; {} when there is none. */
export function withoutMelee(
  enc: Encounter,
  id: string,
): Pick<Encounter, "melee"> {
  if (!enc.melee) return {};
  return { melee: enc.melee.filter(([a, b]) => a !== id && b !== id) };
}

/** FR-007: a melee use between hostile, co-zoned, placed combatants in an active encounter. */
export function meleePairFor(
  state: EngineState,
  attackerId: string,
  targetId: string,
): boolean {
  const a = state.combatants[attackerId];
  const t = state.combatants[targetId];
  const zone = a?.placement?.zoneId;
  return (
    !!state.encounter &&
    !!a &&
    !!t &&
    !!zone &&
    t.placement?.zoneId === zone &&
    areHostile(a, t)
  );
}

/**
 * SRD 5.2.1 playing-the-game.combat.ranged-attacks.ranged-attacks-in-close-combat.
 * Foes in a melee pair with the attacker (spec 101) that oppose it, are conscious, not unable
 * (isUnable), and not blinded. [] when the attacker is invisible, unplaced or sideless.
 * ponytail: "within 5 feet" is a melee pair (spec 101); grid mode (R5) measures feet.
 */
export function closeCombatFoes(
  state: EngineState,
  attackerId: string,
): string[] {
  const attacker = state.combatants[attackerId];
  const zone = attacker?.placement?.zoneId;
  if (!attacker || !zone || !attacker.side) return [];
  if (attacker.conditions.some((i) => i.condition === "invisible")) return [];
  const paired = new Set(meleeFoes(state, attackerId));
  return Object.values(state.combatants)
    .filter(
      (c) =>
        paired.has(c.id) &&
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
