// FR-029–FR-032: DM control kinds and the ai:dm seat rules.
import type { EngineCommand } from "@the-stacks/dnd5e-engine";
import { SQUARE_OWNER } from "./movement.js";
import {
  type Ctx,
  commands,
  type Handler,
  hostilesStanding,
  type Ref,
  refuse,
  resolveTarget,
  resolveTargets,
  sourceOf,
} from "./refs.js";
import type { PlannedCommand, PlanResult } from "./types.js";

/** TASK-0145 #1 and TASK-0147 #1: the AI DM seat never changes a party actor by fiat. */
function fiat(
  c: Ctx,
  targets: readonly Ref[],
  what: string,
): PlanResult | null {
  if (c.intent.actor.kind !== "ai:dm") return null;
  const hit = targets.find((t) => t.actor.side === "party");
  return hit
    ? refuse(
        "DM_SEAT_REQUIRED",
        `the AI DM cannot ${what} on party actor "${hit.id}" without a roll`,
        { targetId: hit.id, seat: "ai:dm" },
      )
    : null;
}

const pulls = (ts: readonly Ref[]): PlannedCommand[] =>
  ts.flatMap((t) => t.pull);
const factsOf = (ts: readonly Ref[]) => ts.flatMap((t) => t.facts);

export const applyDamage: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "apply_damage") throw new Error("apply_damage");
  const ts = resolveTargets(c);
  if (!ts.ok) return ts.result;
  const bad = fiat(c, ts.value, "apply damage");
  if (bad) return bad;
  return commands(
    [
      ...pulls(ts.value),
      ...ts.value.map(
        (t): EngineCommand => ({
          type: "damage.apply",
          targetId: t.combatantId,
          components: [
            { amount: i.params.amount, damageType: i.params.damageType },
          ],
          critical: i.params.critical,
          defenses: null,
          reason: c.reason,
        }),
      ),
    ],
    factsOf(ts.value),
  );
};

export const applyHeal: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "apply_heal") throw new Error("apply_heal");
  const ts = resolveTargets(c);
  if (!ts.ok) return ts.result;
  return commands(
    [
      ...pulls(ts.value),
      ...ts.value.map(
        (t): EngineCommand => ({
          type: i.params.temp ? "temp-hp.grant" : "healing.apply",
          targetId: t.combatantId,
          amount: i.params.amount,
          reason: c.reason,
        }),
      ),
    ],
    factsOf(ts.value),
  );
};

export const applyCondition: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "apply_condition") throw new Error("apply_condition");
  const ts = resolveTargets(c);
  if (!ts.ok) return ts.result;
  const { op, condition, until } = i.params;
  if (op === "add") {
    const bad = fiat(c, ts.value, "add a condition");
    if (bad) return bad;
  }
  const one = (t: Ref): EngineCommand => {
    if (condition === "exhaustion") {
      return {
        type: "exhaustion.adjust",
        targetId: t.combatantId,
        delta: op === "add" ? 1 : -1,
        reason: c.reason,
      };
    }
    return op === "add"
      ? {
          type: "condition.apply",
          targetId: t.combatantId,
          condition,
          source: sourceOf(c.intent),
          expiresAt: until
            ? {
                round: until.round,
                combatantId: until.actor,
                boundary: until.boundary,
              }
            : null,
          reason: c.reason,
        }
      : {
          type: "condition.remove",
          targetId: t.combatantId,
          condition,
          reason: c.reason,
        };
  };
  return commands(
    [...pulls(ts.value), ...ts.value.map(one)],
    factsOf(ts.value),
  );
};

export const startCombat: Handler = (c) => {
  const ts = resolveTargets(c);
  if (!ts.ok) return ts.result;
  const ids =
    ts.value.length > 0
      ? ts.value.map((t) => t.combatantId)
      : Object.values(c.state.actors)
          .filter(
            (a) =>
              a.presence === "present" &&
              a.combatantId !== null &&
              (a.side === "party" || a.side === "hostile") &&
              c.state.engine.combatants[a.combatantId]?.lifeState !== "dead",
          )
          .map((a) => a.combatantId as string)
          .sort();
  if (ids.length === 0) {
    return refuse("TARGET_NOT_PRESENT", "no combatants to roll initiative for");
  }
  return commands(
    [
      ...pulls(ts.value),
      {
        type: "initiative.roll",
        participants: ids.map((combatantId) => ({
          combatantId,
          mode: "normal" as const,
        })),
        reason: c.reason,
      },
    ],
    factsOf(ts.value),
  );
};

export const endCombat: Handler = (c) => {
  if (c.intent.actor.kind === "ai:dm" && hostilesStanding(c.state)) {
    return refuse(
      "DM_SEAT_REQUIRED",
      "the AI DM cannot end combat while hostiles stand",
      { seat: "ai:dm" },
    );
  }
  return commands([{ type: "encounter.end", reason: c.reason }]);
};

export const addCombatant: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "add_combatant") throw new Error("add_combatant");
  const t = c.intent.targets[0];
  const zoneId = t?.kind === "zone" ? t.id : null;
  const init = c.state.inits[i.params.from];
  if (!init) {
    return refuse("TARGET_NOT_PRESENT", `no init for "${i.params.from}"`, {
      from: i.params.from,
    });
  }
  const { placement: _drop, ...bare } = init;
  const taken = new Set(Object.keys(c.state.engine.combatants));
  const out: PlannedCommand[] = [];
  let n = 0;
  for (let k = 0; k < i.params.count; k++) {
    let id: string;
    do {
      n += 1;
      id = `${i.params.from}-${n}`;
    } while (taken.has(id));
    taken.add(id);
    out.push({
      command: {
        type: "combatant.add",
        combatant: { ...bare, id },
        reason: c.reason,
      },
    });
    if (zoneId) {
      out.push({
        command: {
          type: "combatant.place",
          combatantId: id,
          zoneId,
          reason: c.reason,
        },
      });
    }
    if (c.state.engine.encounter) {
      out.push({
        command: {
          type: "initiative.join",
          combatantId: id,
          mode: "normal",
          reason: c.reason,
        },
      });
    }
  }
  return commands(out);
};

export const moveToken: Handler = (c) => {
  const [who, dest, ...more] = c.intent.targets;
  if (!who || !dest)
    throw new Error("move_token needs an actor and a destination");
  if (dest.kind !== "zone" || more.length > 0) {
    return refuse("KIND_UNSERVED", "move_token to squares is not served", {
      param: "targets",
      owner: SQUARE_OWNER,
    });
  }
  const r = resolveTarget(c, who);
  if (!r.ok) return r.result;
  const bad = fiat(c, [r.value], "move a token");
  if (bad) return bad;
  return commands(
    [
      ...r.value.pull,
      {
        type: "combatant.place",
        combatantId: r.value.combatantId,
        zoneId: dest.id,
        reason: c.reason,
      },
    ],
    r.value.facts,
  );
};
