import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { DbClient } from "../auth/session.js";
import { type DmModelCallRow, dmModelCalls } from "../schema/dm-model-calls.js";
import type { RecordedCall } from "./pipeline/context.js";

/**
 * The usage ledger (specs/037-debug-api data-model.md): one `dm_model_calls`
 * row per DM model attempt. Code only inserts; no row holds prompt or
 * completion text.
 */

export interface ModelCallBinding {
  jobId: string;
  sessionId: string;
  jobKind: "turn" | "companion" | "chronicle";
  jobAttempt: number;
}

export async function insertModelCall(
  db: DbClient,
  binding: ModelCallBinding,
  call: RecordedCall,
): Promise<void> {
  await db.insert(dmModelCalls).values({
    jobId: binding.jobId,
    sessionId: binding.sessionId,
    jobKind: binding.jobKind,
    jobAttempt: binding.jobAttempt,
    purpose: call.purpose,
    promptVersion: call.promptVersion,
    callAttempt: call.attempt,
    outcome: call.outcome,
    errorKind: call.errorKind,
    provider: call.provider,
    model: call.model,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
    costUsd: call.costUsd,
    durationMs: call.durationMs,
    httpAttempts: call.httpAttempts,
  });
}

export interface ModelCallPage {
  rows: DmModelCallRow[];
  hasMore: boolean;
}

/** Rows with `id > after`, ascending, at most `limit`. */
export async function listModelCalls(
  db: DbClient,
  sessionId: string,
  opts: { after: number; limit: number },
): Promise<ModelCallPage> {
  const rows = await db
    .select()
    .from(dmModelCalls)
    .where(
      and(
        eq(dmModelCalls.sessionId, sessionId),
        gt(dmModelCalls.id, opts.after),
      ),
    )
    .orderBy(asc(dmModelCalls.id))
    .limit(opts.limit + 1);
  const hasMore = rows.length > opts.limit;
  return { rows: hasMore ? rows.slice(0, opts.limit) : rows, hasMore };
}

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  unpricedCalls: number;
  durationMs: number;
}

export interface ModelCallTotals {
  all: UsageTotals;
  byPurpose: Record<string, UsageTotals>;
  byModel: Record<string, UsageTotals>;
}

const emptyTotals = (): UsageTotals => ({
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
  unpricedCalls: 0,
  durationMs: 0,
});

/** Totals over the whole session. Nulls count 0; a null cost counts as unpriced. */
export async function modelCallTotals(
  db: DbClient,
  sessionId: string,
): Promise<ModelCallTotals> {
  const rows = await db
    .select({
      purpose: dmModelCalls.purpose,
      provider: dmModelCalls.provider,
      model: dmModelCalls.model,
      calls: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${dmModelCalls.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${dmModelCalls.outputTokens}), 0)::int`,
      costUsd: sql<number>`coalesce(sum(${dmModelCalls.costUsd}), 0)::float8`,
      unpricedCalls: sql<number>`count(*) filter (where ${dmModelCalls.costUsd} is null)::int`,
      durationMs: sql<number>`coalesce(sum(${dmModelCalls.durationMs}), 0)::int`,
    })
    .from(dmModelCalls)
    .where(eq(dmModelCalls.sessionId, sessionId))
    .groupBy(dmModelCalls.purpose, dmModelCalls.provider, dmModelCalls.model);

  const totals: ModelCallTotals = {
    all: emptyTotals(),
    byPurpose: {},
    byModel: {},
  };
  const add = (into: UsageTotals, r: (typeof rows)[number]) => {
    into.calls += r.calls;
    into.inputTokens += r.inputTokens;
    into.outputTokens += r.outputTokens;
    into.costUsd += r.costUsd;
    into.unpricedCalls += r.unpricedCalls;
    into.durationMs += r.durationMs;
  };
  for (const r of rows) {
    add(totals.all, r);
    totals.byPurpose[r.purpose] ??= emptyTotals();
    add(totals.byPurpose[r.purpose] as UsageTotals, r);
    const key = r.provider && r.model ? `${r.provider}/${r.model}` : "unknown";
    totals.byModel[key] ??= emptyTotals();
    add(totals.byModel[key] as UsageTotals, r);
  }
  return totals;
}
