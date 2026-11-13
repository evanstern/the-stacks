import type { StoredEvent } from "@the-stacks/session-model";
import { afterAll, describe, expect, it } from "vitest";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
import { loadDmScript } from "../../src/dm/script/load.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  script,
  tick,
  workerFor,
} from "./worker-world.js";
import {
  commitAction,
  createWorld,
  db,
  gatherParty,
  loudSkip,
  reachable,
  readRows,
  requireDb,
  TAMSIN_USER,
} from "./world.js";

loudSkip("scene.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const PASSAGE =
  "A character can try to persuade another creature by making a Charisma check, and the difficulty depends on how willing the creature already is.";

const retrieve = async () => ({
  mode: "fts" as const,
  embeddingModel: null,
  candidates: { vector: null, fts: 1 },
  passages: [
    {
      chunkId: "chunk-persuade",
      documentId: "doc-rules",
      kind: "prose" as const,
      text: PASSAGE,
      anchor: {
        book: "Fixture Rules",
        path: ["Social"],
        start: 0,
        end: PASSAGE.length,
      },
      rank: 1,
      score: 1,
      vector: null,
      fts: { rank: 1, score: 1 },
    },
  ],
});

const payload = <T>(r: StoredEvent | undefined) => r?.payload as T;

describe("fixture scripts", () => {
  it("the full script is the four scene segments in order, plus chronicle passes", () => {
    const parts = [
      "scene-start.json",
      "exploration-check.json",
      "social-adjudicated.json",
      "fight-round.json",
    ].map((f) => loadDmScript(script(f)));
    const full = loadDmScript(script("greyhollow-ford-full.json"));
    expect(full.dice).toEqual(parts.flatMap((p) => p.dice));
    expect(full.calls.filter((c) => c.purpose !== "dm.chronicle")).toEqual(
      parts.flatMap((p) => p.calls),
    );
    expect(() => loadDmScript(script("shutter-check.json"))).not.toThrow();
  });
});

describe.skipIf(!reachable)("the whole scene (database)", () => {
  // TASK-0154: 30 s budget; worst measured 1 987 ms (alone 1 987 ms, full run 1 928 ms); sized 3x max(measured, 5 s), 30 s floor.
  it("plays Greyhollow Ford to its end through exploration, social and fight", async () => {
    const s = script("greyhollow-ford-full.json");
    const w = await createWorld({ dice: s.dice, calls: s.calls });
    const { worker } = workerFor(w, { retrieve });

    // Scene start, through the real queue.
    await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
      start: { seedId: "greyhollow-ford", seats: { tamsin: TAMSIN_USER } },
    });
    await drainAll(worker);
    let p = await w.projections();
    expect(p.scene?.sceneId).toBe("greyhollow-ford");
    expect(p.party.map((m) => m.characterId).sort()).toEqual([
      "kestrel",
      "odo",
      "tamsin",
    ]);
    expect(p.tableMode.mode).toBe("free");

    // Exploration.
    await commitAction(
      w,
      "I search the ferry-house for whoever cut the bell rope.",
      "act-search",
    );
    await tick();
    await drainAll(worker);

    // Social, with an adjudicated ruling.
    await commitAction(
      w,
      "I tell Wenna we will bring Pell home, and ask her for the safe path.",
      "act-persuade",
    );
    await tick();
    await drainAll(worker);

    // Into the fight: initiative, then Snag's turn runs on its own.
    await commitAction(
      w,
      "I follow the old timber posts into the reeds toward the camp.",
      "act-advance",
    );
    await tick();
    await drainAll(worker);
    p = await w.projections();
    expect(p.tableMode.mode).toBe("turn");
    expect(p.encounter?.activeCombatantId).toBe("tamsin");
    // TASK-0312: the fight starts at range; the melee swing below needs the party in reach.
    await gatherParty(w);

    // The human turn, then Odo, Kestrel and the Director's close.
    await commitAction(
      w,
      "I swing my longsword at the goblin in the pot-helm.",
      "act-strike",
    );
    await tick();
    await drainAll(worker);

    p = await w.projections();
    const rows = await readRows(w);

    // The scene ended and the table is free again.
    expect(p.scene).toBeNull();
    expect(p.tableMode.mode).toBe("free");
    expect(p.encounter).toBeNull();
    const sceneRows = rows.filter((r) => r.type === "scene.changed");
    expect(payload<{ after: unknown }>(sceneRows.at(-1)).after).toBeNull();

    // Mode switches: free -> turn -> free.
    const modes = rows
      .filter((r) => r.type === "table-mode.changed")
      .map((r) => payload<{ after: { mode: string } }>(r).after.mode);
    expect(modes[0]).toBe("turn");
    expect(modes.at(-1)).toBe("free");
    expect(modes).toContain("turn");

    // Trackers are DM-only, from creation to the last step.
    const trackerRows = rows.filter((r) => r.type === "tracker.changed");
    expect(trackerRows.length).toBeGreaterThanOrEqual(4);
    expect(trackerRows.every((r) => r.visibility === "dm")).toBe(true);
    expect(p.trackers.find((t) => t.trackerId === "dusk")?.filled).toBe(1);
    expect(p.trackers.find((t) => t.trackerId === "alarm")?.filled).toBe(1);

    // Both companions acted as themselves; the human seat committed as the human.
    const committers = rows
      .filter((r) => r.type === "action.committed")
      .map((r) => r.actor);
    expect(committers).toContain("ai:companion:odo");
    expect(committers).toContain("ai:companion:kestrel");
    expect(committers).toContain(TAMSIN_USER);

    // Every narration: digit-free prose, dice lines from code.
    const narrations = rows.filter((r) => r.type === "narration");
    expect(narrations).toHaveLength(8);
    for (const n of narrations) {
      const [prose] = payload<{ text: string }>(n).text.split("\n\n");
      expect(prose, prose).not.toMatch(/[0-9]/);
    }

    // Spec 104: the social check is ruled by a `ruling` Intent (the adjudicate node's cited
    // journal entry belongs to the legacy path, which TASK-0312 deletes).
    const rulings = rows.filter(
      (r) =>
        r.type === "intent.recorded" &&
        (r.payload as { answers: string | null }).answers === "act-persuade.0",
    );
    expect(rulings).toHaveLength(1);

    // Jobs: every turn succeeded and completed; nothing failed.
    const jobs = await listDmJobs(requireDb(), w.sessionId, 50);
    expect(jobs.filter((j) => j.status === "failed")).toEqual([]);
    const turns = jobs.filter(
      (j) =>
        j.kind === "turn" &&
        (j.input as { trigger?: string }).trigger !== "ruling",
    );
    expect(turns).toHaveLength(8);
    expect(jobs.filter((j) => j.kind === "companion")).toHaveLength(2);

    // The script is spent (chronicle passes vary with idle timing).
    const left = w.scripted.remaining();
    expect(left.dice).toBe(0);
    for (const [purpose, n] of Object.entries(left.calls)) {
      if (purpose !== "dm.chronicle") expect(n, purpose).toBe(0);
    }
  }, 30_000);
});
