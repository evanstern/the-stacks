import { checkModeSources, checkModifier, foldMode } from "./derive.js";
import { rollExpression } from "./dice.js";
import type { Rng } from "./rng.js";
import type { EngineEvent, EventOf } from "./schema/events.js";
import { type RefusalResult, refuse } from "./schema/refusals.js";
import type { Combatant, EngineState, Skill } from "./schema/state.js";

/** Spec 124 FR-006: conditions that are, or grant, Incapacitated (SRD 5.2.1). */
export const INCAPACITATING_CONDITIONS: readonly string[] = [
  "incapacitated",
  "paralyzed",
  "petrified",
  "stunned",
  "unconscious",
];

type Cause = EventOf<"concentration.changed">["cause"];

/**
 * Spec 124: end the caster's concentration. A `concentration.changed` to null plus a
 * `roll-bonus.ended` for each target still holding that spell's bonus. Empty when the
 * caster is not concentrating.
 */
export function breakConcentrationEvents(
  state: EngineState,
  casterId: string,
  cause: Cause,
  reason: string,
): EngineEvent[] {
  const caster = state.combatants[casterId];
  const conc = caster?.concentration;
  if (!caster || !conc) return [];
  const events: EngineEvent[] = [
    {
      type: "concentration.changed",
      v: 1,
      reason,
      combatantId: casterId,
      before: conc,
      after: null,
      cause,
    },
  ];
  for (const id of conc.targetIds) {
    for (const b of state.combatants[id]?.rollBonuses ?? []) {
      if (b.spellId === conc.spellId && b.casterId === casterId) {
        events.push({
          type: "roll-bonus.ended",
          v: 1,
          reason,
          combatantId: id,
          before: b,
          after: null,
          cause,
        });
      }
    }
  }
  return events;
}

/**
 * Spec 124 FR-005: the Constitution save a concentrating target makes after `damage` HP of
 * damage (already pushed on `events`). At 0 HP concentration ends outright (no save). A failed
 * save ends it. DC is max(10, half the damage), capped at 30; one save per damage instance.
 */
export function concentrationDamageEvents(
  state: EngineState,
  target: Combatant,
  damage: number,
  afterCurrent: number,
  events: EngineEvent[],
  reason: string,
  rng: Rng,
): RefusalResult | null {
  if (!target.concentration || damage <= 0) return null;
  if (afterCurrent === 0) {
    const died = events.some(
      (e) =>
        e.type === "life-state.changed" &&
        e.combatantId === target.id &&
        e.after === "dead",
    );
    events.push(
      ...breakConcentrationEvents(
        state,
        target.id,
        died ? "died" : "incapacitated",
        reason,
      ),
    );
    return null;
  }
  const dc = Math.min(30, Math.max(10, Math.floor(damage / 2)));
  const m = checkModifier(target, "saving-throw", "con", null);
  const mod = m.ok ? m.value : target.conModifier;
  const bonus = bonusDice(target, "saving-throw", null);
  const sign = mod === 0 ? "" : mod > 0 ? `+${mod}` : `${mod}`;
  const rolled = rollExpression(
    ["1d20" + sign, ...bonus].join("+"),
    {
      mode: foldMode("normal", checkModeSources(target, "saving-throw", "con")),
      critical: false,
      purpose: "save",
      combatantId: target.id,
      reason,
    },
    rng,
  );
  if (!rolled.ok) return refuse(rolled.code, rolled.message);
  const success = rolled.total >= dc;
  const rollIndex = events.length;
  events.push(rolled.event, {
    type: "check.resolved",
    v: 1,
    reason,
    combatantId: target.id,
    kind: "saving-throw",
    ability: "con",
    skill: null,
    rollIndex,
    dc,
    total: rolled.total,
    natural: rolled.event.natural,
    autoFail: null,
    outcome: success ? "success" : "failure",
    margin: rolled.total - dc,
    band: success ? "success" : "failure",
  });
  if (!success) {
    events.push(
      ...breakConcentrationEvents(state, target.id, "damage", reason),
    );
  }
  return null;
}

/**
 * Spec 124 FR-007: the bonus dice a combatant adds to a d20 roll of `kind`, one per distinct
 * spell id. An ability check takes only bonuses bound to that skill (or to no skill).
 */
export function bonusDice(
  c: Combatant,
  kind: "attack" | "saving-throw" | "ability-check",
  skill: Skill | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of c.rollBonuses ?? []) {
    if (!b.applies.includes(kind) || seen.has(b.spellId)) continue;
    if (kind === "ability-check" && b.skill !== null && b.skill !== skill) {
      continue;
    }
    seen.add(b.spellId);
    out.push(b.die);
  }
  return out;
}

/** Append bonus dice to a d20 expression (`1d20+5` becomes `1d20+5+1d4`). */
export function withBonusDice(expression: string, dice: string[]): string {
  return [expression, ...dice].join("+");
}
