import type { EngineState } from "@the-stacks/dnd5e-engine";
import type { EncounterView, PartyMemberView } from "./types.js";

/** Builds the encounter view from the engine state and the party. */
export function buildEncounter(
  engine: EngineState,
  party: readonly PartyMemberView[],
): EncounterView | null {
  const encounter = engine.encounter;
  if (!encounter) return null;
  const order: EncounterView["order"] = [];
  for (const entry of encounter.order) {
    const c = engine.combatants[entry.combatantId];
    if (!c) continue;
    order.push({
      combatantId: entry.combatantId,
      name: c.name,
      initiative: entry.total,
      hp: { current: c.hp.current, max: c.hp.max, temp: c.hp.temp },
      lifeState: c.lifeState,
      conditions: c.conditions,
      characterId:
        party.find((m) => m.combatantId === entry.combatantId)?.characterId ??
        null,
    });
  }
  return {
    round: encounter.round,
    turnIndex: encounter.turnIndex,
    activeCombatantId: encounter.order[encounter.turnIndex]?.combatantId ?? "",
    order,
  };
}
