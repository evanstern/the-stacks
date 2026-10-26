import { rollExpression } from "../dice.js";
import type { Handler } from "../handler.js";
import type { EngineEvent } from "../schema/events.js";
import { type RefusalResult, refuse } from "../schema/refusals.js";
import type { Combatant, EngineState } from "../schema/state.js";
import { leaveZero } from "./hit-points.js";

/** Shared precondition order for both rests; returns the combatants or a refusal. */
function checkParticipants(
  state: EngineState,
  ids: string[],
): RefusalResult | Combatant[] {
  if (state.encounter) {
    return refuse("ENCOUNTER_ACTIVE", "no rest while an encounter is active");
  }
  for (const id of ids) {
    if (!state.combatants[id]) {
      return refuse("UNKNOWN_COMBATANT", `no combatant "${id}"`, {
        combatantId: id,
      });
    }
  }
  if (new Set(ids).size !== ids.length) {
    return refuse("DUPLICATE_PARTICIPANT", "a participant is listed twice");
  }
  const found: Combatant[] = [];
  for (const id of ids) {
    const c = state.combatants[id] as Combatant;
    if (c.lifeState === "dead") {
      return refuse("TARGET_DEAD", `combatant "${id}" is dead`, {
        combatantId: id,
      });
    }
    found.push(c);
  }
  return found;
}

function pactRestore(c: Combatant, reason: string): EngineEvent[] {
  const pact = c.spellSlots.pact;
  if (!pact || pact.slot.expended === 0) return [];
  return [
    {
      type: "spell-slots.changed",
      v: 1,
      reason,
      combatantId: c.id,
      before: { pool: "pact", level: pact.level, expended: pact.slot.expended },
      after: { pool: "pact", level: pact.level, expended: 0 },
    },
  ];
}

export const handleRestShort: Handler<"rest.short"> = (state, command, rng) => {
  const found = checkParticipants(
    state,
    command.participants.map((p) => p.combatantId),
  );
  if (!Array.isArray(found)) return found;
  // Totals per die size, checked for every participant before any draw.
  const plans: { c: Combatant; spend: Map<number, number> }[] = [];
  for (const [i, p] of command.participants.entries()) {
    const c = found[i] as Combatant;
    const spend = new Map<number, number>();
    for (const s of p.spend) {
      spend.set(s.die, (spend.get(s.die) ?? 0) + s.count);
    }
    for (const [die, count] of spend) {
      if (count === 0) continue;
      const pool = c.hitDice.find((h) => h.die === die);
      if (!pool || pool.remaining < count) {
        return refuse(
          "INSUFFICIENT_HIT_DICE",
          `"${c.id}" lacks ${count} d${die} hit dice`,
          { combatantId: c.id, die, count, remaining: pool?.remaining ?? 0 },
        );
      }
    }
    plans.push({ c, spend });
  }

  const reason = command.reason;
  const events: EngineEvent[] = [];
  for (const { c, spend } of plans) {
    const own: EngineEvent[] = [];
    let healed = 0;
    let spent = 0;
    const pools: { die: number; before: number; after: number }[] = [];
    for (const [die, count] of spend) {
      if (count === 0) continue;
      const pool = c.hitDice.find((h) => h.die === die);
      if (!pool) continue;
      for (let n = 0; n < count; n++) {
        const rolled = rollExpression(
          `1d${die}`,
          {
            mode: "normal",
            critical: false,
            purpose: "hit-die",
            combatantId: c.id,
            reason,
          },
          rng,
        );
        if (!rolled.ok) return refuse(rolled.code, rolled.message);
        own.push(rolled.event);
        healed += Math.max(0, rolled.total + c.conModifier);
        spent += 1;
      }
      pools.push({
        die,
        before: pool.remaining,
        after: pool.remaining - count,
      });
    }
    for (const p of pools) {
      own.push({
        type: "hit-dice.changed",
        v: 1,
        reason,
        combatantId: c.id,
        before: { die: p.die, remaining: p.before },
        after: { die: p.die, remaining: p.after },
      });
    }
    if (spent > 0) {
      const current = Math.min(c.hp.max, c.hp.current + healed);
      own.push({
        type: "hp.changed",
        v: 1,
        reason,
        combatantId: c.id,
        cause: "rest",
        amount: healed,
        rawAmount: null,
        components: null,
        defensesSource: null,
        critical: false,
        rollIndex: null,
        before: { current: c.hp.current, temp: c.hp.temp },
        after: { current, temp: c.hp.temp },
      });
      if (c.hp.current === 0 && current > 0) {
        own.push(...leaveZero(c, reason, null));
      }
    }
    own.push(...pactRestore(c, reason));
    events.push(...own);
  }
  events.push({
    type: "rest.completed",
    v: 1,
    reason,
    kind: "short",
    participants: command.participants.map((p) => p.combatantId),
  });
  return { ok: true, events };
};

export const handleRestLong: Handler<"rest.long"> = (state, command, _rng) => {
  const found = checkParticipants(state, command.participants);
  if (!Array.isArray(found)) return found;
  for (const c of found) {
    if (c.hp.current < 1) {
      return refuse(
        "LONG_REST_REQUIRES_HP",
        `"${c.id}" has 0 HP and cannot take a long rest`,
        { combatantId: c.id },
      );
    }
  }
  const reason = command.reason;
  const events: EngineEvent[] = [];
  for (const c of found) {
    if (c.hp.current !== c.hp.max || c.hp.temp !== 0) {
      events.push({
        type: "hp.changed",
        v: 1,
        reason,
        combatantId: c.id,
        cause: "rest",
        amount: c.hp.max - c.hp.current,
        rawAmount: null,
        components: null,
        defensesSource: null,
        critical: false,
        rollIndex: null,
        before: { current: c.hp.current, temp: c.hp.temp },
        after: { current: c.hp.max, temp: 0 },
      });
    }
    if (c.deathSaves.successes !== 0 || c.deathSaves.failures !== 0) {
      events.push({
        type: "death-saves.changed",
        v: 1,
        reason,
        combatantId: c.id,
        rollIndex: null,
        before: { ...c.deathSaves },
        after: { successes: 0, failures: 0 },
      });
    }
    for (const pool of c.hitDice) {
      if (pool.remaining !== pool.total) {
        events.push({
          type: "hit-dice.changed",
          v: 1,
          reason,
          combatantId: c.id,
          before: { die: pool.die, remaining: pool.remaining },
          after: { die: pool.die, remaining: pool.total },
        });
      }
    }
    for (const [key, slot] of Object.entries(c.spellSlots.standard)) {
      if (slot && slot.expended > 0) {
        events.push({
          type: "spell-slots.changed",
          v: 1,
          reason,
          combatantId: c.id,
          before: {
            pool: "standard",
            level: Number(key),
            expended: slot.expended,
          },
          after: { pool: "standard", level: Number(key), expended: 0 },
        });
      }
    }
    events.push(...pactRestore(c, reason));
    const exhaustion = c.conditions.find((i) => i.condition === "exhaustion");
    if (exhaustion) {
      const level = exhaustion.level ?? 1;
      if (level <= 1) {
        events.push({
          type: "condition.removed",
          v: 1,
          reason,
          combatantId: c.id,
          cause: "rest",
          before: exhaustion,
          after: null,
        });
      } else {
        events.push({
          type: "condition.changed",
          v: 1,
          reason,
          combatantId: c.id,
          before: exhaustion,
          after: { ...exhaustion, level: level - 1 },
        });
      }
    }
  }
  events.push({
    type: "rest.completed",
    v: 1,
    reason,
    kind: "long",
    participants: command.participants,
  });
  return { ok: true, events };
};
