import { SceneSchema } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { buildNarrationFacts } from "../../src/dm/facts.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { CAPS, rosterOf } from "../../src/dm/prompts/common.js";
import { buildInterpretPrompt } from "../../src/dm/prompts/interpret.js";
import { buildNarratePrompt } from "../../src/dm/prompts/narrate.js";
import {
  dmOnlySeedText,
  openingScene,
  playerFacingSeed,
} from "../../src/dm/seed/views.js";
import { buildSnapshot, renderSnapshot } from "../../src/dm/snapshot/index.js";
import { makeCtx } from "./helpers.js";
import {
  EMPTY_RESOLVE_SNAPSHOT,
  greyhollowDuo,
  PLAYER_USER,
  SECOND_USER,
} from "./snapshot-fixtures.js";

/**
 * Spec 054 research R9 (no database): the actor snapshot views and the
 * player-facing prompts hold up with two humans at one table.
 */

const { projections, seed } = greyhollowDuo();
const snapshot = buildSnapshot(projections, seed);

function lines(opts: Parameters<typeof renderSnapshot>[1]): string[] {
  const r = renderSnapshot(snapshot, opts);
  if (!r.ok) throw new Error("snapshot overflow");
  return r.lines;
}
const lineFor = (all: string[], id: string) =>
  all.find((l) => l.startsWith(`${id} `)) ?? "";

describe("duo actor snapshot", () => {
  it("seats tamsin and kestrel as players for two different users", () => {
    const controllers = Object.fromEntries(
      snapshot.actors
        .filter((a) => a.kind === "party")
        .map((a) => [a.id, a.controller]),
    );
    expect(controllers.tamsin).toEqual({ kind: "player", userId: PLAYER_USER });
    expect(controllers.kestrel).toEqual({
      kind: "player",
      userId: SECOND_USER,
    });
    expect(controllers.odo?.kind).toBe("ai-companion");
  });

  it("the dm view lists both humans as players and odo as a companion", () => {
    const dm = lines({ view: "dm", cap: CAPS.snapshotDm });
    expect(lineFor(dm, "tamsin")).toContain("party, player");
    expect(lineFor(dm, "kestrel")).toContain("party, player");
    expect(lineFor(dm, "kestrel")).not.toContain("ai-companion");
    expect(lineFor(dm, "odo")).toContain("party, ai-companion");
  });

  it.each([
    ["tamsin", "kestrel"],
    ["kestrel", "tamsin"],
  ])(
    "the seat view for %s marks its own sheet and shows %s as a party member",
    (self, other) => {
      const seat = lines({ view: "seat", cap: CAPS.snapshotSeat, self });
      // Party members all carry the detailed sheet; the own seat is named as self's actor.
      expect(lineFor(seat, self)).toContain("party, player");
      expect(lineFor(seat, other)).toContain("party, player");
      expect(lineFor(seat, other)).not.toContain("ai-companion");
      expect(lineFor(seat, self)).toContain("mods");
      expect(lineFor(seat, other)).toContain("mods");
    },
  );

  it("the fiction view calls both humans human players, never a companion", () => {
    const fiction = lines({ view: "fiction", cap: CAPS.snapshotFiction });
    const named = (name: string) =>
      fiction.find((l) => l.startsWith(name)) ?? "";
    expect(named("Tamsin Vale")).toContain("human player");
    expect(named("Kestrel")).toContain("human player");
    expect(named("Brother Odo")).toContain("AI companion");
  });
});

const director: DirectorNodeOutput = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId: "ferry-house" },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
};

describe("duo player-facing prompts", () => {
  it("the interpret prompt names both humans as players and kestrel as no companion", async () => {
    const ctx = makeCtx({
      seed,
      deps: { loadProjections: async () => projections },
    });
    const assembled = await assemble(ctx);
    if (!assembled.ok) throw new Error("assemble failed");
    const { user } = buildInterpretPrompt({
      ctx,
      assembled: assembled.output,
      director,
    });
    expect(user).toContain("Tamsin Vale");
    expect(user).toContain("Kestrel");
    const kestrel =
      user.split("\n").find((l) => l.startsWith("kestrel ")) ?? "";
    expect(kestrel).toContain("party, player");
    expect(kestrel).not.toContain("ai-companion");
    expect(user).not.toContain(PLAYER_USER);
    expect(user).not.toContain(SECOND_USER);
  });

  it("the narrate prompt names both humans and calls only odo a companion", () => {
    const view = playerFacingSeed(seed);
    const resolve: ResolveOutput = {
      submissions: [],
      actionResults: [],
      appendedRows: [],
      nextJob: null,
      chronicle: false,
      npcTurn: null,
      ...EMPTY_RESOLVE_SNAPSHOT,
      lastSeq: 0,
    };
    const facts = buildNarrationFacts({
      trigger: "scene-start",
      seed: view,
      beatNpcIds: [],
      projections,
      beat: [],
      director: { ...director },
      resolve,
      presentNpcIds: [],
      modeBefore: "free",
      appendedRows: [],
      clarify: [],
    });
    const { system, user } = buildNarratePrompt({
      seed: view,
      roster: rosterOf(projections.party),
      assembled: {
        transcriptTail: projections.transcript,
        presentNpcIds: [],
        projections,
      } as unknown as Parameters<typeof buildNarratePrompt>[0]["assembled"],
      snapshot,
      facts,
    });
    const text = `${system}\n${user}`;
    expect(text).toContain("Tamsin Vale (party, human player)");
    expect(text).toContain("Kestrel (party, human player)");
    expect(text).toContain("Brother Odo (party, AI companion)");
    expect(text).not.toContain("Kestrel (party, AI companion)");
    expect(text).not.toContain(PLAYER_USER);
    expect(text).not.toContain(SECOND_USER);
  });
});

describe("opening scene (spec 091 D8)", () => {
  const scene = openingScene(playerFacingSeed(seed));
  it("parses and keeps the scene-start values", () => {
    expect(SceneSchema.safeParse(scene).success).toBe(true);
    expect(scene.sceneId).toBe(seed.seedId);
    expect(scene.title).toBe(seed.title);
    expect(scene.summary).toBe(seed.goal.statement);
    expect(scene.location).toBe(seed.location.name);
  });
  it("carries the two visible duo ways (the loft ladder waits on its reveal) and four-field cast", () => {
    expect(scene.ways?.map((w) => w.label)).toEqual([
      "causeway downriver",
      "ferry",
    ]);
    expect(scene.cast?.map((c) => Object.keys(c).sort())).toEqual(
      seed.npcs.map(() => ["appearance", "id", "name", "role"]),
    );
  });
  it("holds no DM-only text", () => {
    const text = JSON.stringify(scene);
    for (const s of dmOnlySeedText(seed)) expect(text).not.toContain(s);
  });
});
