import {
  DamageTypeSchema,
  type EngineCommand,
  EngineCommandSchema,
} from "@the-stacks/dnd5e-engine";
import { CombatantIdSchema, RefIdSchema } from "@the-stacks/session-model";
import { z } from "zod";

/**
 * The scene seed (specs/031-dm-runtime contracts/scene-seed.md): a stand-in for
 * codex entities (decision-0009). NPCs and characters carry A5's three
 * sections — identity, portrayal, hooks.
 */

const Text = (max: number) => z.string().min(1).max(max);

const AbilitySchema = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

export type CombatantInit = Extract<
  EngineCommand,
  { type: "combatant.add" }
>["combatant"];

/** The engine's CombatantInit, taken from its own `combatant.add` command schema. */
const combatAdd = EngineCommandSchema.options.find(
  (o) => o.shape.type.value === "combatant.add",
);
if (!combatAdd || !("combatant" in combatAdd.shape)) {
  throw new Error("engine combatant.add command not found");
}
export const CombatantInitSchema = combatAdd.shape
  .combatant as unknown as z.ZodType<CombatantInit, unknown>;

const Portrayal = z.object({
  voice: Text(300),
  want: Text(300),
  detail: Text(300),
  appearance: Text(300),
});

const Hooks = z.object({
  knows: z.array(Text(300)).max(8),
  secrets: z.array(Text(300)).max(8),
  relationships: z.array(z.object({ to: RefIdSchema, kind: Text(60) })).max(8),
});

export const SeedNpc = z.object({
  id: RefIdSchema,
  name: Text(100),
  identity: z.object({
    role: Text(100),
    srdMonsterId: z.string().min(1).nullable(),
    combatant: RefIdSchema.nullable(),
  }),
  portrayal: Portrayal,
  hooks: Hooks,
});

export const SeedCharacter = z.object({
  characterId: RefIdSchema,
  name: Text(100),
  seat: z.enum(["human", "companion"]),
  identity: z.object({
    combatant: CombatantInitSchema,
    abilityMods: z.partialRecord(
      AbilitySchema,
      z.number().int().min(-5).max(10),
    ),
    proficiencyBonus: z.number().int().min(2).max(6),
    saves: z.partialRecord(AbilitySchema, z.number().int().min(-5).max(15)),
    skills: z.record(
      z.string().min(1).max(40),
      z.number().int().min(-5).max(15),
    ),
    attacks: z
      .array(
        z.object({
          name: Text(60),
          expression: z.string().min(1).max(200),
          damage: z
            .array(
              z.object({
                dice: z.string().min(1).max(200),
                damageType: DamageTypeSchema,
              }),
            )
            .min(1)
            .max(4),
        }),
      )
      .max(6),
    spells: z.array(z.string().min(1)).max(20),
  }),
  portrayal: Portrayal,
  hooks: Hooks,
});

export const SceneSeedSchema = z.object({
  v: z.literal(1),
  seedId: z.string().regex(/^[a-z0-9-]{1,64}$/),
  title: Text(200),
  license: z.object({
    kind: z.enum(["original", "original-plus-srd", "srd"]),
    note: Text(500),
  }),
  goal: z.object({
    statement: Text(500),
    success: Text(500),
    failure: Text(500),
  }),
  location: z.object({
    id: RefIdSchema,
    name: Text(200),
    identity: z.object({ features: z.array(Text(300)).min(1).max(8) }),
    portrayal: z.object({
      mood: Text(300),
      senses: z.array(Text(200)).max(4),
    }),
    hooks: z.object({ secrets: z.array(Text(300)).max(8) }),
  }),
  beats: z
    .array(
      z.object({
        id: RefIdSchema,
        kind: z.enum(["exploration", "social", "combat"]),
        summary: Text(600),
        clues: z
          .array(
            z.object({
              text: Text(300),
              check: z
                .object({
                  ability: AbilitySchema,
                  skill: z.string().min(1).max(40).nullable(),
                  dc: z.number().int().min(5).max(30),
                })
                .nullable(),
            }),
          )
          .max(8),
        npcIds: z.array(RefIdSchema).max(8),
        encounterId: RefIdSchema.nullable(),
      }),
    )
    .min(1)
    .max(12),
  npcs: z.array(SeedNpc).max(20),
  characters: z.array(SeedCharacter).min(1).max(6),
  encounters: z
    .array(
      z.object({
        id: RefIdSchema,
        name: Text(100),
        monsters: z
          .array(
            z.object({
              combatantId: CombatantIdSchema,
              srdMonsterId: z.string().min(1),
              name: Text(100).nullable(),
            }),
          )
          .min(1)
          .max(12),
        terrain: Text(500),
        trigger: Text(300),
        morale: Text(300),
      }),
    )
    .max(6),
  trackers: z
    .array(
      z.object({
        trackerId: RefIdSchema,
        name: Text(100),
        segments: z.number().int().min(2).max(12),
        note: Text(500),
        advanceWhen: Text(300),
      }),
    )
    .max(6),
  opening: z.object({ framing: Text(800) }),
});

export type SceneSeed = z.infer<typeof SceneSeedSchema>;
export type SeedCharacterT = z.infer<typeof SeedCharacter>;
