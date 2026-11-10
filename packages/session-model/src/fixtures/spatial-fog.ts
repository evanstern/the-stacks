import type { EngineCommand, Rng } from "@the-stacks/dnd5e-engine";
import { planProposal } from "../gate/plan.js";
import { mechanicsProposal } from "../gate/proposals.js";
import { project } from "../projections/apply.js";
import type { StoredEvent } from "../stored-event.js";
import {
  fixtureIds as ids,
  type MechanicsRecipe,
  numberRows,
  type RowSpec,
  type SessionFixture,
} from "./build.js";

const sessionId = "00000000-0000-4000-8000-000000000111";
const rng: Rng = { rollDie: () => 1 };

/** The command behind each batch, for the recipes test (fixtures.test.ts). */
export const spatialFogRecipes: MechanicsRecipe[] = [];

const zone = (id: string, name: string, kind: string, hidden = false) => ({
  id,
  name,
  kind,
  tags: [],
  hidden,
});

/** The scene's space: the bank and house show; the loft, camp, marsh and post are fogged. */
export const spatialFogSpace = {
  zones: [
    zone("bank", "Bank", "area"),
    zone("house", "House", "room"),
    zone("loft", "Loft", "room", true),
    zone("camp", "Camp", "area", true),
    zone("marsh", "Marsh", "area", true),
    zone("post", "Post", "feature", true),
  ],
  edges: [
    { from: "bank", to: "house", kind: "open", feet: 20 },
    { from: "house", to: "loft", kind: "climb", feet: 10 },
    { from: "bank", to: "camp", kind: "open", feet: 60 },
    { from: "camp", to: "marsh", kind: "squeeze", feet: 30 },
    { from: "camp", to: "post", kind: "open", feet: 5 },
  ],
};

const fighter = (id: string, name: string, extra = {}) => ({
  id,
  name,
  hp: { max: 10 },
  zeroHpRule: "death-saves",
  ac: 12,
  ...extra,
});

const member = (characterId: string, name: string, userId: string) => ({
  actor: ids.dmActor,
  type: "party.member.changed",
  payload: {
    reason: `${name} joins the party`,
    characterId,
    before: null,
    after: {
      characterId,
      name,
      controller: { kind: "player", userId },
      combatantId: characterId,
    },
  },
});

/**
 * Plans each step through `planProposal` against the DM projection of the log so far, so
 * every row's visibility is the gate's, not the fixture author's.
 */
function script(): RowSpec[] {
  const specs: RowSpec[] = [];
  const fold = () =>
    project(numberRows(sessionId, specs) as StoredEvent[], { role: "dm" });
  let n = 0;
  const plan = (
    command: EngineCommand,
    visibility: "public" | "dm" = "public",
  ) => {
    const result = planProposal(
      fold(),
      { kind: "ai", actor: ids.dmActor },
      mechanicsProposal(command, { visibility }),
      rng,
      { batchId: `b-${++n}` },
      null,
    );
    if (!result.ok) throw new Error(`spatial-fog: ${result.refusal.code}`);
    spatialFogRecipes.push({
      fixture: "spatial-fog",
      batchId: `b-${n}`,
      command,
      faces: [],
    });
    specs.push(...result.rows);
  };
  specs.push(
    member("ana", "Ana", ids.playerUserId),
    member("cade", "Cade", ids.otherPlayerUserId),
  );
  const add = (
    c: ReturnType<typeof fighter>,
    vis: "public" | "dm" = "public",
  ) =>
    plan(
      {
        type: "combatant.add",
        combatant: c,
        reason: `${c.name} joins`,
      } as EngineCommand,
      vis,
    );
  add(fighter("ana", "Ana"));
  add(fighter("cade", "Cade"));
  plan({
    type: "space.define",
    space: spatialFogSpace,
    reason: "The scene is laid out",
  } as EngineCommand);
  for (const id of ["ana", "cade"]) {
    plan({
      type: "combatant.place",
      combatantId: id,
      zoneId: "bank",
      reason: `${id} starts on the bank`,
    } as EngineCommand);
  }
  // A DM-only arrival in the fogged camp: never loosened, reveals nothing.
  add(fighter("snag", "Snag", { placement: { zoneId: "camp" } }), "dm");
  plan({
    type: "move",
    combatantId: "ana",
    toZoneId: "house",
    reason: "Ana enters the house",
  } as EngineCommand);
  plan({
    type: "move",
    combatantId: "ana",
    toZoneId: "loft",
    reason: "Ana climbs to the loft",
  } as EngineCommand);
  // A public arrival in the fogged camp reveals it, with Snag already standing there.
  add(fighter("goblin", "Goblin", { placement: { zoneId: "camp" } }));
  // The goblin flees into the fogged marsh: a crossing reveals it.
  plan({
    type: "move",
    combatantId: "goblin",
    toZoneId: "marsh",
    reason: "The goblin flees",
  } as EngineCommand);
  // A DM-only move into the fogged post: never loosened.
  plan(
    {
      type: "combatant.place",
      combatantId: "snag",
      zoneId: "post",
      reason: "Snag slips away",
    } as EngineCommand,
    "dm",
  );
  return specs;
}

export const spatialFog: SessionFixture = {
  name: "spatial-fog",
  description:
    "Zone fog (specs/100-spatial-events). Rows come from planProposal over a scripted DM log: the space is defined with a fogged loft, camp, marsh and post; the party is placed on the bank; a dm-visibility arrival in the camp stays dm; Ana walks into the house and then the loft, which reveals the loft; a public goblin arrives in the camp, which reveals it and its occupants; the goblin flees to the marsh, which reveals the marsh; and a dm-visibility move into the post stays dm. Two players see the same map.",
  sessionId,
  viewers: {
    dm: { role: "dm" },
    players: [
      { role: "player", userId: ids.playerUserId },
      { role: "player", userId: ids.otherPlayerUserId },
    ],
  },
  events: numberRows(sessionId, script()),
};
