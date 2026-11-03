import { hasPlainD20, parseDiceExpression, rollExpression } from "../dice.js";
import type { Handler } from "../handler.js";
import type { EngineEvent, OutcomeBand } from "../schema/events.js";
import { type RefusalResult, refuse } from "../schema/refusals.js";
import type { Combatant, EngineState } from "../schema/state.js";

function d20Required(expression: string): RefusalResult {
  return refuse(
    "D20_TERM_REQUIRED",
    "the expression needs exactly one plain positive 1d20 term",
    { expression },
  );
}

/** First failing UNKNOWN_COMBATANT / TARGET_DEAD check over the named ids, unknowns first. */
function checkNamed(
  state: EngineState,
  ids: readonly (string | null)[],
): RefusalResult | null {
  const named = ids.filter((id): id is string => id !== null);
  for (const id of named) {
    if (!state.combatants[id]) {
      return refuse("UNKNOWN_COMBATANT", `no combatant "${id}"`, {
        combatantId: id,
      });
    }
  }
  for (const id of named) {
    if (state.combatants[id]?.lifeState === "dead") {
      return refuse("TARGET_DEAD", `combatant "${id}" is dead`, {
        combatantId: id,
      });
    }
  }
  return null;
}

/** Conditions that stop a combatant acting (attack rolls and ability checks). */
const INCAPACITATING = [
  "incapacitated",
  "paralyzed",
  "petrified",
  "stunned",
  "unconscious",
] as const;

function incapacitatingKeys(c: Combatant): string[] {
  return c.conditions
    .map((i) => i.condition as string)
    .filter((k) => (INCAPACITATING as readonly string[]).includes(k));
}

/** True when the combatant is down (unconscious or stable) or holds an incapacitating condition. */
function isUnable(c: Combatant): boolean {
  return (
    c.lifeState === "unconscious" ||
    c.lifeState === "stable" ||
    incapacitatingKeys(c).length > 0
  );
}

function actorUnable(
  state: EngineState,
  id: string | null,
  role: "attacker" | "checker",
): RefusalResult | null {
  if (id === null) return null;
  const c = state.combatants[id];
  if (!c || !isUnable(c)) return null;
  return refuse("ACTOR_UNABLE", `combatant "${id}" cannot act`, {
    combatantId: id,
    role,
    lifeState: c.lifeState,
    conditions: incapacitatingKeys(c),
  });
}

export const handleAttackRoll: Handler<"attack.roll"> = (
  state,
  command,
  rng,
) => {
  const parsed = parseDiceExpression(command.expression);
  if (!parsed.ok) return refuse(parsed.code, parsed.message);
  if (!hasPlainD20(parsed.terms)) return d20Required(command.expression);
  const named = checkNamed(state, [command.targetId, command.attackerId]);
  if (named) return named;
  const unable = actorUnable(state, command.attackerId, "attacker");
  if (unable) return unable;
  const enc = state.encounter;
  if (command.reaction) {
    if (!enc) return refuse("NO_ACTIVE_ENCOUNTER", "no encounter is active");
    if (command.attackerId === null) {
      return refuse("INVALID_COMMAND", "a reaction needs an attacker");
    }
    if (!enc.order.some((e) => e.combatantId === command.attackerId)) {
      return refuse(
        "UNKNOWN_COMBATANT",
        `"${command.attackerId}" is not in the order`,
        { combatantId: command.attackerId, reason: "not-in-order" },
      );
    }
    if (enc.reactionsSpent?.includes(command.attackerId)) {
      return refuse(
        "REACTION_SPENT",
        `"${command.attackerId}" has spent its Reaction`,
        { combatantId: command.attackerId },
      );
    }
  }
  const target = state.combatants[command.targetId];
  const ac = command.targetAc ?? target?.ac ?? null;
  if (ac === null) {
    return refuse(
      "TARGET_AC_UNKNOWN",
      `target "${command.targetId}" has no AC and the attack carries none`,
      { combatantId: command.targetId },
    );
  }
  const rolled = rollExpression(
    command.expression,
    {
      mode: command.mode,
      critical: false,
      purpose: "attack",
      combatantId: command.attackerId,
      reason: command.reason,
    },
    rng,
  );
  if (!rolled.ok) return refuse(rolled.code, rolled.message);
  const natural = rolled.event.natural as number;
  const outcome =
    natural === 20
      ? "critical-hit"
      : natural === 1
        ? "miss"
        : rolled.total >= ac
          ? "hit"
          : "miss";
  const events: EngineEvent[] = [
    rolled.event,
    {
      type: "attack.resolved",
      v: 1,
      reason: command.reason,
      attackerId: command.attackerId,
      targetId: command.targetId,
      rollIndex: 0,
      ac,
      acSource: command.targetAc !== null ? "command" : "record",
      total: rolled.total,
      natural,
      outcome,
      ...(command.reaction ? { reaction: true } : {}),
    },
  ];
  if (command.reaction && enc && command.attackerId !== null) {
    events.push({
      type: "encounter.changed",
      v: 1,
      reason: command.reason,
      combatantId: command.attackerId,
      before: enc,
      after: {
        ...enc,
        reactionsSpent: [...(enc.reactionsSpent ?? []), command.attackerId],
      },
    });
  }
  return { ok: true, events };
};

/**
 * Spec 070 D2: the outcome and band of a rolled check. Natural 20 succeeds and
 * natural 1 fails when `naturals`; the bands (-1..-2 success at a cost, <= -5
 * severe) apply to ability checks only, when `outcomeBands`.
 */
export function bandOf(input: {
  total: number;
  dc: number;
  natural: number | null;
  kind: "ability-check" | "saving-throw";
  houseRules: { outcomeBands: boolean; naturals: boolean };
}): { margin: number; band: OutcomeBand; outcome: "success" | "failure" } {
  const { total, dc, natural, kind, houseRules } = input;
  const margin = total - dc;
  const bands = houseRules.outcomeBands && kind === "ability-check";
  const fail = (): OutcomeBand =>
    bands && margin <= -5 ? "severe-failure" : "failure";
  let band: OutcomeBand;
  if (houseRules.naturals && natural === 20) band = "success";
  else if (houseRules.naturals && natural === 1) band = fail();
  else if (margin >= 0) band = "success";
  else if (bands && margin >= -2) band = "success-at-cost";
  else band = fail();
  const outcome =
    band === "success" || band === "success-at-cost" ? "success" : "failure";
  return { margin, band, outcome };
}

export const handleCheckRoll: Handler<"check.roll"> = (state, command, rng) => {
  const parsed = parseDiceExpression(command.expression);
  if (!parsed.ok) return refuse(parsed.code, parsed.message);
  if (!hasPlainD20(parsed.terms)) return d20Required(command.expression);
  const named = checkNamed(state, [command.combatantId]);
  if (named) return named;
  if (command.kind === "ability-check") {
    const unable = actorUnable(state, command.combatantId, "checker");
    if (unable) return unable;
  }
  const base = {
    type: "check.resolved" as const,
    v: 1 as const,
    reason: command.reason,
    combatantId: command.combatantId,
    kind: command.kind,
    ability: command.ability,
    skill: command.skill,
    dc: command.dc,
  };
  if (command.autoFail && command.autoSuccess) {
    return refuse(
      "INVALID_COMMAND",
      "a check cannot be both autoFail and autoSuccess",
    );
  }
  if (command.autoSuccess) {
    return {
      ok: true,
      events: [
        {
          ...base,
          rollIndex: null,
          total: null,
          natural: null,
          autoFail: null,
          outcome: "success",
          margin: null,
          band: "success",
        },
      ],
    };
  }
  if (command.autoFail) {
    return {
      ok: true,
      events: [
        {
          ...base,
          rollIndex: null,
          total: null,
          natural: null,
          autoFail: command.autoFail,
          outcome: "failure",
          margin: null,
          band: "failure",
        },
      ],
    };
  }
  const rolled = rollExpression(
    command.expression,
    {
      mode: command.mode,
      critical: false,
      purpose: command.kind === "saving-throw" ? "save" : "check",
      combatantId: command.combatantId,
      reason: command.reason,
    },
    rng,
  );
  if (!rolled.ok) return refuse(rolled.code, rolled.message);
  const result = bandOf({
    total: rolled.total,
    dc: command.dc,
    natural: rolled.event.natural,
    kind: command.kind,
    houseRules: command.houseRules ?? { outcomeBands: false, naturals: false },
  });
  return {
    ok: true,
    events: [
      rolled.event,
      {
        ...base,
        rollIndex: 0,
        total: rolled.total,
        natural: rolled.event.natural,
        autoFail: null,
        outcome: result.outcome,
        margin: result.margin,
        band: result.band,
      },
    ],
  };
};
