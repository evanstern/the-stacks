import type {
  PlannerInputs,
  SessionProjections,
} from "@the-stacks/session-model";
import { getById, list } from "@the-stacks/srd";
import { combatantFromSrd } from "./combatants.js";
import type { SceneSeed } from "./schema.js";

type Inits = PlannerInputs["inits"];

/** Spec 102 plan "Design" 4: planner facts the projection cannot hold, derived from the scene seed. */
export function plannerInputsFromSeed(
  seed: SceneSeed,
  p: SessionProjections,
): PlannerInputs {
  const casters: PlannerInputs["casters"] = {};
  for (const c of seed.characters) {
    casters[c.identity.combatant.id] = {
      level: c.identity.level,
      spells: [...c.identity.spells],
    };
  }

  const inits: Inits = {};
  const hostile = new Set<string>();
  for (const e of seed.encounters) {
    for (const m of e.monsters) {
      hostile.add(m.combatantId);
      const rec = getById("monster", m.srdMonsterId);
      if (!rec || p.engine.combatants[m.combatantId]) continue;
      inits[m.combatantId] = {
        ...combatantFromSrd(rec, m.combatantId, m.name, "hostile"),
        ...(e.zone ? { placement: { zoneId: e.zone } } : {}),
      };
    }
  }
  const fought = seed.encounters.find((e) =>
    e.monsters.some((m) => p.engine.combatants[m.combatantId]),
  );
  for (const npc of seed.npcs) {
    if (p.engine.combatants[npc.id] || inits[npc.id]) continue;
    const rec = getById("monster", npc.identity.srdMonsterId ?? "commoner");
    if (!rec) continue;
    const zoneId = (p.encounter && fought?.zone) || npc.zone;
    inits[npc.id] = {
      ...combatantFromSrd(
        rec,
        npc.id,
        npc.name,
        hostile.has(npc.id) ? "hostile" : "neutral",
      ),
      ...(zoneId ? { placement: { zoneId } } : {}),
    };
  }

  const { outcomeBands, naturals } = seed.tableRules;
  return {
    casters,
    srdSpellIds: list("spell").map((s) => s.id),
    inits,
    tableRules: { outcomeBands, naturals },
    npcIds: [...seed.npcs.map((n) => n.id), ...hostile],
  };
}

/** The gate's `plannerInputs` dep: loads the session's scene seed; no scene or seed means empty inputs. */
export function createPlannerInputs(
  loadSeed: (seedId: string) => SceneSeed,
): (p: SessionProjections) => PlannerInputs | undefined {
  return (p) => {
    if (!p.scene) return undefined;
    try {
      return plannerInputsFromSeed(loadSeed(p.scene.sceneId), p);
    } catch {
      return undefined;
    }
  };
}
