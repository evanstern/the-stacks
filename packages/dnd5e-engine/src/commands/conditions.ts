import {
  breakConcentrationEvents,
  INCAPACITATING_CONDITIONS,
} from "../concentration.js";
import type { Handler } from "../handler.js";
import type { EngineEvent } from "../schema/events.js";
import { type RefusalResult, refuse } from "../schema/refusals.js";
import type { Combatant, ConditionInstance } from "../schema/state.js";
import { lifeStateEvent } from "./hit-points.js";

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

export function appliedEvent(
  c: Combatant,
  reason: string,
  instance: Omit<ConditionInstance, "instanceId">,
): EngineEvent {
  const seq = c.conditionSeq + 1;
  return {
    type: "condition.applied",
    v: 1,
    reason,
    combatantId: c.id,
    conditionSeq: { before: c.conditionSeq, after: seq },
    before: null,
    after: { instanceId: `${c.id}#${seq}`, ...instance },
  };
}

export const handleConditionApply: Handler<"condition.apply"> = (
  state,
  command,
  _rng,
) => {
  const target = state.combatants[command.targetId];
  if (!target) return unknownCombatant(command.targetId);
  if (target.lifeState === "dead") return targetDead(target.id);
  if (target.conditions.some((i) => i.condition === command.condition)) {
    return refuse(
      "CONDITION_ALREADY_PRESENT",
      `combatant "${target.id}" is already ${command.condition}`,
      { combatantId: target.id, condition: command.condition },
    );
  }
  return {
    ok: true,
    events: [
      appliedEvent(target, command.reason, {
        condition: command.condition,
        level: null,
        source: command.source,
        expiresAt: command.expiresAt,
      }),
      // Spec 124 FR-006: Incapacitated ends concentration.
      ...(INCAPACITATING_CONDITIONS.includes(command.condition)
        ? breakConcentrationEvents(
            state,
            target.id,
            "incapacitated",
            command.reason,
          )
        : []),
    ],
  };
};

export const handleConditionRemove: Handler<"condition.remove"> = (
  state,
  command,
  _rng,
) => {
  const target = state.combatants[command.targetId];
  if (!target) return unknownCombatant(command.targetId);
  const matching = target.conditions.filter(
    (i) => i.condition === command.condition,
  );
  if (matching.length === 0) {
    return refuse(
      "CONDITION_NOT_PRESENT",
      `combatant "${target.id}" is not ${command.condition}`,
      { combatantId: target.id, condition: command.condition },
    );
  }
  return {
    ok: true,
    events: matching.map(
      (instance): EngineEvent => ({
        type: "condition.removed",
        v: 1,
        reason: command.reason,
        combatantId: target.id,
        cause: "command",
        before: instance,
        after: null,
      }),
    ),
  };
};

export const handleExhaustionAdjust: Handler<"exhaustion.adjust"> = (
  state,
  command,
  _rng,
) => {
  const target = state.combatants[command.targetId];
  if (!target) return unknownCombatant(command.targetId);
  if (target.lifeState === "dead") return targetDead(target.id);
  const current = target.conditions.find((i) => i.condition === "exhaustion");
  const from = current?.level ?? 0;
  const to = from + command.delta;
  if (to < 0 || to > 6) {
    return refuse(
      "EXHAUSTION_OUT_OF_RANGE",
      `exhaustion level would be ${to}`,
      { combatantId: target.id, from, to },
    );
  }
  const reason = command.reason;
  const events: EngineEvent[] = [];
  if (to === 0 && current) {
    events.push({
      type: "condition.removed",
      v: 1,
      reason,
      combatantId: target.id,
      cause: "command",
      before: current,
      after: null,
    });
  } else if (!current) {
    events.push(
      appliedEvent(target, reason, {
        condition: "exhaustion",
        level: to,
        source: "exhaustion.adjust",
        expiresAt: null,
      }),
    );
  } else {
    events.push({
      type: "condition.changed",
      v: 1,
      reason,
      combatantId: target.id,
      before: current,
      after: { ...current, level: to },
    });
  }
  if (to === 6) {
    events.push(lifeStateEvent(target, reason, target.lifeState, "dead"));
    events.push(...breakConcentrationEvents(state, target.id, "died", reason));
  }
  return { ok: true, events };
};
