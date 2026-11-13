import {
  type Combatant,
  checkModifier,
  findAttack,
  oppositionDc,
  type RefusalCode,
  type Skill,
  SPELLS,
  spellcastingModifier,
} from "@the-stacks/dnd5e-engine";
import {
  REASON_TO_PRESENCE,
  type SessionProjections,
} from "@the-stacks/session-model";
import type { BeatItem } from "../nodes/assemble.js";
import type { DirectorNodeOutput } from "../nodes/director.js";
import {
  type AnyInterpretReading,
  type Effect,
  hasStages,
  type InterpretStage,
  type LegacyInterpretReading,
  type Step,
} from "../nodes/schemas.js";
import type { SceneSeed } from "../seed/schema.js";
import type { ActorSnapshot } from "../snapshot/index.js";

/**
 * The plan gate (specs/046-downed-hero-gate plan D3, decision-0025 §3.2).
 * Pure: it checks every actor and target id a plan names against the S0
 * actors' `combatantId`s, before any step of the group runs. It never maps an
 * alias: an alias only tells the verdict which reason to give.
 */

export type PlanFailureReason =
  | "not-a-combatant"
  | "not-in-snapshot"
  | "absent"
  | "not-the-actor"
  | "stat-undefined"
  | "spell-unknown"
  | "spell-not-prepared"
  | "spell-unresolved"
  | "off-turn";

export interface PlanFailure {
  stepIndex: number;
  /** The step field that named the id, e.g. `targetId` or `onHit[0].targetId`. */
  field: string;
  id: string;
  reason: PlanFailureReason;
}

/**
 * The refusal code of a group whose step names a foreign actor (spec 079, OQ-4).
 * Spec 077's `askUndeclared` clarifies another human's PC only; no refusal code
 * covers a non-party attacker, so this is new. Plan-gate only.
 */
export const ACTOR_REFUSAL_CODE =
  "STEP_ACTOR_MISMATCH" as const satisfies RefusalCode;

/**
 * The plan-gate literal of a party group held for an off-turn AI companion
 * (TASK-0244). Not a `RefusalCode`; it never reaches an event.
 */
export const TURN_HELD_CODE = "TURN_HELD" as const;

/**
 * The refusal code of a group whose step the stats cannot derive (spec 082 D8):
 * no stats, a missing ability modifier or an unknown attack name. An engine code.
 */
export const STAT_REFUSAL_CODE =
  "STAT_UNDEFINED" as const satisfies RefusalCode;

/**
 * The refusal codes of a group whose spell step the table or the seed cannot
 * resolve (spec 083 D6). `SPELL_UNKNOWN` and `SPELL_NOT_PREPARED` are plan-gate
 * only; `SPELL_UNRESOLVED` is also an engine code.
 */
export type SpellRefusalCode = Extract<
  RefusalCode,
  "SPELL_UNRESOLVED" | "SPELL_UNKNOWN" | "SPELL_NOT_PREPARED"
>;

export type PlanVerdict =
  | { actionId: string | null; ok: true; pull?: string[] }
  | {
      actionId: string | null;
      ok: false;
      code: "UNKNOWN_COMBATANT";
      failure: PlanFailure;
    }
  | {
      actionId: string | null;
      ok: false;
      code: typeof ACTOR_REFUSAL_CODE;
      failure: PlanFailure;
    }
  | {
      actionId: string | null;
      ok: false;
      code: typeof STAT_REFUSAL_CODE | SpellRefusalCode;
      failure: PlanFailure;
    }
  | {
      actionId: string | null;
      ok: false;
      code: typeof TURN_HELD_CODE;
      /** The off-turn companion's combatant id. */
      heldFor: string;
    };

export interface PlanInput {
  /** S0. */
  snapshot: ActorSnapshot;
  readings: readonly AnyInterpretReading[];
  /** The combatant ids this turn's Director opening moves add. */
  joining: readonly string[];
  /** Seed NPC ids the encounter start marks `arrived` (spec 058) and the Director's legal arrivals (spec 078). An arriving id is not absent. */
  arriving: readonly string[];
  /** Action ids with a resumed plan (spec 057): they skip the reason check. */
  resumed: readonly string[];
  /**
   * Action id -> the acting character's combatant id, `null` for a party-scope
   * action. An action id absent from the map (a character with no combatant)
   * is not actor-checked (spec 079 D5).
   */
  actors?: ReadonlyMap<string, string | null>;
  /**
   * Spec 104 FR-012: action id -> the declarer's combatant id, for an Intent reading. The turn
   * hold names it where a step reading names its steps' actors.
   */
  declarers?: ReadonlyMap<string, string>;
  /** The engine combatants (spec 082 D8). A joining or absent id is not stat-checked. */
  combatants: Readonly<Record<string, Combatant>>;
  /** Spec 083 D6: combatant id -> the seed character's spell ids. A caster with no entry has no list. */
  spellLists?: ReadonlyMap<string, readonly string[]>;
  /** Spec 083 D6: the SRD spell record's level, or undefined when there is none. */
  srdSpell?: (id: string) => { level: number } | undefined;
}

type EncounterSeed = SceneSeed["encounters"][number];

/**
 * The seed encounter the Director opening starts: a `turn` decision on a job
 * that is not a scene start. One definition, shared by `directorOpening` and
 * the plan gate.
 */
export function encounterToStart(
  seed: SceneSeed,
  director: Pick<DirectorNodeOutput, "tableMode">,
  trigger: string,
): EncounterSeed | undefined {
  if (trigger === "scene-start") return undefined;
  const tm = director.tableMode;
  if (tm.to !== "turn") return undefined;
  return seed.encounters.find((e) => e.id === tm.encounterId);
}

/** The ids an encounter start adds to the engine: its monsters not yet there. */
export function joiningCombatants(
  enc: EncounterSeed | undefined,
  existing: Readonly<Record<string, unknown>>,
  projections?: SessionProjections,
): string[] {
  if (!enc) return [];
  // Spec 099 FR-018: a resume adds nobody.
  if (projections && encounterPhase(projections, enc) === "ended") return [];
  return enc.monsters
    .map((m) => m.combatantId)
    .filter((id) => !(id in existing));
}

/**
 * An encounter has run when it is active (an order holds one of its monsters)
 * or a logged `encounter.started` row's order held one (spec 088 D1). A monster
 * added alone, before the start, does not make it run.
 */
export function encounterRan(
  projections: SessionProjections,
  enc: EncounterSeed,
): boolean {
  const ids = new Set(enc.monsters.map((m) => m.combatantId));
  const orderHolds = (order: unknown): boolean =>
    Array.isArray(order) &&
    order.some((o) =>
      ids.has((o as { combatantId?: string } | null)?.combatantId ?? ""),
    );
  if (projections.encounter && orderHolds(projections.encounter.order)) {
    return true;
  }
  return projections.ledger.some(
    (r) =>
      r.kind === "change" &&
      r.type === "encounter.started" &&
      orderHolds((r.after as { order?: unknown } | null)?.order),
  );
}

export type EncounterPhase = "pending" | "active" | "ended";

/** Spec 099 FR-014: derived per seed encounter; never stored. */
export function encounterPhase(
  projections: SessionProjections,
  enc: EncounterSeed,
): EncounterPhase {
  const ids = new Set(enc.monsters.map((m) => m.combatantId));
  if (projections.encounter?.order.some((o) => ids.has(o.combatantId))) {
    return "active";
  }
  return encounterRan(projections, enc) ? "ended" : "pending";
}

/**
 * Spec 099 FR-016: the encounter's monsters that may enter a start or resume.
 * A combatant, not dead, logged present (or never logged), side hostile or none.
 */
export function eligibleMonsters(
  projections: SessionProjections,
  enc: EncounterSeed,
): string[] {
  return enc.monsters
    .map((m) => m.combatantId)
    .filter((id) => {
      const c = projections.engine.combatants[id];
      if (!c || c.lifeState === "dead") return false;
      if (
        (projections.scenePresence[id]?.presence ?? "present") !== "present"
      ) {
        return false;
      }
      return c.side === undefined || c.side === "hostile";
    });
}

/** Spec 099 FR-015: encounters the Director may start: every pending one, and each ended one with an eligible monster. */
export function startableEncounterIds(
  projections: SessionProjections,
  seed: SceneSeed,
): string[] {
  return seed.encounters
    .filter((e) => {
      const phase = encounterPhase(projections, e);
      return (
        phase === "pending" ||
        (phase === "ended" && eligibleMonsters(projections, e).length > 0)
      );
    })
    .map((e) => e.id);
}

/**
 * Spec 099 FR-021: monsters of the active seed encounter that are not combatants
 * and not seed NPCs. A turn-mode arrival of one joins the order.
 */
export function joinableMonsters(
  projections: SessionProjections,
  seed: SceneSeed,
): { id: string; name: string; encounterId: string }[] {
  const npcIds = new Set(seed.npcs.map((n) => n.id));
  const out: { id: string; name: string; encounterId: string }[] = [];
  for (const e of seed.encounters) {
    if (encounterPhase(projections, e) !== "active") continue;
    for (const m of e.monsters) {
      if (projections.engine.combatants[m.combatantId]) continue;
      if (npcIds.has(m.combatantId)) continue;
      out.push({
        id: m.combatantId,
        name: m.name ?? m.srdMonsterId,
        encounterId: e.id,
      });
    }
  }
  return out;
}

/** Spec 088 D1: encounter monsters of an unrun encounter that are not combatants yet, in seed order. */
export function unseenMonsters(
  projections: SessionProjections,
  seed: SceneSeed,
): { id: string; name: string; encounterId: string }[] {
  const npcIds = new Set(seed.npcs.map((n) => n.id));
  const out: { id: string; name: string; encounterId: string }[] = [];
  for (const e of seed.encounters) {
    if (encounterRan(projections, e)) continue;
    for (const m of e.monsters) {
      if (projections.engine.combatants[m.combatantId]) continue;
      if (npcIds.has(m.combatantId)) continue;
      out.push({
        id: m.combatantId,
        name: m.name ?? m.srdMonsterId,
        encounterId: e.id,
      });
    }
  }
  return out;
}

/**
 * Spec 088 D1: every monster id arriving this beat: the Director's monster
 * arrivals, then the encounter start's joiners, once each, with seed names.
 */
export function arrivingMonsters(
  seed: SceneSeed,
  projections: SessionProjections,
  director: Pick<DirectorNodeOutput, "tableMode" | "arrivals">,
  trigger: string,
): { id: string; name: string }[] {
  const all = new Map(
    seed.encounters.flatMap((e) =>
      e.monsters.map((m) => [m.combatantId, m.name ?? m.srdMonsterId] as const),
    ),
  );
  const ids = [
    // A seed NPC that is also an encounter monster arrives by the 078 path.
    ...(director.arrivals ?? []).filter(
      (id) => all.has(id) && !seed.npcs.some((n) => n.id === id),
    ),
    ...joiningCombatants(
      encounterToStart(seed, director, trigger),
      projections.engine.combatants,
      projections,
    ),
  ];
  return [...new Set(ids)].map((id) => ({ id, name: all.get(id) as string }));
}

/**
 * The seed NPC ids an encounter start marks `arrived`: the encounter beat
 * declares them `present` and the logged presence is not `present`. Mirrors
 * the encounter-start branch of `seedPresence` (nodes/resolve.ts).
 */
export function arrivingNpcs(
  seed: SceneSeed,
  enc: EncounterSeed | undefined,
  scenePresence: SessionProjections["scenePresence"],
  projections?: SessionProjections,
): string[] {
  if (!enc) return [];
  // Spec 099 FR-018: a resume runs no encounter-start presence group.
  if (projections && encounterPhase(projections, enc) === "ended") return [];
  const beat = seed.beats.find((b) => b.encounterId === enc.id);
  if (!beat) return [];
  const out: string[] = [];
  for (const npc of seed.npcs) {
    if (beat.presence[npc.id] !== "present") continue;
    const logged = scenePresence[npc.id]?.presence ?? "present";
    if (logged !== REASON_TO_PRESENCE.arrived) out.push(npc.id);
  }
  return out;
}

interface NamedId {
  field: string;
  id: string;
  /** Set on a presence effect's target: the effect's reason. */
  presenceReason?: string;
}

function effectIds(effects: readonly Effect[], list: string): NamedId[] {
  return effects.map((e, j) => {
    return {
      field: `${list}[${j}].targetId`,
      id: e.targetId,
      ...(e.effect === "presence" ? { presenceReason: e.reason } : {}),
    };
  });
}

/** Every id a step names, in the order the step runs them. */
function stepIds(step: Step): NamedId[] {
  switch (step.step) {
    case "none":
    case "roll":
      return [];
    case "move":
      return [
        { field: "combatantId", id: step.combatantId },
        ...step.leavesReachOf.map((id, i) => ({
          field: `leavesReachOf[${i}]`,
          id,
        })),
      ];
    case "effect":
      return effectIds(step.effects, "effects");
    case "check":
      return [
        ...(step.combatantId
          ? [{ field: "combatantId", id: step.combatantId }]
          : []),
        ...(typeof step.difficulty !== "string"
          ? [{ field: "difficulty.opposedBy", id: step.difficulty.opposedBy }]
          : []),
        ...effectIds(step.onSuccess, "onSuccess"),
        ...effectIds(step.onFailure, "onFailure"),
        ...effectIds(step.onCost, "onCost"),
        ...effectIds(step.onSevere, "onSevere"),
      ];
    case "attack":
      return [
        { field: "attackerId", id: step.attackerId },
        { field: "targetId", id: step.targetId },
        ...effectIds(step.onHit, "onHit"),
      ];
    case "spell":
      return [
        { field: "casterId", id: step.casterId },
        { field: "targetId", id: step.targetId },
      ];
    case "help":
      return [
        { field: "helperId", id: step.helperId },
        step.assist.kind === "ability-check"
          ? { field: "assist.allyId", id: step.assist.allyId }
          : { field: "assist.targetId", id: step.assist.targetId },
      ];
  }
}

/** The first `attack` attacker, `spell` caster or `move` mover that is not the action's actor. */
function foreignActor(
  steps: readonly Step[],
  actor: string | null,
  party: ReadonlySet<string>,
): PlanFailure | null {
  for (const [stepIndex, step] of steps.entries()) {
    const named =
      step.step === "attack"
        ? { field: "attackerId", id: step.attackerId }
        : step.step === "spell"
          ? { field: "casterId", id: step.casterId }
          : step.step === "help"
            ? { field: "helperId", id: step.helperId }
            : step.step === "move"
              ? { field: "combatantId", id: step.combatantId }
              : null;
    if (!named) continue;
    if (actor === null ? !party.has(named.id) : named.id !== actor) {
      return { stepIndex, ...named, reason: "not-the-actor" };
    }
  }
  return null;
}

/**
 * Spec 104: the combatant ids an Intent group's stages act for. Every stage of an item shares the
 * declarer (the actor comes from the beat item, FR-005), so the list holds at most one id.
 */
export function stageActors(
  stages: readonly InterpretStage[],
  party: readonly { characterId: string; combatantId: string | null }[],
  item: { characterId: string | null },
): string[] {
  const id = party.find((m) => m.characterId === item.characterId)?.combatantId;
  return stages.length > 0 && id ? [id] : [];
}

/** The distinct actor ids a plan's steps name, in step order (TASK-0244). */
export function stepActors(steps: readonly Step[]): string[] {
  const out: string[] = [];
  for (const step of steps) {
    const id =
      step.step === "attack"
        ? step.attackerId
        : step.step === "spell"
          ? step.casterId
          : step.step === "help"
            ? step.helperId
            : step.step === "move"
              ? step.combatantId
              : null;
    if (id !== null && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * TASK-0244: in turn mode a party group naming an off-turn AI companion is
 * held (the companion is the only actor) or refused (mixed actors).
 * ponytail: only AI companions are held (OQ-2); a human PC named off turn
 * still acts. Extend the off-turn set to human party members when a playtest
 * shows it.
 */
function heldFor(
  steps: readonly Step[],
  snapshot: ActorSnapshot,
  ownActors: ReadonlySet<string>,
  named: readonly string[] = stepActors(steps),
): { held: string } | { offTurn: PlanFailure } | null {
  const enc = snapshot.stage.encounter;
  if (snapshot.stage.tableMode.mode !== "turn" || !enc) return null;
  const order = new Set(enc.order);
  const offTurn = new Set<string>();
  for (const a of snapshot.actors) {
    const id = a.combatantId;
    if (
      a.kind === "party" &&
      a.controller.kind === "ai-companion" &&
      a.lifeState === "conscious" &&
      id &&
      (order.has(a.id) || order.has(id)) &&
      (id !== enc.activeCombatantId || ownActors.has(id))
    ) {
      offTurn.add(id);
    }
  }
  if (!named.some((id) => offTurn.has(id))) return null;
  const only = named[0];
  if (named.length === 1 && only !== undefined) return { held: only };
  const stepIndex = Math.max(
    0,
    steps.findIndex((s) => stepActors([s]).some((id) => offTurn.has(id))),
  );
  const id = named.find((n) => offTurn.has(n)) ?? "";
  return {
    offTurn: { stepIndex, field: "actor", id, reason: "off-turn" },
  };
}

/** Spec 082 D8: the first check or attack whose number the stats cannot derive. */
function statGap(
  steps: readonly Step[],
  combatants: Readonly<Record<string, Combatant>>,
  joining: readonly string[],
): PlanFailure | null {
  for (const [stepIndex, step] of steps.entries()) {
    if (step.step === "check" && typeof step.difficulty !== "string") {
      // Spec 084 D12: the opponent's stats must give the DC. A joining opponent is skipped.
      const { opposedBy, rule } = step.difficulty;
      const opp = combatants[opposedBy];
      if (opp && !joining.includes(opposedBy)) {
        const d = oppositionDc(opp, rule);
        if (!d.ok) {
          return {
            stepIndex,
            field: "difficulty.opposedBy",
            id: `${opposedBy}: ${d.missing}`,
            reason: "stat-undefined",
          };
        }
      }
    }
    if (step.step === "help" && step.assist.kind === "ability-check") {
      const helper = combatants[step.helperId];
      if (helper && !joining.includes(step.helperId) && !helper.stats) {
        return {
          stepIndex,
          field: "helperId",
          id: `${step.helperId}: stats`,
          reason: "stat-undefined",
        };
      }
    }
    if (step.step === "check" && step.combatantId) {
      const c = combatants[step.combatantId];
      if (!c || joining.includes(step.combatantId)) continue;
      const d = checkModifier(c, step.kind, step.ability, step.skill);
      if (!d.ok) {
        return {
          stepIndex,
          field: step.skill ? "skill" : "ability",
          id: `${step.combatantId}: ${d.missing}`,
          reason: "stat-undefined",
        };
      }
    } else if (step.step === "attack") {
      const c = combatants[step.attackerId];
      if (!c || joining.includes(step.attackerId)) continue;
      const d = findAttack(c, step.attack);
      if (!d.ok) {
        return {
          stepIndex,
          field: "attack",
          id: `${step.attackerId}: ${d.missing}`,
          reason: "stat-undefined",
        };
      }
    }
  }
  return null;
}

export type SpellGap = {
  code: SpellRefusalCode | typeof STAT_REFUSAL_CODE;
  failure: PlanFailure;
};

/**
 * Spec 083 D6: the first spell step the SRD, the seed list, the engine table or
 * the stats cannot resolve; and a non-clarify `spell` reading with no spell step.
 */
function spellGap(
  steps: readonly Step[],
  intent: LegacyInterpretReading["intent"] | null,
  input: PlanInput,
): SpellGap | null {
  const fail = (
    code: SpellGap["code"],
    stepIndex: number,
    field: string,
    id: string,
    reason: PlanFailureReason,
  ): SpellGap => ({ code, failure: { stepIndex, field, id, reason } });
  for (const [stepIndex, step] of steps.entries()) {
    if (step.step !== "spell") continue;
    const { casterId, spellId, slotLevel, targetId } = step;
    const srd = input.srdSpell?.(spellId);
    if (!srd) {
      return fail(
        "SPELL_UNKNOWN",
        stepIndex,
        "spellId",
        spellId,
        "spell-unknown",
      );
    }
    if (input.joining.includes(casterId)) continue;
    const list = input.spellLists?.get(casterId);
    if (!list?.includes(spellId)) {
      return fail(
        "SPELL_NOT_PREPARED",
        stepIndex,
        "spellId",
        `${casterId}: ${spellId}`,
        "spell-not-prepared",
      );
    }
    const mech = SPELLS[spellId];
    const badLevel =
      srd.level === 0
        ? slotLevel !== null
        : slotLevel === null || slotLevel < srd.level;
    if (!mech || badLevel) {
      return fail(
        "SPELL_UNRESOLVED",
        stepIndex,
        mech ? "slotLevel" : "spellId",
        spellId,
        "spell-unresolved",
      );
    }
    const caster = input.combatants[casterId];
    if (!caster?.stats || spellcastingModifier(caster.stats) === null) {
      return fail(
        "STAT_UNDEFINED",
        stepIndex,
        "casterId",
        `${casterId}: spellcasting ability`,
        "stat-undefined",
      );
    }
    const target = input.combatants[targetId];
    if (
      mech.delivery.kind === "save" &&
      target &&
      !input.joining.includes(targetId)
    ) {
      const d = checkModifier(
        target,
        "saving-throw",
        mech.delivery.ability,
        null,
      );
      if (!d.ok) {
        return fail(
          "STAT_UNDEFINED",
          stepIndex,
          "targetId",
          `${targetId}: ${d.missing}`,
          "stat-undefined",
        );
      }
    }
  }
  if (intent === "spell" && !steps.some((s) => s.step === "spell")) {
    return fail("SPELL_UNRESOLVED", 0, "intent", "spell", "spell-unresolved");
  }
  return null;
}

export function checkPlan(input: PlanInput): PlanVerdict[] {
  const { snapshot } = input;
  const valid = new Set<string>(input.joining);
  const noCombatant = new Set<string>();
  // Specs 068 and 075: exact ids of S0 npc actors with no combatant (never aliases).
  // Any non-presence field may name one, attacks and damage included.
  const npcIds = new Set<string>();
  const inOrder = new Set<string>(snapshot.stage.encounter?.order ?? []);
  const actorIds = new Set<string>(input.joining);
  const absentIds = new Set<string>();
  const arrivingIds = new Set<string>(input.arriving);
  for (const a of snapshot.actors) {
    actorIds.add(a.id);
    if (a.presence === "absent" && !arrivingIds.has(a.id)) {
      absentIds.add(a.id);
      if (a.combatantId) absentIds.add(a.combatantId);
    }
    if (a.combatantId) valid.add(a.combatantId);
    else {
      noCombatant.add(a.id);
      if (a.kind === "npc") npcIds.add(a.id);
      for (const alias of a.aliases) noCombatant.add(alias);
    }
  }

  const partyCombatants = new Set<string>(
    snapshot.actors.flatMap((a) =>
      a.kind === "party" && a.combatantId ? [a.combatantId] : [],
    ),
  );

  const groups = new Map<string | null, readonly Step[]>();
  /** The intent of a non-clarify reading, for the spell-intent rule (spec 083 D6). */
  const intents = new Map<string | null, LegacyInterpretReading["intent"]>();
  /** Spec 104: Intent readings carry no step; the planner and gate own their legality. */
  const staged = new Set<string | null>();
  for (const r of input.readings) {
    if (hasStages(r)) {
      groups.set(r.actionId, []);
      if (r.clarify === null && r.stages.length > 0) staged.add(r.actionId);
      continue;
    }
    // A clarify reading runs no step: nothing to gate.
    groups.set(r.actionId, r.clarify !== null ? [] : r.steps);
    if (r.clarify === null) intents.set(r.actionId, r.intent);
  }

  const verdicts: PlanVerdict[] = [];
  for (const [actionId, steps] of groups) {
    let failure: PlanFailure | null = null;
    const pull = new Set<string>();
    // Spec 079 D5: no foreign actor in a party action. The monster turn is not checked.
    const actorFailure =
      actionId !== null && input.actors?.has(actionId)
        ? foreignActor(
            steps,
            input.actors.get(actionId) ?? null,
            partyCombatants,
          )
        : null;
    if (actorFailure) {
      verdicts.push({
        actionId,
        ok: false,
        code: ACTOR_REFUSAL_CODE,
        failure: actorFailure,
      });
      continue;
    }
    // TASK-0244: a party group naming an off-turn AI companion waits or is refused.
    if (actionId !== null && input.actors?.get(actionId) === null) {
      const own = new Set<string>();
      for (const k of groups.keys()) {
        const o = k === null ? null : input.actors.get(k);
        if (o) own.add(o);
      }
      const declarer = input.declarers?.get(actionId);
      const h = heldFor(
        steps,
        snapshot,
        own,
        staged.has(actionId) && declarer ? [declarer] : stepActors(steps),
      );
      if (h && "held" in h) {
        verdicts.push({
          actionId,
          ok: false,
          code: TURN_HELD_CODE,
          heldFor: h.held,
        });
        continue;
      }
      if (h) {
        verdicts.push({
          actionId,
          ok: false,
          code: ACTOR_REFUSAL_CODE,
          failure: h.offTurn,
        });
        continue;
      }
    }
    for (const [stepIndex, step] of steps.entries()) {
      for (const { field, id, presenceReason } of stepIds(step)) {
        if (presenceReason !== undefined) {
          // A presence effect targets any S0 actor, combatant or not.
          const reason: PlanFailureReason | null = !actorIds.has(id)
            ? "not-in-snapshot"
            : absentIds.has(id) && presenceReason !== "arrived"
              ? "absent"
              : null;
          if (reason === null) continue;
          failure = { stepIndex, field, id, reason };
          break;
        }
        if (!valid.has(id) && !npcIds.has(id)) {
          failure = {
            stepIndex,
            field,
            id,
            reason: noCombatant.has(id) ? "not-a-combatant" : "not-in-snapshot",
          };
          break;
        }
        if (absentIds.has(id)) {
          failure = { stepIndex, field, id, reason: "absent" };
          break;
        }
        // Specs 068, 075: a named actor outside the order is pulled in. Free mode
        // pulls only an actor with no combatant (nothing else to do).
        const actor = snapshot.actors.find(
          (a) =>
            a.combatantId === id || (a.combatantId === null && a.id === id),
        );
        if (
          actor &&
          !inOrder.has(actor.id) &&
          !inOrder.has(id) &&
          !input.joining.includes(id) &&
          (snapshot.stage.encounter || actor.combatantId === null)
        ) {
          pull.add(id);
        }
      }
      if (failure) break;
    }
    if (failure) {
      verdicts.push({
        actionId,
        ok: false,
        code: "UNKNOWN_COMBATANT",
        failure,
      });
      continue;
    }
    // Spec 082 D8: the stats must derive every named modifier and attack.
    const gap = statGap(steps, input.combatants, input.joining);
    if (gap) {
      verdicts.push({
        actionId,
        ok: false,
        code: STAT_REFUSAL_CODE,
        failure: gap,
      });
      continue;
    }
    // Spec 083 D6: a spell step must resolve; a spell reading needs a spell step.
    const sGap = spellGap(steps, intents.get(actionId) ?? null, input);
    if (sGap) {
      verdicts.push({
        actionId,
        ok: false,
        code: sGap.code,
        failure: sGap.failure,
      });
      continue;
    }
    verdicts.push(
      pull.size > 0
        ? { actionId, ok: true, pull: [...pull] }
        : { actionId, ok: true },
    );
  }
  return verdicts;
}

/**
 * Skills that name how a character presents itself (spec 077 OQ-3 (a)).
 * ponytail: cues are lexical. Ceiling: negation ("I don't sneak") matches and
 * synonyms outside the list miss. Upgrade: an interpret-written `method` field
 * the gate compares, if the playtest shows misses.
 */
export const MANNER_SKILLS = [
  {
    skill: "stealth",
    cues: /\b(sneak\w*|snuck|stealth\w*|hid|hide|hides|hiding|hidden|quiet\w*|silent\w*|unseen|unnoticed|undetected|creep\w*|crept|skulk\w*|tiptoe\w*|slink\w*|stalk\w*)\b/i,
    question: "Are you trying to stay unseen, or moving openly?",
  },
  {
    skill: "deception",
    cues: /\b(lie|lies|lying|lied|bluff\w*|deceiv\w*|trick\w*|pretend\w*|feign\w*|disguis\w*|mislead\w*|fake\w*|pose as|posing as)\b/i,
    question: "Are you being honest with them, or trying to mislead them?",
  },
  {
    skill: "intimidation",
    cues: /\b(intimidat\w*|threat\w*|menac\w*|scare\w*|frighten\w*|cow|bully\w*|glower\w*|loom\w*|snarl\w*)\b/i,
    question: "Are you trying to frighten them, or asking plainly?",
  },
] as const satisfies readonly {
  skill: Skill;
  cues: RegExp;
  question: string;
}[];

export const otherPlayerQuestion = (name: string, declarer: string) =>
  `${name}'s player decides what ${name} does. What does ${declarer} do instead?`;

export interface Asked {
  actionId: string;
  stepIndex: number;
  rule: "manner" | "other-player";
  /** The manner skill, or the other PC's name. */
  detail: string;
}

/**
 * Spec 077: a manner skill the declaration does not state, or a roll for
 * another human's PC, becomes a clarify. Pure; the runner applies it after the
 * free-mode cut and before `clarifyHolds`.
 */
export function askUndeclared(input: {
  snapshot: ActorSnapshot;
  beat: readonly BeatItem[];
  readings: readonly AnyInterpretReading[];
  resumed: readonly string[];
}): { readings: AnyInterpretReading[]; asked: Asked[] } {
  const { snapshot, beat } = input;
  const resumed = new Set(input.resumed);
  const asked: Asked[] = [];
  const questions = new Map<string, string>();
  for (const item of beat) {
    if (item.status !== "committed" || resumed.has(item.actionId)) continue;
    const reading = input.readings.find((r) => r.actionId === item.actionId);
    if (!reading || reading.clarify !== null) continue;
    if (hasStages(reading)) {
      // Spec 104 FR-011: the manner rule holds for Intent stages. The other-player rule cannot
      // fire: the actor of a stage is the declarer, stamped by code.
      for (const [stepIndex, st] of reading.stages.entries()) {
        const { kind, params } = st.intent;
        const skill = (params as { skill?: string }).skill;
        if (kind !== "check" || item.actor.startsWith("ai:")) continue;
        const row = MANNER_SKILLS.find((m) => m.skill === skill);
        if (row && !row.cues.test(item.text)) {
          questions.set(item.actionId, row.question);
          asked.push({
            actionId: item.actionId,
            stepIndex,
            rule: "manner",
            detail: row.skill,
          });
          break;
        }
      }
      continue;
    }
    const steps = reading.steps;
    for (const [stepIndex, step] of steps.entries()) {
      let question: string | null = null;
      let rule: Asked["rule"] = "manner";
      let detail = "";
      if (
        step.step === "check" &&
        step.kind === "ability-check" &&
        !item.actor.startsWith("ai:")
      ) {
        const row = MANNER_SKILLS.find((m) => m.skill === step.skill);
        if (row && !row.cues.test(item.text)) {
          question = row.question;
          detail = row.skill;
        }
      }
      if (!question && item.scope !== "party") {
        const id =
          step.step === "attack"
            ? step.attackerId
            : step.step === "spell"
              ? step.casterId
              : step.step === "help"
                ? step.helperId
                : step.step === "check" && step.kind === "ability-check"
                  ? step.combatantId
                  : null;
        const declarerName =
          snapshot.actors.find(
            (a) => a.kind === "party" && a.characterId === item.characterId,
          )?.name ?? "your character";
        const other = id
          ? snapshot.actors.find(
              (a) =>
                a.kind === "party" &&
                (a.combatantId === id ||
                  (a.combatantId === null && a.id === id)),
            )
          : undefined;
        if (
          other &&
          other.controller.kind === "player" &&
          other.controller.userId !== item.actor
        ) {
          question = otherPlayerQuestion(other.name, declarerName);
          rule = "other-player";
          detail = other.name;
        }
      }
      if (question) {
        questions.set(item.actionId, question);
        asked.push({ actionId: item.actionId, stepIndex, rule, detail });
        break;
      }
    }
  }
  return {
    readings: input.readings.map((r) => {
      const q = r.actionId === null ? undefined : questions.get(r.actionId);
      return q === undefined
        ? r
        : hasStages(r)
          ? { ...r, stages: [], followUps: [], clarify: q }
          : { ...r, steps: [], followUps: [], clarify: q };
    }),
    asked,
  };
}
