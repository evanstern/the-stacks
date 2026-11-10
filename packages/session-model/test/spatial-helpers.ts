import { emptyState } from "@the-stacks/dnd5e-engine";
import {
  anaCombatant,
  batchSpecs,
  goblinCombatant,
  makeRows,
  PLAYER_A,
  type RowSpec,
  run,
} from "./helpers.js";

export const zone = (id: string, kind = "room", hidden = false) => ({
  id,
  name: id[0]?.toUpperCase() + id.slice(1),
  kind,
  tags: [],
  hidden,
});

/** bank - house - loft(hidden); bank - camp(hidden); camp - post(hidden feature). */
export const space = {
  zones: [
    zone("bank", "area"),
    zone("house"),
    zone("loft", "room", true),
    zone("camp", "area", true),
    zone("post", "feature", true),
  ],
  edges: [
    { from: "bank", to: "house", kind: "open", feet: 20 },
    { from: "house", to: "loft", kind: "climb", feet: 10 },
    { from: "bank", to: "camp", kind: "open", feet: 60 },
    { from: "camp", to: "post", kind: "open", feet: 5 },
  ],
};

export const memberAna = {
  characterId: "ana",
  name: "Ana",
  controller: { kind: "player", userId: PLAYER_A },
  combatantId: "ana",
};

/** Rows for engine commands, one batch each, all with one visibility. */
export function engineRows(
  commands: { command: unknown; visibility?: string }[],
): RowSpec[] {
  let state = emptyState();
  const specs: RowSpec[] = [];
  commands.forEach(({ command, visibility }, i) => {
    const executed = run(state, command);
    state = executed.state;
    specs.push(
      ...batchSpecs(executed.events, `b${i}`, {
        actor: "ai:dm",
        visibility: visibility ?? "public",
      }),
    );
  });
  return specs;
}

export { anaCombatant, goblinCombatant, makeRows };
