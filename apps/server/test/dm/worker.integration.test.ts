import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createSession } from "../../src/auth/session.js";
import { createDmEnqueuer } from "../../src/dm/enqueue.js";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
import { listModelCalls } from "../../src/dm/model-calls.js";
import { MAX_ATTEMPTS } from "../../src/jobs/queue.js";
import { users } from "../../src/schema/auth.js";
import { jobs } from "../../src/schema/jobs.js";
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
  startScene,
  TAMSIN_USER,
} from "./world.js";

loudSkip("worker.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

describe.skipIf(!reachable)("DM worker (database)", () => {
  it("a committed action enqueues one turn; a second commit does not add another", async () => {
    const s = script("audit-regenerate.json");
    const w = await createWorld({ dice: s.dice, calls: s.calls });
    const { nudges } = workerFor(w);
    await startScene(w);
    await commitAction(w, "Tamsin forces the stuck shutter.", "act-shutter");
    await commitAction(w, "Tamsin checks the lintel.", "act-lintel");
    await tick();
    const queued = await listDmJobs(requireDb(), w.sessionId, 10, "turn");
    expect(queued.filter((j) => j.status === "queued")).toHaveLength(1);
    expect(nudges.count).toBeGreaterThan(0);
  });

  it("fills the scene-start job's start from its input", async () => {
    const w = await createWorld({
      dice: [],
      calls: [
        {
          purpose: "dm.director",
          respond: {
            type: "json",
            value: {
              beat: { decision: "resolve" },
              tableMode: { to: "stay" },
              trackers: [],
              scene: { status: "continue" },
              pacing: {
                tension: "low",
                spotlight: null,
                beatId: "ferry-house",
              },
              goalNote: "Open at the ford.",
              companionPrompts: [],
            },
          },
        },
      ],
    });
    const { worker } = workerFor(w);
    await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
      start: { seedId: "greyhollow-ford", seats: { tamsin: TAMSIN_USER } },
    });
    await worker.drain();
    const p = await w.projections();
    expect(p.scene?.sceneId).toBe("greyhollow-ford");
    const seat = p.party.find((m) => m.characterId === "tamsin");
    expect(seat?.controller).toEqual({ kind: "player", userId: TAMSIN_USER });
  });

  it("appends the failure notice for a job abandoned past MAX_ATTEMPTS", async () => {
    const w = await createWorld();
    const { worker } = workerFor(w);
    await startScene(w);
    const id = randomUUID();
    await requireDb()
      .insert(jobs)
      .values({
        id,
        kind: "turn",
        sessionId: w.sessionId,
        status: "running",
        stage: "assemble",
        attempts: MAX_ATTEMPTS,
        claimToken: randomUUID(),
        input: {
          v: 1,
          sessionId: w.sessionId,
          trigger: "manual",
          triggerSeq: null,
          forceResolve: false,
          start: null,
        },
      });
    await requireDb().execute(
      sql`UPDATE jobs SET heartbeat_at = now() - interval '5 minutes' WHERE id = ${id}`,
    );
    await worker.processOne();
    const all = await listDmJobs(requireDb(), w.sessionId, 10, "turn");
    expect(all.find((j) => j.id === id)?.status).toBe("failed");
    const notice = (await readRows(w)).find(
      (r) =>
        r.type === "talk" &&
        r.visibility === "dm" &&
        (r.payload as { text: string }).text.includes("abandoned"),
    );
    expect(notice).toBeDefined();
  });

  it("appends the failure notice when a turn fails", async () => {
    const w = await createWorld({ calls: [] });
    const { worker } = workerFor(w);
    await startScene(w);
    await commitAction(w, "Tamsin knocks.", "act-knock");
    await tick();
    await worker.drain();
    const turn = (await listDmJobs(requireDb(), w.sessionId, 10, "turn")).find(
      (j) => j.status === "failed",
    );
    expect(turn?.error).toMatch(/^stopped at /);
    const notice = (await readRows(w)).find(
      (r) =>
        r.type === "talk" &&
        (r.payload as { text: string }).text.startsWith(
          "The DM runtime stopped",
        ),
    );
    expect(notice).toBeDefined();
  });
});

describe.skipIf(!reachable)("DM worker failure record (database)", () => {
  it("keeps the schema issues, purpose and excerpts of an invalid director output", async () => {
    const bad = { beat: { decision: "resolve" }, tableMode: "stay" };
    const w = await createWorld({
      calls: [
        { purpose: "dm.director", respond: { type: "json", value: bad } },
        { purpose: "dm.director", respond: { type: "json", value: bad } },
      ],
    });
    const { worker } = workerFor(w);
    await startScene(w);
    await commitAction(w, "Tamsin knocks.", "act-knock");
    await tick();
    await worker.drain();
    const turn = (await listDmJobs(requireDb(), w.sessionId, 10, "turn")).find(
      (j) => j.status === "failed",
    );
    expect(turn?.error).toBe("stopped at director: invalid-output");
    const result = turn?.result as {
      failure: {
        node: string;
        kind: string;
        detail: {
          purpose: string;
          promptVersion: string;
          issues: string;
          attempts: { attempt: number; chars: number; excerpt: string }[];
        };
      };
    };
    expect(result.failure).toMatchObject({
      node: "director",
      kind: "invalid-output",
      detail: { purpose: "dm.director" },
    });
    expect(result.failure.detail.issues).not.toBe("");
    expect(result.failure.detail.attempts.map((a) => a.attempt)).toEqual([
      1, 2,
    ]);
    expect(result.failure.detail.attempts[0]?.excerpt).toContain("resolve");

    // The operator route shows calls for the failed turn, never the record.
    const [user] = await requireDb()
      .insert(users)
      .values({
        username: `test-${randomUUID()}`,
        displayName: "Test Operator",
        role: "operator",
        passwordHash: "unused",
      })
      .returning({ id: users.id });
    const session = await createSession(
      requireDb(),
      (user as { id: string }).id,
    );
    const app = createApp({
      databaseProbe: { reachable: async () => true },
      db: requireDb(),
      dm: { nudge: () => {} },
    });
    const res = await app.request(`/dm/sessions/${w.sessionId}/turns?limit=5`, {
      headers: { cookie: `session=${session.token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain("excerpt");
    const item = (
      JSON.parse(body) as { turns: Record<string, unknown>[] }
    ).turns.find((t) => t.id === turn?.id);
    expect(item?.calls).not.toEqual([]);
    expect(item).not.toHaveProperty("failure");
  });
});

describe.skipIf(!reachable)("DM enqueuer on approvals (database)", () => {
  const row = (type: string, payload: unknown, seq: number) => ({
    sessionId: "",
    seq,
    actor: "x",
    type,
    payload,
    payloadVersion: 1,
    visibility: "dm",
    ts: "2026-10-26T00:00:00.000Z",
  });

  it("enqueues a turn when an ai:dm proposal is approved or rejected, not another proposer's", async () => {
    const sessionId = randomUUID();
    const loadProjections = async () =>
      ({
        proposals: [
          { proposalId: "p-dm", proposer: "ai:dm" },
          { proposalId: "p-human", proposer: TAMSIN_USER },
        ],
      }) as never;
    const enqueuer = createDmEnqueuer({
      db: requireDb(),
      nudge: () => {},
      loadProjections,
    });
    await enqueuer.onAppended(sessionId, [
      row("proposal.approved", { proposalId: "p-human", batchId: null }, 3),
    ] as never);
    expect(await listDmJobs(requireDb(), sessionId, 10)).toHaveLength(0);

    await enqueuer.onAppended(sessionId, [
      row("proposal.rejected", { proposalId: "p-dm", reason: null }, 4),
    ] as never);
    const queued = await listDmJobs(requireDb(), sessionId, 10);
    expect(queued).toHaveLength(1);
    expect(
      (queued[0] as unknown as { input: { trigger: string } }).input.trigger,
    ).toBe("approval");
  });
});

const holdDirector = {
  purpose: "dm.director",
  respond: {
    type: "json",
    value: {
      beat: { decision: "hold", companions: ["odo"], reason: "ask Odo" },
      tableMode: { to: "stay" },
      trackers: [],
      scene: { status: "continue" },
      pacing: { tension: "low", spotlight: null, beatId: "ferry-house" },
      goalNote: "",
      companionPrompts: [],
    },
  },
};

describe.skipIf(!reachable)("DM worker usage ledger (database)", () => {
  it("a held turn keeps its calls and has ledger rows", async () => {
    const w = await createWorld({ calls: [holdDirector] });
    const { worker } = workerFor(w);
    await startScene(w);
    await commitAction(w, "Tamsin asks the party.", "act-ask");
    await tick();
    await worker.processOne();
    const turn = (await listDmJobs(requireDb(), w.sessionId, 10, "turn"))[0];
    expect(turn?.status).toBe("succeeded");
    const result = turn?.result as {
      outcome: { status: string };
      calls: {
        purpose: string;
        provider: string | null;
        model: string | null;
      }[];
    };
    expect(result.outcome.status).toBe("held");
    expect(result.calls.map((c) => c.purpose)).toEqual(["dm.director"]);
    expect(result.calls[0]?.provider).not.toBeNull();
    const rows = (
      await listModelCalls(requireDb(), w.sessionId, { after: 0, limit: 50 })
    ).rows;
    expect(rows.map((r) => [r.jobId, r.purpose, r.outcome])).toEqual([
      [turn?.id, "dm.director", "ok"],
    ]);
  });

  it("a failed ledger insert still finishes the job and logs dm.call.record-failed", async () => {
    const w = await createWorld({ calls: [holdDirector] });
    const lines: Record<string, unknown>[] = [];
    const { worker } = workerFor(w, { log: (l) => lines.push(l) });
    await startScene(w);
    // A trigger scoped to this session makes every insert for it fail.
    const fn = `fail_dm_calls_${w.sessionId.replace(/-/g, "")}`;
    await requireDb().execute(
      sql.raw(`CREATE FUNCTION ${fn}() RETURNS trigger AS $$ BEGIN
        IF NEW.session_id = '${w.sessionId}' THEN RAISE EXCEPTION 'ledger down'; END IF;
        RETURN NEW; END; $$ LANGUAGE plpgsql`),
    );
    await requireDb().execute(
      sql.raw(
        `CREATE TRIGGER ${fn} BEFORE INSERT ON dm_model_calls FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
      ),
    );
    try {
      await commitAction(w, "Tamsin asks the party.", "act-ask");
      await tick();
      await worker.processOne();
    } finally {
      await requireDb().execute(
        sql.raw(`DROP TRIGGER ${fn} ON dm_model_calls`),
      );
      await requireDb().execute(sql.raw(`DROP FUNCTION ${fn}()`));
    }
    const turn = (await listDmJobs(requireDb(), w.sessionId, 10, "turn"))[0];
    expect(turn?.status).toBe("succeeded");
    expect(
      lines.find((l) => l.event === "dm.call.record-failed"),
    ).toMatchObject({ jobId: turn?.id, purpose: "dm.director" });
    expect(
      (await listModelCalls(requireDb(), w.sessionId, { after: 0, limit: 50 }))
        .rows,
    ).toEqual([]);
  });

  it("an aborted attempt leaves an aborted row; the reclaim's rows carry the higher job_attempt", async () => {
    const s = script("exploration-check.json");
    const w = await createWorld({
      dice: s.dice,
      calls: [
        ...s.calls,
        {
          purpose: "dm.chronicle",
          respond: { type: "json", value: { entries: [] } },
        },
      ],
    });
    const base = w.ctx().deps.gateway;
    let first = true;
    const gateway = {
      chat(req: Parameters<typeof base.chat>[0]) {
        if (!first) return base.chat(req);
        first = false;
        return (async function* () {
          // The lease is lost mid-call: the heartbeat aborts the signal.
          await requireDb().execute(
            sql`UPDATE jobs SET claim_token = gen_random_uuid()
                WHERE session_id = ${w.sessionId} AND kind = 'turn' AND status = 'running'`,
          );
          while (!req.signal?.aborted) await tick();
          yield { type: "text" as const, text: "" };
        })();
      },
    };
    const { worker } = workerFor(w, { gateway, heartbeatMs: 20 });
    await startScene(w);
    await commitAction(
      w,
      "I search the ferry-house for whoever cut the bell rope.",
      "act-search",
    );
    await tick();
    await worker.processOne(); // aborted: the job stays running
    await requireDb().execute(
      sql`UPDATE jobs SET heartbeat_at = now() - interval '5 minutes'
          WHERE session_id = ${w.sessionId} AND kind = 'turn' AND status = 'running'`,
    );
    await drainAll(worker);
    const rows = (
      await listModelCalls(requireDb(), w.sessionId, { after: 0, limit: 50 })
    ).rows.filter((r) => r.jobKind === "turn");
    expect(rows[0]).toMatchObject({
      purpose: "dm.director",
      outcome: "aborted",
      jobAttempt: 1,
      provider: null,
    });
    const later = rows.slice(1);
    expect(later.length).toBeGreaterThan(0);
    expect(
      later.every((r) => r.jobAttempt === 2 && r.outcome !== "aborted"),
    ).toBe(true);
  });

  it("a companion job's calls carry usage and have ledger rows", async () => {
    const w = await createWorld({
      calls: [
        holdDirector,
        {
          purpose: "dm.companion",
          respond: {
            type: "json",
            value: { say: null, comment: null, act: null },
          },
        },
        {
          purpose: "dm.director",
          respond: { type: "json", value: holdDirector.respond.value },
        },
      ],
    });
    const { worker } = workerFor(w);
    await startScene(w);
    await commitAction(w, "Tamsin asks the party.", "act-ask");
    await tick();
    await worker.processOne(); // the held turn; queues a companion job
    await worker.processOne(); // the companion job
    const jobsAll = await listDmJobs(requireDb(), w.sessionId, 20);
    const companion = jobsAll.find((j) => j.kind === "companion");
    expect(companion?.status).toBe("succeeded");
    const companionResult = companion?.result as unknown as {
      calls: { provider: string | null; inputTokens: number | null }[];
    };
    const stored = companionResult.calls;
    expect(stored).toHaveLength(1);
    expect(stored[0]?.provider).not.toBeNull();
    expect(stored[0]?.inputTokens).not.toBeNull();
    const ledger = (
      await listModelCalls(requireDb(), w.sessionId, { after: 0, limit: 50 })
    ).rows.filter((r) => r.jobId === companion?.id);
    expect(ledger.map((r) => [r.jobKind, r.purpose])).toEqual([
      ["companion", "dm.companion"],
    ]);
  });
});
