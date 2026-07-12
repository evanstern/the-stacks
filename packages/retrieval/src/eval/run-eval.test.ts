/**
 * T027 (010 US4): the harness executor, TDD'd before run-eval.ts exists.
 * Doctrine under test (data-model.md, contracts/metrics.md):
 *  - an eval run PINS its gold snapshot at creation — re-labeling afterwards
 *    changes nothing retroactively;
 *  - every question executes as a REAL engine search leaving its own
 *    origin:"eval" receipt;
 *  - per-slice metrics land on the run row; unresolvable items are reported,
 *    never silently scored as misses;
 *  - status transitions running → completed exactly once.
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

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("eval runs", () => {
  let db: Database;
  let close: () => Promise<void>;
  let corpusId: string;

  beforeAll(async () => {
    const client = createDbClient(
      // TASK-8: this suite's own database.
      await ensureSuiteDatabase(DATABASE_URL, "retrieval_eval"),
    );
    db = client.db;
    close = () => client.pool.end();
    await runMigrations(db);
    const fixture = await seedFixtureCorpus(db);
    corpusId = fixture.corpusId;
    for (const gold of FIXTURE_GOLD) {
      await createGoldItem(db, {
        corpusId,
        question: gold.question,
        chunkIds: gold.expectedChunkIds,
        split: gold.split,
      });
    }
  });

  afterAll(async () => {
    await close();
  });

  it("executes the gold set, records per-slice metrics, and leaves origin-eval receipts", async () => {
    const config = resolveRetrievalConfig({}, { configName: "rrf-default" });
    const evalRunId = await createEvalRun(db, { corpusId, config });

    const created = await db.execute<{ status: string; gold_snapshot: unknown[] }>(
      sql`SELECT status, gold_snapshot FROM eval_runs WHERE id = ${evalRunId}`,
    );
    expect(created.rows[0]!.status).toBe("running");
    expect(created.rows[0]!.gold_snapshot).toHaveLength(FIXTURE_GOLD.length);

    await executeEvalRun({ db, embedQuery: fixtureQueryEmbedder }, evalRunId);

    const done = await db.execute<{
      status: string;
      metrics: {
        tuning: { items: number; recallAt5: number; recallAt10: number; mrr: number; ndcgAt10: number };
        heldout: { items: number; recallAt5: number };
        unresolvableCount: number;
      };
      retrieval_run_ids: string[];
      config_name: string;
    }>(sql`SELECT status, metrics, retrieval_run_ids, config_name FROM eval_runs WHERE id = ${evalRunId}`);
    const run = done.rows[0]!;
    expect(run.status).toBe("completed");
    expect(run.config_name).toBe("rrf-default");
    expect(run.metrics.unresolvableCount).toBe(0);
    // The fixture is constructed so term questions hit via FTS and
    // paraphrases via the vector map — the tuning slice must be strong.
    expect(run.metrics.tuning.items).toBe(9);
    expect(run.metrics.heldout.items).toBe(3);
    expect(run.metrics.tuning.recallAt10).toBeGreaterThanOrEqual(0.8);
    expect(run.metrics.heldout.recallAt5).toBeGreaterThanOrEqual(2 / 3);

    // One receipt per question, all origin "eval".
    expect(run.retrieval_run_ids).toHaveLength(FIXTURE_GOLD.length);
    const origins = await db.execute<{ origin: string; n: number }>(
      sql`SELECT origin, count(*)::int AS n FROM retrieval_runs GROUP BY origin`,
    );
    expect(origins.rows).toEqual([{ origin: "eval", n: FIXTURE_GOLD.length }]);
  });

  it("the gold snapshot pins history: re-labeling after the run changes nothing", async () => {
    const config = resolveRetrievalConfig({}, { configName: "pin-check" });
    const evalRunId = await createEvalRun(db, { corpusId, config });
    const before = await db.execute<{ gold_snapshot: Array<{ question: string }> }>(
      sql`SELECT gold_snapshot FROM eval_runs WHERE id = ${evalRunId}`,
    );

    // "Re-label" brutally: rewrite every gold question in place.
    await db.execute(sql`UPDATE gold_items SET question = 'REWRITTEN'`);

    const after = await db.execute<{ gold_snapshot: Array<{ question: string }> }>(
      sql`SELECT gold_snapshot FROM eval_runs WHERE id = ${evalRunId}`,
    );
    expect(after.rows[0]!.gold_snapshot).toEqual(before.rows[0]!.gold_snapshot);
    expect(after.rows[0]!.gold_snapshot.some((i) => i.question === "REWRITTEN")).toBe(false);

    // Restore for later tests (execute against the pinned snapshot still works).
    await executeEvalRun({ db, embedQuery: fixtureQueryEmbedder }, evalRunId);
    const done = await db.execute<{ status: string }>(
      sql`SELECT status FROM eval_runs WHERE id = ${evalRunId}`,
    );
    expect(done.rows[0]!.status).toBe("completed");
  });

  it("reports swept expected passages as unresolvable, never as misses", async () => {
    // Sweep fx-glyphs' text out of the current generation: label an item
    // against it first, then rewrite the chunk content in place (the hash
    // dies even though the chunk id survives — hash matching is the point).
    const [item] = await db.execute<{ id: string }>(
      sql`SELECT id FROM chunks WHERE id = 'fx-glyphs'`,
    ).then((r) => r.rows);
    expect(item).toBeTruthy();
    await createGoldItem(db, {
      corpusId,
      question: "warding glyph materials",
      chunkIds: ["fx-glyphs"],
      split: "tuning",
    });
    await db.execute(sql`UPDATE chunks SET content = 'Glyph rules rewritten.' WHERE id = 'fx-glyphs'`);

    const config = resolveRetrievalConfig({}, { configName: "unresolvable-check" });
    const evalRunId = await createEvalRun(db, { corpusId, config });
    await executeEvalRun({ db, embedQuery: fixtureQueryEmbedder }, evalRunId);

    const done = await db.execute<{
      metrics: { unresolvableCount: number };
      item_outcomes: Array<{ status: string }>;
    }>(sql`SELECT metrics, item_outcomes FROM eval_runs WHERE id = ${evalRunId}`);
    expect(done.rows[0]!.metrics.unresolvableCount).toBe(1);
    expect(done.rows[0]!.item_outcomes.filter((o) => o.status === "unresolvable")).toHaveLength(1);
  });
});
