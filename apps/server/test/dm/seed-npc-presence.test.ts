import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyEvent,
  emptyProjections,
  type SessionProjections,
  type StoredEvent,
  StoredEventSchema,
} from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { buildSnapshot, diffSnapshots } from "../../src/dm/snapshot/index.js";
import { testSeed } from "./helpers.js";

/**
 * AC #3: the recorded M2 demo log (session e8c848ec) proves only the event
 * moves presence. Snag flees in prose at seq 299; no row records it, so he
 * stays present through seq 301. The test reads the record in place.
 */

const LOG = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../docs/design/m2-demo/demo-session/transcript.jsonl",
);

function loadLog(): StoredEvent[] {
  return readFileSync(LOG, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => StoredEventSchema.parse(JSON.parse(l)));
}

/** Folds the log; returns the projections at each requested seq. */
function foldThrough(
  events: readonly StoredEvent[],
  seqs: readonly number[],
): { at: Map<number, SessionProjections>; final: SessionProjections } {
  let p = emptyProjections({ role: "dm" });
  const at = new Map<number, SessionProjections>();
  for (const e of events) {
    p = applyEvent(p, e);
    if (seqs.includes(e.seq)) at.set(e.seq, p);
  }
  return { at, final: p };
}

const SEQS = [295, 296, 297, 298, 299, 300, 301];

describe("seed NPC presence over the recorded M2 log (AC #3)", () => {
  const seed = testSeed();
  const events = loadLog();
  const { at, final } = foldThrough(events, SEQS);

  it("folds 333 rows with no diagnostics", () => {
    expect(events).toHaveLength(333);
    const d = final.diagnostics;
    expect(d.skippedUnknownType).toBe(0);
    expect(d.skippedUnknownVersion).toBe(0);
    expect(d.skippedInvalid).toBe(0);
    expect(d.outOfOrder).toBe(0);
    expect(d.ignoredTransitions).toBe(0);
    expect(d.beforeMismatches).toBe(0);
    expect(d.engineRejected).toBe(0);
    expect(d.incompleteBatches).toEqual([]);
  });

  it("holds no scene-presence.changed row", () => {
    expect(
      events.filter((e) => e.type === "scene-presence.changed"),
    ).toHaveLength(0);
  });

  it("lists Snag once, as one present npc with his combatant, at seq 295 to 301", () => {
    for (const seq of SEQS) {
      const p = at.get(seq);
      if (!p) throw new Error(`no fold at ${seq}`);
      const actors = buildSnapshot(p, seed).actors.filter(
        (a) => a.id === "snag" || a.combatantId === "snag",
      );
      expect(actors, `seq ${seq}`).toHaveLength(1);
      const snag = actors[0];
      expect(snag?.kind).toBe("npc");
      expect(snag?.combatantId).toBe("snag");
      expect(snag?.presence).toBe("present");
    }
  });

  it("shows no presence change between seq 298 and 301", () => {
    const s298 = at.get(298);
    const s301 = at.get(301);
    if (!s298 || !s301) throw new Error("missing fold");
    const diff = diffSnapshots(
      buildSnapshot(s298, seed),
      buildSnapshot(s301, seed),
    );
    expect(diff.actors.filter((c) => c.kind === "presence")).toHaveLength(0);
  });

  it("moves Snag to absent only when a scene-presence.changed row says so", () => {
    const s301 = at.get(301);
    if (!s301) throw new Error("missing fold");
    const last = events[events.length - 1] as StoredEvent;
    const row: StoredEvent = {
      sessionId: last.sessionId,
      seq: 334,
      actor: "ai:dm",
      type: "scene-presence.changed",
      payload: {
        actorId: "snag",
        before: "present",
        after: "absent",
        reason: "fled",
        actionId: null,
      },
      payloadVersion: 1,
      visibility: "public",
      ts: last.ts,
    };
    const after = applyEvent(s301, row);
    expect(after.diagnostics.skippedInvalid).toBe(0);
    expect(after.diagnostics.ignoredTransitions).toBe(0);
    expect(after.diagnostics.beforeMismatches).toBe(0);
    const snapAfter = buildSnapshot(after, seed);
    expect(snapAfter.actors.find((a) => a.id === "snag")?.presence).toBe(
      "absent",
    );
    const diff = diffSnapshots(buildSnapshot(s301, seed), snapAfter);
    const presence = diff.actors.filter((c) => c.kind === "presence");
    expect(presence).toHaveLength(1);
    expect(presence[0]?.actorId).toBe("snag");
  });
});
