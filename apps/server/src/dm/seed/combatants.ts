import {
  type AttackEntry,
  type CombatantStats,
  DamageTypeSchema,
  type Side,
  SkillSchema,
} from "@the-stacks/dnd5e-engine";
import type { SrdRecord } from "@the-stacks/srd";
import type { SrdLookup } from "../pipeline/context.js";
import type { CombatantInit, SceneSeed } from "./schema.js";

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

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;

/**
 * SRD monster to engine stats (spec 082 D4, plan R2/R6). Skill and save totals are stored as
 * totals. An attack with no usable damage part is skipped; a part with a `condition` (for example
 * "if the attack roll had Advantage") is skipped, as spec 079's reaction rule did.
 */
export function statsFromSrd(monster: Monster): CombatantStats {
  const abilityMods: CombatantStats["abilityMods"] = {};
  const saves: CombatantStats["saves"] = {};
  for (const a of ABILITIES) {
    abilityMods[a] = monster.abilities[a].mod;
    saves[a] = monster.abilities[a].save;
  }
  const skills: CombatantStats["skills"] = {};
  for (const [name, total] of Object.entries(monster.skills)) {
    const key = SkillSchema.safeParse(name.toLowerCase().replace(/\s+/g, "-"));
    if (key.success) skills[key.data] = total;
  }
  const abilityScores: NonNullable<CombatantStats["abilityScores"]> = {};
  for (const a of ABILITIES) abilityScores[a] = monster.abilities[a].score;
  const attacks: AttackEntry[] = [];
  for (const action of monster.actions) {
    const atk = action.attack;
    if (!atk) continue;
    const damage: AttackEntry["damage"] = [];
    for (const part of atk.hit) {
      if (part.condition) continue;
      const type = DamageTypeSchema.safeParse(part.type.toLowerCase());
      if (!type.success) continue;
      damage.push({
        amount: part.dice
          ? { kind: "roll", expression: part.dice.replace(/\s+/g, "") }
          : { kind: "fixed", value: part.average },
        damageType: type.data,
      });
    }
    if (damage.length === 0) continue;
    attacks.push({
      name: action.name,
      range: atk.type,
      ...(atk.reach !== undefined ? { reachFt: atk.reach } : {}),
      ...(atk.range
        ? {
            rangeFt: {
              normal: atk.range.normal,
              long: atk.range.long ?? atk.range.normal,
            },
          }
        : {}),
      toHit: atk.bonus,
      damage: damage.slice(0, 4),
    });
  }
  return {
    abilityMods,
    proficiencyBonus: monster.pb,
    saves,
    skills,
    attacks: attacks.slice(0, 12),
    // ponytail: monster spellcasting is per-feature (OQ-7, TASK-0224); null until carded work lands.
    spellcastingAbility: null,
    abilityScores,
  };
}

type SeedCharacter = SceneSeed["characters"][number];

/** A seed PC's stats from its sheet; weapon range comes from the SRD weapon of the same name. */
export function statsFromCharacter(
  character: SeedCharacter,
  srd: Pick<SrdLookup, "getByName">,
): CombatantStats {
  const id = character.identity;
  const attacks: AttackEntry[] = id.attacks.map((a) => {
    const weapon = srd.getByName("equipment", a.name);
    const sw = weapon && weapon.category === "weapon" ? weapon : null;
    const range = sw ? sw.rangeType : "melee";
    const m = /^1d20([+-]\d+)?$/.exec(a.expression.replace(/\s+/g, ""));
    return {
      name: a.name,
      range,
      // SRD weapon: Reach property gives 10 ft (spec 094 FR-025); range is its normal/long.
      ...(sw?.properties.includes("Reach") ? { reachFt: 10 } : {}),
      ...(sw?.range ? { rangeFt: sw.range } : {}),
      toHit: m?.[1] ? Number(m[1]) : 0,
      damage: a.damage.map((d) => ({
        amount: {
          kind: "roll" as const,
          expression: d.dice.replace(/\s+/g, ""),
        },
        damageType: d.damageType,
      })),
    };
  });
  const cls = srd.getByName("class", id.class);
  return {
    abilityMods: id.abilityMods,
    proficiencyBonus: id.proficiencyBonus,
    saves: id.saves,
    skills: id.skills,
    attacks,
    spellcastingAbility: cls?.spellcastingAbility ?? null,
  };
}

/** SRD monster to an engine combatant — code, no model (scene-seed.md). */
export function combatantFromSrd(
  monster: Monster,
  combatantId: string,
  name: string | null,
  side: Side,
): CombatantInit {
  return {
    id: combatantId,
    side,
    name: name ?? monster.name,
    hp: { max: monster.hp.average },
    zeroHpRule: "dies",
    initiativeBonus: monster.initiative.mod,
    conModifier: monster.abilities.con.mod,
    ac: monster.ac,
    speed: monster.speed.walk,
    defenses: {
      resistances: engineTypes(monster.damageResistances),
      vulnerabilities: engineTypes(monster.damageVulnerabilities),
      immunities: engineTypes(monster.damageImmunities),
    },
    stats: statsFromSrd(monster),
  } as CombatantInit;
}
