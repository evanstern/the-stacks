// FR-028: rest_short, rest_long, roll_free.
import { commands, type Handler, resolveActor } from "./refs.js";

export const restShort: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "rest_short") throw new Error("rest_short");
  const who = resolveActor(c, false);
  if (!who.ok) return who.result;
  return commands([
    {
      type: "rest.short",
      participants: [
        { combatantId: who.value.combatantId, spend: i.params.spend },
      ],
      reason: c.reason,
    },
  ]);
};

export const restLong: Handler = (c) => {
  const who = resolveActor(c, false);
  if (!who.ok) return who.result;
  return commands([
    {
      type: "rest.long",
      participants: [who.value.combatantId],
      reason: c.reason,
    },
  ]);
};

export const rollFree: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "roll_free") throw new Error("roll_free");
  return commands([
    {
      type: "roll",
      expression: i.params.expression,
      mode: "normal",
      reason: c.reason,
    },
  ]);
};
