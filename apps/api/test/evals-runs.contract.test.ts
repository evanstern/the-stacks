/**
 * T030 (010 US4): eval-run routes, TDD'd first (contracts/api.md §4).
 * POST answers 202 accept-then-async (Principle IV): the row exists as
 * `running` and an eval_run job is on the D12 queue the moment the operator
 * asks; the worker does the slow half. Overrides here are the A/B mechanism
 * — validated by the same config guards as env.
 */
import bcrypt from "bcrypt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDbClient,
  ensureSuiteDatabase,
  runMigrations,
} from "@stacks/db";
import {
  createGoldItem,
  fixtureQueryEmbedder,
  resolveRetrievalConfig,
  seedFixtureCorpus,
  executeEvalRun,
  FIXTURE_GOLD,
} from "@stacks/retrieval";

import { buildApp } from "../src/app";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5542/stacks_v3";
const PASSWORD = "correct horse battery staple";

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("eval-run routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let close: () => Promise<void>;
  let cookie: string;

  beforeAll(async () => {
    const { db, pool } = createDbClient(
      // TASK-8: this suite's own database.
      await ensureSuiteDatabase(DATABASE_URL, "api_evals_runs"),
    );
    close = () => pool.end();
    await runMigrations(db);
    const fixture = await seedFixtureCorpus(db);
    for (const gold of FIXTURE_GOLD.slice(0, 5)) {
      await createGoldItem(db, {
        corpusId: fixture.corpusId,
        question: gold.question,
        chunkIds: gold.expectedChunkIds,
        split: gold.split,
      });
    }

    app = await buildApp({
      db,
      pool,
      operatorPasswordHash: bcrypt.hashSync(PASSWORD, 10),
      sessionSecret: "a".repeat(32),
      sessionCookieSecure: false,
      retrievalConfig: resolveRetrievalConfig({}),
    });
    await app.ready();
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: PASSWORD },
    });
    cookie = String(login.headers["set-cookie"]).split(";")[0]!;
  });

  afterAll(async () => {
    await app.close();
    await close();
  });

  it("202: creates the running row AND enqueues the eval_run job", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/evals/runs",
      payload: { configName: "rrf-default" },
      headers: { cookie },
    });
    expect(res.statusCode).toBe(202);
    const { evalRunId } = res.json();
    expect(evalRunId).toBeTruthy();

    const row = await app.deps.pool.query("SELECT status, config_name FROM eval_runs WHERE id = $1", [
      evalRunId,
    ]);
    expect(row.rows[0]).toMatchObject({ status: "running", config_name: "rrf-default" });

    const jobs = await app.deps.pool.query(
      "SELECT payload FROM jobs WHERE kind = 'eval_run' ORDER BY created_at DESC LIMIT 1",
    );
    expect(jobs.rows[0].payload).toEqual({ evalRunId });
  });

  it("overrides ride the same validation as env (bad override = 400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/evals/runs",
      payload: { configName: "bad", overrides: { k: 9999 } },
      headers: { cookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("invalid_input");
  });

  it("lists and details runs; a completed run carries per-slice metrics", async () => {
    // Complete one run in-process (the worker's job, done directly here).
    const created = await app.inject({
      method: "POST",
      url: "/api/evals/runs",
      payload: { configName: "detail-check" },
      headers: { cookie },
    });
    const { evalRunId } = created.json();
    await executeEvalRun({ db: app.deps.db, embedQuery: fixtureQueryEmbedder }, evalRunId);

    const list = await app.inject({ method: "GET", url: "/api/evals/runs", headers: { cookie } });
    expect(list.statusCode).toBe(200);
    expect(list.json().items.length).toBeGreaterThanOrEqual(2);

    const detail = await app.inject({
      method: "GET",
      url: `/api/evals/runs/${evalRunId}`,
      headers: { cookie },
    });
    expect(detail.statusCode).toBe(200);
    const body = detail.json();
    expect(body.status).toBe("completed");
    expect(body.metrics.tuning).toHaveProperty("recallAt10");
    expect(body.itemOutcomes.length).toBe(5);
    expect(body.retrievalRunIds.length).toBe(5);
  });

  it("404 unknown_thing for an absent eval run", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/evals/runs/00000000-0000-0000-0000-000000000000",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it("401 without a session", async () => {
    const res = await app.inject({ method: "POST", url: "/api/evals/runs", payload: {} });
    expect(res.statusCode).toBe(401);
  });
});
