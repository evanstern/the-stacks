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
import {
  emptyCheckpoint,
  freeEventsThrough,
  makeCtx,
  projectDm,
} from "./helpers.js";
import { EMPTY_RESOLVE_SNAPSHOT } from "./snapshot-fixtures.js";

/**
 * Spec 104 FR-018, FR-019 (User Story 5): narrate renders the public `intent.recorded` facts in
 * the window `(W0, W1]`, W0 being the last narrated beat's `factsThrough`.
 */

const director: DirectorNodeOutput = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "rising", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
};
const resolved: ResolveOutput = {
  submissions: [],
  actionResults: [],
  appendedRows: [],
  nextJob: null,
  chronicle: false,
  npcTurn: null,
  ...EMPTY_RESOLVE_SNAPSHOT,
  lastSeq: 0,
};

const carrier = (
  seq: number,
  visibility: string,
  decision: string,
): StoredEvent =>
  ({
    sessionId: "s",
    seq,
    actor: "ai:dm",
    type: "intent.recorded",
    payload: { facts: [{ kind: "ruling", decision }] },
    payloadVersion: 1,
    visibility,
    ts: "2026-11-11T00:00:00.000Z",
  }) as StoredEvent;
const narration = (seq: number): StoredEvent =>
  ({
    ...carrier(seq, "public", ""),
    type: "narration",
    payload: {},
  }) as StoredEvent;

/** Runs narrate over the fixture log with `log` as the store and `factsThrough` on a prior turn. */
async function whyRows(opts: {
  log: (w1: number) => StoredEvent[];
  factsThrough?: number;
}) {
  const events = freeEventsThrough("action.resolved");
  const w1 = events.at(-1)?.seq ?? 0;
  const log = opts.log(w1);
  const scripted = createScriptedDm(
    loadDmScript({
      v: 1,
      name: "window",
      dice: [],
      calls: [{ purpose: "dm.narrate", respond: { type: "text", value: "x" } }],
    }),
  );
  const gateway = createGateway({
    config: scripted.aiConfig,
    sink: memorySink(),
    adapters: { fake: () => scripted.provider },
  });
  const asked: { afterSeq: number; throughSeq: number }[] = [];
  const ctx0 = makeCtx({
    deps: {
      gateway,
      loadProjections: async () => projectDm(events),
      loadEvents: async (_s, w) => {
        asked.push({ afterSeq: w.afterSeq, throughSeq: w.throughSeq });
        return log.filter(
          (e) =>
            e.seq > w.afterSeq &&
            e.seq <= w.throughSeq &&
            w.types.includes(e.type),
        );
      },
      loadPriorTurns: async () =>
        opts.factsThrough === undefined
          ? []
          : [
              {
                jobId: "j0",
                checkpoint: {
                  ...emptyCheckpoint(),
                  factsThrough: opts.factsThrough,
                },
              },
            ],
    },
  });
  const assembled = await assemble(ctx0);
  if (!assembled.ok) throw new Error("assemble failed");
  const snapshot = buildSnapshot(assembled.output.projections, ctx0.seed);
  const out = await narrate({
    ...ctx0,
    results: {
      assemble: assembled.output,
      director,
      resolve: { ...resolved, snapshot },
    },
  });
  if (!out.ok) throw new Error("narrate failed");
  return {
    why: out.output.sheet.rows
      .filter((r) => r.kind === "why")
      .map((r) => r.text),
    factsThrough: out.output.factsThrough,
    w1,
    asked,
  };
}

describe("narrate window (spec 104 US5)", () => {
  it("1: a ruling row landed before the job and after the last narration renders", async () => {
    const r = await whyRows({
      log: (w1) => [carrier(w1 - 1, "public", "accept")],
      factsThrough: 1,
    });
    expect(r.why).toEqual(["DM ruling: accept"]);
    expect(r.factsThrough).toBe(r.w1);
  });

  it("2: a row the previous beat already narrated does not repeat", async () => {
    const r = await whyRows({
      log: (w1) => [carrier(w1 - 1, "public", "accept")],
      factsThrough: 99_999, // the previous narrate read through every row
    });
    expect(r.why).toEqual([]);
  });

  it("3: a row landed while the previous narration ran (after its W1) renders next beat", async () => {
    const before = await whyRows({
      log: () => [],
      factsThrough: 5,
    });
    // The previous narrate read through seq 5; the row at 6 landed during it.
    const r = await whyRows({
      log: () => [carrier(6, "public", "accept")],
      factsThrough: 5,
    });
    expect(before.why).toEqual([]);
    expect(r.why).toEqual(["DM ruling: accept"]);
  });

  it("4: a dm row stays out of the public fact sheet", async () => {
    const r = await whyRows({
      log: (w1) => [
        carrier(w1 - 1, "dm", "reject"),
        carrier(w1, "public", "accept"),
      ],
      factsThrough: 1,
    });
    expect(r.why).toEqual(["DM ruling: accept"]);
  });

  it("without a recorded window, W0 is the newest earlier narration row (a deploy does not re-render history)", async () => {
    const r = await whyRows({
      log: (w1) => [
        carrier(w1 - 3, "public", "stale"),
        narration(w1 - 2),
        carrier(w1 - 1, "public", "accept"),
      ],
    });
    expect(r.why).toEqual(["DM ruling: accept"]);
  });
});
