import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDiceExpression } from "@the-stacks/dnd5e-engine";
import { getById, getByName } from "@the-stacks/srd";
import { type SceneSeed, SceneSeedSchema } from "./schema.js";

/** A seed that fails the schema or a cross-check; `issues` lists every problem. */
export class SeedError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`invalid scene seed: ${issues.join("; ")}`);
    this.name = "SeedError";
    this.issues = issues;
  }
}

/** `apps/server/seeds`, resolved from the module so the working directory is irrelevant. */
export const DEFAULT_SEED_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "seeds",
);

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  return [...dup];
}

function hasPlainD20(expression: string): boolean {
  const parsed = parseDiceExpression(expression);
  if (!parsed.ok) return false;
  const d20 = parsed.terms.filter((t) => t.kind === "dice" && t.sides === 20);
  if (d20.length !== 1) return false;
  const t = d20[0];
  return t?.kind === "dice" && t.count === 1 && t.keep === null && t.sign === 1;
}

/** Cross-checks a schema-valid seed; returns every issue found. */
export function crossCheckSeed(seed: SceneSeed): string[] {
  const issues: string[] = [];
  const lists: [string, readonly string[]][] = [
    ["beats", seed.beats.map((b) => b.id)],
    ["npcs", seed.npcs.map((n) => n.id)],
    ["characters", seed.characters.map((c) => c.characterId)],
    ["encounters", seed.encounters.map((e) => e.id)],
    ["trackers", seed.trackers.map((t) => t.trackerId)],
    [
      "encounter combatants",
      seed.encounters.flatMap((e) => e.monsters.map((m) => m.combatantId)),
    ],
  ];
  for (const [label, ids] of lists) {
    for (const id of duplicates(ids)) {
      issues.push(`duplicate id "${id}" in ${label}`);
    }
  }

  const npcIds = new Set(seed.npcs.map((n) => n.id));
  const encounterIds = new Set(seed.encounters.map((e) => e.id));
  const allIds = new Set<string>([
    ...npcIds,
    ...seed.characters.map((c) => c.characterId),
  ]);

  for (const npc of seed.npcs) {
    const m = npc.identity.srdMonsterId;
    if (m !== null && !getById("monster", m)) {
      issues.push(`npc "${npc.id}" names unknown srdMonsterId "${m}"`);
    }
    for (const r of npc.hooks.relationships) {
      if (!allIds.has(r.to)) {
        issues.push(
          `npc "${npc.id}" relationship targets unknown id "${r.to}"`,
        );
      }
    }
  }
  const monsterIds = new Set(
    seed.encounters.flatMap((e) => e.monsters.map((m) => m.combatantId)),
  );
  for (const npc of seed.npcs) {
    const c = npc.identity.combatant;
    if (c === null) continue;
    if (c !== npc.id) {
      issues.push(`npc "${npc.id}" combatant "${c}" differs from its id`);
    } else if (!monsterIds.has(c)) {
      issues.push(
        `npc "${npc.id}" combatant "${c}" names no encounter monster`,
      );
    }
  }
  for (const enc of seed.encounters) {
    for (const mon of enc.monsters) {
      if (!getById("monster", mon.srdMonsterId)) {
        issues.push(
          `encounter "${enc.id}" names unknown srdMonsterId "${mon.srdMonsterId}"`,
        );
      }
    }
  }
  for (const beat of seed.beats) {
    for (const id of beat.npcIds) {
      if (!npcIds.has(id)) {
        issues.push(`beat "${beat.id}" names unknown npc "${id}"`);
      }
    }
    for (const id of npcIds) {
      if (!(id in beat.presence)) {
        issues.push(`beat "${beat.id}" declares no presence for npc "${id}"`);
      }
    }
    for (const id of Object.keys(beat.presence)) {
      if (!npcIds.has(id)) {
        issues.push(
          `beat "${beat.id}" declares presence for unknown npc "${id}"`,
        );
      }
    }
    for (const id of beat.npcIds) {
      if (beat.presence[id] === "absent") {
        issues.push(
          `beat "${beat.id}" lists npc "${id}" in npcIds but declares it absent`,
        );
      }
    }
    if (beat.encounterId !== null && !encounterIds.has(beat.encounterId)) {
      issues.push(
        `beat "${beat.id}" names unknown encounter "${beat.encounterId}"`,
      );
    }
  }
  for (const c of seed.characters) {
    if (c.identity.combatant.id !== c.characterId) {
      issues.push(
        `character "${c.characterId}" combatant id "${c.identity.combatant.id}" differs`,
      );
    }
    if (c.identity.combatant.stats !== undefined) {
      issues.push(
        `character "${c.characterId}" combatant carries stats; the loader builds them from the sheet`,
      );
    }
    for (const spell of c.identity.spells) {
      if (!getById("spell", spell)) {
        issues.push(
          `character "${c.characterId}" names unknown spell "${spell}"`,
        );
      }
    }
    for (const atk of c.identity.attacks) {
      if (!hasPlainD20(atk.expression)) {
        issues.push(
          `character "${c.characterId}" attack "${atk.name}" expression "${atk.expression}" is not a valid plain d20 expression`,
        );
      }
      if (!/^1d20([+-]\d+)?$/.test(atk.expression.replace(/\s+/g, ""))) {
        issues.push(
          `character "${c.characterId}" attack "${atk.name}" expression "${atk.expression}" is not 1d20 plus or minus a number`,
        );
      }
      const weapon = getByName("equipment", atk.name);
      if (!weapon || weapon.category !== "weapon") {
        issues.push(
          `character "${c.characterId}" attack "${atk.name}" is no SRD weapon`,
        );
      }
      for (const d of atk.damage) {
        if (!parseDiceExpression(d.dice).ok) {
          issues.push(
            `character "${c.characterId}" attack "${atk.name}" damage "${d.dice}" does not parse`,
          );
        }
      }
    }
  }
  const humans = seed.characters.filter((c) => c.seat === "human").length;
  if (humans < 1) {
    issues.push(
      `at least one character must have seat "human", found ${humans}`,
    );
  }
  return issues;
}

/** Validates an already-parsed seed document (used by tests and the loader). */
export function parseSeed(raw: unknown): SceneSeed {
  const result = SceneSeedSchema.safeParse(raw);
  if (!result.success) {
    throw new SeedError(
      result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  const issues = crossCheckSeed(result.data);
  if (issues.length > 0) throw new SeedError(issues);
  return result.data;
}

export function loadSeed(
  seedId: string,
  dir: string = DEFAULT_SEED_DIR,
): SceneSeed {
  if (!/^[a-z0-9-]{1,64}$/.test(seedId)) {
    throw new SeedError([`seedId "${seedId}" is not a valid seed id`]);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(dir, `${seedId}.json`), "utf8"));
  } catch (error) {
    throw new SeedError([
      `cannot read seed "${seedId}": ${(error as Error).message}`,
    ]);
  }
  return parseSeed(raw);
}

/**
 * Every seed in `dir` that loads, sorted by id. A file that fails to load is
 * left out and logged once; this never throws for a bad file.
 */
export function listSeeds(dir: string = DEFAULT_SEED_DIR): SceneSeed[] {
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  const seeds: SceneSeed[] = [];
  for (const name of names) {
    const seedId = name.slice(0, -".json".length);
    try {
      seeds.push(loadSeed(seedId, dir));
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "dm.seeds.load-failed",
          seedId,
          issues:
            error instanceof SeedError
              ? error.issues
              : [(error as Error).message],
        }),
      );
    }
  }
  return seeds.sort((a, b) =>
    a.seedId < b.seedId ? -1 : a.seedId > b.seedId ? 1 : 0,
  );
}
