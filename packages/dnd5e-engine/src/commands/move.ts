import { path } from "@the-stacks/space";
import type { Handler } from "../handler.js";
import type { EngineEvent } from "../schema/events.js";
import { type RefusalResult, refuse } from "../schema/refusals.js";
import type { Combatant, Encounter, EngineState } from "../schema/state.js";
import { actorUnable, isUnable } from "./attacks.js";

type Movement = NonNullable<Encounter["movement"]>;

/** SRD 5.2.1: these conditions set Speed to 0. */
const SPEED_ZERO = [
  "grappled",
  "paralyzed",
  "petrified",
  "restrained",
  "unconscious",
] as const;

const unknown = (id: string): RefusalResult =>
  refuse("UNKNOWN_COMBATANT", `no combatant "${id}"`, { combatantId: id });

/** Walking Speed in feet after conditions and exhaustion; null when the combatant has no speed stat. */
export function effectiveSpeed(c: Combatant): number | null {
  if (c.speed === undefined) return null;
  if (
    c.conditions.some((i) =>
      (SPEED_ZERO as readonly string[]).includes(i.condition),
    )
  ) {
    return 0;
  }
  const exhaustion =
    c.conditions.find((i) => i.condition === "exhaustion")?.level ?? 0;
  return Math.max(0, c.speed - 5 * exhaustion);
}

/** The active combatant's movement record for the current turn; null when stale or off turn. */
function currentMovement(state: EngineState, id: string): Movement | null {
  const enc = state.encounter;
  if (!enc) return null;
  const active = enc.order[enc.turnIndex]?.combatantId;
  const m = enc.movement;
  if (active !== id || !m || m.combatantId !== id || m.round !== enc.round) {
    return null;
  }
  return m;
}

/** Feet left this turn; null outside an encounter (unbounded) or for a mover with no speed. */
export function movementLeft(
  state: EngineState,
  combatantId: string,
): number | null {
  const enc = state.encounter;
  const c = state.combatants[combatantId];
  if (!enc || !c) return null;
  const speed = effectiveSpeed(c);
  if (speed === null) return null;
  const m = currentMovement(state, combatantId);
  return speed * (1 + (m?.dashes ?? 0)) - (m?.usedFt ?? 0);
}

function withMovement(
  state: EngineState,
  id: string,
  patch: (m: Movement) => Movement,
): Encounter {
  const enc = state.encounter as Encounter;
  const m = currentMovement(state, id) ?? {
    combatantId: id,
    round: enc.round,
    usedFt: 0,
    dashes: 0,
    disengaged: false,
  };
  return { ...enc, movement: patch(m) };
}

export const handleSpaceDefine: Handler<"space.define"> = (state, command) => {
  const zones = new Set(command.space.zones.map((z) => z.id));
  for (const c of Object.values(state.combatants)) {
    if (c.placement && !zones.has(c.placement.zoneId)) {
      return refuse(
        "ZONE_IN_USE",
        `"${c.id}" stands in zone "${c.placement.zoneId}", missing from the new space`,
        { combatantId: c.id, zoneId: c.placement.zoneId },
      );
    }
  }
  return {
    ok: true,
    events: [
      {
        type: "space.defined",
        v: 1,
        reason: command.reason,
        before: state.space ?? null,
        after: command.space,
      },
    ],
  };
};

export const handleCombatantPlace: Handler<"combatant.place"> = (
  state,
  command,
) => {
  const c = state.combatants[command.combatantId];
  if (!c) return unknown(command.combatantId);
  if (command.zoneId !== null) {
    if (!state.space) {
      return refuse("SPACE_UNDEFINED", "the scene has no space");
    }
    if (!state.space.zones.some((z) => z.id === command.zoneId)) {
      return refuse("ZONE_UNKNOWN", `no zone "${command.zoneId}"`, {
        zoneId: command.zoneId,
      });
    }
  }
  return {
    ok: true,
    events: [
      {
        type: "combatant.placed",
        v: 1,
        reason: command.reason,
        combatantId: c.id,
        before: c.placement ?? null,
        after: command.zoneId === null ? null : { zoneId: command.zoneId },
      },
    ],
  };
};

export const handleMove: Handler<"move"> = (state, command) => {
  const c = state.combatants[command.combatantId];
  if (!c) return unknown(command.combatantId);
  if (c.lifeState === "dead") {
    return refuse("ACTOR_UNABLE", `combatant "${c.id}" is dead`, {
      combatantId: c.id,
      role: "mover",
    });
  }
  const unable = actorUnable(state, c.id, "mover");
  if (unable) return unable;
  if (!state.space) return refuse("SPACE_UNDEFINED", "the scene has no space");
  if (!c.placement) {
    return refuse("NOT_PLACED", `"${c.id}" is not placed`, {
      combatantId: c.id,
    });
  }
  if (!state.space.zones.some((z) => z.id === command.toZoneId)) {
    return refuse("ZONE_UNKNOWN", `no zone "${command.toZoneId}"`, {
      zoneId: command.toZoneId,
    });
  }
  const from = c.placement.zoneId;
  if (from === command.toZoneId) {
    return refuse("INVALID_COMMAND", `${c.id} is already in zone ${from}`);
  }
  const route = path(state.space, from, command.toZoneId);
  if (!route) {
    return refuse(
      "MOVE_BLOCKED",
      `no open path between zones ${from} and ${command.toZoneId}`,
      { from, to: command.toZoneId },
    );
  }
  const enc = state.encounter;
  let cost = route.feet;
  if (enc) {
    if (enc.order[enc.turnIndex]?.combatantId !== c.id) {
      return refuse("MOVE_OFF_TURN", `it is not "${c.id}"'s turn`, {
        combatantId: c.id,
      });
    }
    if (effectiveSpeed(c) === null) {
      return refuse("STAT_UNDEFINED", `"${c.id}" has no speed`, {
        combatantId: c.id,
        missing: "speed",
      });
    }
    // SRD 5.2.1 prone: crawling costs 1 extra foot per foot.
    if (c.conditions.some((i) => i.condition === "prone")) cost *= 2;
    const left = movementLeft(state, c.id) as number;
    if (cost > left) {
      return refuse(
        "MOVE_OVER_SPEED",
        `${cost} ft exceeds the ${left} ft left this turn`,
        { combatantId: c.id, cost, left },
      );
    }
  }
  const events: EngineEvent[] = [
    {
      type: "combatant.moved",
      v: 1,
      reason: command.reason,
      combatantId: c.id,
      before: { zoneId: from },
      after: { zoneId: command.toZoneId },
      path: route.zones,
      feet: cost,
    },
  ];
  if (enc) {
    events.push({
      type: "encounter.changed",
      v: 1,
      reason: command.reason,
      combatantId: c.id,
      before: enc,
      after: withMovement(state, c.id, (m) => ({
        ...m,
        usedFt: m.usedFt + cost,
      })),
    });
  }
  return { ok: true, events };
};

export const handleMovementAction: Handler<"movement.action"> = (
  state,
  command,
) => {
  const c = state.combatants[command.combatantId];
  if (!c) return unknown(command.combatantId);
  const enc = state.encounter;
  if (!enc) return refuse("NO_ACTIVE_ENCOUNTER", "no encounter is active");
  if (enc.order[enc.turnIndex]?.combatantId !== c.id) {
    return refuse("MOVE_OFF_TURN", `it is not "${c.id}"'s turn`, {
      combatantId: c.id,
    });
  }
  return {
    ok: true,
    events: [
      {
        type: "encounter.changed",
        v: 1,
        reason: command.reason,
        combatantId: c.id,
        before: enc,
        after: withMovement(state, c.id, (m) =>
          command.action === "dash"
            ? { ...m, dashes: m.dashes + 1 }
            : { ...m, disengaged: true },
        ),
      },
    ],
  };
};

/**
 * Who may take an opportunity attack when `moverId` leaves for `toZoneId`, in initiative order.
 * ponytail: only the origin zone provokes (OQ-2); a hostile passed in a transit zone does not.
 * Upgrade path: grid mode (R5) resolves reach per square. The engine knows no sides: callers
 * filter by hostility, as reactors() does.
 */
export function provokers(
  state: EngineState,
  moverId: string,
  toZoneId: string,
): string[] {
  const enc = state.encounter;
  const mover = state.combatants[moverId];
  const from = mover?.placement?.zoneId;
  if (!enc || !mover || !from || from === toZoneId) return [];
  if (currentMovement(state, moverId)?.disengaged) return [];
  return enc.order
    .map((e) => state.combatants[e.combatantId])
    .filter(
      (c): c is Combatant =>
        c !== undefined &&
        c.id !== moverId &&
        c.placement?.zoneId === from &&
        c.lifeState === "conscious" &&
        !isUnable(c) &&
        !enc.reactionsSpent?.includes(c.id) &&
        (c.stats?.attacks.some((a) => a.range !== "ranged") ?? false),
    )
    .map((c) => c.id);
}

/** Spec 099: standing from prone costs half Speed (SRD 5.2.1 condition prone). */
export const handleStand: Handler<"stand"> = (state, command) => {
  const c = state.combatants[command.combatantId];
  if (!c) return unknown(command.combatantId);
  const prone = c.conditions.filter((i) => i.condition === "prone");
  if (prone.length === 0) {
    return refuse("CONDITION_NOT_PRESENT", `combatant "${c.id}" is not prone`, {
      combatantId: c.id,
      condition: "prone",
    });
  }
  const enc = state.encounter;
  let cost = 0;
  if (enc) {
    if (enc.order[enc.turnIndex]?.combatantId !== c.id) {
      return refuse("MOVE_OFF_TURN", `it is not "${c.id}"'s turn`, {
        combatantId: c.id,
      });
    }
    const speed = effectiveSpeed(c);
    if (speed === null) {
      return refuse("STAT_UNDEFINED", `"${c.id}" has no speed`, {
        combatantId: c.id,
        missing: "speed",
      });
    }
    cost = Math.floor(speed / 2);
    const left = movementLeft(state, c.id) as number;
    if (speed === 0 || cost > left) {
      return refuse(
        "MOVE_OVER_SPEED",
        speed === 0
          ? `"${c.id}" has Speed 0 and cannot stand`
          : `standing costs ${cost} ft, ${left} ft left this turn`,
        {
          combatantId: c.id,
          cost,
          left,
          ...(speed === 0 ? { reason: "speed-zero" } : {}),
        },
      );
    }
  }
  const events: EngineEvent[] = prone.map(
    (instance): EngineEvent => ({
      type: "condition.removed",
      v: 1,
      reason: command.reason,
      combatantId: c.id,
      cause: "command",
      before: instance,
      after: null,
    }),
  );
  if (enc) {
    events.push({
      type: "encounter.changed",
      v: 1,
      reason: command.reason,
      combatantId: c.id,
      before: enc,
      after: withMovement(state, c.id, (m) => ({
        ...m,
        usedFt: m.usedFt + cost,
      })),
    });
  }
  return { ok: true, events };
};
