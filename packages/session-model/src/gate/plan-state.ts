import type { Combatant } from "@the-stacks/dnd5e-engine";
import type { PlanActor, PlanState } from "@the-stacks/planner";
import { openRulings } from "../projections/intents.js";
import { targetStatus } from "../projections/spatial.js";
import type { SessionProjections } from "../projections/types.js";
import type { Viewer } from "../visibility.js";

type Inits = PlanState["inits"];

/**
 * Planner facts the projection cannot hold (spec 102 FR-013): the server derives them from the
 * scene seed on each call. Absent inputs mean empty maps and the default table rules.
 */
export interface PlannerInputs {
  /** By combatant id. */
  casters: PlanState["casters"];
  srdSpellIds: readonly string[];
  /** Pull-in and `add_combatant` sources, by NPC id. */
  inits: Inits;
  tableRules: PlanState["tableRules"];
  /** Seed NPC ids that may be targets before the engine holds them. */
  npcIds: readonly string[];
}

export const EMPTY_PLANNER_INPUTS: PlannerInputs = {
  casters: {},
  srdSpellIds: [],
  inits: {},
  tableRules: { outcomeBands: true, naturals: true },
  npcIds: [],
};

/**
 * FR-013, FR-014: builds the planner's `PlanState` from the DM projection `p`. `seen` is
 * `targetStatus(p, viewer, actor) === "ok"` for the acting viewer.
 */
export function buildPlanState(
  p: SessionProjections,
  viewer: Viewer,
  inputs: PlannerInputs = EMPTY_PLANNER_INPUTS,
): PlanState {
  const actors: Record<string, PlanActor> = {};
  const presenceOf = (id: string): PlanActor["presence"] =>
    p.scenePresence[id]?.presence ?? "present";
  const seenOf = (id: string) =>
    targetStatus(p, viewer, { kind: "actor", id }) === "ok";

  for (const m of p.party) {
    actors[m.characterId] = {
      id: m.characterId,
      combatantId: m.combatantId,
      side: "party",
      presence: presenceOf(m.characterId),
      seen: seenOf(m.combatantId ?? m.characterId),
      controller: m.controller.kind === "player" ? "human" : "ai",
    };
  }
  const claimed = new Set(p.party.map((m) => m.combatantId));
  const sideOf = (c: Combatant | undefined, id: string) =>
    c?.side ?? inputs.inits[id]?.side ?? "neutral";
  const npcs = new Set([
    ...inputs.npcIds,
    ...Object.keys(p.engine.combatants).filter((id) => !claimed.has(id)),
  ]);
  for (const id of npcs) {
    if (actors[id]) continue;
    const c = p.engine.combatants[id] as Combatant | undefined;
    actors[id] = {
      id,
      combatantId: c ? id : null,
      side: sideOf(c, id),
      presence: presenceOf(id),
      seen: seenOf(id),
      controller: "ai",
    };
  }

  const openRequests: PlanState["openRequests"] = {};
  for (const [id, { proposalId: _proposalId, ...request }] of Object.entries(
    openRulings(p),
  )) {
    openRequests[id] = request;
  }
  return {
    engine: p.engine,
    actors,
    casters: inputs.casters,
    srdSpellIds: [...inputs.srdSpellIds],
    inits: inputs.inits,
    openRequests,
    tableRules: inputs.tableRules,
  };
}
