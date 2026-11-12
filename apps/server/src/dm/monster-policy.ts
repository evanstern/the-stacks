import { type SessionProjections, spatialFor } from "@the-stacks/session-model";
import { type InterpretStage, InterpretStageSchema } from "./nodes/schemas.js";
import type { SceneSeed } from "./seed/schema.js";

/**
 * Specs/107 D3: a monster's turn as Intent stages, chosen in code from the engine
 * stat block, the spatial view and the seed `tactics` field. Reads state only; the
 * planner still judges reach and range. Names attack entries, never numbers.
 * ponytail: one attack per turn; multiattack and spell use arrive with a card.
 */
export function monsterStages(
  p: SessionProjections,
  seed: SceneSeed,
  combatantId: string,
): InterpretStage[] {
  const me = p.engine.combatants[combatantId];
  const attacks = me?.stats?.attacks ?? [];
  if (!me || attacks.length === 0 || !p.encounter) return [];

  const foes = p.encounter.order.flatMap((o) => {
    const c = p.engine.combatants[o.combatantId];
    if (c?.side !== "party" || c.lifeState !== "conscious") return [];
    const member = p.party.find((m) => m.combatantId === c.id);
    return member
      ? [
          {
            combatantId: c.id,
            characterId: member.characterId,
            hp: c.hp.current,
          },
        ]
      : [];
  });
  if (foes.length === 0) return [];

  const placements = spatialFor(p, { role: "dm" }).placements;
  const myZone = placements[combatantId];
  // Spec OQ-4: with no zones, every foe counts as engaged.
  const engagedWith = (id: string): boolean =>
    myZone === undefined ||
    placements[id] === undefined ||
    placements[id] === myZone;

  const tactics =
    seed.encounters
      .flatMap((e) => e.monsters)
      .find((m) => m.combatantId === combatantId)?.tactics ?? "nearest";
  const engaged = foes.filter((f) => engagedWith(f.combatantId));
  const pool = engaged.length > 0 ? engaged : foes;
  // Initiative order breaks ties: `foes` is already in order, and reduce keeps the first.
  const target =
    tactics === "weakest"
      ? pool.reduce((a, b) => (b.hp < a.hp ? b : a))
      : (pool[0] as (typeof pool)[number]);
  const isEngaged = engagedWith(target.combatantId);

  const melee =
    attacks.find((a) => a.range === "melee") ??
    attacks.find((a) => a.range === "melee-or-ranged");
  const ranged = attacks.find((a) => a.range !== "melee");
  const attack = (name: string) => ({
    intent: {
      kind: "attack" as const,
      targets: [{ kind: "actor" as const, id: target.characterId }],
      params: { weapon: name, mode: "normal" as const },
    },
    beside: null,
  });

  let stages: unknown[];
  if (isEngaged && melee) stages = [attack(melee.name)];
  else if (ranged) stages = [attack(ranged.name)];
  else if (melee) {
    const zone = placements[target.combatantId];
    stages = zone
      ? [
          {
            intent: {
              kind: "move" as const,
              targets: [{ kind: "zone" as const, id: zone }],
              params: {},
            },
            beside: null,
          },
          attack(melee.name),
        ]
      : [attack(melee.name)];
  } else return [];
  return stages.map((s) => InterpretStageSchema.parse(s));
}
