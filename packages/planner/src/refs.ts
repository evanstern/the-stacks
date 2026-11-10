// FR-009–FR-012: actor and target resolution, able-actor check, pull-in; result helpers.
import {
  type Combatant,
  type Difficulty,
  type EngineCommand,
  isUnable,
  type RefusalCode,
} from "@the-stacks/dnd5e-engine";
import {
  type Intent,
  type IntentRefusalCodeSchema,
  type TargetRef,
  toText,
} from "@the-stacks/intent";
import type { SpaceView } from "@the-stacks/space";
import type { z } from "zod";
import type {
  PlanActor,
  PlanFact,
  PlannedCommand,
  PlanResult,
  PlanState,
} from "./types.js";

type IntentRefusalCode = z.infer<typeof IntentRefusalCodeSchema>;

/** What every handler reads. `answer` and `askId` are set when a ruling replans an Intent. */
export type Ctx = {
  state: PlanState;
  space: SpaceView;
  intent: Intent;
  reason: string;
  askId: string;
  answer?: { dc?: number; difficulty?: Difficulty };
  /** Plan another Intent in this context (set by `plan`); rulings use it to replan. */
  replan: (c: Ctx) => PlanResult;
};
export type Handler = (c: Ctx) => PlanResult;

export type Res<T> = { ok: true; value: T } | { ok: false; result: PlanResult };
export const good = <T>(value: T): Res<T> => ({ ok: true, value });
const bad = <T>(result: PlanResult): Res<T> => ({ ok: false, result });

type Details = Record<string, unknown>;

export function refuse(
  code: IntentRefusalCode,
  message: string,
  details?: Details,
  facts: PlanFact[] = [],
): PlanResult {
  return {
    kind: "refusal",
    refusal: {
      source: "planner",
      code,
      message,
      ...(details ? { details } : {}),
    },
    facts,
  };
}

export function refuseEngine(
  code: RefusalCode,
  message: string,
  details?: Details,
): PlanResult {
  return {
    kind: "refusal",
    refusal: {
      source: "engine",
      code,
      message,
      ...(details ? { details } : {}),
    },
    facts: [],
  };
}

export const commands = (
  list: (EngineCommand | PlannedCommand)[],
  facts: PlanFact[] = [],
): PlanResult => ({
  kind: "commands",
  commands: list.map((x) => ("command" in x ? x : { command: x })),
  facts,
});

/** FR-004: the Intent's text form without its body, cut to 500 characters. */
export function reasonOf(intent: Intent): string {
  const text = toText({ ...intent, text: undefined } as Intent);
  return (text === "" ? intent.kind : text).slice(0, 500);
}

/** A short label for who did it, for a condition's `source` (max 200 characters). */
export function sourceOf(intent: Intent): string {
  const a = intent.actor;
  const who =
    a.kind === "pc" || a.kind === "companion" || a.kind === "npc"
      ? a.id
      : a.kind;
  return `${who}: ${intent.kind}`.slice(0, 200);
}

/** The id of the actor an Intent names, or null for a DM seat. */
export function actorIdOf(intent: Intent): string | null {
  const a = intent.actor;
  return a.kind === "pc" || a.kind === "companion" || a.kind === "npc"
    ? a.id
    : null;
}

export type Ref = {
  id: string;
  combatantId: string;
  combatant: Combatant;
  actor: PlanActor;
  /** Commands that bring a pulled-in NPC into the engine (and the encounter) first. */
  pull: PlannedCommand[];
  facts: PlanFact[];
};

/** A combatant with only what the planner reads, for a target not yet in the engine. */
function combatantOfInit(
  init: Extract<EngineCommand, { type: "combatant.add" }>["combatant"],
): Combatant {
  return {
    id: init.id,
    name: init.name,
    hp: {
      current: init.hp.current ?? init.hp.max,
      max: init.hp.max,
      temp: init.hp.temp ?? 0,
    },
    zeroHpRule: init.zeroHpRule,
    lifeState: "conscious",
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    conditionSeq: 0,
    hitDice: [],
    spellSlots: { standard: {}, pact: null },
    initiativeBonus: init.initiativeBonus,
    conModifier: init.conModifier,
    ac: init.ac,
    defenses: init.defenses,
    ...(init.stats ? { stats: init.stats } : {}),
  };
}

/** The Intent's actor as a present engine combatant. `able` adds the ACTOR_UNABLE check. */
export function resolveActor(c: Ctx, able = true): Res<Ref> {
  const id = actorIdOf(c.intent);
  if (id === null) {
    return bad(
      refuseEngine(
        "UNKNOWN_COMBATANT",
        `a ${c.intent.actor.kind} seat has no combatant`,
        { actor: c.intent.actor.kind },
      ),
    );
  }
  const actor = c.state.actors[id];
  const combatant =
    actor?.combatantId == null
      ? undefined
      : c.state.engine.combatants[actor.combatantId];
  if (!actor || actor.presence === "absent" || !combatant) {
    return bad(
      refuseEngine("UNKNOWN_COMBATANT", `no combatant for actor "${id}"`, {
        actorId: id,
      }),
    );
  }
  if (able && (combatant.lifeState === "dead" || isUnable(combatant))) {
    return bad(
      refuseEngine("ACTOR_UNABLE", `combatant "${combatant.id}" cannot act`, {
        combatantId: combatant.id,
        lifeState: combatant.lifeState,
      }),
    );
  }
  return good({
    id,
    combatantId: combatant.id,
    combatant,
    actor,
    pull: [],
    facts: [],
  });
}

/** An actor target: known, present, seen; an NPC with no combatant is pulled in from `inits`. */
export function resolveTarget(c: Ctx, t: TargetRef): Res<Ref> {
  if (t.kind !== "actor") {
    return bad(
      refuse("TARGET_NOT_PRESENT", `target is not an actor (${t.kind})`, {
        target: t,
      }),
    );
  }
  const actor = c.state.actors[t.id];
  if (!actor || actor.presence === "absent") {
    return bad(
      refuse("TARGET_NOT_PRESENT", `"${t.id}" is not present`, {
        targetId: t.id,
      }),
    );
  }
  if (!actor.seen) {
    return bad(
      refuse("TARGET_UNSEEN", `"${t.id}" cannot be seen`, { targetId: t.id }),
    );
  }
  if (actor.combatantId !== null) {
    const combatant = c.state.engine.combatants[actor.combatantId];
    if (!combatant) {
      return bad(
        refuse("TARGET_NOT_PRESENT", `"${t.id}" has no combatant`, {
          targetId: t.id,
        }),
      );
    }
    return good({
      id: t.id,
      combatantId: combatant.id,
      combatant,
      actor,
      pull: [],
      facts: [],
    });
  }
  const init = c.state.inits[t.id];
  if (!init) {
    return bad(
      refuse("TARGET_NOT_PRESENT", `"${t.id}" is not in the encounter`, {
        targetId: t.id,
      }),
    );
  }
  const pull: PlannedCommand[] = [
    { command: { type: "combatant.add", combatant: init, reason: c.reason } },
  ];
  if (c.state.engine.encounter) {
    pull.push({
      command: {
        type: "initiative.join",
        combatantId: init.id,
        mode: "normal",
        reason: c.reason,
      },
    });
  }
  return good({
    id: t.id,
    combatantId: init.id,
    combatant: combatantOfInit(init),
    actor,
    pull,
    facts: [{ kind: "pull-in", actorId: t.id }],
  });
}

/** Every actor target of the Intent, in order; the first refusal wins. */
export function resolveTargets(c: Ctx): Res<Ref[]> {
  const out: Ref[] = [];
  for (const t of c.intent.targets) {
    const r = resolveTarget(c, t);
    if (!r.ok) return r;
    out.push(r.value);
  }
  return good(out);
}

/** TASK-0145 #1: a hostile actor is present, conscious and not yielded. */
export function hostilesStanding(state: PlanState): boolean {
  return Object.values(state.actors).some((a) => {
    if (a.side !== "hostile" || a.presence !== "present") return false;
    const c =
      a.combatantId === null
        ? undefined
        : state.engine.combatants[a.combatantId];
    return c?.lifeState === "conscious";
  });
}
