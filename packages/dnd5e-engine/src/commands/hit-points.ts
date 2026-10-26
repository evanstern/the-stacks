import {
  checkLimits,
  criticalTerms,
  type DiceFailure,
  parseDiceExpression,
  rollExpression,
} from "../dice.js";
import type { Handler } from "../handler.js";
import type { Rng } from "../rng.js";
import type { EngineEvent, EventOf } from "../schema/events.js";
import { type RefusalResult, refuse } from "../schema/refusals.js";
import type { Combatant, DamageType, DefenseSet } from "../schema/state.js";

type Component = NonNullable<EventOf<"hp.changed">["components"]>[number];

/** Life-state change event. */
export function lifeStateEvent(
  c: Combatant,
  reason: string,
  before: Combatant["lifeState"],
  after: Combatant["lifeState"],
): EngineEvent {
  return {
    type: "life-state.changed",
    v: 1,
    reason,
    combatantId: c.id,
    before,
    after,
  };
}

/**
 * Events for a conscious combatant whose HP just reached 0. `overflow` is the damage left
 * over after reaching 0. The `dies` rule and massive damage kill; otherwise the combatant
 * falls unconscious and gains the `hp-zero` condition (unless one is already present).
 */
export function dropToZero(
  c: Combatant,
  overflow: number,
  reason: string,
): EngineEvent[] {
  if (c.zeroHpRule === "dies" || overflow >= c.hp.max) {
    return [lifeStateEvent(c, reason, c.lifeState, "dead")];
  }
  const events: EngineEvent[] = [
    lifeStateEvent(c, reason, c.lifeState, "unconscious"),
  ];
  if (!c.conditions.some((i) => i.condition === "unconscious")) {
    const seq = c.conditionSeq + 1;
    events.push({
      type: "condition.applied",
      v: 1,
      reason,
      combatantId: c.id,
      conditionSeq: { before: c.conditionSeq, after: seq },
      before: null,
      after: {
        instanceId: `${c.id}#${seq}`,
        condition: "unconscious",
        level: null,
        source: "hp-zero",
        expiresAt: null,
      },
    });
  }
  return events;
}

/**
 * Events for a combatant at 0 HP that regains HP: conscious, tally reset (when not
 * already 0/0) and the `hp-zero` unconscious instances removed.
 */
export function leaveZero(
  c: Combatant,
  reason: string,
  rollIndex: number | null,
): EngineEvent[] {
  const events: EngineEvent[] = [
    lifeStateEvent(c, reason, c.lifeState, "conscious"),
  ];
  if (c.deathSaves.successes !== 0 || c.deathSaves.failures !== 0) {
    events.push({
      type: "death-saves.changed",
      v: 1,
      reason,
      combatantId: c.id,
      rollIndex,
      before: { ...c.deathSaves },
      after: { successes: 0, failures: 0 },
    });
  }
  for (const instance of c.conditions) {
    if (instance.condition === "unconscious" && instance.source === "hp-zero") {
      events.push({
        type: "condition.removed",
        v: 1,
        reason,
        combatantId: c.id,
        cause: "healed",
        before: instance,
        after: null,
      });
    }
  }
  return events;
}

function unknownCombatant(id: string): RefusalResult {
  return refuse("UNKNOWN_COMBATANT", `no combatant "${id}"`, {
    combatantId: id,
  });
}

function targetDead(id: string): RefusalResult {
  return refuse("TARGET_DEAD", `combatant "${id}" is dead`, {
    combatantId: id,
  });
}

/** Parse a rolled amount's expression; with `critical`, check the doubled limits. */
function preflight(expression: string, critical: boolean): DiceFailure | null {
  const parsed = parseDiceExpression(expression);
  if (!parsed.ok) return parsed;
  return critical ? checkLimits(criticalTerms(parsed.terms)) : null;
}

type Amount =
  | { kind: "fixed"; value: number }
  | { kind: "roll"; expression: string };

/** Resolve an amount to a non-negative number, pushing its dice event when rolled. */
function resolveAmount(
  amount: Amount,
  opts: {
    purpose: "healing" | "temp-hp";
    combatantId: string;
    reason: string;
  },
  events: EngineEvent[],
  rng: Rng,
): { amount: number; rollIndex: number | null } | RefusalResult {
  if (amount.kind === "fixed") return { amount: amount.value, rollIndex: null };
  const rolled = rollExpression(
    amount.expression,
    { mode: "normal", critical: false, ...opts },
    rng,
  );
  if (!rolled.ok) return refuse(rolled.code, rolled.message);
  const rollIndex = events.length;
  events.push(rolled.event);
  return { amount: Math.max(0, rolled.total), rollIndex };
}

function isRefusal(v: object): v is RefusalResult {
  return "refusal" in v;
}

function adjust(
  raw: number,
  type: DamageType,
  defenses: DefenseSet,
): { applied: number; adjustment: Component["adjustment"] } {
  if (defenses.immunities.includes(type)) {
    return { applied: 0, adjustment: "immune" };
  }
  const resisted = defenses.resistances.includes(type);
  const vulnerable = defenses.vulnerabilities.includes(type);
  let applied = raw;
  if (resisted) applied = Math.floor(applied / 2);
  if (vulnerable) applied *= 2;
  const adjustment: Component["adjustment"] =
    resisted && vulnerable
      ? "resisted-and-vulnerable"
      : resisted
        ? "resisted"
        : vulnerable
          ? "vulnerable"
          : "none";
  return { applied, adjustment };
}

export const handleDamageApply: Handler<"damage.apply"> = (
  state,
  command,
  rng,
) => {
  const target = state.combatants[command.targetId];
  if (!target) return unknownCombatant(command.targetId);
  if (target.lifeState === "dead") return targetDead(target.id);
  for (const comp of command.components) {
    if (comp.amount.kind !== "roll") continue;
    const failure = preflight(comp.amount.expression, command.critical);
    if (failure) return refuse(failure.code, failure.message);
  }

  const reason = command.reason;
  const events: EngineEvent[] = [];
  const defenses = command.defenses ?? target.defenses;
  const defensesSource = command.defenses ? "command" : "record";
  const components: Component[] = [];
  for (const comp of command.components) {
    let raw: number;
    let rollIndex: number | null = null;
    if (comp.amount.kind === "fixed") {
      raw = comp.amount.value;
    } else {
      const rolled = rollExpression(
        comp.amount.expression,
        {
          mode: "normal",
          critical: command.critical,
          purpose: "damage",
          combatantId: target.id,
          reason,
        },
        rng,
      );
      if (!rolled.ok) return refuse(rolled.code, rolled.message);
      rollIndex = events.length;
      events.push(rolled.event);
      raw = Math.max(0, rolled.total);
    }
    const { applied, adjustment } = adjust(raw, comp.damageType, defenses);
    components.push({
      damageType: comp.damageType,
      raw,
      applied,
      adjustment,
      rollIndex,
    });
  }

  const total = components.reduce((a, c) => a + c.applied, 0);
  const rawTotal = components.reduce((a, c) => a + c.raw, 0);
  const absorbed = Math.min(target.hp.temp, total);
  const afterTemp = target.hp.temp - absorbed;
  const hpDamage = total - absorbed;
  const afterCurrent = Math.max(0, target.hp.current - hpDamage);
  const overflow = Math.max(0, hpDamage - target.hp.current);

  events.push({
    type: "hp.changed",
    v: 1,
    reason,
    combatantId: target.id,
    cause: "damage",
    amount: total,
    rawAmount: rawTotal,
    components,
    defensesSource,
    critical: command.critical,
    rollIndex: null,
    before: { current: target.hp.current, temp: target.hp.temp },
    after: { current: afterCurrent, temp: afterTemp },
  });

  if (target.lifeState === "conscious") {
    if (afterCurrent === 0)
      events.push(...dropToZero(target, overflow, reason));
  } else if (target.zeroHpRule === "death-saves" && total > 0) {
    // Already at 0 HP (unconscious or stable): massive damage kills, else a failure.
    if (total >= target.hp.max) {
      events.push(lifeStateEvent(target, reason, target.lifeState, "dead"));
    } else {
      if (target.lifeState === "stable") {
        events.push(lifeStateEvent(target, reason, "stable", "unconscious"));
      }
      const failures = Math.min(
        3,
        target.deathSaves.failures + (command.critical ? 2 : 1),
      );
      events.push({
        type: "death-saves.changed",
        v: 1,
        reason,
        combatantId: target.id,
        rollIndex: null,
        before: { ...target.deathSaves },
        after: { successes: target.deathSaves.successes, failures },
      });
      if (failures >= 3) {
        events.push(lifeStateEvent(target, reason, "unconscious", "dead"));
      }
    }
  }
  return { ok: true, events };
};

export const handleHealingApply: Handler<"healing.apply"> = (
  state,
  command,
  rng,
) => {
  const target = state.combatants[command.targetId];
  if (!target) return unknownCombatant(command.targetId);
  if (target.lifeState === "dead") return targetDead(target.id);
  if (command.amount.kind === "roll") {
    const failure = preflight(command.amount.expression, false);
    if (failure) return refuse(failure.code, failure.message);
  }
  const reason = command.reason;
  const events: EngineEvent[] = [];
  const resolved = resolveAmount(
    command.amount,
    { purpose: "healing", combatantId: target.id, reason },
    events,
    rng,
  );
  if (isRefusal(resolved)) return resolved;
  const afterCurrent = Math.min(
    target.hp.max,
    target.hp.current + resolved.amount,
  );
  events.push({
    type: "hp.changed",
    v: 1,
    reason,
    combatantId: target.id,
    cause: "healing",
    amount: resolved.amount,
    rawAmount: null,
    components: null,
    defensesSource: null,
    critical: false,
    rollIndex: resolved.rollIndex,
    before: { current: target.hp.current, temp: target.hp.temp },
    after: { current: afterCurrent, temp: target.hp.temp },
  });
  if (target.hp.current === 0 && afterCurrent >= 1) {
    events.push(...leaveZero(target, reason, null));
  }
  return { ok: true, events };
};

export const handleTempHpGrant: Handler<"temp-hp.grant"> = (
  state,
  command,
  rng,
) => {
  const target = state.combatants[command.targetId];
  if (!target) return unknownCombatant(command.targetId);
  if (target.lifeState === "dead") return targetDead(target.id);
  if (
    command.amount.kind === "fixed" &&
    command.amount.value <= target.hp.temp
  ) {
    return refuse(
      "TEMP_HP_NOT_HIGHER",
      `temporary HP ${command.amount.value} not above current ${target.hp.temp}`,
      { combatantId: target.id, current: target.hp.temp },
    );
  }
  if (command.amount.kind === "roll") {
    const failure = preflight(command.amount.expression, false);
    if (failure) return refuse(failure.code, failure.message);
  }
  const reason = command.reason;
  const events: EngineEvent[] = [];
  const resolved = resolveAmount(
    command.amount,
    { purpose: "temp-hp", combatantId: target.id, reason },
    events,
    rng,
  );
  if (isRefusal(resolved)) return resolved;
  events.push({
    type: "hp.changed",
    v: 1,
    reason,
    combatantId: target.id,
    cause: "temp-hp",
    amount: resolved.amount,
    rawAmount: null,
    components: null,
    defensesSource: null,
    critical: false,
    rollIndex: resolved.rollIndex,
    before: { current: target.hp.current, temp: target.hp.temp },
    after: {
      current: target.hp.current,
      temp: Math.max(target.hp.temp, resolved.amount),
    },
  });
  return { ok: true, events };
};
