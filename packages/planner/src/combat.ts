// FR-019–FR-024: attack, cast, help, grapple, shove.
import {
  checkModifier,
  closeCombatSources,
  type EngineCommand,
  findAttack,
  oppositionDc,
  SPELLS,
  spellcastingModifier,
} from "@the-stacks/dnd5e-engine";
import { bandBetween, rangeOf, reachCovers } from "@the-stacks/space";
import { type Roll, rollCommand } from "./checks.js";
import {
  type Ctx,
  commands,
  type Handler,
  type Ref,
  refuse,
  refuseEngine,
  resolveActor,
  resolveTarget,
} from "./refs.js";
import type { PlanFact, PlannedCommand, PlanResult } from "./types.js";

export type AttackEntry = NonNullable<
  ReturnType<typeof findAttack> extends infer R
    ? R extends { ok: true; value: infer V }
      ? V
      : never
    : never
>;

const statUndefined = (id: string, missing: string): PlanResult =>
  refuseEngine("STAT_UNDEFINED", `cannot derive "${missing}" for "${id}"`, {
    combatantId: id,
    missing,
  });

/** The step index the next pushed command will take. */
const nextStep = (list: PlannedCommand[]): number => list.length;

/** One `damage.apply` per hit outcome: normal on `hit`, critical on `critical-hit`. */
export function guardedDamage(
  entry: AttackEntry,
  targetId: string,
  step: number,
  reason: string,
): PlannedCommand[] {
  if (entry.damage.length === 0) return [];
  const make = (critical: boolean): EngineCommand => ({
    type: "damage.apply",
    targetId,
    components: entry.damage.map((d) => ({
      amount: d.amount,
      damageType: d.damageType,
    })),
    critical,
    defenses: null,
    reason,
  });
  return [
    { command: make(false), when: { step, outcomes: ["hit"] } },
    { command: make(true), when: { step, outcomes: ["critical-hit"] } },
  ];
}

/** FR-019: reach and range by band, when both sides are placed. */
function bandUse(
  c: Ctx,
  who: Ref,
  target: Ref,
  entry: AttackEntry,
): { fact: PlanFact | null; refusal: PlanResult | null } {
  const band = bandBetween(c.space, who.combatantId, target.combatantId);
  if (band === null) return { fact: null, refusal: null };
  const melee =
    entry.range === "melee" ||
    (entry.range === "melee-or-ranged" && band === "engaged");
  const details = {
    attackerId: who.combatantId,
    targetId: target.combatantId,
    band,
  };
  if (melee) {
    if (!reachCovers(band, entry.reachFt ?? 5)) {
      return {
        fact: null,
        refusal: refuse(
          "OUT_OF_REACH",
          `"${target.id}" is ${band}, beyond melee reach`,
          details,
        ),
      };
    }
    return { fact: { kind: "reach", band, use: "melee" }, refusal: null };
  }
  if (!entry.rangeFt) {
    return {
      fact: null,
      refusal: statUndefined(who.combatantId, `range of "${entry.name}"`),
    };
  }
  const use = rangeOf(band, entry.rangeFt);
  if (use === "out") {
    return {
      fact: null,
      refusal: refuse(
        "OUT_OF_RANGE",
        `"${target.id}" is ${band}, beyond range`,
        details,
      ),
    };
  }
  return { fact: { kind: "reach", band, use }, refusal: null };
}

// The engine folds the disadvantage itself; the planner only reports it (spec 099). The engine
// verdict reads melee pairs, not zones (spec 101).
const closeCombatFact = (
  c: Ctx,
  attackerId: string,
  ranged: boolean,
): PlanFact[] =>
  closeCombatSources(c.state.engine, attackerId, ranged).length
    ? [
        {
          kind: "rule",
          rule: "playing-the-game.combat.ranged-attacks.ranged-attacks-in-close-combat",
        },
      ]
    : [];

export const attack: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "attack") throw new Error("attack");
  const who = resolveActor(c);
  if (!who.ok) return who.result;
  const t = c.intent.targets[0];
  if (!t) throw new Error("attack needs a target");
  const target = resolveTarget(c, t);
  if (!target.ok) return target.result;
  const weapon =
    i.params.weapon === "unarmed" ? "Unarmed Strike" : i.params.weapon;
  const entry = findAttack(who.value.combatant, weapon);
  if (!entry.ok) return statUndefined(who.value.combatantId, entry.missing);
  const band = bandUse(c, who.value, target.value, entry.value);
  if (band.refusal) return band.refusal;
  const list: PlannedCommand[] = [...target.value.pull];
  const step = nextStep(list);
  list.push({
    command: {
      type: "attack.roll",
      attackerId: who.value.combatantId,
      targetId: target.value.combatantId,
      attack: entry.value.name,
      mode: i.params.mode,
      targetAc: null,
      reason: c.reason,
    },
  });
  list.push(
    ...guardedDamage(entry.value, target.value.combatantId, step, c.reason),
  );
  return commands(list, [
    ...who.value.facts,
    ...target.value.facts,
    ...(band.fact ? [band.fact] : []),
    ...closeCombatFact(
      c,
      who.value.combatantId,
      band.fact?.kind === "reach"
        ? band.fact.use !== "melee"
        : entry.value.range === "ranged",
    ),
  ]);
};

// ponytail: spell range is not checked (OQ-9); the engine spell table has no range.
// Add a band check with TASK-0227 (area spells), when the table carries range.
export const cast: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "cast") throw new Error("cast");
  const who = resolveActor(c);
  if (!who.ok) return who.result;
  const caster = who.value;
  const { spell: spellId } = i.params;
  if (!c.state.srdSpellIds.includes(spellId)) {
    return refuseEngine("SPELL_UNKNOWN", `"${spellId}" is not an SRD spell`, {
      spellId,
    });
  }
  const known = c.state.casters[caster.combatantId];
  if (!known?.spells.includes(spellId)) {
    return refuseEngine(
      "SPELL_NOT_PREPARED",
      `"${caster.id}" has not prepared "${spellId}"`,
      { casterId: caster.combatantId, spellId },
    );
  }
  const mech = SPELLS[spellId];
  const slotLevel =
    i.params.slot ?? (mech && mech.level > 0 ? mech.level : null);
  const badLevel =
    mech &&
    (mech.level === 0
      ? slotLevel !== null
      : slotLevel === null || slotLevel < mech.level);
  const unresolved = (reason: string) =>
    refuseEngine("SPELL_UNRESOLVED", `"${spellId}" cannot be planned`, {
      spellId,
      reason,
    });
  if (!mech) return unresolved("no-mechanics");
  if (badLevel) return unresolved("slot-level");
  const targets = c.intent.targets;
  const only = targets[0];
  if (targets.length > 1 || (only && only.kind !== "actor")) {
    return unresolved("target-shape");
  }
  const target = only ? resolveTarget(c, only) : null;
  if (target && !target.ok) return target.result;
  const aim: Ref = target ? target.value : caster;
  const stats = caster.combatant.stats;
  if (!stats || spellcastingModifier(stats) === null) {
    return statUndefined(caster.combatantId, "spellcasting ability modifier");
  }
  if (mech.delivery.kind === "save") {
    const m = checkModifier(
      aim.combatant,
      "saving-throw",
      mech.delivery.ability,
      null,
    );
    if (!m.ok) return statUndefined(aim.combatantId, m.missing);
  }
  return commands(
    [
      ...(target ? target.value.pull : []),
      {
        command: {
          type: "spell.cast",
          casterId: caster.combatantId,
          spellId,
          targetId: aim.combatantId,
          slotLevel,
          casterLevel: known.level,
          houseRules: { ...c.state.tableRules },
          reason: c.reason,
        },
      },
    ],
    [
      ...caster.facts,
      ...(target ? target.value.facts : []),
      ...closeCombatFact(
        c,
        caster.combatantId,
        mech.delivery.kind === "attack" && mech.delivery.range === "ranged",
      ),
    ],
  );
};

export const help: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "help") throw new Error("help");
  const who = resolveActor(c);
  if (!who.ok) return who.result;
  const t = c.intent.targets[0];
  if (!t) throw new Error("help needs a target");
  const target = resolveTarget(c, t);
  if (!target.ok) return target.result;
  const assist = i.params.assist;
  const facts: PlanFact[] = [
    ...who.value.facts,
    ...target.value.facts,
    { kind: "rule", rule: "rules-glossary.help-action" },
  ];
  let command: EngineCommand;
  if (assist.kind === "attack") {
    const band = bandBetween(
      c.space,
      who.value.combatantId,
      target.value.combatantId,
    );
    if (band !== null && band !== "engaged") {
      return refuse(
        "OUT_OF_REACH",
        `"${target.value.id}" is ${band}, beyond the helper's reach`,
        {
          helperId: who.value.combatantId,
          targetId: target.value.combatantId,
          band,
        },
      );
    }
    command = {
      type: "help.grant",
      helperId: who.value.combatantId,
      assist: { kind: "attack", targetId: target.value.combatantId },
      reason: c.reason,
    };
  } else {
    if (!who.value.combatant.stats) {
      return statUndefined(who.value.combatantId, "stats");
    }
    command = {
      type: "help.grant",
      helperId: who.value.combatantId,
      assist: {
        kind: "ability-check",
        allyId: target.value.combatantId,
        skill: assist.skill,
      },
      reason: c.reason,
    };
  }
  return commands([...target.value.pull, command], facts);
};

/** FR-022: the target's better of a Strength or Dexterity save (Strength on a tie). */
function grappleSave(
  c: Ctx,
  who: Ref,
  target: Ref,
  condition: "grappled" | "prone",
): PlanResult {
  const mods = (["str", "dex"] as const).map((ability) => ({
    ability,
    m: checkModifier(target.combatant, "saving-throw", ability, null),
  }));
  for (const { m } of mods) {
    if (!m.ok) return statUndefined(target.combatantId, m.missing);
  }
  const pick = mods.reduce((best, x) =>
    x.m.ok && best.m.ok && x.m.value > best.m.value ? x : best,
  );
  const rule = "unarmed-strike" as const;
  const dc = oppositionDc(who.combatant, rule);
  if (!dc.ok) return statUndefined(who.combatantId, dc.missing);
  const opposition = { opponentId: who.combatantId, rule };
  const roll: Roll = {
    kind: "saving-throw",
    ability: pick.ability,
    skill: null,
  };
  const list: PlannedCommand[] = [...target.pull];
  const step = nextStep(list);
  list.push({
    command: rollCommand(c, target, roll, "normal", { opposition }),
  });
  list.push({
    command: {
      type: "condition.apply",
      targetId: target.combatantId,
      condition,
      source: `${who.id}: ${c.intent.kind}`,
      expiresAt: null,
      reason: c.reason,
    },
    when: { step, outcomes: ["failure", "severe-failure"] },
  });
  return commands(list, [
    ...who.facts,
    ...target.facts,
    { kind: "rule", rule: "playing-the-game.combat.melee-attacks" },
    { kind: "dc", source: "opposition", opposition },
  ]);
}

export const grapple: Handler = (c) => {
  const who = resolveActor(c);
  if (!who.ok) return who.result;
  const t = c.intent.targets[0];
  if (!t) throw new Error("grapple needs a target");
  const target = resolveTarget(c, t);
  if (!target.ok) return target.result;
  return grappleSave(c, who.value, target.value, "grappled");
};

export const shove: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "shove") throw new Error("shove");
  if (i.params.effect === "push") {
    return refuse("KIND_UNSERVED", "shove with effect push is not served", {
      param: "effect",
      owner: "TASK-0274",
    });
  }
  const who = resolveActor(c);
  if (!who.ok) return who.result;
  const t = c.intent.targets[0];
  if (!t) throw new Error("shove needs a target");
  const target = resolveTarget(c, t);
  if (!target.ok) return target.result;
  return grappleSave(c, who.value, target.value, "prone");
};
