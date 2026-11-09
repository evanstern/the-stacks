import type { SpaceView } from "@the-stacks/space";
import type { EngineState } from "./schema/state.js";

/** The one place the engine builds a SpaceView: combatant placements only. */
export function spaceViewOf(state: EngineState): SpaceView {
  const placements: Record<string, string> = {};
  for (const c of Object.values(state.combatants)) {
    if (c.placement) placements[c.id] = c.placement.zoneId;
  }
  return { space: state.space ?? null, placements };
}
