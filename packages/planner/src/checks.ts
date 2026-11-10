// FR-013–FR-018: check, save, contest, search, hide.
import {
  type Ability,
  checkModifier,
  type Difficulty,
  type EngineCommand,
  type OppositionRule,
  oppositionCovers,
  oppositionDc,
  type RollMode,
  SKILL_ABILITY,
  type Skill,
} from "@the-stacks/dnd5e-engine";
import {
  type Ctx,
  commands,
  good,
  type Handler,
  type Ref,
  type Res,
  refuseEngine,
  resolveActor,
  resolveTarget,
} from "./refs.js";
import type { PlanFact, PlanResult, RulingRequest } from "./types.js";

export type Roll = {
  kind: "ability-check" | "saving-throw";
  ability: Ability;
  skill: Skill | null;
};
type Dc = { dc: number } | { difficulty: Difficulty };

// ponytail: the order is fixed (influence, then unarmed-strike); add a rule table entry when
// the engine gains a third opposition rule.
const RULE_ORDER: OppositionRule[] = ["influence", "unarmed-strike"];
const RULE_IDS: Record<OppositionRule, string> = {
  influence: "rules-glossary.influence-action",
  "unarmed-strike": "playing-the-game.combat.melee-attacks",
};

const abilityOf = (p: { ability?: Ability; skill?: Skill }): Ability =>
  p.ability ?? SKILL_ABILITY[p.skill as Skill];

/** FR-018: a modifier the engine cannot derive refuses before any command. */
function checkStat(who: Ref, roll: Roll): PlanResult | null {
  const m = checkModifier(who.combatant, roll.kind, roll.ability, roll.skill);
  return m.ok
    ? null
    : refuseEngine(
        "STAT_UNDEFINED",
        `cannot derive the ${roll.ability} modifier for "${who.combatantId}"`,
        { combatantId: who.combatantId, missing: m.missing },
      );
}

export function rollCommand(
  c: Ctx,
  who: Ref,
  roll: Roll,
  mode: RollMode,
  source: Dc | { opposition: { opponentId: string; rule: OppositionRule } },
): EngineCommand {
  return {
    type: "check.roll",
    combatantId: who.combatantId,
    kind: roll.kind,
    ability: roll.ability,
    skill: roll.skill,
    mode,
    ...source,
    autoFail: null,
    houseRules: { ...c.state.tableRules },
    reason: c.reason,
  };
}

function dcFact(d: Dc): PlanFact {
  return "dc" in d
    ? { kind: "dc", source: "dc", dc: d.dc }
    : { kind: "dc", source: "difficulty", difficulty: d.difficulty };
}

function ask(
  c: Ctx,
  who: Ref,
  roll: Roll,
  mode: RollMode,
  extra: {
    opposition?: RulingRequest["opposition"];
    stakes?: "self" | "other";
    rule?: string | null;
    facts?: PlanFact[];
  } = {},
): PlanResult {
  return {
    kind: "needs_ruling",
    request: {
      requestId: c.askId,
      intent: c.intent,
      ask: "difficulty",
      roll: {
        kind: roll.kind,
        combatantId: who.combatantId,
        ability: roll.ability,
        skill: roll.skill,
        mode,
      },
      opposition: extra.opposition ?? null,
      stakes: extra.stakes ?? "self",
      rule: extra.rule ?? null,
    },
    facts: [...who.facts, ...(extra.facts ?? [])],
  };
}

/** The DC from a ruling, else from an `npc` actor's own field; a player-seat value is ignored. */
function dcSource(
  c: Ctx,
  p: { dc?: number; difficulty?: Difficulty },
): { dc: Dc | null; facts: PlanFact[] } {
  const facts: PlanFact[] = [];
  const own: Dc | null =
    p.dc !== undefined
      ? { dc: p.dc }
      : p.difficulty !== undefined
        ? { difficulty: p.difficulty }
        : null;
  let dc: Dc | null = null;
  if (own && c.intent.actor.kind === "npc") dc = own;
  else if (own) {
    facts.push({
      kind: "ignored",
      field: "dc" in own ? "dc" : "difficulty",
      why: "player-seat",
    });
  }
  const a = c.answer;
  if (a?.dc !== undefined) dc = { dc: a.dc };
  else if (a?.difficulty !== undefined) dc = { difficulty: a.difficulty };
  return { dc, facts };
}

function actorTarget(c: Ctx): Res<Ref | null> {
  const t = c.intent.targets.find((x) => x.kind === "actor");
  if (!t) return good(null);
  return resolveTarget(c, t);
}

/** `check` and `save`: a DC from an npc or a ruling, else a ruling request (FR-013, FR-014). */
export const checkKind: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "check" && i.kind !== "save") throw new Error("checkKind");
  const who = resolveActor(c);
  if (!who.ok) return who.result;
  const target = actorTarget(c);
  if (!target.ok) return target.result;
  const roll: Roll =
    i.kind === "save"
      ? { kind: "saving-throw", ability: i.params.ability, skill: null }
      : {
          kind: "ability-check",
          ability: abilityOf(i.params),
          skill: i.params.skill ?? null,
        };
  const bad = checkStat(who.value, roll);
  if (bad) return bad;
  const { dc, facts } = dcSource(c, i.params);
  const pulled = [...who.value.facts, ...(target.value?.facts ?? [])];
  if (!dc) {
    return ask(c, who.value, roll, i.params.mode, {
      stakes: target.value ? "other" : "self",
      facts: [...(target.value?.facts ?? []), ...facts],
    });
  }
  return commands(
    [
      ...(target.value?.pull ?? []),
      rollCommand(c, who.value, roll, i.params.mode, dc),
    ],
    [...pulled, ...facts, dcFact(dc)],
  );
};

/** `contest`: an engine opposition rule gives the DC; none covering asks for a ruling (FR-015). */
export const contest: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "contest") throw new Error("contest");
  const who = resolveActor(c);
  if (!who.ok) return who.result;
  const t = c.intent.targets[0];
  if (!t) throw new Error("contest needs a target");
  const opp = resolveTarget(c, t);
  if (!opp.ok) return opp.result;
  const roll: Roll = {
    kind: "ability-check",
    ability: abilityOf(i.params),
    skill: i.params.skill ?? null,
  };
  const bad = checkStat(who.value, roll);
  if (bad) return bad;
  const rules = RULE_ORDER.filter((r) =>
    oppositionCovers(r, roll.kind, roll.ability, roll.skill),
  );
  const facts = [...who.value.facts, ...opp.value.facts];
  const rule = rules[0];
  if (rule) {
    const d = oppositionDc(opp.value.combatant, rule);
    if (!d.ok) {
      return refuseEngine(
        "STAT_UNDEFINED",
        `cannot derive the ${rule} DC for "${opp.value.combatantId}"`,
        { combatantId: opp.value.combatantId, missing: d.missing },
      );
    }
    const opposition = { opponentId: opp.value.combatantId, rule };
    return commands(
      [
        ...opp.value.pull,
        rollCommand(c, who.value, roll, i.params.mode, { opposition }),
      ],
      [
        ...facts,
        { kind: "rule", rule: RULE_IDS[rule] },
        { kind: "dc", source: "opposition", opposition },
      ],
    );
  }
  const { dc } = dcSource(c, {});
  if (dc) {
    return commands(
      [...opp.value.pull, rollCommand(c, who.value, roll, i.params.mode, dc)],
      [...facts, dcFact(dc)],
    );
  }
  return ask(c, who.value, roll, i.params.mode, {
    opposition: { opponentId: opp.value.combatantId, rules: [] },
    stakes: "other",
    facts: opp.value.facts,
  });
};

/** `search`: Wisdom (Perception) or Intelligence (Investigation); the DC is a ruling (FR-016). */
export const search: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "search") throw new Error("search");
  const who = resolveActor(c);
  if (!who.ok) return who.result;
  const skill = i.params.skill;
  const roll: Roll = {
    kind: "ability-check",
    ability: SKILL_ABILITY[skill],
    skill,
  };
  const bad = checkStat(who.value, roll);
  if (bad) return bad;
  const { dc } = dcSource(c, {});
  const rule = "rules-glossary.search-action";
  if (dc) {
    return commands(
      [rollCommand(c, who.value, roll, "normal", dc)],
      [...who.value.facts, { kind: "rule", rule }, dcFact(dc)],
    );
  }
  return ask(c, who.value, roll, "normal", { rule });
};

/** `hide`: Dexterity (Stealth) at difficulty medium; hidden state is not tracked (FR-017). */
export const hide: Handler = (c) => {
  const who = resolveActor(c);
  if (!who.ok) return who.result;
  const roll: Roll = {
    kind: "ability-check",
    ability: "dex",
    skill: "stealth",
  };
  const bad = checkStat(who.value, roll);
  if (bad) return bad;
  const dc: Dc = { difficulty: "medium" };
  return commands(
    [rollCommand(c, who.value, roll, "normal", dc)],
    [
      ...who.value.facts,
      { kind: "rule", rule: "playing-the-game.exploration.hiding" },
      dcFact(dc),
      { kind: "unserved", part: "hidden-state", owner: "TASK-0271" },
    ],
  );
};
