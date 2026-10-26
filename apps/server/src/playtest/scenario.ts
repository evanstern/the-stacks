import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { DEFAULT_SEED_DIR, loadSeed, SeedError } from "../dm/seed/load.js";

/** A scenario or auditor script that fails the schema or a cross-check. */
export class ScenarioError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`invalid scenario: ${issues.join("; ")}`);
    this.name = "ScenarioError";
    this.issues = issues;
  }
}

const ErrorKindSchema = z.enum([
  "config",
  "auth",
  "rate_limit",
  "refusal",
  "upstream",
  "cancelled",
]);

const ActionId = z.string().regex(/^[a-z0-9-]{1,64}$/);

const Move = z.object({
  text: z.string().min(1).max(500),
  actionId: ActionId.optional(),
});

/** Scripted players (specs/032-playtest-harness contracts/scenario.md). */
export const ScenarioSchema = z.object({
  v: z.literal(1),
  name: z.string().regex(/^[a-z0-9-]{1,64}$/),
  seedId: z.string().regex(/^[a-z0-9-]{1,64}$/),
  seat: z.object({
    characterId: z.string().min(1),
    userId: z.string().uuid(),
  }),
  moves: z.object({
    free: z.array(Move).min(1).max(50),
    combat: z.object({
      text: z.string().min(1).max(500),
      firstActionId: ActionId.optional(),
    }),
    fallback: Move.omit({ actionId: true }),
  }),
  limits: z.object({
    maxMoves: z.number().int().min(1).max(200),
    maxWallMs: z.number().int().min(10_000).max(3_600_000),
  }),
  dice: z
    .object({
      faces: z.array(z.number().int().min(1).max(1000)).max(2000).default([]),
      seed: z.number().int().min(0).max(4294967295).nullable().default(null),
    })
    .default({ faces: [], seed: null }),
  ci: z
    .object({
      dmScript: z.string().min(1),
      auditScript: z.string().min(1),
      retrieve: z.string().min(1),
    })
    .nullable(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;
export type ScenarioMove = z.infer<typeof Move>;

/** The scripted auditor responses, queued on purpose `playtest.audit`. */
export const AuditScriptSchema = z.object({
  v: z.literal(1),
  name: z.string().min(1).max(100),
  responses: z
    .array(
      z.object({
        note: z.string().max(200).optional(),
        respond: z.discriminatedUnion("type", [
          z.object({ type: z.literal("json"), value: z.unknown() }),
          z.object({ type: z.literal("text"), value: z.string() }),
          z.object({
            type: z.literal("error"),
            kind: ErrorKindSchema,
            message: z.string(),
          }),
        ]),
        usage: z
          .object({
            inputTokens: z.number().int().min(0),
            outputTokens: z.number().int().min(0),
          })
          .default({ inputTokens: 0, outputTokens: 0 }),
      }),
    )
    .max(200),
});
export type AuditScript = z.infer<typeof AuditScriptSchema>;

function readJson(path: string, label: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ScenarioError([
      `cannot read ${label} "${path}": ${(error as Error).message}`,
    ]);
  }
}

export interface LoadScenarioOptions {
  /** Seed directory; defaults to `apps/server/seeds`. */
  seedDir?: string;
}

/** A loaded scenario whose `ci` paths are resolved to absolute paths. */
export function loadScenario(
  path: string,
  opts: LoadScenarioOptions = {},
): Scenario {
  const raw = readJson(path, "scenario");
  const parsed = ScenarioSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ScenarioError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  const scenario = parsed.data;
  const issues: string[] = [];

  try {
    const seed = loadSeed(scenario.seedId, opts.seedDir ?? DEFAULT_SEED_DIR);
    const human = seed.characters.find((c) => c.seat === "human");
    if (!human || human.characterId !== scenario.seat.characterId) {
      issues.push(
        `seat.characterId "${scenario.seat.characterId}" is not the seed's human character${human ? ` ("${human.characterId}")` : ""}`,
      );
    }
  } catch (error) {
    if (error instanceof SeedError) issues.push(...error.issues);
    else throw error;
  }

  const ids = scenario.moves.free
    .map((m) => m.actionId)
    .filter((id): id is string => id !== undefined);
  if (scenario.moves.combat.firstActionId)
    ids.push(scenario.moves.combat.firstActionId);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) issues.push(`duplicate action id "${id}"`);
    seen.add(id);
  }
  for (const id of ids) {
    if (/^pt-\d+$/.test(id)) {
      issues.push(`action id "${id}" collides with generated pt-<n> ids`);
    }
  }

  if (issues.length > 0) throw new ScenarioError(issues);

  if (scenario.ci) {
    const base = dirname(resolve(path));
    scenario.ci = {
      dmScript: resolve(base, scenario.ci.dmScript),
      auditScript: resolve(base, scenario.ci.auditScript),
      retrieve: resolve(base, scenario.ci.retrieve),
    };
  }
  return scenario;
}

export function loadAuditScript(path: string): AuditScript {
  const raw = readJson(path, "auditor script");
  const parsed = AuditScriptSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ScenarioError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  return parsed.data;
}
