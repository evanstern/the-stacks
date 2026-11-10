import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoredEvent } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { narrate } from "../../src/dm/nodes/narrate.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { makeCtx, projectDm, SESSION_ID } from "./helpers.js";
import { EMPTY_RESOLVE_SNAPSHOT } from "./snapshot-fixtures.js";

/**
 * Spec 098 AC #5: the run 1 seq 15-20 replay. A party action with no method
 * becomes a clarify. The reply ships the question as its own block and no row,
 * and code writes the State line; a model [ask] is discarded.
 */

const here = dirname(fileURLToPath(import.meta.url));
const run5 = JSON.parse(
  readFileSync(join(here, "fixtures/run5-narration-quality.json"), "utf8"),
) as { transcript: StoredEvent[] };
const replay = JSON.parse(
  readFileSync(join(here, "fixtures/run1-seq15-20-clarify.json"), "utf8"),
) as { clarify: string; action: string; rows: StoredEvent[] };

// Setup rows only (scene, combatants, party): the beat holds just the replayed action.
const SETUP = new Set([
  "scene.changed",
  "combatant.added",
  "party.member.changed",
]);
const setup = run5.transcript.filter((r) => r.seq <= 87 && SETUP.has(r.type));
const base = projectDm(setup);
const seat = base.party.find((m) => m.controller.kind === "player");
const HUMAN = seat?.controller.kind === "player" ? seat.controller.userId : "";
const events = [
  ...setup,
  ...replay.rows.map((r, i) => ({
    ...r,
    seq: (setup.at(-1)?.seq ?? 0) + 1 + i,
    sessionId: SESSION_ID,
    payloadVersion: 1,
    ts: "2026-11-03T12:00:00.000Z",
    actor: HUMAN,
  })),
] as StoredEvent[];

const director: DirectorNodeOutput = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
};

async function run(reply: string) {
  const scripted = createScriptedDm(
    loadDmScript({
      v: 1,
      name: "replay",
      dice: [],
      calls: [
        { purpose: "dm.narrate", respond: { type: "text", value: reply } },
      ],
    }),
  );
  const gateway = createGateway({
    config: scripted.aiConfig,
    sink: memorySink(),
    adapters: { fake: () => scripted.provider },
  });
  const ctx0 = makeCtx({
    deps: { gateway, loadProjections: async () => projectDm(events) },
  });
  const a = await assemble(ctx0);
  if (!a.ok) throw new Error("assemble failed");
  const resolve: ResolveOutput = {
    submissions: [],
    actionResults: [
      {
        actionId: "act-run1-15",
        outcome: "no-effect",
        batchIds: [],
        refusalCode: null,
      },
    ],
    appendedRows: [],
    nextJob: null,
    chronicle: false,
    npcTurn: null,
    ...EMPTY_RESOLVE_SNAPSHOT,
    snapshot: buildSnapshot(a.output.projections, ctx0.seed),
    lastSeq: 0,
  };
  const ctx = {
    ...ctx0,
    results: {
      assemble: a.output,
      director,
      resolve,
      interpret: {
        readings: [
          {
            actionId: "act-run1-15",
            intent: "other",
            uncertain: true,
            needsAdjudication: false,
            rulesQuestion: null,
            clarify: replay.clarify,
            followUps: [],
            steps: [],
          },
        ],
      },
    },
  } as unknown as Parameters<typeof narrate>[0];
  const out = await narrate(ctx);
  if (!out.ok) throw new Error("narrate failed");
  return out.output;
}

describe("run 1 seq 15-20 replay (spec 098)", () => {
  it("ships the question as its own block, no row, and the clarify State line", async () => {
    const n = await run(
      "[restate] The party means to move along the timber posts.\n[describe] Slick posts creak underfoot as the reeds whisper ahead.\n[ask] Which way, then?",
    );
    expect(n.slots.ask).toBe(replay.clarify);
    expect(n.sheet.rows).toEqual([]);
    expect(n.text).toBe(
      [
        "The party means to move along the timber posts.",
        "Slick posts creak underfoot as the reeds whisper ahead.",
        replay.clarify,
        "State: Nothing has happened yet. The party's action waits on Tamsin Vale's answer. Anyone else may act.",
      ].join("\n\n"),
    );
  });

  it("an untagged scripted reply is the describe slot, with the code restate", async () => {
    const n = await run(
      "Slick posts creak underfoot as the reeds whisper ahead.",
    );
    expect(n.slots.describe).toBe(
      "Slick posts creak underfoot as the reeds whisper ahead.",
    );
    expect(n.slots.restate).toContain("The party means to:");
    expect(n.slots.ask).toBe(replay.clarify);
  });

  it("every digit in a shipped reply lies in a row or the State line (Principle VII)", async () => {
    const n = await run("[describe] Posts creak.\n[restate] 3 of us go");
    const code = [...n.sheet.rows.map((r) => r.text), n.sheet.state ?? ""].join(
      "\n",
    );
    const prose = n.text.replace(code, "");
    expect(prose).not.toMatch(/[0-9]/);
  });
});
