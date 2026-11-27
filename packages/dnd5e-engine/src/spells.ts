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
    castingTime: z.enum(["action", "bonus-action"]),
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
    // Spec 124: a concentration spell that grants a roll bonus die to its targets.
    effect: z
      .strictObject({
        kind: z.literal("roll-bonus"),
        die: DiceSchema,
        applies: z
          .array(z.enum(["attack", "saving-throw", "ability-check"]))
          .min(1),
        skillChoice: z.boolean(),
        targets: z.strictObject({
          base: z.number().int().min(1),
          perSlotLevel: z.number().int().min(0),
        }),
        concentration: z.literal(true),
        durationRounds: z.number().int().min(1),
      })
      .optional(),
    scaling: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("cantrip"), die: DiceSchema }),
      z.strictObject({ kind: z.literal("slot"), die: DiceSchema }),
      z.strictObject({ kind: z.literal("none") }),
    ]),
  })
  .refine(
    (m) => m.damage.length > 0 || m.healing !== null || m.condition || m.effect,
    {
      message: "a spell entry needs damage, healing, a condition or an effect",
    },
  );
export type SpellMechanics = z.infer<typeof SpellMechanicsSchema>;

const none = { damage: [], healing: null, condition: null };

const ENTRIES: z.input<typeof SpellMechanicsSchema>[] = [
  {
    // SRD 5.2.1 p. 132, spell `fire-bolt`.
    ...none,
    id: "fire-bolt",
    castingTime: "action",
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
    castingTime: "action",
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
    castingTime: "action",
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
    castingTime: "action",
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
    castingTime: "action",
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
    castingTime: "bonus-action",
    level: 1,
    srdPage: 139,
    delivery: { kind: "auto" },
    healing: { dice: "2d4", addModifier: true },
    scaling: { kind: "slot", die: "2d4" },
  },
  {
    // SRD 5.2.1 p. 113, spell `bless`. Concentration, up to 1 minute (10 rounds).
    ...none,
    id: "bless",
    castingTime: "action",
    level: 1,
    srdPage: 113,
    delivery: { kind: "auto" },
    effect: {
      kind: "roll-bonus",
      die: "1d4",
      applies: ["attack", "saving-throw"],
      skillChoice: false,
      targets: { base: 3, perSlotLevel: 1 },
      concentration: true,
      durationRounds: 10,
    },
    scaling: { kind: "none" },
  },
  {
    // SRD 5.2.1 p. 138, spell `guidance`. Concentration, up to 1 minute (10 rounds).
    ...none,
    id: "guidance",
    castingTime: "action",
    level: 0,
    srdPage: 138,
    delivery: { kind: "auto" },
    effect: {
      kind: "roll-bonus",
      die: "1d4",
      applies: ["ability-check"],
      skillChoice: true,
      targets: { base: 1, perSlotLevel: 0 },
      concentration: true,
      durationRounds: 10,
    },
    scaling: { kind: "none" },
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
