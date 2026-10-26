import { DamageTypeSchema } from "@the-stacks/dnd5e-engine";
import type { SrdRecord } from "@the-stacks/srd";
import type { CombatantInit } from "./schema.js";

type Monster = SrdRecord<"monster">;
type DamageType = (typeof DamageTypeSchema.options)[number];

function engineTypes(list: readonly string[]): DamageType[] {
  const out: DamageType[] = [];
  for (const raw of list) {
    const parsed = DamageTypeSchema.safeParse(raw.toLowerCase());
    if (parsed.success && !out.includes(parsed.data)) out.push(parsed.data);
  }
  return out;
}

/** SRD monster to an engine combatant — code, no model (scene-seed.md). */
export function combatantFromSrd(
  monster: Monster,
  combatantId: string,
  name: string | null,
): CombatantInit {
  return {
    id: combatantId,
    name: name ?? monster.name,
    hp: { max: monster.hp.average },
    zeroHpRule: "dies",
    initiativeBonus: monster.initiative.mod,
    conModifier: monster.abilities.con.mod,
    ac: monster.ac,
    defenses: {
      resistances: engineTypes(monster.damageResistances),
      vulnerabilities: engineTypes(monster.damageVulnerabilities),
      immunities: engineTypes(monster.damageImmunities),
    },
  } as CombatantInit;
}
