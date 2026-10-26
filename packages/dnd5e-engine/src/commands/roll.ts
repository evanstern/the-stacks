import { hasPlainD20, parseDiceExpression, rollExpression } from "../dice.js";
import type { Handler } from "../handler.js";
import { refuse } from "../schema/refusals.js";

export const handleRoll: Handler<"roll"> = (_state, command, rng) => {
  const parsed = parseDiceExpression(command.expression);
  if (!parsed.ok) return refuse(parsed.code, parsed.message);
  if (command.mode !== "normal" && !hasPlainD20(parsed.terms)) {
    return refuse(
      "ADVANTAGE_NOT_APPLICABLE",
      "advantage and disadvantage need exactly one plain positive 1d20 term",
      { expression: command.expression },
    );
  }
  const rolled = rollExpression(
    command.expression,
    {
      mode: command.mode,
      critical: false,
      purpose: "roll",
      combatantId: null,
      reason: command.reason,
    },
    rng,
  );
  if (!rolled.ok) return refuse(rolled.code, rolled.message);
  return { ok: true, events: [rolled.event] };
};
