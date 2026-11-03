import {
  attackAssists,
  attackModeSources,
  checkModeSources,
  checkModifier,
  d20Expression,
  foldMode,
  type ModeSource,
  spellAttackBonus,
  spellcastingModifier,
  spellSaveDc,
} from "../derive.js";
import { rollExpression } from "../dice.js";
import type { Handler } from "../handler.js";
import type { EngineEvent } from "../schema/events.js";
import { type RefusalResult, refuse } from "../schema/refusals.js";
import type {
  AttackEntry,
  Combatant,
  EngineState,
  ExpiryPoint,
} from "../schema/state.js";
import { SPELLS, spellDice } from "../spells.js";
import { actorUnable, bandOf, checkNamed, usedAssists } from "./attacks.js";
import { appliedEvent } from "./conditions.js";
import { damageEvents, healingEvents, preflight } from "./hit-points.js";
import { slotExpendEvent } from "./spell-slots.js";

/**
 * Spell `ray-of-sickness`: "until the end of your next turn". Active caster: the end of the
 * caster's turn next round. Caster later in this round's order: this round. Otherwise next round.
 * Null outside an encounter or when the caster is not in the order.
 */
function nextTurnEnd(state: EngineState, casterId: string): ExpiryPoint | null {
  const enc = state.encounter;
  if (!enc) return null;
  const at = enc.order.findIndex((e) => e.combatantId === casterId);
  if (at < 0) return null;
  const round = at > enc.turnIndex ? enc.round : enc.round + 1;
  return { round, combatantId: casterId, boundary: "turn-end" };
}

export const handleSpellCast: Handler<"spell.cast"> = (state, command, rng) => {
  const spell = SPELLS[command.spellId];
  if (!spell) {
    return refuse("SPELL_UNRESOLVED", `no mechanics for "${command.spellId}"`, {
      spellId: command.spellId,
      reason: "no-mechanics",
    });
  }
  const slotLevel = command.slotLevel;
  const badLevel =
    spell.level === 0
      ? slotLevel !== null
      : slotLevel === null || slotLevel < spell.level;
  if (badLevel) {
    return refuse(
      "SPELL_UNRESOLVED",
      `"${spell.id}" cannot be cast at slot level ${slotLevel}`,
      { spellId: spell.id, reason: "slot-level", slotLevel },
    );
  }
  const named = checkNamed(state, [command.targetId, command.casterId]);
  if (named) return named;
  const unable = actorUnable(state, command.casterId, "attacker");
  if (unable) return unable;
  const caster = state.combatants[command.casterId] as Combatant;
  const target = state.combatants[command.targetId] as Combatant;
  const stat = (c: Combatant, missing: string): RefusalResult =>
    refuse("STAT_UNDEFINED", `cannot derive "${missing}" for "${c.id}"`, {
      combatantId: c.id,
      missing,
    });
  if (!caster.stats || spellcastingModifier(caster.stats) === null) {
    return stat(caster, "spellcasting ability modifier");
  }
  const mod = spellcastingModifier(caster.stats) as number;
  const d = spell.delivery;
  let saveMod = 0;
  if (d.kind === "save") {
    const m = checkModifier(target, "saving-throw", d.ability, null);
    if (!m.ok) return stat(target, m.missing);
    saveMod = m.value;
  }

  const reason = command.reason;
  const dice = spellDice(spell, slotLevel, command.casterLevel);
  const critMax = d.kind === "attack";
  for (const expr of dice.damage) {
    const failure = preflight(expr, critMax);
    if (failure) return refuse(failure.code, failure.message);
  }
  const healExpr =
    dice.healing === null
      ? null
      : spell.healing?.addModifier && mod !== 0
        ? `${dice.healing}${mod > 0 ? "+" : ""}${mod}`
        : dice.healing;
  if (healExpr) {
    const failure = preflight(healExpr, false);
    if (failure) return refuse(failure.code, failure.message);
  }

  const events: EngineEvent[] = [];
  if (spell.level > 0) {
    const slot = slotExpendEvent(
      state,
      caster.id,
      null,
      slotLevel as number,
      reason,
    );
    if ("ok" in slot) return slot;
    events.push(slot);
  }

  const components = spell.damage.map((c, i) => ({
    amount: { kind: "roll" as const, expression: dice.damage[i] as string },
    damageType: c.damageType,
  }));
  const fail = (r: RefusalResult | null) => r;
  let dealt: "full" | "half" | "none" = "none";

  if (d.kind === "attack") {
    const exhaustion =
      caster.conditions.find((i) => i.condition === "exhaustion")?.level ?? 0;
    const bonus = (spellAttackBonus(caster.stats) as number) - 2 * exhaustion;
    // Spec 084 D5a: a spell attack roll is an attack roll (rules-glossary.help-action).
    const applied = attackAssists(target, caster.id);
    const mode = foldMode("normal", [
      ...attackModeSources(caster, target, { range: d.range } as AttackEntry),
      ...(applied.length ? (["advantage"] as ModeSource[]) : []),
    ]);
    const ac = target.ac;
    if (ac === null) {
      return refuse("TARGET_AC_UNKNOWN", `target "${target.id}" has no AC`, {
        combatantId: target.id,
      });
    }
    const rolled = rollExpression(
      d20Expression(bonus),
      {
        mode,
        critical: false,
        purpose: "attack",
        combatantId: caster.id,
        reason,
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
    const rollIndex = events.length;
    events.push(rolled.event, {
      type: "attack.resolved",
      v: 1,
      reason,
      attackerId: caster.id,
      targetId: target.id,
      rollIndex,
      ac,
      acSource: "record",
      total: rolled.total,
      natural,
      outcome,
      spellId: spell.id,
    });
    events.push(...usedAssists(target.id, applied, reason));
    if (outcome === "miss") return { ok: true, events };
    const refusal = fail(
      damageEvents(
        target,
        components,
        { critical: outcome === "critical-hit", reason },
        events,
        rng,
      ),
    );
    if (refusal) return refusal;
    dealt = "full";
  } else if (d.kind === "save") {
    const dc = spellSaveDc(caster.stats) as number;
    const rolled = rollExpression(
      d20Expression(saveMod),
      {
        mode: foldMode(
          "normal",
          checkModeSources(target, "saving-throw", d.ability),
        ),
        critical: false,
        purpose: "save",
        combatantId: target.id,
        reason,
      },
      rng,
    );
    if (!rolled.ok) return refuse(rolled.code, rolled.message);
    const result = bandOf({
      total: rolled.total,
      dc,
      natural: rolled.event.natural,
      kind: "saving-throw",
      houseRules: command.houseRules ?? {
        outcomeBands: false,
        naturals: false,
      },
    });
    const rollIndex = events.length;
    events.push(rolled.event, {
      type: "check.resolved",
      v: 1,
      reason,
      combatantId: target.id,
      kind: "saving-throw",
      ability: d.ability,
      skill: null,
      rollIndex,
      dc,
      total: rolled.total,
      natural: rolled.event.natural,
      autoFail: null,
      outcome: result.outcome,
      margin: result.margin,
      band: result.band,
      spellId: spell.id,
    });
    dealt =
      result.outcome === "failure"
        ? "full"
        : d.onSuccess === "half"
          ? "half"
          : "none";
    if (dealt !== "none" && components.length > 0) {
      const refusal = fail(
        damageEvents(
          target,
          components,
          { critical: false, half: dealt === "half", reason },
          events,
          rng,
        ),
      );
      if (refusal) return refusal;
    }
  } else if (healExpr) {
    const refusal = fail(
      healingEvents(
        target,
        { kind: "roll", expression: healExpr },
        reason,
        events,
        rng,
      ),
    );
    if (refusal) return refusal;
  }

  if (
    spell.condition &&
    dealt === "full" &&
    !target.conditions.some((i) => i.condition === spell.condition?.key)
  ) {
    // ponytail: outside an encounter there is no turn clock, so the condition is skipped (spec 083
    // OQ-4) and the damage still lands. Add a time-based expiry when the engine tracks durations.
    const expiresAt = nextTurnEnd(state, caster.id);
    if (expiresAt) {
      events.push(
        appliedEvent(target, reason, {
          condition: spell.condition.key,
          level: null,
          source: spell.id,
          expiresAt,
        }),
      );
    }
  }
  return { ok: true, events };
};
