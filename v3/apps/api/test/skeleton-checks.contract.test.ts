import { createDbClient, runMigrations, skeletonCheckRuns, skeletonVectors } from "@stacks/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5442/stacks_v3";
const PASSWORD = "correct-password";
const SESSION_SECRET = "a".repeat(32);

// Requires the compose Postgres (v3/docker-compose.yml) reachable at DATABASE_URL —
// the accept-then-enqueue path is transactional against real tables (T033).
describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("skeleton-checks contract", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let close: () => Promise<void>;
  let cookie: string;

  beforeAll(async () => {
    const { db, pool } = createDbClient(DATABASE_URL);
    close = () => pool.end();
    await runMigrations(db);

    app = await buildApp({
      db,
      pool,
      operatorPasswordHash: bcrypt.hashSync(PASSWORD, 10),
      sessionSecret: SESSION_SECRET,
      sessionCookieSecure: false,
    });
    await app.ready();

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: PASSWORD },
    });
    cookie = String(login.headers["set-cookie"]).split(";")[0];
  });

  afterAll(async () => {
    await app.close();
    await close();
  });

  beforeEach(async () => {
    await app.deps.pool.query(
      "TRUNCATE TABLE skeleton_check_events, skeleton_check_runs, jobs, skeleton_vectors CASCADE",
    );
  });

  it("POST creates a run and enqueues a job, returning 202 accepted", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/skeleton-checks",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.run.status).toBe("accepted");
    expect(body.run.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.run.createdAt).toBeTruthy();
  });

  it("GET unknown id is 404 unknown_thing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/skeleton-checks/00000000-0000-0000-0000-000000000000",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: { code: "unknown_thing", message: expect.any(String) },
    });
  });

  it("GET list returns runs newest-first", async () => {
    const first = await app.inject({ method: "POST", url: "/api/skeleton-checks", headers: { cookie } });
    const second = await app.inject({ method: "POST", url: "/api/skeleton-checks", headers: { cookie } });

    const list = await app.inject({ method: "GET", url: "/api/skeleton-checks", headers: { cookie } });

    expect(list.statusCode).toBe(200);
    const { runs } = list.json();
    expect(runs.length).toBeGreaterThanOrEqual(2);
    expect(runs[0].id).toBe(second.json().run.id);
    expect(runs[1].id).toBe(first.json().run.id);
    expect(Object.keys(runs[0]).sort()).toEqual(["completedAt", "createdAt", "id", "status"].sort());
  });

  it("GET detail includes the events array and omits outcome/vector while accepted", async () => {
    const created = await app.inject({ method: "POST", url: "/api/skeleton-checks", headers: { cookie } });
    const { id } = created.json().run;

    const detail = await app.inject({
      method: "GET",
      url: `/api/skeleton-checks/${id}`,
      headers: { cookie },
    });

    expect(detail.statusCode).toBe(200);
    const { run } = detail.json();
    expect(run.status).toBe("accepted");
    expect(Array.isArray(run.events)).toBe(true);
    expect(run.events[0]).toMatchObject({ seam: "queued", ok: true });
    expect(run.outcome).toBeUndefined();
    expect(run.vector).toBeUndefined();
  });

  it("GET detail on a succeeded run includes the vector block and omits outcome", async () => {
    const created = await app.inject({ method: "POST", url: "/api/skeleton-checks", headers: { cookie } });
    const { id } = created.json().run;
    const { db } = app.deps;

    await db.insert(skeletonVectors).values({
      id: "test-vector-id",
      content: "fixture",
      embedding: [0.1, 0.2, 0.3, 0.4],
      embeddingProvider: "local-sidecar",
      embeddingModel: "test-model",
      embeddingDimensions: 4,
    });
    await db
      .update(skeletonCheckRuns)
      .set({
        status: "succeeded",
        vectorId: "test-vector-id",
        readbackDistance: 0,
        completedAt: new Date(),
      })
      .where(sql`${skeletonCheckRuns.id} = ${id}`);

    const detail = await app.inject({
      method: "GET",
      url: `/api/skeleton-checks/${id}`,
      headers: { cookie },
    });

    expect(detail.statusCode).toBe(200);
    const { run } = detail.json();
    expect(run.status).toBe("succeeded");
    expect(run.vector).toEqual({
      id: "test-vector-id",
      provider: "local-sidecar",
      model: "test-model",
      dimensions: 4,
      readbackDistance: 0,
    });
    expect(run.outcome).toBeUndefined();
  });

  it("GET detail on a failed run includes the outcome and omits the vector block", async () => {
    const created = await app.inject({ method: "POST", url: "/api/skeleton-checks", headers: { cookie } });
    const { id } = created.json().run;
    const { db } = app.deps;

    await db
      .update(skeletonCheckRuns)
      .set({
        status: "failed",
        outcome: { class: "dependency_down", seam: "inference", message: "Inference sidecar is not ready." },
        completedAt: new Date(),
      })
      .where(sql`${skeletonCheckRuns.id} = ${id}`);

    const detail = await app.inject({
      method: "GET",
      url: `/api/skeleton-checks/${id}`,
      headers: { cookie },
    });

    expect(detail.statusCode).toBe(200);
    const { run } = detail.json();
    expect(run.status).toBe("failed");
    expect(run.outcome).toEqual({
      class: "dependency_down",
      seam: "inference",
      message: "Inference sidecar is not ready.",
    });
    expect(run.vector).toBeUndefined();
  });
});
