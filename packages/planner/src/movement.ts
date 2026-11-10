// FR-025–FR-027: move (probe and reactions), dash, disengage, stand, drop_prone, end_turn.
import {
  type EngineCommand,
  execute,
  firstMeleeAttack,
  movementLeft,
  provokers,
  scriptedRng,
} from "@the-stacks/dnd5e-engine";
import { guardedDamage } from "./combat.js";
import {
  commands,
  type Handler,
  refuse,
  resolveActor,
  sourceOf,
} from "./refs.js";
import type { PlanFact, PlannedCommand } from "./types.js";

// ponytail: square targets are grid mode; add with the grid milestone (N-05).
export const SQUARE_OWNER = "N-05";

export const move: Handler = (c) => {
  const who = resolveActor(c);
  if (!who.ok) return who.result;
  const t = c.intent.targets[0];
  if (!t || c.intent.targets.length !== 1 || t.kind !== "zone") {
    return refuse("KIND_UNSERVED", "move to squares is not served", {
      param: "targets",
      owner: SQUARE_OWNER,
    });
  }
  const me = who.value;
  if (
    c.state.engine.encounter &&
    movementLeft(c.state.engine, me.combatantId) === 0
  ) {
    return refuse("NO_MOVEMENT_LEFT", "no movement left this turn", {
      combatantId: me.combatantId,
    });
  }
  const step: EngineCommand = {
    type: "move",
    combatantId: me.combatantId,
    toZoneId: t.id,
    reason: c.reason,
  };
  // D5: `move` draws no dice, so the probe is pure. A refusal passes through before reactions.
  const probe = execute(c.state.engine, step, scriptedRng([]));
  if (!probe.ok) {
    const { code, message, details } = probe.refusal;
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
  const list: PlannedCommand[] = [];
  const facts: PlanFact[] = [];
  if (me.actor.side === "party") {
    // FR-026 (OQ-11): only hostile-side reactors strike a party mover.
    for (const id of provokers(c.state.engine, me.combatantId, t.id)) {
      const reactor = Object.values(c.state.actors).find(
        (a) => a.combatantId === id,
      );
      const body = c.state.engine.combatants[id];
      const entry = body?.stats ? firstMeleeAttack(body.stats) : null;
      if (reactor?.side !== "hostile" || !entry) continue;
      const at = list.length;
      list.push({
        command: {
          type: "attack.roll",
          attackerId: id,
          targetId: me.combatantId,
          attack: entry.name,
          mode: "normal",
          targetAc: null,
          reaction: true,
          reason: c.reason,
        },
      });
      list.push(...guardedDamage(entry, me.combatantId, at, c.reason));
      facts.push({ kind: "reaction", reactorId: id, trigger: "leaves-zone" });
    }
  }
  list.push({ command: step });
  return commands(list, [...me.facts, ...facts]);
};

const movementAction =
  (action: "dash" | "disengage"): Handler =>
  (c) => {
    const who = resolveActor(c);
    if (!who.ok) return who.result;
    return commands(
      [
        {
          type: "movement.action",
          combatantId: who.value.combatantId,
          action,
          reason: c.reason,
        },
      ],
      who.value.facts,
    );
  };

export const dash = movementAction("dash");
export const disengage = movementAction("disengage");

// ponytail: the engine on this branch has no `stand` command (TASK-0274 adds it, with the stand-up
// movement cost). Refuse until it merges, then plan `{ type: "stand", combatantId, reason }`.
export const stand: Handler = (c) => {
  const who = resolveActor(c);
  if (!who.ok) return who.result;
  return refuse("KIND_UNSERVED", "stand needs the engine stand command", {
    kind: "stand",
    owner: "TASK-0274",
  });
};

export const dropProne: Handler = (c) => {
  const who = resolveActor(c);
  if (!who.ok) return who.result;
  return commands([
    {
      type: "condition.apply",
      targetId: who.value.combatantId,
      condition: "prone",
      source: sourceOf(c.intent),
      expiresAt: null,
      reason: c.reason,
    },
  ]);
};

export const endTurn: Handler = (c) => {
  const who = resolveActor(c);
  if (!who.ok) return who.result;
  return commands(
    [{ type: "turn.advance", reason: c.reason }],
    who.value.facts,
  );
};
