/**
 * T031 (010 US4): the deterministic CI floor — SC-004 as a running test.
 * This suite is `pnpm verify`'s retrieval-correctness tripwire: it seeds the
 * synthetic fixture corpus (deterministic embeddings, zero network beyond
 * Postgres), runs the REAL harness in-process under `fixture-baseline`, and
 * asserts the pinned floor. Breaking fusion, the reader predicate, metric
 * math, or candidate SQL moves these numbers — and fails the build naming
 * what regressed.
 *
 * The floors are the 2026-07-11 fixture-construction values (probe logged
 * in the eval report). They are FLOORS, not snapshots: a change that
 * IMPROVES ranking passes; one that degrades it does not. Changing the
 * fixture or the embedding generator legitimately moves them — do it
 * deliberately, in the same commit, with the eval report updated.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDbClient,
  ensureSuiteDatabase,
  runMigrations,
  type Database,
} from "@stacks/db";

import { resolveRetrievalConfig } from "../config";
import { createGoldItem } from "../gold";
import { createEvalRun, executeEvalRun } from "./run-eval";
import { FIXTURE_GOLD, fixtureQueryEmbedder, seedFixtureCorpus } from "./fixture/corpus";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5542/stacks_v3";

interface SliceRow {
  items: number;
  recallAt5: number;
  recallAt10: number;
  mrr: number;
  ndcgAt10: number;
}

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("deterministic CI floor (SC-004)", () => {
  let db: Database;
  let close: () => Promise<void>;
  let tuning: SliceRow;
  let heldout: SliceRow;
  let unresolvableCount: number;

  beforeAll(async () => {
    const client = createDbClient(
      // TASK-8: this suite's own database.
      await ensureSuiteDatabase(DATABASE_URL, "retrieval_ci_floor"),
    );
    db = client.db;
    close = () => client.pool.end();
    await runMigrations(db);
    const fixture = await seedFixtureCorpus(db);
    for (const gold of FIXTURE_GOLD) {
      await createGoldItem(db, {
        corpusId: fixture.corpusId,
        question: gold.question,
        chunkIds: gold.expectedChunkIds,
        split: gold.split,
      });
    }
    const evalRunId = await createEvalRun(db, {
      corpusId: fixture.corpusId,
      // Floor pinned at 0.3 (not the shipped 0.2 default): the fixture's
      // hash embeddings put unrelated text ~0.2–0.3, so this deterministic
      // math-proving corpus is calibrated to 0.3 — decoupled from the
      // real-corpus operational default on purpose (TASK-10; eval report).
      config: resolveRetrievalConfig({}, { configName: "fixture-baseline", minSimilarity: 0.3 }),
    });
    await executeEvalRun({ db, embedQuery: fixtureQueryEmbedder }, evalRunId);
    const row = await db.execute<{
      metrics: { tuning: SliceRow; heldout: SliceRow; unresolvableCount: number };
    }>(sql`SELECT metrics FROM eval_runs WHERE id = ${evalRunId}`);
    ({ tuning, heldout, unresolvableCount } = row.rows[0]!.metrics);
    // The probe line CI logs on every run — regressions name themselves.
    console.log(
      `[ci-floor] tuning r@5=${tuning.recallAt5.toFixed(3)} r@10=${tuning.recallAt10.toFixed(3)} ` +
        `mrr=${tuning.mrr.toFixed(3)} ndcg=${tuning.ndcgAt10.toFixed(3)} · ` +
        `heldout r@5=${heldout.recallAt5.toFixed(3)} mrr=${heldout.mrr.toFixed(3)}`,
    );
  });

  afterAll(async () => {
    await close();
  });

  it("evaluates every fixture item (none unresolvable, both slices populated)", () => {
    expect(unresolvableCount).toBe(0);
    expect(tuning.items).toBe(9);
    expect(heldout.items).toBe(3);
  });

  it("tuning slice holds the pinned floor", () => {
    expect(tuning.recallAt5).toBeGreaterThanOrEqual(0.85);
    expect(tuning.recallAt10).toBeGreaterThanOrEqual(0.85);
    expect(tuning.mrr).toBeGreaterThanOrEqual(0.8);
    expect(tuning.ndcgAt10).toBeGreaterThanOrEqual(0.75);
  });

  it("held-out slice holds the pinned floor (the paraphrase channel)", () => {
    expect(heldout.recallAt5).toBeGreaterThanOrEqual(0.99);
    expect(heldout.mrr).toBeGreaterThanOrEqual(0.99);
  });
});
