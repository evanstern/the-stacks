import { afterAll, describe, expect, it } from "vitest";
import { enqueueTurn } from "../../src/dm/jobs.js";
import { beforeClosingQuestion } from "../../src/dm/nodes/audit.js";
import type { PresenceReader } from "../../src/presence/index.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  script,
  workerFor,
} from "./worker-world.js";
import {
  createWorld,
  db,
  loudSkip,
  payloadOf,
  reachable,
  readRows,
  requireDb,
  TAMSIN_USER,
} from "./world.js";

/** Spec 076 AC #3: an opening that omits Wenna is blocked, regenerated and ships naming everyone. */
loudSkip("scene-start-intros.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
const present: PresenceReader = {
  presentUsers: () =>
    [TAMSIN_USER, KESTREL_USER].map((userId) => ({
      userId,
      displayName: userId,
    })),
  isPresent: () => true,
  onChange: () => () => {},
};
const retrieve = async () => ({
  mode: "fts" as const,
  embeddingModel: null,
  candidates: { vector: null, fts: 0 },
  passages: [],
});

describe.skipIf(!reachable)("scene-start intro regenerate (database)", () => {
  it("blocks the opening that omits Wenna and ships the one that names everyone", async () => {
    const s = script("scene-start-intro-regenerate.json");
    const w = await createWorld({
      dice: s.dice,
      calls: [
        ...s.calls,
        ...[1, 2, 3].map(() => ({
          purpose: "dm.chronicle",
          respond: { type: "json", value: { entries: [] } },
        })),
      ],
      presence: present,
    });
    const { worker } = workerFor(w, { retrieve, presence: present });
    await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
      start: {
        seedId: "greyhollow-ford-duo",
        seats: { tamsin: TAMSIN_USER, kestrel: KESTREL_USER },
      },
    });
    await drainAll(worker);
    const rows = await readRows(w);
    const narrations = rows.filter((r) => r.type === "narration");
    expect(narrations).toHaveLength(1);
    const text = payloadOf<{ text: string }>(narrations[0]).text;
    const before = beforeClosingQuestion(text);
    for (const n of ["Tamsin Vale", "Brother Odo", "Kestrel", "Wenna Marsh"])
      expect(before).toContain(n);
    expect(rows.some((r) => r.type === "journal.entry.added")).toBe(false);
    // Two narrate calls and one audit call: attempt 1 was blocked by code checks.
    expect(w.scripted.remaining()).toEqual({
      calls: expect.objectContaining({ "dm.narrate": 0, "dm.audit": 0 }),
      dice: 0,
    });
  });
});
