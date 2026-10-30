import { afterAll, describe, expect, it } from "vitest";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import { PURPOSE_OF } from "../../src/dm/purposes.js";
import { runTalkTurn } from "../../src/dm/talk-turn.js";
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
  player,
  reachable,
  readRows,
  requireDb,
  startScene,
  TAMSIN_USER,
  type World,
} from "./world.js";

/** The talk path (specs/065-talk-triggers D3): reply, none, leak, full pipeline, reclaim, chain. */

loudSkip("talk-turn.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
const retrieve = async () => ({
  mode: "fts" as const,
  embeddingModel: null,
  candidates: { vector: null, fts: 0 },
  passages: [],
});
const chronicle = () => ({
  purpose: "dm.chronicle",
  respond: { type: "json", value: { entries: [] } },
});
const reactCall = (value: Record<string, unknown>) => ({
  purpose: "dm.narrate",
  respond: {
    type: "json",
    value: {
      outcome: "reply",
      triggers: [],
      speaker: "wenna",
      text: "Wenna nods slowly.",
      encounterId: null,
      companionPrompts: [],
      reason: "r",
      ...value,
    },
  },
});

/** A duo table after scene start, with the talk script's calls queued after it. */
async function table(talkCalls: unknown[]) {
  const sceneStart = script("scene-start.json");
  const w = await createWorld({
    dice: [],
    calls: [...sceneStart.calls, chronicle(), ...talkCalls],
  });
  const wired = workerFor(w, { retrieve, talkQuietMs: 0 });
  await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
    start: {
      seedId: "greyhollow-ford-duo",
      seats: { tamsin: TAMSIN_USER, kestrel: KESTREL_USER },
    },
  });
  await drainAll(wired.worker);
  return { w, ...wired };
}

/** Posts talk, then lets the gate listener enqueue (it runs async). */
const say = async (w: World, text: string, channel = "ic") => {
  const res = await w.as(player, {
    kind: "talk",
    talk: { text, channel, characterId: "tamsin" },
  });
  await tick();
  return res;
};

const dmNarrations = async (w: World) =>
  (await readRows(w)).filter(
    (r) => r.type === "narration" && r.actor === "ai:dm",
  );
const talkJobs = async (w: World) =>
  (await listDmJobs(requireDb(), w.sessionId, 50, "turn")).filter(
    (j) => (j.input as { trigger: string }).trigger === "talk",
  );
const MECHANICS = new Set([
  "roll",
  "combatant.add",
  "initiative",
  "table-mode.changed",
  "hp.changed",
]);

describe.skipIf(!reachable)("talk turn (database)", () => {
  it("a reply ships one narration row and no state-change row", async () => {
    const s = script("talk-reply.json");
    const { w, worker } = await table(s.calls);
    const before = await readRows(w);
    await say(w, "Wenna, who's missing from this house?");
    await drainAll(worker);
    const after = (await readRows(w)).slice(before.length);
    const narrations = after.filter((r) => r.type === "narration");
    expect(narrations).toHaveLength(1);
    expect(narrations[0]?.actor).toBe("ai:dm");
    expect(after.filter((r) => MECHANICS.has(r.type))).toEqual([]);
    const [job] = await talkJobs(w);
    expect(job?.status).toBe("succeeded");
    const result = job?.result as {
      talk: {
        outcome: string;
        codeTriggers: { kind: string; actorId: string }[];
      };
      calls: { purpose: string; promptVersion: string }[];
    };
    expect(result.talk.outcome).toBe("reply");
    expect(result.talk.codeTriggers).toContainEqual(
      expect.objectContaining({ kind: "addressed", actorId: "wenna" }),
    );
    expect(result.calls.map((c) => [c.purpose, c.promptVersion])).toEqual([
      [PURPOSE_OF.narrate, "dm.react-v1"],
    ]);
  });

  it("none ships nothing and records the reason", async () => {
    const s = script("talk-none.json");
    const { w, worker } = await table(s.calls);
    const before = (await readRows(w)).length;
    await say(w, "Does anyone answer?");
    await drainAll(worker);
    expect(
      (await readRows(w))
        .slice(before)
        .filter((r) => r.type !== "presence.recorded")
        .map((r) => r.type),
    ).toEqual(["talk"]);
    const [job] = await talkJobs(w);
    expect(job?.status).toBe("succeeded");
    expect(job?.result).toMatchObject({
      talk: { outcome: "none", reason: expect.stringContaining("chatter") },
    });
  });

  it("a DM-only leak is refused, regenerated once, then dropped", async () => {
    const leak =
      "Wenna leans in. Four goblins took the clapper into the reeds.";
    const { w, worker } = await table([
      reactCall({ text: leak }),
      reactCall({ text: leak }),
    ]);
    const before = (await readRows(w)).length;
    await say(w, "Wenna, what do you know?");
    await drainAll(worker);
    expect(
      (await readRows(w)).slice(before).filter((r) => r.type === "narration"),
    ).toEqual([]);
    expect(w.scripted.remaining().calls["dm.narrate"]).toBe(0);
    const [job] = await talkJobs(w);
    expect(job?.status).toBe("succeeded");
    expect(job?.result).toMatchObject({
      talk: { outcome: "none", reason: expect.stringContaining("refused") },
    });
  });

  it("a talk job with a committed beat runs the full pipeline", async () => {
    const s = script("exploration-check.json");
    const w = await createWorld({
      dice: s.dice,
      calls: [...s.calls, chronicle()],
    });
    const { worker } = workerFor(w, { retrieve, listen: false });
    await startScene(w);
    await commitAction(
      w,
      "I search the ferry-house for the bell rope.",
      "act-search",
    );
    const projections = await w.projections();
    await enqueueTurn(requireDb(), w.sessionId, "talk", projections.throughSeq);
    await drainAll(worker);
    const [job] = await talkJobs(w);
    expect(job?.status).toBe("succeeded");
    const result = job?.result as {
      outcome: { status: string };
      talk?: unknown;
      calls: { purpose: string }[];
    };
    expect(result.outcome.status).toBe("completed");
    expect(result.talk).toBeUndefined();
    expect(result.calls.map((c) => c.purpose)).toContain(PURPOSE_OF.director);
  });

  it("a reclaim reuses the checkpointed react output and ships once", async () => {
    const { w } = await table([]);
    await say(w, "Wenna, who's missing from this house?");
    const react = {
      outcome: "reply" as const,
      triggers: [],
      speaker: "wenna",
      text: "Wenna keeps her counsel, and the fire pops.",
      encounterId: null,
      companionPrompts: [],
      reason: "r",
    };
    const seq = (await w.projections()).throughSeq;
    const run = async () => {
      const base = w.ctx({
        job: { trigger: "talk", triggerSeq: seq, attempt: 2 },
        checkpoint: { ...w.checkpoint.current, react },
      });
      const assembled = await assemble(base);
      if (!assembled.ok) throw new Error("assemble failed");
      return runTalkTurn(
        { ...base, results: { assemble: assembled.output } },
        assembled.output,
      );
    };
    const first = await run();
    expect(first).toMatchObject({ status: "talk", shipped: true });
    const second = await run();
    expect(second).toMatchObject({ status: "talk" });
    expect(await dmNarrations(w)).toHaveLength(2); // scene start + one reaction
    expect(w.scripted.remaining().calls["dm.narrate"]).toBe(0);
  });

  it("a chain stops at two DM reactions and the cap reaction prompts no companion", async () => {
    const s = script("talk-chain.json");
    const { w, worker } = await table(s.calls);
    const sceneRows = (await dmNarrations(w)).length;
    await say(w, "Wenna, who's missing from this house?");
    await drainAll(worker); // reply 1, Odo's line, reply 2
    console.log(
      JSON.stringify(
        (await listDmJobs(requireDb(), w.sessionId, 50)).map((j) => [
          j.kind,
          j.status,
          j.error,
          j.input,
        ]),
      ),
      JSON.stringify(
        (await readRows(w)).slice(-6).map((r) => [r.seq, r.type, r.actor]),
      ),
    );
    expect((await dmNarrations(w)).length - sceneRows).toBe(2);
    const rows = await readRows(w);
    expect(
      rows.filter((r) => r.type === "talk" && r.actor === "ai:companion:odo"),
    ).toHaveLength(1);
    expect(await talkJobs(w)).toHaveLength(2);
    const companionJobs = await listDmJobs(
      requireDb(),
      w.sessionId,
      20,
      "companion",
    );
    expect(companionJobs).toHaveLength(1); // only reply 1 prompted Odo

    // The next companion line draws no talk turn: the cap holds.
    const odo = { kind: "ai", actor: "ai:companion:odo" } as const;
    const res = await w.gate.submit(w.sessionId, odo, {
      kind: "talk",
      summary: null,
      rationale: null,
      talk: { text: "Wenna?", channel: "ic", characterId: "odo" },
      visibility: "public",
    });
    expect(res.ok).toBe(true);
    await drainAll(worker);
    expect(await talkJobs(w)).toHaveLength(2);

    // A human post resets the count.
    await say(w, "Wenna, anything else?");
    expect(await talkJobs(w)).toHaveLength(3);
  });
});
