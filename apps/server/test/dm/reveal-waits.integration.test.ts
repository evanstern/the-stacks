import { afterAll, describe, expect, it } from "vitest";
import { enqueueTurn } from "../../src/dm/jobs.js";
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
  loudSkip,
  reachable,
  readRows,
  requireDb,
  TAMSIN_USER,
} from "./world.js";

/**
 * Spec 089 (TASK-0237): replays run 1 seq 43-51 (docs/playtests/2026-11-03-runbook-b-playtest.md,
 * finding 12). An arrival a check's stakes name lands only when the applied band's texts name the NPC.
 */

loudSkip("reveal-waits.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
const chronicle = {
  purpose: "dm.chronicle",
  respond: { type: "json", value: { entries: [] } },
};

// biome-ignore lint/suspicious/noExplicitAny: script JSON
type Json = Record<string, any>;

async function run(opts: {
  die: number;
  stakes?: Json;
  narration?: string;
  unconditional?: boolean;
}) {
  const s = script("reveal-pell.json");
  const start = script("scene-start.json");
  const calls = structuredClone(s.calls) as { respond: { value: Json } }[];
  if (opts.stakes) {
    Object.assign(
      calls[1].respond.value.readings[0].stages[0].beside.stakes,
      opts.stakes,
    );
  }
  if (opts.unconditional) {
    for (const k of ["success", "cost", "failure", "severe"]) {
      calls[1].respond.value.readings[0].stages[0].beside.stakes[k] =
        "Nothing of note.";
    }
  }
  if (opts.narration) calls[3].respond.value = opts.narration as never;
  const logs: Record<string, unknown>[] = [];
  const w = await createWorld({
    dice: [opts.die],
    calls: [...start.calls, ...calls, chronicle, chronicle, chronicle],
  });
  const { worker } = workerFor(w, {
    log: (l) => logs.push(l),
  });
  await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
    start: {
      seedId: "greyhollow-ford-duo",
      seats: { tamsin: TAMSIN_USER, kestrel: KESTREL_USER },
    },
  });
  await drainAll(worker);
  await commitAction(w, "We scan the reeds.", "act-listen");
  await tick();
  await drainAll(worker);
  return { rows: await readRows(w), logs };
}

const pellRows = (rows: Awaited<ReturnType<typeof readRows>>) =>
  rows.flatMap((r, i) =>
    r.type === "scene-presence.changed" &&
    (r.payload as { actorId: string }).actorId === "pell" &&
    (r.payload as { reason: string }).reason === "arrived"
      ? [i]
      : [],
  );
const checkAt = (rows: Awaited<ReturnType<typeof readRows>>) =>
  rows.findIndex((r) => r.type === "check.resolved");
const held = (logs: Record<string, unknown>[]) =>
  logs.filter((l) => l.event === "dm.arrival.held");

describe.skipIf(!reachable)("reveal waits for the dice (database)", () => {
  it("seq 43-51, severe failure: no Pell row, one held log", async () => {
    const { rows, logs } = await run({ die: 3 });
    expect(checkAt(rows)).toBeGreaterThan(-1);
    expect(pellRows(rows)).toHaveLength(0);
    expect(held(logs)).toHaveLength(1);
  });

  it("success: one public arrived row after check.resolved", async () => {
    const { rows, logs } = await run({
      die: 15,
      narration: "Tamsin scans the reeds and spots Pell, alive at the post.",
    });
    const p = pellRows(rows);
    expect(p).toHaveLength(1);
    expect(rows[p[0]].visibility).toBe("public");
    expect(p[0]).toBeGreaterThan(checkAt(rows));
    expect(held(logs)).toHaveLength(0);
  });

  it("a failure text naming Pell lands him on failure", async () => {
    const { rows } = await run({
      die: 3,
      stakes: { failure: "She misses the lookout but sees Pell tied there" },
      narration: "Tamsin sees Pell tied at the post.",
    });
    expect(pellRows(rows)).toHaveLength(1);
  });

  it("an unconditional arrival lands before the check, as spec 078", async () => {
    const { rows, logs } = await run({
      die: 3,
      unconditional: true,
      narration: "Tamsin sees Pell tied at the post.",
    });
    const p = pellRows(rows);
    expect(p).toHaveLength(1);
    expect(p[0]).toBeLessThan(checkAt(rows));
    expect(held(logs)).toHaveLength(0);
  });
});
