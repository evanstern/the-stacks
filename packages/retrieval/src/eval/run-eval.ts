/**
 * The harness executor (spec 010 US4, research R7). Split in two on purpose:
 *
 *   createEvalRun   — snapshot the gold set, insert the run row as
 *                     `running`. Called by the API before enqueueing the
 *                     D12 job, so the operator sees the run exist the
 *                     moment they asked for it.
 *   executeEvalRun  — the slow half, run by the worker (or in-process by
 *                     the deterministic CI slice): every snapshot question
 *                     executes as a REAL engine search (origin "eval",
 *                     leaving its own receipt), metrics per
 *                     contracts/metrics.md land on the row, status flips to
 *                     completed|failed EXACTLY once.
 *
 * The snapshot is the history pin: re-labeling gold items after the run
 * can't rewrite what this measurement measured. Resolvability is evaluated
 * at execution time by content hash — a swept expected passage reports
 * `unresolvable`, excluded from every denominator (never a silent miss).
 */
import { sql } from "drizzle-orm";

import { DomainError } from "@stacks/core";
import { evalRuns, goldItems, type Database } from "@stacks/db";

import type { ResolvedRetrievalConfig } from "../config";
import type { ExpectedPassage } from "../gold";
import { searchCorpus, type QueryEmbedder } from "../search";
import { computeMetrics, type EvalItemInput } from "./metrics";

interface GoldSnapshotItem {
  id: string;
  question: string;
  expected: ExpectedPassage[];
  split: "tuning" | "heldout";
}

export interface CreateEvalRunInput {
  corpusId: string;
  config: ResolvedRetrievalConfig;
}

export async function createEvalRun(db: Database, input: CreateEvalRunInput): Promise<string> {
  const items = await db
    .select({
      id: goldItems.id,
      question: goldItems.question,
      expected: goldItems.expected,
      split: goldItems.split,
    })
    .from(goldItems)
    .where(sql`${goldItems.corpusId} = ${input.corpusId}`)
    .orderBy(sql`${goldItems.createdAt} ASC`);
  if (items.length === 0) {
    throw new DomainError({
      class: "invalid_input",
      message: "The gold set is empty — label at least one item before running an eval.",
    });
  }
  const [row] = await db
    .insert(evalRuns)
    .values({
      corpusId: input.corpusId,
      config: input.config,
      configName: input.config.configName,
      goldSnapshot: items,
      status: "running",
    })
    .returning({ id: evalRuns.id });
  return row!.id;
}

export interface EvalDeps {
  db: Database;
  embedQuery: QueryEmbedder;
  /** Wired by the worker when the reranker role is live; eval configs with
   *  rerank on fail honestly without it (same rule as interactive search). */
  rerank?: import("../rerank-client").RerankScorer;
}

export async function executeEvalRun(deps: EvalDeps, evalRunId: string): Promise<void> {
  const { db } = deps;
  const rows = await db.select().from(evalRuns).where(sql`${evalRuns.id} = ${evalRunId}`);
  const run = rows[0];
  if (!run) {
    throw new DomainError({ class: "unknown_thing", message: `No eval run ${evalRunId}.` });
  }
  if (run.status !== "running") {
    // Exactly-once discipline: a completed measurement is history, and a
    // failed one is retried as a NEW run so no receipt is ever overwritten.
    throw new DomainError({
      class: "invalid_input",
      message: `Eval run ${evalRunId} is ${run.status}; runs execute exactly once.`,
    });
  }
  const snapshot = run.goldSnapshot as GoldSnapshotItem[];
  const config = run.config as ResolvedRetrievalConfig;

  try {
    // Resolvability at execution time, one query for every expected hash:
    // which of them still exist at their source's current generation?
    const allHashes = [...new Set(snapshot.flatMap((i) => i.expected.map((e) => e.contentSha256)))];
    const liveRows = await db.execute<{ hash: string }>(sql`
      SELECT DISTINCT encode(sha256(convert_to(c.content, 'UTF8')), 'hex') AS hash
      FROM chunks c JOIN sources s ON s.id = c.source_id
      WHERE c.generation = s.current_generation
        AND encode(sha256(convert_to(c.content, 'UTF8')), 'hex') IN
            (${sql.join(allHashes.map((h) => sql`${h}`), sql`, `)})
    `);
    const liveHashes = new Set(liveRows.rows.map((r) => r.hash));

    const evalInputs: EvalItemInput[] = [];
    const retrievalRunIds: string[] = [];
    for (const item of snapshot) {
      const search = await searchCorpus(deps, {
        corpusId: run.corpusId,
        query: item.question,
        config,
        origin: "eval",
      });
      retrievalRunIds.push(search.runId);
      evalInputs.push({
        goldItemId: item.id,
        split: item.split,
        expectedHashes: item.expected.map((e) => e.contentSha256),
        resultHashes: search.results.map((r) => r.contentSha256),
        unresolvable: item.expected.some((e) => !liveHashes.has(e.contentSha256)),
      });
    }

    const metrics = computeMetrics(evalInputs);
    await db
      .update(evalRuns)
      .set({
        status: "completed",
        metrics: {
          tuning: metrics.slices.tuning,
          heldout: metrics.slices.heldout,
          unresolvableCount: metrics.unresolvableCount,
        },
        itemOutcomes: metrics.itemOutcomes,
        retrievalRunIds,
        completedAt: sql`now()`,
      })
      .where(sql`${evalRuns.id} = ${evalRunId}`);
  } catch (error) {
    // Scrubbed on the row (renderable in the UI); full diagnostics belong to
    // the worker's logs (FR-018 lineage).
    await db
      .update(evalRuns)
      .set({
        status: "failed",
        error: error instanceof DomainError ? error.message : "Eval run failed.",
        completedAt: sql`now()`,
      })
      .where(sql`${evalRuns.id} = ${evalRunId}`);
    throw error;
  }
}
