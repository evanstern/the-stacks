import type { Skill } from "@the-stacks/dnd5e-engine";
import {
  REASON_TO_PRESENCE,
  type SessionProjections,
} from "@the-stacks/session-model";
import type { BeatItem } from "../nodes/assemble.js";
import type { DirectorNodeOutput } from "../nodes/director.js";
import type { InterpretReading, InterpretStage } from "../nodes/schemas.js";
import type { SceneSeed } from "../seed/schema.js";
import type { ActorSnapshot } from "../snapshot/index.js";

/**
 * The plan gate (specs/046-downed-hero-gate plan D3, decision-0025 §3.2).
 * Pure: it checks every actor and target id a plan names against the S0
 * actors' `combatantId`s, before any step of the group runs. It never maps an
 * alias: an alias only tells the verdict which reason to give.
 */

/**
 * The plan-gate literal of a party group held for an off-turn AI companion
 * (TASK-0244). Not a `RefusalCode`; it never reaches an event.
 */
export const TURN_HELD_CODE = "TURN_HELD" as const;

export type PlanVerdict =
  | { actionId: string | null; ok: true }
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
  readings: readonly InterpretReading[];
  /**
   * Action id -> the acting character's combatant id, `null` for a party-scope
   * action. An action id absent from the map (a character with no combatant)
   * is not actor-checked (spec 079 D5).
   */
  actors?: ReadonlyMap<string, string | null>;
  /** Spec 104 FR-012: action id -> the declarer's combatant id. The turn hold names it. */
  declarers?: ReadonlyMap<string, string>;
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

/**
 * TASK-0244: in turn mode a party group whose declarer is an off-turn AI companion is held.
 * ponytail: only AI companions are held (OQ-2); a human PC named off turn
 * still acts. Extend the off-turn set to human party members when a playtest
 * shows it.
 */
function heldFor(
  snapshot: ActorSnapshot,
  ownActors: ReadonlySet<string>,
  declarer: string | undefined,
): string | null {
  const enc = snapshot.stage.encounter;
  if (snapshot.stage.tableMode.mode !== "turn" || !enc || !declarer) {
    return null;
  }
  const order = new Set(enc.order);
  for (const a of snapshot.actors) {
    const id = a.combatantId;
    if (
      id === declarer &&
      a.kind === "party" &&
      a.controller.kind === "ai-companion" &&
      a.lifeState === "conscious" &&
      (order.has(a.id) || order.has(id)) &&
      (id !== enc.activeCombatantId || ownActors.has(id))
    ) {
      return id;
    }
  }
  return null;
}

/**
 * The plan gate's one check: a party group whose declarer is an off-turn AI companion waits for
 * its own turn (TASK-0244). The planner and the Intent runner own every other legality check.
 */
export function checkPlan(input: PlanInput): PlanVerdict[] {
  const { snapshot } = input;
  const staged = new Set<string | null>();
  const actionIds: (string | null)[] = [];
  for (const r of input.readings) {
    actionIds.push(r.actionId);
    if (r.clarify === null && r.stages.length > 0) {
      staged.add(r.actionId);
    }
  }
  return actionIds.map((actionId): PlanVerdict => {
    if (
      actionId !== null &&
      staged.has(actionId) &&
      input.actors?.get(actionId) === null
    ) {
      const own = new Set<string>();
      for (const k of actionIds) {
        const o = k === null ? null : input.actors.get(k);
        if (o) own.add(o);
      }
      const held = heldFor(snapshot, own, input.declarers?.get(actionId));
      if (held) {
        return { actionId, ok: false, code: TURN_HELD_CODE, heldFor: held };
      }
    }
    return { actionId, ok: true };
  });
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

export interface Asked {
  actionId: string;
  stepIndex: number;
  rule: "manner";
  /** The manner skill. */
  detail: string;
}

/**
 * Spec 077: a manner skill the declaration does not state, or a roll for
 * another human's PC, becomes a clarify. Pure; the runner applies it after the
 * free-mode cut and before `clarifyHolds`.
 */
export function askUndeclared(input: {
  beat: readonly BeatItem[];
  readings: readonly InterpretReading[];
  resumed: readonly string[];
}): { readings: InterpretReading[]; asked: Asked[] } {
  const { beat } = input;
  const resumed = new Set(input.resumed);
  const asked: Asked[] = [];
  const questions = new Map<string, string>();
  for (const item of beat) {
    if (item.status !== "committed" || resumed.has(item.actionId)) continue;
    const reading = input.readings.find((r) => r.actionId === item.actionId);
    if (!reading || reading.clarify !== null) continue;
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
  }
  return {
    readings: input.readings.map((r) => {
      const q = r.actionId === null ? undefined : questions.get(r.actionId);
      return q === undefined
        ? r
        : { ...r, stages: [], followUps: [], clarify: q };
    }),
    asked,
  };
}
