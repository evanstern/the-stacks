import { bandBetween, rangeOf, reachCovers } from "@the-stacks/space";
import {
  attackAssists,
  attackModeSources,
  checkAssists,
  checkModeSources,
  checkModifier,
  DIFFICULTY_DC,
  d20Expression,
  findAttack,
  foldMode,
  type ModeSource,
  oppositionCovers,
  oppositionDc,
} from "../derive.js";
import { hasPlainD20, parseDiceExpression, rollExpression } from "../dice.js";
import type { Handler } from "../handler.js";
import type { EngineEvent, OutcomeBand } from "../schema/events.js";
import { type RefusalResult, refuse } from "../schema/refusals.js";
import type {
  Assist,
  AttackEntry,
  Combatant,
  Encounter,
  EngineState,
} from "../schema/state.js";
import { closeCombatSources, meleePairFor, withMeleePair } from "../sides.js";
import { spaceViewOf } from "../space.js";

/** Spec 084: one `assist.ended` (used) per applied assist, held by `holderId`. */
export function usedAssists(
  holderId: string,
  assists: readonly Assist[],
  reason: string,
): EngineEvent[] {
  return assists.map((before) => ({
    type: "assist.ended" as const,
    v: 1 as const,
    reason,
    combatantId: holderId,
    cause: "used" as const,
    before,
    after: null,
  }));
}

function d20Required(expression: string): RefusalResult {
  return refuse(
    "D20_TERM_REQUIRED",
    "the expression needs exactly one plain positive 1d20 term",
    { expression },
  );
}

/** First failing UNKNOWN_COMBATANT / TARGET_DEAD check over the named ids, unknowns first. */
export function checkNamed(
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
export function isUnable(c: Combatant): boolean {
  return (
    c.lifeState === "unconscious" ||
    c.lifeState === "stable" ||
    incapacitatingKeys(c).length > 0
  );
}

export function actorUnable(
  state: EngineState,
  id: string | null,
  role: "attacker" | "checker" | "helper" | "mover",
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

/**
 * Spec 094 FR-020..FR-022: band checks when both combatants are placed. Returns a refusal, or
 * whether a long-range use adds a disadvantage source.
 */
function bandCheck(
  state: EngineState,
  attackerId: string,
  targetId: string,
  entry: AttackEntry,
): RefusalResult | { long: boolean } {
  const band = bandBetween(spaceViewOf(state), attackerId, targetId);
  if (band === null) return { long: false };
  if (
    entry.range === "melee" ||
    (entry.range === "melee-or-ranged" && band === "engaged")
  ) {
    if (!reachCovers(band, entry.reachFt ?? 5)) {
      return refuse(
        "OUT_OF_REACH",
        `"${targetId}" is ${band}, beyond melee reach`,
        {
          attackerId,
          targetId,
          band,
        },
      );
    }
    return { long: false };
  }
  if (!entry.rangeFt) {
    return refuse("STAT_UNDEFINED", `attack "${entry.name}" has no range`, {
      combatantId: attackerId,
      missing: "rangeFt",
    });
  }
  const use = rangeOf(band, entry.rangeFt);
  if (use === "out") {
    return refuse("OUT_OF_RANGE", `"${targetId}" is ${band}, beyond range`, {
      attackerId,
      targetId,
      band,
    });
  }
  return { long: use === "long" };
}

function isRangedUse(
  state: EngineState,
  attackerId: string,
  targetId: string,
  entry: AttackEntry,
): boolean {
  if (entry.range === "ranged") return true;
  if (entry.range === "melee") return false;
  const band = bandBetween(spaceViewOf(state), attackerId, targetId);
  return band !== null && band !== "engaged";
}

export const handleAttackRoll: Handler<"attack.roll"> = (
  state,
  command,
  rng,
) => {
  if ((command.expression === undefined) === (command.attack === undefined)) {
    return refuse(
      "INVALID_COMMAND",
      "attack.roll needs exactly one of expression and attack",
    );
  }
  if (command.expression !== undefined) {
    const parsed = parseDiceExpression(command.expression);
    if (!parsed.ok) return refuse(parsed.code, parsed.message);
    if (!hasPlainD20(parsed.terms)) return d20Required(command.expression);
  } else if (command.attackerId === null) {
    return refuse("INVALID_COMMAND", "a derived attack needs an attacker");
  }
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
  let expression = command.expression ?? "";
  let mode = command.mode;
  let applied: Assist[] = [];
  if (command.attack !== undefined) {
    const attacker = state.combatants[command.attackerId as string];
    const entry = attacker ? findAttack(attacker, command.attack) : null;
    if (!attacker || !entry || !entry.ok) {
      return refuse(
        "STAT_UNDEFINED",
        `cannot derive attack "${command.attack}" for "${command.attackerId}"`,
        {
          combatantId: command.attackerId,
          missing: entry && !entry.ok ? entry.missing : "stats",
        },
      );
    }
    const placed = bandCheck(state, attacker.id, command.targetId, entry.value);
    if ("refusal" in placed) return placed;
    const exhaustion =
      attacker.conditions.find((i) => i.condition === "exhaustion")?.level ?? 0;
    expression = d20Expression(entry.value.toHit - 2 * exhaustion);
    // Spec 084 D5: an open Help against the target gives advantage (rules-glossary.help-action).
    applied = attackAssists(target, command.attackerId);
    mode = foldMode(command.mode, [
      ...attackModeSources(attacker, target, entry.value),
      ...(applied.length ? (["advantage"] as ModeSource[]) : []),
      ...(placed.long ? (["disadvantage"] as ModeSource[]) : []),
      // Spec 099: a ranged attack with a hostile in the attacker's zone (the
      // ranged-attacks-in-close-combat rule). A melee-or-ranged entry is ranged
      // only against a target outside the engaged band.
      ...closeCombatSources(
        state,
        attacker.id,
        isRangedUse(state, attacker.id, command.targetId, entry.value),
      ),
    ]);
  }
  const rolled = rollExpression(
    expression,
    {
      mode,
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
      ...(command.attack !== undefined ? { attack: command.attack } : {}),
      ...(command.reaction ? { reaction: true } : {}),
    },
    ...usedAssists(command.targetId, applied, command.reason),
  ];
  // Spec 101: a resolved melee use in one zone forms a melee pair.
  let after: Encounter | null = enc;
  if (enc && command.attack !== undefined && command.attackerId !== null) {
    const attacker = state.combatants[command.attackerId];
    const entry = attacker ? findAttack(attacker, command.attack) : null;
    if (
      entry?.ok &&
      !isRangedUse(state, command.attackerId, command.targetId, entry.value) &&
      meleePairFor(state, command.attackerId, command.targetId)
    ) {
      after = withMeleePair(enc, command.attackerId, command.targetId) ?? enc;
    }
  }
  if (command.reaction && enc && command.attackerId !== null) {
    after = {
      ...(after as Encounter),
      reactionsSpent: [...(enc.reactionsSpent ?? []), command.attackerId],
    };
  }
  if (enc && after && after !== enc && command.attackerId !== null) {
    events.push({
      type: "encounter.changed",
      v: 1,
      reason: command.reason,
      combatantId: command.attackerId,
      before: enc,
      after,
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
  const sources = [command.dc, command.difficulty, command.opposition].filter(
    (v) => v !== undefined,
  ).length;
  if (sources !== 1) {
    return refuse(
      "INVALID_COMMAND",
      "check.roll needs exactly one of dc, difficulty and opposition",
    );
  }
  const opposition = command.opposition;
  if (
    opposition &&
    (opposition.opponentId === command.combatantId ||
      !oppositionCovers(
        opposition.rule,
        command.kind,
        command.ability,
        command.skill,
      ))
  ) {
    return refuse(
      "INVALID_COMMAND",
      "the opposition is the checker or its rule does not cover this check",
      { rule: opposition.rule },
    );
  }
  let dc =
    command.dc ??
    (command.difficulty !== undefined ? DIFFICULTY_DC[command.difficulty] : 0);
  if (command.expression !== undefined) {
    const parsed = parseDiceExpression(command.expression);
    if (!parsed.ok) return refuse(parsed.code, parsed.message);
    if (!hasPlainD20(parsed.terms)) return d20Required(command.expression);
  }
  const named = checkNamed(state, [
    command.combatantId,
    opposition?.opponentId ?? null,
  ]);
  if (named) return named;
  if (opposition) {
    const derived = oppositionDc(
      state.combatants[opposition.opponentId] as Combatant,
      opposition.rule,
    );
    if (!derived.ok) {
      return refuse(
        "STAT_UNDEFINED",
        `cannot derive the DC of opponent "${opposition.opponentId}"`,
        { combatantId: opposition.opponentId, missing: derived.missing },
      );
    }
    dc = derived.value;
  }
  if (command.kind === "ability-check") {
    const unable = actorUnable(state, command.combatantId, "checker");
    if (unable) return unable;
  }
  let expression = command.expression ?? "1d20";
  let mode = command.mode;
  let applied: Assist[] = [];
  if (command.expression === undefined && command.combatantId !== null) {
    const checker = state.combatants[command.combatantId] as Combatant;
    const mod = checkModifier(
      checker,
      command.kind,
      command.ability,
      command.skill,
    );
    if (!mod.ok) {
      return refuse(
        "STAT_UNDEFINED",
        `cannot derive the modifier for "${command.combatantId}"`,
        { combatantId: command.combatantId, missing: mod.missing },
      );
    }
    expression = d20Expression(mod.value);
    applied = checkAssists(checker, command.kind, command.skill);
    mode = foldMode(command.mode, [
      ...checkModeSources(checker, command.kind, command.ability),
      ...(applied.length ? (["advantage"] as ModeSource[]) : []),
    ]);
  }
  const base = {
    type: "check.resolved" as const,
    v: 1 as const,
    reason: command.reason,
    combatantId: command.combatantId,
    kind: command.kind,
    ability: command.ability,
    skill: command.skill,
    dc,
    ...(command.difficulty !== undefined
      ? { difficulty: command.difficulty }
      : {}),
    ...(opposition ? { opposition } : {}),
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
    expression,
    {
      mode,
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
    dc,
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
      ...usedAssists(command.combatantId as string, applied, command.reason),
    ],
  };
};
