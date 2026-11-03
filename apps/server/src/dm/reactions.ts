import { DamageTypeSchema, type EngineState } from "@the-stacks/dnd5e-engine";
import type { SrdRecord } from "@the-stacks/srd";

type DamageType = (typeof DamageTypeSchema.options)[number];
type Amount =
  | { kind: "roll"; expression: string }
  | { kind: "fixed"; value: number };

/**
 * Opportunity attacks (spec 079, SRD 5.2.1 `playing-the-game.combat.melee-attacks.opportunity-attacks`).
 * Pure: resolve reads the reactor's numbers from the SRD record, never a model.
 */

/** The reactor's SRD melee attack as engine inputs, else null. */
export function meleeAttackOf(monster: SrdRecord<"monster">): {
  name: string;
  expression: string;
  components: { amount: Amount; damageType: DamageType }[];
} | null {
  for (const action of monster.actions) {
    const atk = action.attack;
    if (!atk || (atk.type !== "melee" && atk.type !== "melee-or-ranged")) {
      continue;
    }
    const components: { amount: Amount; damageType: DamageType }[] = [];
    for (const part of atk.hit) {
      if (part.condition) continue; // e.g. "if the attack roll had Advantage"
      const type = DamageTypeSchema.safeParse(part.type.toLowerCase());
      if (!type.success) continue;
      components.push({
        amount: part.dice
          ? { kind: "roll", expression: part.dice.replace(/\s+/g, "") }
          : { kind: "fixed", value: part.average },
        damageType: type.data,
      });
    }
    if (components.length === 0) continue;
    const sign = atk.bonus < 0 ? "-" : "+";
    return {
      name: action.name,
      expression: `1d20${sign}${Math.abs(atk.bonus)}`,
      components,
    };
  }
  return null;
}

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
