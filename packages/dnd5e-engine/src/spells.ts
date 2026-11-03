import { z } from "zod";
import {
  AbilitySchema,
  ConditionKeySchema,
  DamageTypeSchema,
} from "./schema/state.js";

const DiceSchema = z.string().regex(/^\d+d\d+$/);

/**
 * Hand-authored spell mechanics keyed by SRD spell id (spec 083). The engine imports only
 * zod, so the table lives here; `apps/server/test/dm/spell-mechanics.test.ts` checks every
 * entry clause by clause against the SRD record text.
 */
export const SpellMechanicsSchema = z
  .strictObject({
    id: z.string(),
    level: z.number().int().min(0).max(9),
    srdPage: z.number().int(),
    delivery: z.discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("attack"),
        range: z.enum(["melee", "ranged"]),
      }),
      z.strictObject({
        kind: z.literal("save"),
        ability: AbilitySchema,
        onSuccess: z.enum(["none", "half"]),
      }),
      z.strictObject({ kind: z.literal("auto") }),
    ]),
    damage: z
      .array(z.strictObject({ dice: DiceSchema, damageType: DamageTypeSchema }))
      .max(2),
    healing: z
      .strictObject({ dice: DiceSchema, addModifier: z.boolean() })
      .nullable(),
    condition: z
      .strictObject({
        key: ConditionKeySchema,
        ends: z.literal("caster-next-turn-end"),
      })
      .nullable(),
    scaling: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("cantrip"), die: DiceSchema }),
      z.strictObject({ kind: z.literal("slot"), die: DiceSchema }),
      z.strictObject({ kind: z.literal("none") }),
    ]),
  })
  .refine((m) => m.damage.length > 0 || m.healing !== null || m.condition, {
    message: "a spell entry needs damage, healing or a condition",
  });
export type SpellMechanics = z.infer<typeof SpellMechanicsSchema>;

const none = { damage: [], healing: null, condition: null };

const ENTRIES: z.input<typeof SpellMechanicsSchema>[] = [
  {
    // SRD 5.2.1 p. 132, spell `fire-bolt`.
    ...none,
    id: "fire-bolt",
    level: 0,
    srdPage: 132,
    delivery: { kind: "attack", range: "ranged" },
    damage: [{ dice: "1d10", damageType: "fire" }],
    scaling: { kind: "cantrip", die: "1d10" },
  },
  {
    // SRD 5.2.1 p. 159, spell `sacred-flame`. "No benefit from cover" has no engine effect.
    ...none,
    id: "sacred-flame",
    level: 0,
    srdPage: 159,
    delivery: { kind: "save", ability: "dex", onSuccess: "none" },
    damage: [{ dice: "1d8", damageType: "radiant" }],
    scaling: { kind: "cantrip", die: "1d8" },
  },
  {
    // SRD 5.2.1 p. 143, spell `inflict-wounds`.
    ...none,
    id: "inflict-wounds",
    level: 1,
    srdPage: 143,
    delivery: { kind: "save", ability: "con", onSuccess: "half" },
    damage: [{ dice: "2d10", damageType: "necrotic" }],
    scaling: { kind: "slot", die: "1d10" },
  },
  {
    // SRD 5.2.1 p. 158, spell `ray-of-sickness`. Poisoned on a hit, to the end of the caster's next turn.
    ...none,
    id: "ray-of-sickness",
    level: 1,
    srdPage: 158,
    delivery: { kind: "attack", range: "ranged" },
    damage: [{ dice: "2d8", damageType: "poison" }],
    condition: { key: "poisoned", ends: "caster-next-turn-end" },
    scaling: { kind: "slot", die: "1d8" },
  },
  {
    // SRD 5.2.1 p. 121, spell `cure-wounds`.
    ...none,
    id: "cure-wounds",
    level: 1,
    srdPage: 121,
    delivery: { kind: "auto" },
    healing: { dice: "2d8", addModifier: true },
    scaling: { kind: "slot", die: "2d8" },
  },
  {
    // SRD 5.2.1 p. 139, spell `healing-word`.
    ...none,
    id: "healing-word",
    level: 1,
    srdPage: 139,
    delivery: { kind: "auto" },
    healing: { dice: "2d4", addModifier: true },
    scaling: { kind: "slot", die: "2d4" },
  },
];

export const SPELLS: Readonly<Record<string, SpellMechanics>> = Object.freeze(
  Object.fromEntries(
    ENTRIES.map((e) => {
      const m = SpellMechanicsSchema.parse(e);
      return [m.id, m];
    }),
  ),
);

const split = (dice: string): [number, number] => {
  const [n, f] = dice.split("d") as [string, string];
  return [Number(n), Number(f)];
};

/**
 * The dice a cast rolls. Cantrips add one base die at caster levels 5, 11 and 17; leveled
 * spells add `scaling.die` per slot level above the spell's level (the SRD `higherLevels` text).
 */
export function spellDice(
  m: SpellMechanics,
  slotLevel: number | null,
  casterLevel: number,
): { damage: string[]; healing: string | null } {
  const tiers = 1 + [5, 11, 17].filter((l) => casterLevel >= l).length;
  const extra = slotLevel === null ? 0 : Math.max(0, slotLevel - m.level);
  const scale = (dice: string): string => {
    const [n, faces] = split(dice);
    if (m.scaling.kind === "cantrip") return `${n * tiers}d${faces}`;
    if (m.scaling.kind === "slot") {
      return `${n + extra * split(m.scaling.die)[0]}d${faces}`;
    }
    return dice;
  };
  return {
    damage: m.damage.map((d) => scale(d.dice)),
    healing: m.healing ? scale(m.healing.dice) : null,
  };
}
