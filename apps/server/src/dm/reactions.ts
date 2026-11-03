import type { EngineState } from "@the-stacks/dnd5e-engine";

/**
 * Opportunity attacks (spec 079, SRD 5.2.1 `playing-the-game.combat.melee-attacks.opportunity-attacks`).
 * Pure: resolve reads the reactor's numbers from its engine stats (spec 082), never a model.
 */

const INCAPACITATING = [
  "incapacitated",
  "paralyzed",
  "petrified",
  "stunned",
  "unconscious",
];

/** Which `leavesReachOf` ids may take an opportunity attack now. */
export function reactors(input: {
  moverId: string;
  leavesReachOf: readonly string[];
  engine: EngineState;
  partyCombatantIds: ReadonlySet<string>;
  /** combatantId -> srdMonsterId, from the seed's encounters. */
  encounterMonsters: ReadonlyMap<string, string>;
}): string[] {
  const { engine } = input;
  const enc = engine.encounter;
  if (!enc || !input.partyCombatantIds.has(input.moverId)) return [];
  const out: string[] = [];
  for (const id of input.leavesReachOf) {
    if (out.includes(id) || !input.encounterMonsters.has(id)) continue;
    if (!enc.order.some((e) => e.combatantId === id)) continue;
    const c = engine.combatants[id];
    if (!c || c.lifeState !== "conscious") continue;
    if (c.conditions.some((i) => INCAPACITATING.includes(i.condition)))
      continue;
    if (enc.reactionsSpent?.includes(id)) continue;
    out.push(id);
  }
  return out;
}
