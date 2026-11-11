import { afterAll, describe, expect, it } from "vitest";
import { listDmJobs } from "../../src/dm/jobs.js";
import { clearDmJobsBeforeEach, drainAll, workerFor } from "./worker-world.js";
import {
  createWorld,
  db,
  loudSkip,
  player,
  reachable,
  readRows,
  requireDb,
  startScene,
} from "./world.js";

/**
 * Spec 102 Phase 4 (AC #2, AI seat): a `needs_ruling` result queues a `ruling` turn that answers
 * it with one `dm.adjudicate` call and a `ruling` Intent from `ai:dm`. Fake gateway only.
 */

loudSkip("rulings.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const attempt = {
  kind: "intent",
  intent: {
    id: "try-1",
    kind: "attempt",
    actor: { kind: "pc", id: "tamsin" },
    params: {},
    text: "I swing from the rope.",
    source: "composer",
    commit: "confirmed",
  },
} as const;

describe.skipIf(!reachable)("AI ruling turn (database)", () => {
  it("attempt -> ruling turn -> accept -> carrier with no-roll, request closed", async () => {
    const w = await createWorld({
      calls: [
        {
          purpose: "dm.adjudicate",
          respond: {
            type: "json",
            value: { decision: "accept", reason: "The rope holds." },
          },
        },
      ],
    });
    await startScene(w);
    const { worker } = workerFor(w);
    const res = await w.as(player, attempt);
    expect(res.ok).toBe(true);
    await drainAll(worker);

    const turns = await listDmJobs(requireDb(), w.sessionId, 10, "turn");
    expect(turns.map((j) => j.input)).toContainEqual(
      expect.objectContaining({ trigger: "ruling" }),
    );
    const carriers = (await readRows(w)).filter(
      (r) => r.type === "intent.recorded",
    );
    const answer = carriers.at(-1)?.payload as {
      answers: string | null;
      facts: { kind: string }[];
      outcome: string;
    };
    expect(carriers.at(-1)?.actor).toBe("ai:dm");
    expect(answer.answers).toBe("try-1");
    expect(answer.facts.map((f) => f.kind)).toContain("no-roll");
    const p = await w.projections();
    expect(p.intents.find((v) => v.id === "try-1")?.status).toBe("answered");
    // The one scripted call was consumed.
    expect(w.scripted.remaining().calls["dm.adjudicate"]).toBe(0);
  });

  it("a scripted ai:dm amend with a literal dc is refused", async () => {
    const w = await createWorld();
    await startScene(w);
    await w.as(player, attempt);
    const res = await w.gate.submit(
      w.sessionId,
      { kind: "ai", actor: "ai:dm" },
      {
        kind: "intent",
        intent: {
          id: "r-bad",
          kind: "ruling",
          actor: { kind: "ai:dm" },
          params: {
            requestId: "try-1",
            decision: "amend",
            amend: {
              kind: "check",
              targets: [],
              params: { skill: "athletics", dc: 12 },
            },
          },
          source: "ai",
          commit: "confirmed",
        },
      },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.refusal.message).toMatch(/MODEL_NUMBER|number/);
    const p = await w.projections();
    expect(p.intents.find((v) => v.id === "try-1")?.status).toBe(
      "needs_ruling",
    );
  });
});
