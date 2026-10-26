import type { EngineState } from "@the-stacks/dnd5e-engine";
import type { PartyMember } from "../events/party.js";
import type { PartyMemberView } from "./types.js";

function combatantView(
  engine: EngineState,
  combatantId: string | null,
): PartyMemberView["combatant"] {
  if (combatantId === null) return null;
  const c = engine.combatants[combatantId];
  if (!c) return null;
  return {
    hp: { current: c.hp.current, max: c.hp.max, temp: c.hp.temp },
    lifeState: c.lifeState,
    deathSaves: {
      successes: c.deathSaves.successes,
      failures: c.deathSaves.failures,
    },
    conditions: c.conditions,
    ac: c.ac,
  };
}

/** The member as stored in the log: the view without the engine join. */
export function memberOf(
  party: readonly PartyMemberView[],
  characterId: string,
): PartyMember | null {
  const view = party.find((m) => m.characterId === characterId);
  if (!view) return null;
  const { combatant: _combatant, ...member } = view;
  return member;
}

/** Joins every member to the engine state. Order is unchanged. */
export function joinParty(
  party: readonly PartyMemberView[],
  engine: EngineState,
): PartyMemberView[] {
  return party.map((m) => ({
    ...m,
    combatant: combatantView(engine, m.combatantId),
  }));
}

/** Adds (before null), replaces in place, or removes (after null) one member. */
export function changeMember(
  party: readonly PartyMemberView[],
  characterId: string,
  after: PartyMember | null,
  engine: EngineState,
): PartyMemberView[] {
  const index = party.findIndex((m) => m.characterId === characterId);
  if (after === null) {
    return index < 0 ? [...party] : party.filter((_, i) => i !== index);
  }
  const view: PartyMemberView = {
    ...after,
    combatant: combatantView(engine, after.combatantId),
  };
  if (index < 0) return [...party, view];
  return party.map((m, i) => (i === index ? view : m));
}
