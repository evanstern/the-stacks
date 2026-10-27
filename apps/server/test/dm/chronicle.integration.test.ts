import { afterAll, describe, expect, it } from "vitest";
import { runChronicleJob } from "../../src/dm/chronicle.js";
import {
  enqueueChronicle,
  enqueueTurn,
  listDmJobs,
} from "../../src/dm/jobs.js";
import { listModelCalls } from "../../src/dm/model-calls.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import { loadProjections } from "../../src/session/projections.js";
import { withManyMonsters } from "./snapshot-fixtures.js";
import {
  clearDmJobsBeforeEach,
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
  startScene,
} from "./world.js";

loudSkip("chronicle.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

describe.skipIf(!reachable)("chronicle (database)", () => {
  it("runs a committed action to a finished turn and queues one chronicle that writes a journal entry", async () => {
    const s = script("audit-regenerate.json");
    const w = await createWorld({
      dice: s.dice,
      calls: [
        ...s.calls,
        {
          purpose: "dm.chronicle",
          respond: {
            type: "json",
            value: {
              entries: [
                {
                  title: "The shutter gives",
                  body: "Tamsin forced the stuck shutter of the ferry house.",
                  sourceActionIds: ["act-shutter"],
                  visibility: "public",
                },
              ],
            },
          },
        },
      ],
    });
    const { worker } = workerFor(w);
    await startScene(w);
    await commitAction(w, "Tamsin forces the stuck shutter.", "act-shutter");
    await tick();
    await worker.drain();

    const all = await listDmJobs(requireDb(), w.sessionId, 20);
    const turns = all.filter((j) => j.kind === "turn");
    const chronicles = all.filter((j) => j.kind === "chronicle");
    expect(turns.map((j) => j.error ?? j.status)).toEqual(["succeeded"]);
    expect(chronicles.map((j) => j.status)).toEqual(["succeeded"]);
    expect(
      (turns[0] as unknown as { result: { outcome: { status: string } } })
        .result.outcome.status,
    ).toBe("completed");

    const rows = await readRows(w);
    const entries = rows.filter(
      (r) =>
        r.type === "journal.entry.added" &&
        (r.payload as { entryId: string }).entryId.startsWith("chron-"),
    );
    expect(entries).toHaveLength(1);
    expect(
      (entries[0] as unknown as { payload: { sourceActionIds: string[] } })
        .payload.sourceActionIds,
    ).toEqual(["act-shutter"]);

    // TASK-0116: the chronicle result names its seqs, carries usage, and has ledger rows.
    const chronResult = (
      chronicles[0] as unknown as {
        result: {
          entries: number;
          seqs: number[];
          calls: {
            provider: string | null;
            model: string | null;
            inputTokens: number | null;
            outputTokens: number | null;
            durationMs: number | null;
          }[];
        };
      }
    ).result;
    expect(chronResult.seqs).toEqual(entries.map((r) => r.seq));
    expect(chronResult.calls).toHaveLength(1);
    expect(chronResult.calls[0]?.provider).not.toBeNull();
    expect(chronResult.calls[0]?.model).not.toBeNull();
    expect(chronResult.calls[0]?.inputTokens).not.toBeNull();
    expect(chronResult.calls[0]?.outputTokens).not.toBeNull();
    expect(chronResult.calls[0]?.durationMs).not.toBeNull();
    const ledger = (
      await listModelCalls(requireDb(), w.sessionId, { after: 0, limit: 100 })
    ).rows.filter((r) => r.jobId === chronicles[0]?.id);
    expect(ledger.map((r) => [r.jobKind, r.purpose, r.outcome])).toEqual([
      ["chronicle", "dm.chronicle", "ok"],
    ]);

    // A second chronicle pass with nothing new writes nothing and calls no model.
    const p = await w.projections();
    await enqueueChronicle(requireDb(), w.sessionId, p.throughSeq);
    await worker.drain();
    const after = (await readRows(w)).filter(
      (r) =>
        r.type === "journal.entry.added" &&
        (r.payload as { entryId: string }).entryId.startsWith("chron-"),
    );
    expect(after).toHaveLength(1);
    expect(w.scripted.remaining().calls["dm.chronicle"]).toBe(0);
  });

  it("a chronicle job never waits behind a turn job (turn claims first)", async () => {
    const w = await createWorld();
    const { worker } = workerFor(w);
    await enqueueChronicle(requireDb(), w.sessionId, 5);
    await enqueueTurn(requireDb(), w.sessionId, "manual");
    await worker.processOne();
    const all = await listDmJobs(requireDb(), w.sessionId, 10);
    const turn = all.find((j) => j.kind === "turn");
    const chron = all.find((j) => j.kind === "chronicle");
    expect(turn?.status).not.toBe("queued");
    expect(chron?.status).toBe("queued");
  });

  it("reads the state at the job's throughSeq, not the live log", async () => {
    const w = await createWorld();
    await startScene(w);
    const full = await w.projections();
    expect(full.throughSeq).toBeGreaterThan(3);
    const bound = full.throughSeq - 2;
    const at = await loadProjections(
      requireDb(),
      w.sessionId,
      { role: "dm" },
      { throughSeq: bound },
    );
    expect(at.throughSeq).toBeLessThanOrEqual(bound);
    expect(at.throughSeq).toBeLessThan(full.throughSeq);
  });

  it("an overflowing state writes nothing, logs state-overflow and makes no model call", async () => {
    const w = await createWorld({
      calls: [
        {
          purpose: "dm.chronicle",
          respond: { type: "json", value: { entries: [] } },
        },
      ],
    });
    await startScene(w);
    const base = w.ctx().deps;
    const live = await w.projections();
    const seen: number[] = [];
    const logs: Record<string, unknown>[] = [];
    // The scene-start narration is not part of the start rows; add one.
    const withNarration = {
      ...live,
      transcript: [
        ...live.transcript,
        {
          seq: live.throughSeq + 1,
          kind: "narration" as const,
          actor: "ai:dm",
          text: "The shutter gives.",
          visibility: "public" as const,
          actionId: null,
        },
      ],
    } as unknown as typeof live;
    const result = await runChronicleJob(
      {
        gateway: base.gateway,
        gate: base.gate,
        loadProjections: async () => withNarration,
        loadProjectionsThrough: async (_s, through) => {
          seen.push(through);
          return withManyMonsters(live, 90);
        },
        loadSeed: (id) => loadSeed(id),
        fence: async () => true,
        log: (l) => logs.push(l),
      },
      {
        id: "00000000-0000-4000-8000-0000000000c2",
        input: {
          v: 1,
          sessionId: w.sessionId,
          throughSeq: live.throughSeq + 1,
        },
      },
      new AbortController().signal,
    );
    expect(seen).toEqual([live.throughSeq + 1]);
    expect(result).toEqual({ entries: 0, seqs: [], calls: [] });
    expect(logs.find((l) => l.event === "dm.chronicle.failed")).toMatchObject({
      kind: "state-overflow",
      view: "fiction",
    });
    expect(w.scripted.remaining().calls["dm.chronicle"]).toBe(1);
  });
});
