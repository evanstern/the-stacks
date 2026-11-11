import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  insertModelCall,
  listModelCalls,
  modelCallTotals,
} from "../../src/dm/model-calls.js";
import type { RecordedCall } from "../../src/dm/pipeline/context.js";
import { dmModelCalls } from "../../src/schema/dm-model-calls.js";
import { jobs } from "../../src/schema/jobs.js";
import { db, loudSkip, reachable, requireDb } from "./world.js";

loudSkip("model-calls.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

const SCRIPTED_TEXT =
  "The ferry-house door creaks open onto a lantern-lit room.";

const call = (over: Partial<RecordedCall> = {}): RecordedCall => ({
  purpose: "dm.director",
  promptVersion: "director-v1",
  attempt: 1,
  outcome: "ok",
  errorKind: null,
  provider: "scripted",
  model: "scripted-chat",
  inputTokens: 100,
  outputTokens: 20,
  costUsd: 0.5,
  durationMs: 40,
  httpAttempts: 1,
  ...over,
});

async function makeJob(sessionId: string): Promise<string> {
  const id = randomUUID();
  await requireDb()
    .insert(jobs)
    .values({
      id,
      kind: "turn",
      sessionId,
      status: "running",
      attempts: 1,
      input: { v: 1 },
    });
  return id;
}

describe.skipIf(!reachable)("usage ledger (database)", () => {
  it("stores only metadata columns, never model text", async () => {
    const sessionId = randomUUID();
    const jobId = await makeJob(sessionId);
    await insertModelCall(
      requireDb(),
      { jobId, sessionId, jobKind: "turn", jobAttempt: 1 },
      call(),
    );
    const [row] = (
      await listModelCalls(requireDb(), sessionId, { after: 0, limit: 10 })
    ).rows;
    expect(Object.keys(row ?? {}).sort()).toEqual(
      [
        "id",
        "jobId",
        "sessionId",
        "jobKind",
        "jobAttempt",
        "purpose",
        "promptVersion",
        "callAttempt",
        "outcome",
        "errorKind",
        "provider",
        "model",
        "inputTokens",
        "outputTokens",
        "costUsd",
        "durationMs",
        "httpAttempts",
        "createdAt",
      ].sort(),
    );
    expect(JSON.stringify(row)).not.toContain(SCRIPTED_TEXT);
  });

  it("stores and reads back a truncated outcome", async () => {
    const sessionId = randomUUID();
    const jobId = await makeJob(sessionId);
    await insertModelCall(
      requireDb(),
      { jobId, sessionId, jobKind: "turn", jobAttempt: 1 },
      call({ outcome: "truncated" }),
    );
    const [row] = (
      await listModelCalls(requireDb(), sessionId, { after: 0, limit: 10 })
    ).rows;
    expect(row?.outcome).toBe("truncated");
  });

  it("stores and reads back a schema-mismatch outcome", async () => {
    const sessionId = randomUUID();
    const jobId = await makeJob(sessionId);
    await insertModelCall(
      requireDb(),
      { jobId, sessionId, jobKind: "turn", jobAttempt: 1 },
      call({ outcome: "schema-mismatch" }),
    );
    const [row] = (
      await listModelCalls(requireDb(), sessionId, { after: 0, limit: 10 })
    ).rows;
    expect(row?.outcome).toBe("schema-mismatch");
  });

  it("pages by after, and totals cover the whole session with unpriced calls", async () => {
    const sessionId = randomUUID();
    const jobId = await makeJob(sessionId);
    const bind = { jobId, sessionId, jobKind: "turn" as const, jobAttempt: 1 };
    await insertModelCall(requireDb(), bind, call());
    await insertModelCall(
      requireDb(),
      bind,
      call({ purpose: "dm.narrate", costUsd: null, inputTokens: null }),
    );
    await insertModelCall(
      requireDb(),
      bind,
      call({
        purpose: "dm.companion",
        provider: null,
        model: null,
        costUsd: null,
        inputTokens: null,
        outputTokens: null,
        durationMs: null,
        outcome: "aborted",
      }),
    );

    const first = await listModelCalls(requireDb(), sessionId, {
      after: 0,
      limit: 2,
    });
    expect(first.rows).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const lastId = first.rows.at(-1)?.id ?? 0;
    const rest = await listModelCalls(requireDb(), sessionId, {
      after: lastId,
      limit: 2,
    });
    expect(rest.rows).toHaveLength(1);
    expect(rest.hasMore).toBe(false);
    expect(rest.rows[0]?.purpose).toBe("dm.companion");

    const totals = await modelCallTotals(requireDb(), sessionId);
    expect(totals.all).toEqual({
      calls: 3,
      inputTokens: 100,
      outputTokens: 40,
      costUsd: 0.5,
      unpricedCalls: 2,
      durationMs: 80,
    });
    expect(Object.keys(totals.byPurpose).sort()).toEqual([
      "dm.companion",
      "dm.director",
      "dm.narrate",
    ]);
    expect(totals.byModel["scripted/scripted-chat"]?.calls).toBe(2);
    expect(totals.byModel.unknown?.calls).toBe(1);
  });

  it("returns empty totals for an unknown session", async () => {
    const totals = await modelCallTotals(requireDb(), randomUUID());
    expect(totals.all.calls).toBe(0);
    expect(totals.byPurpose).toEqual({});
  });

  it("deletes its rows with the job", async () => {
    const sessionId = randomUUID();
    const jobId = await makeJob(sessionId);
    await insertModelCall(
      requireDb(),
      { jobId, sessionId, jobKind: "turn", jobAttempt: 1 },
      call(),
    );
    await requireDb().delete(jobs).where(eq(jobs.id, jobId));
    const left = await requireDb()
      .select()
      .from(dmModelCalls)
      .where(eq(dmModelCalls.sessionId, sessionId));
    expect(left).toEqual([]);
  });
});
