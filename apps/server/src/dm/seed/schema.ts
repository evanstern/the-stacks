import {
  DamageTypeSchema,
  type EngineCommand,
  EngineCommandSchema,
} from "@the-stacks/dnd5e-engine";
import { parse } from "@the-stacks/intent";
import {
  CombatantIdSchema,
  RefIdSchema,
  ScenePresenceSchema,
  WaySchema,
} from "@the-stacks/session-model";
import { SpaceSchema, ZoneIdSchema } from "@the-stacks/space";
import { z } from "zod";
import { SkillSchema } from "../nodes/schemas.js";

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
    aliases: z.array(Text(60)).max(6).default([]),
  }),
  portrayal: Portrayal,
  hooks: Hooks,
  /** Spec 100: the zone the NPC joins in when it enters the engine. */
  zone: ZoneIdSchema.optional(),
});

export const SeedCharacter = z.object({
  characterId: RefIdSchema,
  name: Text(100),
  seat: z.enum(["human", "companion"]),
  identity: z.object({
    class: Text(40),
    level: z.number().int().min(1).max(20),
    combatant: CombatantInitSchema,
    abilityMods: z.partialRecord(
      AbilitySchema,
      z.number().int().min(-5).max(10),
    ),
    proficiencyBonus: z.number().int().min(2).max(6),
    saves: z.partialRecord(AbilitySchema, z.number().int().min(-5).max(15)),
    skills: z.partialRecord(SkillSchema, z.number().int().min(-5).max(15)),
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

export const SceneSeedSchema = z
  .object({
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
      /** Spec 091 D2: the exits a player can take, as composer text forms. */
      ways: z.array(WaySchema).max(6).default([]),
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
                    skill: SkillSchema.nullable(),
                    dc: z.number().int().min(5).max(30),
                  })
                  .nullable(),
              }),
            )
            .max(8),
          npcIds: z.array(RefIdSchema).max(8),
          presence: z.record(RefIdSchema, ScenePresenceSchema),
          encounterId: RefIdSchema.nullable(),
        }),
      )
      .min(1)
      .max(12),
    /** Spec 100: zones, edges and the start zone. A seed without it plays as before. */
    space: z
      .object({
        zones: SpaceSchema.shape.zones,
        edges: SpaceSchema.shape.edges,
        start: ZoneIdSchema,
      })
      .superRefine((sp, ctx) => {
        const parsed = SpaceSchema.safeParse({
          zones: sp.zones,
          edges: sp.edges,
        });
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            ctx.addIssue({
              code: "custom",
              path: issue.path,
              message: issue.message,
            });
          }
        }
      })
      .optional(),
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
                /** Spec 107: who the monster picks on. */
                tactics: z.enum(["nearest", "weakest"]).default("nearest"),
              }),
            )
            .min(1)
            .max(12),
          terrain: Text(500),
          trigger: Text(300),
          morale: Text(300),
          /** Spec 100: the zone the fight happens in. */
          zone: ZoneIdSchema.optional(),
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
    opening: z.object({ framing: Text(800), premise: Text(500) }),
    // Spec 070 D3: table rules. A seed with none takes the defaults (OQ-1 (a)).
    // groupChecks has no behaviour yet: SRD 5.2.1 has no group-check rule (TASK-0232).
    tableRules: z
      .object({
        outcomeBands: z.boolean().default(true),
        naturals: z.boolean().default(true),
        groupChecks: z.boolean().default(false),
      })
      .default({ outcomeBands: true, naturals: true, groupChecks: false }),
  })
  .superRefine((seed, ctx) => {
    // Spec 091 DA4: each way draft parses, and none moves into a hidden zone.
    const zones = new Map((seed.space?.zones ?? []).map((z) => [z.id, z]));
    const resolve = (name: string) => {
      const id = name.toLowerCase();
      const hit = zones.get(id);
      return hit ? { kind: "zone" as const, id: hit.id } : null;
    };
    seed.location.ways.forEach((way, i) => {
      const r = parse(way.draft, {
        id: `way-${i}`,
        actor: { kind: "pc", id: "seed-way" },
        source: "composer",
        commit: "draft",
        resolve,
      });
      const bad = (message: string) =>
        ctx.addIssue({
          code: "custom",
          path: ["location", "ways", i, "draft"],
          message,
        });
      if (!r.ok) {
        bad(`way draft does not parse: ${r.refusal.message}`);
        return;
      }
      if (r.intent.kind !== "move") return;
      for (const t of r.intent.targets ?? []) {
        if (t.kind === "zone" && seed.space && !zones.has(t.id))
          bad(`way moves into unknown zone ${t.id}`);
        else if (t.kind === "zone" && zones.get(t.id)?.hidden)
          bad(`way moves into hidden zone ${t.id}`);
      }
    });
  });

export type SceneSeed = z.infer<typeof SceneSeedSchema>;
export type SeedCharacterT = z.infer<typeof SeedCharacter>;
