import type { Handler } from "../handler.js";
import type { EngineEvent } from "../schema/events.js";
import { type RefusalResult, refuse } from "../schema/refusals.js";
import type { Combatant, EngineState } from "../schema/state.js";

/** The slot a pool and level name on a combatant, or null when none exists. */
function slotOf(
  c: Combatant,
  pool: "standard" | "pact",
  level: number,
): { max: number; expended: number } | null {
  if (pool === "pact") {
    const pact = c.spellSlots.pact;
    return pact && pact.level === level ? pact.slot : null;
  }
  const slot =
    c.spellSlots.standard[
      String(level) as keyof Combatant["spellSlots"]["standard"]
    ];
  return slot && slot.max > 0 ? slot : null;
}

function preflight(
  c: Combatant | undefined,
  id: string,
  pool: "standard" | "pact",
  level: number,
): RefusalResult | { c: Combatant; slot: { max: number; expended: number } } {
  if (!c) {
    return refuse("UNKNOWN_COMBATANT", `no combatant "${id}"`, {
      combatantId: id,
    });
  }
  if (c.lifeState === "dead") {
    return refuse("TARGET_DEAD", `combatant "${id}" is dead`, {
      combatantId: id,
    });
  }
  const slot = slotOf(c, pool, level);
  if (!slot) {
    return refuse(
      "SLOT_LEVEL_UNAVAILABLE",
      `"${id}" has no ${pool} slot of level ${level}`,
      { combatantId: id, pool, level },
    );
  }
  return { c, slot };
}

/**
 * The `spell-slots.changed` event that spends one slot, or a refusal. `pool` null picks the
 * standard pool when the combatant has a slot of the level, else the pact pool.
 */
export function slotExpendEvent(
  state: EngineState,
  id: string,
  pool: "standard" | "pact" | null,
  level: number,
  reason: string,
): EngineEvent | RefusalResult {
  const c = state.combatants[id];
  // Standard pool when the combatant has a slot of the level, else the pact pool.
  const use =
    pool ??
    (c && !slotOf(c, "standard", level) && slotOf(c, "pact", level)
      ? "pact"
      : "standard");
  const pre = preflight(c, id, use, level);
  if ("ok" in pre) return pre;
  if (pre.slot.expended >= pre.slot.max) {
    return refuse(
      "NO_SLOT_AVAILABLE",
      `every ${use} slot of level ${level} is expended`,
      { combatantId: pre.c.id, pool: use, level },
    );
  }
  return {
    type: "spell-slots.changed",
    v: 1,
    reason,
    combatantId: pre.c.id,
    before: { pool: use, level, expended: pre.slot.expended },
    after: { pool: use, level, expended: pre.slot.expended + 1 },
  };
}

export const handleSpellSlotExpend: Handler<"spell-slot.expend"> = (
  state,
  command,
  _rng,
) => {
  const out = slotExpendEvent(
    state,
    command.targetId,
    command.pool,
    command.level,
    command.reason,
  );
  return "ok" in out ? out : { ok: true, events: [out] };
};

export const handleSpellSlotRestore: Handler<"spell-slot.restore"> = (
  state,
  command,
  _rng,
) => {
  const pre = preflight(
    state.combatants[command.targetId],
    command.targetId,
    command.pool,
    command.level,
  );
  if ("ok" in pre) return pre;
  if (pre.slot.expended < command.count) {
    return refuse(
      "SLOT_NOT_EXPENDED",
      `only ${pre.slot.expended} ${command.pool} slot(s) of level ${command.level} are expended`,
      {
        combatantId: pre.c.id,
        pool: command.pool,
        level: command.level,
        count: command.count,
      },
    );
  }
  return {
    ok: true,
    events: [
      {
        type: "spell-slots.changed",
        v: 1,
        reason: command.reason,
        combatantId: pre.c.id,
        before: {
          pool: command.pool,
          level: command.level,
          expended: pre.slot.expended,
        },
        after: {
          pool: command.pool,
          level: command.level,
          expended: pre.slot.expended - command.count,
        },
      },
    ],
  };
};
