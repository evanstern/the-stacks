import { rollExpression } from "../dice.js";
import type { Handler } from "../handler.js";
import type { EngineEvent } from "../schema/events.js";
import { refuse } from "../schema/refusals.js";
import type { Combatant } from "../schema/state.js";
import { leaveZero, lifeStateEvent } from "./hit-points.js";

function checkDying(c: Combatant | undefined, id: string) {
  if (!c) {
    return refuse("UNKNOWN_COMBATANT", `no combatant "${id}"`, {
      combatantId: id,
    });
  }
  if (c.lifeState !== "unconscious" || c.zeroHpRule !== "death-saves") {
    return refuse("NOT_DYING", `combatant "${id}" is not dying`, {
      combatantId: id,
      lifeState: c.lifeState,
    });
  }
  return null;
}

export const handleDeathSaveRoll: Handler<"death-save.roll"> = (
  state,
  command,
  rng,
) => {
  const target = state.combatants[command.targetId];
  const refusal = checkDying(target, command.targetId);
  if (refusal || !target) return refusal as NonNullable<typeof refusal>;
  const reason = command.reason;
  const rolled = rollExpression(
    "1d20",
    {
      mode: command.mode,
      critical: false,
      purpose: "death-save",
      combatantId: target.id,
      reason,
    },
    rng,
  );
  if (!rolled.ok) return refuse(rolled.code, rolled.message);
  const face = rolled.event.natural as number;
  const events: EngineEvent[] = [rolled.event];
  const before = { ...target.deathSaves };

  if (face === 20) {
    events.push({
      type: "hp.changed",
      v: 1,
      reason,
      combatantId: target.id,
      cause: "death-save",
      amount: 1,
      rawAmount: null,
      components: null,
      defensesSource: null,
      critical: false,
      rollIndex: 0,
      before: { current: target.hp.current, temp: target.hp.temp },
      after: { current: 1, temp: target.hp.temp },
    });
    events.push(...leaveZero(target, reason, 0));
    return { ok: true, events };
  }

  if (face >= 10) {
    const successes = before.successes + 1;
    if (successes >= 3) {
      events.push({
        type: "death-saves.changed",
        v: 1,
        reason,
        combatantId: target.id,
        rollIndex: 0,
        before,
        after: { successes: 0, failures: 0 },
      });
      events.push(lifeStateEvent(target, reason, "unconscious", "stable"));
    } else {
      events.push({
        type: "death-saves.changed",
        v: 1,
        reason,
        combatantId: target.id,
        rollIndex: 0,
        before,
        after: { successes, failures: before.failures },
      });
    }
    return { ok: true, events };
  }

  const failures = Math.min(3, before.failures + (face === 1 ? 2 : 1));
  events.push({
    type: "death-saves.changed",
    v: 1,
    reason,
    combatantId: target.id,
    rollIndex: 0,
    before,
    after: { successes: before.successes, failures },
  });
  if (failures >= 3) {
    events.push(lifeStateEvent(target, reason, "unconscious", "dead"));
  }
  return { ok: true, events };
};

export const handleStabilize: Handler<"stabilize"> = (state, command, _rng) => {
  const target = state.combatants[command.targetId];
  const refusal = checkDying(target, command.targetId);
  if (refusal || !target) return refusal as NonNullable<typeof refusal>;
  const reason = command.reason;
  const events: EngineEvent[] = [];
  if (target.deathSaves.successes !== 0 || target.deathSaves.failures !== 0) {
    events.push({
      type: "death-saves.changed",
      v: 1,
      reason,
      combatantId: target.id,
      rollIndex: null,
      before: { ...target.deathSaves },
      after: { successes: 0, failures: 0 },
    });
  }
  events.push(lifeStateEvent(target, reason, "unconscious", "stable"));
  return { ok: true, events };
};
