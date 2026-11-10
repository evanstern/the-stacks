import { rollExpression } from "../dice.js";
import type { Handler } from "../handler.js";
import type { Rng } from "../rng.js";
import type { EngineEvent } from "../schema/events.js";
import { type RefusalResult, refuse } from "../schema/refusals.js";
import type { Encounter, EngineState, ExpiryPoint } from "../schema/state.js";
import { withoutMelee } from "../sides.js";

type Entry = Encounter["order"][number];

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

/** Total descending, then bonus descending, then id ascending. */
function compareEntries(a: Entry, b: Entry): number {
  if (a.total !== b.total) return b.total - a.total;
  if (a.bonus !== b.bonus) return b.bonus - a.bonus;
  return a.combatantId < b.combatantId
    ? -1
    : a.combatantId > b.combatantId
      ? 1
      : 0;
}

function d20Expression(bonus: number): string {
  if (bonus === 0) return "1d20";
  return bonus > 0 ? `1d20+${bonus}` : `1d20-${-bonus}`;
}

function rollInitiative(
  id: string,
  bonus: number,
  mode: "normal" | "advantage" | "disadvantage",
  reason: string,
  rng: Rng,
) {
  return rollExpression(
    d20Expression(bonus),
    { mode, critical: false, purpose: "initiative", combatantId: id, reason },
    rng,
  );
}

export const handleInitiativeRoll: Handler<"initiative.roll"> = (
  state,
  command,
  rng,
) => {
  if (state.encounter) {
    return refuse("ENCOUNTER_ACTIVE", "an encounter is already active");
  }
  const ids = command.participants.map((p) => p.combatantId);
  for (const id of ids) {
    if (!state.combatants[id]) return unknownCombatant(id);
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      return refuse("DUPLICATE_PARTICIPANT", `"${id}" listed twice`, {
        combatantId: id,
      });
    }
    seen.add(id);
  }
  for (const id of ids) {
    if (state.combatants[id]?.lifeState === "dead") return targetDead(id);
  }
  const reason = command.reason;
  const events: EngineEvent[] = [];
  const order: Entry[] = [];
  for (const p of command.participants) {
    const c = state.combatants[p.combatantId];
    if (!c) continue;
    const rolled = rollInitiative(c.id, c.initiativeBonus, p.mode, reason, rng);
    if (!rolled.ok) return refuse(rolled.code, rolled.message);
    events.push(rolled.event);
    order.push({
      combatantId: c.id,
      total: rolled.total,
      bonus: c.initiativeBonus,
    });
  }
  order.sort(compareEntries);
  events.push({
    type: "encounter.started",
    v: 1,
    reason,
    before: null,
    after: { round: 1, turnIndex: 0, order },
  });
  return { ok: true, events };
};

export const handleInitiativeJoin: Handler<"initiative.join"> = (
  state,
  command,
  rng,
) => {
  const enc = state.encounter;
  if (!enc) return refuse("NO_ACTIVE_ENCOUNTER", "no encounter is active");
  const c = state.combatants[command.combatantId];
  if (!c) return unknownCombatant(command.combatantId);
  if (enc.order.some((e) => e.combatantId === c.id)) {
    return refuse("ALREADY_IN_ENCOUNTER", `"${c.id}" is already in the order`, {
      combatantId: c.id,
    });
  }
  if (c.lifeState === "dead") return targetDead(c.id);
  const reason = command.reason;
  const rolled = rollInitiative(
    c.id,
    c.initiativeBonus,
    command.mode,
    reason,
    rng,
  );
  if (!rolled.ok) return refuse(rolled.code, rolled.message);
  const entry: Entry = {
    combatantId: c.id,
    total: rolled.total,
    bonus: c.initiativeBonus,
  };
  let at = enc.order.findIndex((e) => compareEntries(entry, e) < 0);
  if (at === -1) at = enc.order.length;
  const order = [...enc.order.slice(0, at), entry, ...enc.order.slice(at)];
  const turnIndex = at <= enc.turnIndex ? enc.turnIndex + 1 : enc.turnIndex;
  return {
    ok: true,
    events: [
      rolled.event,
      {
        type: "encounter.changed",
        v: 1,
        reason,
        combatantId: c.id,
        before: enc,
        after: { ...enc, turnIndex, order },
      },
    ],
  };
};

function expiring(
  state: EngineState,
  point: Pick<ExpiryPoint, "round" | "combatantId" | "boundary">,
  reason: string,
): EngineEvent[] {
  const events: EngineEvent[] = [];
  for (const c of Object.values(state.combatants)) {
    for (const instance of c.conditions) {
      const at = instance.expiresAt;
      if (
        at &&
        at.round === point.round &&
        at.combatantId === point.combatantId &&
        at.boundary === point.boundary
      ) {
        events.push({
          type: "condition.removed",
          v: 1,
          reason,
          combatantId: c.id,
          cause: "expired",
          before: instance,
          after: null,
        });
      }
    }
    // Spec 084 D7: an assist ends at the start of its helper's next turn.
    for (const assist of c.assists ?? []) {
      const at = assist.expiresAt;
      if (
        at &&
        at.round === point.round &&
        at.combatantId === point.combatantId &&
        at.boundary === point.boundary
      ) {
        events.push({
          type: "assist.ended",
          v: 1,
          reason,
          combatantId: c.id,
          cause: "expired",
          before: assist,
          after: null,
        });
      }
    }
  }
  return events;
}

/** The `reactionsSpent` slice with each given id removed; empty when none was spent. */
function withoutSpent(
  enc: Encounter,
  ...ids: (string | null)[]
): Pick<Encounter, "reactionsSpent"> {
  if (!enc.reactionsSpent) return {};
  return { reactionsSpent: enc.reactionsSpent.filter((x) => !ids.includes(x)) };
}

/**
 * The events `initiative.leave` emits, or its refusal. `combatant.depart` composes it (spec 099).
 * Caller guarantees an active encounter.
 */
export function leaveEvents(
  state: EngineState,
  id: string,
  reason: string,
): RefusalResult | EngineEvent[] {
  const enc = state.encounter as Encounter;
  const at = enc.order.findIndex((e) => e.combatantId === id);
  if (at === -1) {
    return refuse("UNKNOWN_COMBATANT", `"${id}" is not in the order`, {
      combatantId: id,
      reason: "not-in-order",
    });
  }
  if (enc.order.length === 1) {
    return refuse(
      "NO_ELIGIBLE_COMBATANT",
      "leaving would empty the initiative order",
      { combatantId: id },
    );
  }
  const order = enc.order.filter((_, i) => i !== at);
  const isDead = (e: Entry) =>
    state.combatants[e.combatantId]?.lifeState === "dead";
  const events: EngineEvent[] = [];
  let turnIndex = enc.turnIndex;
  let round = enc.round;
  let incomingId: string | null = null;
  if (at === enc.turnIndex) {
    // The leave is the turn transition: mirror turn.advance.
    if (order.every(isDead)) {
      return refuse(
        "NO_ELIGIBLE_COMBATANT",
        "every remaining combatant in the order is dead",
        { combatantId: id },
      );
    }
    events.push(
      ...expiring(
        state,
        { round: enc.round, combatantId: id, boundary: "turn-end" },
        reason,
      ),
    );
    let index = at;
    for (;;) {
      if (index >= order.length) {
        index = 0;
        round += 1;
      }
      const entry = order[index] as Entry;
      if (!isDead(entry)) break;
      for (const boundary of ["turn-start", "turn-end"] as const) {
        events.push(
          ...expiring(
            state,
            { round, combatantId: entry.combatantId, boundary },
            reason,
          ),
        );
      }
      index += 1;
    }
    turnIndex = index;
    incomingId = (order[index] as Entry).combatantId;
  } else if (at < enc.turnIndex) {
    turnIndex -= 1;
  }
  events.push({
    type: "encounter.changed",
    v: 1,
    reason,
    combatantId: id,
    before: enc,
    after: {
      ...enc,
      round,
      turnIndex,
      order,
      ...withoutSpent(enc, id, incomingId),
      ...withoutMelee(enc, id),
    },
  });
  if (incomingId !== null) {
    events.push(
      ...expiring(
        state,
        { round, combatantId: incomingId, boundary: "turn-start" },
        reason,
      ),
    );
  }
  return events;
}

export const handleInitiativeLeave: Handler<"initiative.leave"> = (
  state,
  command,
  _rng,
) => {
  if (!state.encounter) {
    return refuse("NO_ACTIVE_ENCOUNTER", "no encounter is active");
  }
  const id = command.combatantId;
  if (!state.combatants[id]) return unknownCombatant(id);
  const out = leaveEvents(state, id, command.reason);
  return Array.isArray(out) ? { ok: true, events: out } : out;
};

export const handleTurnAdvance: Handler<"turn.advance"> = (
  state,
  command,
  _rng,
) => {
  const enc = state.encounter;
  if (!enc) return refuse("NO_ACTIVE_ENCOUNTER", "no encounter is active");
  const isDead = (e: Entry) =>
    state.combatants[e.combatantId]?.lifeState === "dead";
  if (enc.order.every(isDead)) {
    return refuse(
      "NO_ELIGIBLE_COMBATANT",
      "every combatant in the order is dead",
    );
  }
  const reason = command.reason;
  const outgoing = enc.order[enc.turnIndex] as Entry;
  const events: EngineEvent[] = expiring(
    state,
    {
      round: enc.round,
      combatantId: outgoing.combatantId,
      boundary: "turn-end",
    },
    reason,
  );
  const skipped: string[] = [];
  let index = enc.turnIndex;
  let round = enc.round;
  for (;;) {
    index += 1;
    if (index >= enc.order.length) {
      index = 0;
      round += 1;
    }
    const entry = enc.order[index] as Entry;
    if (!isDead(entry)) break;
    skipped.push(entry.combatantId);
    for (const boundary of ["turn-start", "turn-end"] as const) {
      events.push(
        ...expiring(
          state,
          { round, combatantId: entry.combatantId, boundary },
          reason,
        ),
      );
    }
  }
  const incoming = enc.order[index] as Entry;
  events.push({
    type: "turn.advanced",
    v: 1,
    reason,
    skipped,
    before: {
      round: enc.round,
      turnIndex: enc.turnIndex,
      combatantId: outgoing.combatantId,
    },
    after: { round, turnIndex: index, combatantId: incoming.combatantId },
  });
  if (enc.reactionsSpent?.includes(incoming.combatantId)) {
    // The Reaction returns at the start of its owner's turn (SRD 5.2.1 p. 10).
    const advanced = { ...enc, round, turnIndex: index };
    events.push({
      type: "encounter.changed",
      v: 1,
      reason,
      combatantId: incoming.combatantId,
      before: advanced,
      after: { ...advanced, ...withoutSpent(enc, incoming.combatantId) },
    });
  }
  events.push(
    ...expiring(
      state,
      { round, combatantId: incoming.combatantId, boundary: "turn-start" },
      reason,
    ),
  );
  return { ok: true, events };
};

/** The events `encounter.end` emits. Caller guarantees an active encounter. */
export function endEvents(state: EngineState, reason: string): EngineEvent[] {
  const enc = state.encounter as Encounter;
  const events: EngineEvent[] = [];
  for (const c of Object.values(state.combatants)) {
    for (const instance of c.conditions) {
      if (instance.expiresAt) {
        events.push({
          type: "condition.removed",
          v: 1,
          reason: reason,
          combatantId: c.id,
          cause: "encounter-ended",
          before: instance,
          after: null,
        });
      }
    }
    for (const assist of c.assists ?? []) {
      events.push({
        type: "assist.ended",
        v: 1,
        reason: reason,
        combatantId: c.id,
        cause: "encounter-ended",
        before: assist,
        after: null,
      });
    }
  }
  events.push({
    type: "encounter.ended",
    v: 1,
    reason: reason,
    before: enc,
    after: null,
  });
  return events;
}

export const handleEncounterEnd: Handler<"encounter.end"> = (
  state,
  command,
  _rng,
) => {
  if (!state.encounter) {
    return refuse("NO_ACTIVE_ENCOUNTER", "no encounter is active");
  }
  return { ok: true, events: endEvents(state, command.reason) };
};

export const handleCombatantDepart: Handler<"combatant.depart"> = (
  state,
  command,
  _rng,
) => {
  const id = command.combatantId;
  const c = state.combatants[id];
  if (!c) return unknownCombatant(id);
  const inOrder = state.encounter?.order.some((e) => e.combatantId === id);
  if (!inOrder && !c.placement) {
    return refuse(
      "INVALID_COMMAND",
      `"${id}" is neither in the order nor placed`,
      { combatantId: id },
    );
  }
  const events: EngineEvent[] = [];
  if (inOrder) {
    const left = leaveEvents(state, id, command.reason);
    if (Array.isArray(left)) events.push(...left);
    else if (left.refusal.code === "NO_ELIGIBLE_COMBATANT") {
      events.push(...endEvents(state, command.reason));
    } else return left;
  }
  if (c.placement) {
    events.push({
      type: "combatant.placed",
      v: 1,
      reason: command.reason,
      combatantId: id,
      before: c.placement,
      after: null,
    });
  }
  return { ok: true, events };
};
