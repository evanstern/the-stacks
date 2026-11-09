import type { Handler } from "../handler.js";
import { refuse } from "../schema/refusals.js";
import type { Combatant } from "../schema/state.js";

export const handleCombatantAdd: Handler<"combatant.add"> = (
  state,
  command,
  _rng,
) => {
  const init = command.combatant;
  if (state.combatants[init.id]) {
    return refuse(
      "DUPLICATE_COMBATANT",
      `combatant "${init.id}" already exists`,
      {
        combatantId: init.id,
      },
    );
  }
  if (init.placement) {
    if (!state.space) {
      return refuse(
        "SPACE_UNDEFINED",
        "a placement needs a space; run space.define first",
      );
    }
    if (!state.space.zones.some((z) => z.id === init.placement?.zoneId)) {
      return refuse("ZONE_UNKNOWN", `no zone "${init.placement.zoneId}"`, {
        zoneId: init.placement.zoneId,
      });
    }
  }
  const current = init.hp.current ?? init.hp.max;
  const standard: Combatant["spellSlots"]["standard"] = {};
  for (const [level, max] of Object.entries(init.spellSlots.standard)) {
    if (max === undefined) continue;
    standard[level as keyof typeof standard] = { max, expended: 0 };
  }
  const pact = init.spellSlots.pact
    ? {
        level: init.spellSlots.pact.level,
        slot: { max: init.spellSlots.pact.count, expended: 0 },
      }
    : null;
  let lifeState: Combatant["lifeState"] = "conscious";
  if (current === 0) {
    lifeState = init.zeroHpRule === "dies" ? "dead" : "unconscious";
  }
  const combatant: Combatant = {
    id: init.id,
    name: init.name,
    hp: { current, max: init.hp.max, temp: init.hp.temp ?? 0 },
    zeroHpRule: init.zeroHpRule,
    lifeState,
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    conditionSeq: 0,
    hitDice: init.hitDice.map((p) => ({
      die: p.die,
      total: p.total,
      remaining: p.remaining ?? p.total,
    })),
    spellSlots: { standard, pact },
    initiativeBonus: init.initiativeBonus,
    conModifier: init.conModifier,
    ac: init.ac,
    defenses: init.defenses,
    ...(init.stats ? { stats: init.stats } : {}),
    ...(init.placement ? { placement: init.placement } : {}),
    ...(init.speed !== undefined ? { speed: init.speed } : {}),
  };
  return {
    ok: true,
    events: [
      {
        type: "combatant.added",
        v: 1,
        reason: command.reason,
        combatantId: init.id,
        before: null,
        after: combatant,
      },
    ],
  };
};

export const handleCombatantRemove: Handler<"combatant.remove"> = (
  state,
  command,
  _rng,
) => {
  const target = state.combatants[command.combatantId];
  if (!target) {
    return refuse(
      "UNKNOWN_COMBATANT",
      `no combatant "${command.combatantId}"`,
      {
        combatantId: command.combatantId,
      },
    );
  }
  if (state.encounter?.order.some((e) => e.combatantId === target.id)) {
    return refuse(
      "COMBATANT_IN_ENCOUNTER",
      `combatant "${target.id}" is in the active encounter`,
      { combatantId: target.id },
    );
  }
  return {
    ok: true,
    events: [
      {
        type: "combatant.removed",
        v: 1,
        reason: command.reason,
        combatantId: target.id,
        before: target,
        after: null,
      },
    ],
  };
};
