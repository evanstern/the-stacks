import { afterAll, describe, expect, it } from "vitest";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  script,
  tick,
  workerFor,
} from "./worker-world.js";
import {
  createWorld,
  db,
  HUMAN_DM,
  loudSkip,
  operator,
  payloadOf,
  player,
  reachable,
  readRows,
  requireDb,
  TAMSIN_USER,
  type World,
} from "./world.js";

/**
 * Spec 111 Phase 2 (plan D8 steps 1-6): the test-drive replay. Real carriers through the real
 * gate, enqueue rules, talk read, ruling turn and narrate; fake gateway only.
 */

loudSkip("ruling-narration.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
const chronicle = () => ({
  purpose: "dm.chronicle",
  respond: { type: "json", value: { entries: [] } },
});
const adjudicate = () => ({
  purpose: "dm.adjudicate",
  respond: {
    type: "json",
    value: { decision: "accept", difficulty: "easy" },
  },
});
const narrateText = (text: string) => ({
  purpose: "dm.narrate",
  respond: { type: "text", value: text },
});
const tamsin = {
  kind: "human",
  userId: TAMSIN_USER,
  role: "player",
} as const;

/** A duo table after scene start (same shape as talk-turn.integration.test.ts). */
async function table(calls: unknown[], dice: number[]) {
  const sceneStart = script("scene-start.json");
  const w = await createWorld({
    dice,
    calls: [...sceneStart.calls, chronicle(), ...calls],
  });
  const wired = workerFor(w, { talkQuietMs: 0 });
  await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
    start: {
      seedId: "greyhollow-ford-duo",
      seats: { tamsin: TAMSIN_USER, kestrel: KESTREL_USER },
    },
  });
  await drainAll(wired.worker);
  return { w, ...wired };
}

const declare = async (
  w: World,
  id: string,
  kind: string,
  targets: unknown[],
) => {
  const res = await w.as(player, {
    kind: "intent",
    intent: {
      id,
      kind,
      actor: { kind: "pc", id: "tamsin" },
      targets,
      params: {},
      source: "composer",
      commit: "declared",
    },
  } as never);
  if (!res.ok) throw new Error(`declare refused: ${res.refusal.code}`);
  await tick();
};

const accept = async (w: World, suggestionId: string, itemId = "i1") => {
  const res = await w.as(tamsin, {
    kind: "action.accept",
    suggestionId,
    itemId,
  } as never);
  if (!res.ok)
    throw new Error(
      `accept refused: ${res.refusal.code} ${res.refusal.message}`,
    );
  await tick();
};

const lastSuggestion = async (w: World) => {
  const s = (await readRows(w)).filter((r) => r.type === "action.suggested");
  return payloadOf<{ suggestionId: string; items: { itemId: string }[] }>(
    s.at(-1),
  );
};

const narrations = async (w: World) =>
  (await readRows(w)).filter(
    (r) => r.type === "narration" && r.actor === "ai:dm",
  );
const narrateRequests = (w: World) =>
  w.scripted.provider.chatCalls
    .filter((c) => c.request.purpose === "dm.narrate")
    .map((c) => JSON.stringify(c.request));
const turnJobs = async (w: World) =>
  (await listDmJobs(requireDb(), w.sessionId, 40, "turn")).reverse();

const SEARCH = { kind: "zone", id: "ferry-house" };
const MOVE = { kind: "zone", id: "causeway" };

describe.skipIf(!reachable)("ruling narration replay (database)", () => {
  it("steps 1-6: declared, confirm, thumbs-up, ruling, narration holds the deed; the move follows", async () => {
    const { w, worker } = await table(
      [
        adjudicate(),
        narrateText("Tamsin searches the ferry house."),
        narrateText("Tamsin crosses the causeway."),
      ],
      [12, 12, 12, 12, 12, 12],
    );
    const base = (await narrations(w)).length;
    await declare(w, "search-1", "search", [SEARCH]);
    await drainAll(worker);
    const sug = await lastSuggestion(w);
    await accept(w, sug.suggestionId, sug.items[0]?.itemId);
    await drainAll(worker);

    // Live carriers fill `answers` and `request.requestId` (the Phase 1 assumption).
    const carriers = (await readRows(w))
      .filter((r) => r.type === "intent.recorded")
      .map((r) =>
        payloadOf<{
          outcome: string;
          answers: string | null;
          request?: { requestId?: string } | null;
        }>(r),
      );
    const ask = carriers.find((c) => c.outcome === "needs_ruling");
    expect(ask?.request?.requestId).toBeTruthy();
    expect(carriers.find((c) => c.answers != null)?.answers).toBe(
      ask?.request?.requestId,
    );

    const ruling = (await turnJobs(w)).find(
      (j) => (j.input as { trigger?: string }).trigger === "ruling",
    );
    expect(
      (ruling?.result as { outcome: { status: string } } | undefined)?.outcome
        .status,
    ).toBe("completed");
    const n1 = (await narrations(w)).slice(base);
    expect(n1).toHaveLength(1);
    const text1 = JSON.stringify(n1[0]?.payload);
    expect(text1).toContain("Deed: Tamsin Vale:");
    expect(text1).toContain("DM ruling: accept");

    // The move: a second deed; the search's deed is outside the window.
    const before = narrateRequests(w).length;
    // A human post resets the talk chain cap (two DM narrations already follow the last human row).
    const ooc = await w.as(player, {
      kind: "intent",
      intent: {
        id: "ooc-1",
        kind: "ooc",
        actor: { kind: "pc", id: "tamsin" },
        text: "Moving on.",
        source: "composer",
        commit: "declared",
      },
    } as never);
    expect(ooc.ok).toBe(true);
    await tick();
    await declare(w, "move-1", "move", [MOVE]);
    await drainAll(worker);
    const sug2 = await lastSuggestion(w);
    await accept(w, sug2.suggestionId, sug2.items[0]?.itemId);
    await drainAll(worker);
    const n2 = (await narrations(w)).slice(base);
    expect(n2).toHaveLength(2);
    const prompt = narrateRequests(w).slice(before).join("\n");
    expect(prompt).toContain("Direct action: Tamsin Vale: /move");
    expect(prompt).not.toContain("Direct action: Tamsin Vale: /search");
    expect(JSON.stringify(n2[1]?.payload)).not.toContain("/search");
  });

  it("step 7: two deeds stranded before one turn are both narrated, in seq order", async () => {
    const { w, worker } = await table(
      [narrateText("Tamsin crosses the causeway, then the bank.")],
      [],
    );
    const live = workerFor(w, { listen: false });
    const base = (await narrations(w)).length;
    // Two direct confirmed Intents settle with no turn drained between them (the pre-fix strand).
    for (const [id, zone] of [
      ["move-a", "causeway"],
      ["move-b", "near-bank"],
    ] as const) {
      const res = await w.as(player, {
        kind: "intent",
        intent: {
          id,
          kind: "move",
          actor: { kind: "pc", id: "tamsin" },
          targets: [{ kind: "zone", id: zone }],
          params: {},
          source: "composer",
          commit: "confirmed",
        },
      } as never);
      expect(res.ok ? "ok" : res.refusal).toBe("ok");
    }
    const sinceStart = narrateRequests(w).length;
    const last = (await readRows(w)).at(-1)?.seq ?? 0;
    await enqueueTurn(requireDb(), w.sessionId, "intent", last);
    await drainAll(live.worker);
    void worker;
    const n = (await narrations(w)).slice(base);
    expect(n).toHaveLength(1);
    const text = JSON.stringify(n[0]?.payload);
    expect(text.indexOf("/move #causeway")).toBeGreaterThan(-1);
    expect(text.indexOf("/move #near-bank")).toBeGreaterThan(
      text.indexOf("/move #causeway"),
    );
    const prompt = narrateRequests(w).slice(sinceStart).join("\n");
    expect(prompt.match(/Direct action: Tamsin Vale/g)).toHaveLength(2);
  });

  it("step 8: under a human DM, the DM's ruling queues an approval turn that narrates the deed", async () => {
    const { w, worker } = await table(
      [narrateText("Tamsin searches the ferry house.")],
      [12, 12, 12],
    );
    const seat = await w.as(operator, {
      kind: "dm.seat",
      reason: "A human takes the DM seat",
      after: { kind: "human", userId: HUMAN_DM },
    });
    expect(seat.ok ? "ok" : seat.refusal).toBe("ok");
    const base = (await narrations(w)).length;
    const res = await w.as(player, {
      kind: "intent",
      intent: {
        id: "search-h",
        kind: "search",
        actor: { kind: "pc", id: "tamsin" },
        targets: [SEARCH],
        params: {},
        source: "composer",
        commit: "confirmed",
      },
    } as never);
    expect(res.ok ? "ok" : res.refusal).toBe("ok");
    await tick();
    await drainAll(worker);
    const ruled = await w.as(operator, {
      kind: "intent",
      intent: {
        id: "dc-h",
        kind: "ruling",
        actor: { kind: "dm" },
        params: {
          requestId: "search-h",
          decision: "accept",
          difficulty: "easy",
        },
        source: "console",
        commit: "confirmed",
      },
    } as never);
    expect(ruled.ok ? "ok" : ruled.refusal).toBe("ok");
    await tick();
    const before = narrateRequests(w).length;
    await drainAll(worker);
    const approval = (await turnJobs(w)).filter(
      (j) => (j.input as { trigger?: string }).trigger === "approval",
    );
    expect(approval.length).toBeGreaterThan(0);
    expect(
      (approval.at(-1)?.result as { outcome: { status: string } } | undefined)
        ?.outcome.status,
    ).toBe("completed");
    const prompt = narrateRequests(w).slice(before).join("\n");
    expect(prompt).toContain("Direct action: Tamsin Vale: /search");
    // A human DM approves the narration: it ships as a proposal, not a row.
    expect((await narrations(w)).length).toBe(base);
  });
});
