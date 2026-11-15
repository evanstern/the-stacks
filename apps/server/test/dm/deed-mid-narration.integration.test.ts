import { afterAll, describe, expect, it } from "vitest";
import { enqueueTurn } from "../../src/dm/jobs.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import { runAudit } from "../../src/playtest/auditor/audit.js";
import { exportSession } from "../../src/playtest/export.js";
import { cmd, initDice, inTurnMode } from "./encounter-lifecycle.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  type Gw,
  pausing,
  workerFor,
} from "./worker-world.js";
import {
  db,
  loudSkip,
  player,
  reachable,
  readRows,
  requireDb,
} from "./world.js";

/**
 * Spec 115 (TASK-0350): session 8c7d506e replayed. A floor holder's `/attack` lands while the
 * monster turn's narration is mid-stream. The runtime tells it in the next narration; the
 * auditor must cut the segment at that narration's facts window.
 */
loudSkip("deed-mid-narration.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const text = (purpose: string, value: string) => ({
  purpose,
  respond: { type: "text", value },
});
const chronicle = [1, 2, 3, 4].map(() => ({
  purpose: "dm.chronicle",
  respond: { type: "json", value: { entries: [] } },
}));

describe.skipIf(!reachable)("a deed posted mid-narration (database)", () => {
  async function replay() {
    // Snag acts first; Tamsin is next in the order.
    const init: number[] = initDice(3);
    init[0] = 5; // Tamsin follows Snag
    const dice = [...init, 15, 4, 4, 4, 15, 4, 4, 4, 10, 10];
    const w = await inTurnMode(dice, [
      text("dm.narrate", "The goblins press the attack."),
      text("dm.narrate", "Tamsin's blade lands."),
      ...chronicle,
    ]);
    await cmd(w, {
      type: "combatant.place",
      combatantId: "tamsin",
      zoneId: "reed-camp",
    });
    const p = pausing(w.ctx().deps.gateway as Gw);
    const { worker } = workerFor(w, { gateway: p.gateway });
    await enqueueTurn(requireDb(), w.sessionId, "npc-turn", null);
    const running = worker.processOne();
    await p.reached;
    const res = await w.as(player, {
      kind: "intent",
      intent: {
        id: "mid-narration-attack",
        kind: "attack",
        targets: [{ kind: "actor", id: "snag" }],
        params: { weapon: "Longsword" },
        actor: { kind: "pc", id: "tamsin" },
        source: "composer",
        commit: "confirmed",
      },
    } as never);
    expect(res.ok, JSON.stringify(res)).toBe(true);
    p.release();
    await running;
    await drainAll(worker);
    return w;
  }

  it("the audit passes with the window and fails without it", async () => {
    const w = await replay();
    const rows = await readRows(w);
    const carrier = rows.find(
      (r) =>
        r.type === "intent.recorded" &&
        (r.payload as { intent: { id: string } }).intent.id ===
          "mid-narration-attack",
    );
    const narrations = rows.filter((r) => r.type === "narration");
    const first = narrations[0];
    if (!carrier || !first) throw new Error("no carrier or narration row");
    // The race: the deed landed before the in-flight narration shipped, and it does not tell it.
    expect(carrier.seq).toBeLessThan(first.seq);
    const body = (r: { payload: unknown }) =>
      String((r.payload as { text?: string }).text ?? "");
    expect(body(first)).not.toMatch(/^Deed: /m);
    const later = narrations.slice(1).find((r) => /^Deed: /m.test(body(r)));
    expect(later, "a later narration tells the deed").toBeDefined();

    const exported = await exportSession(requireDb(), w.sessionId);
    const seed = loadSeed("greyhollow-ford-duo");
    const audit = (jobs: typeof exported.jobs) =>
      runAudit({
        ...exported,
        jobs,
        seed,
        gateway: null,
        models: {},
      });
    const ok = await audit(exported.jobs);
    for (const s of ok.segments) {
      for (const c of s.checks) {
        if (c.id === "deeds-narrated" || c.id === "dice-lines")
          expect(c.pass, `segment ${s.index} ${c.id}`).toBe(true);
      }
    }

    // Control (T008): without the window the old transcript-position rule blames the carrier.
    const stripped = exported.jobs.map((j) => ({
      ...j,
      factsThrough: undefined,
      narrationSeqs: undefined,
    }));
    const bad = await audit(stripped);
    expect(
      bad.findings.some(
        (f) => f.check === "deeds-narrated" && f.seqs.includes(carrier.seq),
      ),
    ).toBe(true);
  });
});
