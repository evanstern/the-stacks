import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createSession } from "../../src/auth/session.js";
import { listDmJobs } from "../../src/dm/jobs.js";
import { insertModelCall } from "../../src/dm/model-calls.js";
import { finishJob } from "../../src/jobs/queue.js";
import { users } from "../../src/schema/auth.js";
import { jobs } from "../../src/schema/jobs.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
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

loudSkip("routes.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

async function cookieFor(role: "operator" | "player") {
  const [row] = await requireDb()
    .insert(users)
    .values({
      username: `test-${randomUUID()}`,
      displayName: "Test User",
      role,
      passwordHash: "unused",
    })
    .returning({ id: users.id });
  const session = await createSession(requireDb(), (row as { id: string }).id);
  return {
    cookie: `session=${session.token}`,
    userId: (row as { id: string }).id,
  };
}

function appWith(nudges: { count: number }) {
  return createApp({
    databaseProbe: { reachable: async () => true },
    db: requireDb(),
    dm: {
      nudge: () => {
        nudges.count += 1;
      },
    },
  });
}

const post = (
  app: ReturnType<typeof appWith>,
  path: string,
  cookie: string | null,
  body?: unknown,
) =>
  app.request(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const get = (
  app: ReturnType<typeof appWith>,
  path: string,
  cookie: string | null,
) => app.request(path, { headers: cookie ? { cookie } : {} });

describe.skipIf(!reachable)("DM routes (database)", () => {
  it("starts a scene: 202 and a scene-start job; a second start is 409", async () => {
    const nudges = { count: 0 };
    const app = appWith(nudges);
    const { cookie, userId } = await cookieFor("operator");
    const sessionId = randomUUID();
    const body = { seedId: "greyhollow-ford", seats: { tamsin: userId } };

    const before = await get(app, `/dm/sessions/${sessionId}/start`, cookie);
    expect(before.status).toBe(200);
    expect(await before.json()).toEqual({ state: "none" });

    const first = await post(
      app,
      `/dm/sessions/${sessionId}/start`,
      cookie,
      body,
    );
    expect(first.status).toBe(202);
    const { jobId } = (await first.json()) as { jobId: string };
    const jobs = await listDmJobs(requireDb(), sessionId, 10, "turn");
    expect(jobs.map((j) => j.id)).toEqual([jobId]);
    const input = jobs[0]?.input as unknown as {
      trigger: string;
      start: { seedId: string };
    };
    expect(input.trigger).toBe("scene-start");
    expect(input.start.seedId).toBe("greyhollow-ford");
    expect(nudges.count).toBe(1);

    const queued = await get(app, `/dm/sessions/${sessionId}/start`, cookie);
    expect(await queued.json()).toEqual({ state: "queued" });

    const second = await post(
      app,
      `/dm/sessions/${sessionId}/start`,
      cookie,
      body,
    );
    expect(second.status).toBe(409);
    const secondJson = (await second.json()) as {
      error: { kind: string; message: string };
    };
    expect(secondJson.error.kind).toBe("conflict");
    expect(secondJson.error.message).toBe("A scene start is already queued.");
  });

  it("GET start: 401 with no cookie, 403 for a player, 400 for a bad session id", async () => {
    const app = appWith({ count: 0 });
    const operatorAuth = await cookieFor("operator");
    const playerAuth = await cookieFor("player");
    const sessionId = randomUUID();
    const none = await get(app, `/dm/sessions/${sessionId}/start`, null);
    expect(none.status).toBe(401);
    const forbidden = await get(
      app,
      `/dm/sessions/${sessionId}/start`,
      playerAuth.cookie,
    );
    expect(forbidden.status).toBe(403);
    const bad = await get(
      app,
      "/dm/sessions/not-a-uuid/start",
      operatorAuth.cookie,
    );
    expect(bad.status).toBe(400);
  });

  it("a session with a committed scene reads started and its start is 409", async () => {
    const app = appWith({ count: 0 });
    const { cookie, userId } = await cookieFor("operator");
    const w = await createWorld();
    await startScene(w);
    const state = await get(app, `/dm/sessions/${w.sessionId}/start`, cookie);
    expect(await state.json()).toEqual({ state: "started" });
    const res = await post(app, `/dm/sessions/${w.sessionId}/start`, cookie, {
      seedId: "greyhollow-ford",
      seats: { tamsin: userId },
    });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { message: string } };
    expect(json.error.message).toBe("The session already has a scene.");
  });

  it("rejects a bad seed id with 400 and issues", async () => {
    const app = appWith({ count: 0 });
    const { cookie, userId } = await cookieFor("operator");
    const res = await post(app, `/dm/sessions/${randomUUID()}/start`, cookie, {
      seedId: "no-such-seed",
      seats: { tamsin: userId },
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: { kind: string; issues: unknown[] };
    };
    expect(json.error.kind).toBe("validation");
    expect(json.error.issues.length).toBeGreaterThan(0);
  });

  it("rejects seats that do not match the seed's human characters", async () => {
    const app = appWith({ count: 0 });
    const { cookie, userId } = await cookieFor("operator");
    const res = await post(app, `/dm/sessions/${randomUUID()}/start`, cookie, {
      seedId: "greyhollow-ford",
      seats: { tamsin: userId, odo: userId },
    });
    expect(res.status).toBe(400);
  });

  it("GET /dm/seeds lists seeds for the operator only", async () => {
    const app = appWith({ count: 0 });
    const op = await cookieFor("operator");
    const player = await cookieFor("player");
    const res = await app.request("/dm/seeds", {
      headers: { cookie: op.cookie },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      seeds: {
        seedId: string;
        title: string;
        humans: { characterId: string; name: string }[];
        companions: { characterId: string; name: string }[];
      }[];
    };
    expect(json.seeds.map((s) => s.seedId)).toEqual([
      "greyhollow-ford",
      "greyhollow-ford-duo",
      "greyhollow-ford-reed-camp",
      "greyhollow-ford-trio",
    ]);
    for (const s of json.seeds) {
      expect(Object.keys(s).sort()).toEqual([
        "companions",
        "humans",
        "seedId",
        "title",
      ]);
    }
    expect(json.seeds[1]?.humans.map((h) => h.characterId)).toEqual([
      "tamsin",
      "kestrel",
    ]);
    expect(json.seeds[3]?.humans.map((h) => h.characterId)).toEqual([
      "tamsin",
      "odo",
      "kestrel",
    ]);
    expect(json.seeds[3]?.companions).toEqual([]);
    expect(
      (await app.request("/dm/seeds", { headers: { cookie: player.cookie } }))
        .status,
    ).toBe(403);
    expect((await app.request("/dm/seeds")).status).toBe(401);
  });

  it("refuses one user in two seats and accepts two users", async () => {
    const nudges = { count: 0 };
    const app = appWith(nudges);
    const { cookie, userId } = await cookieFor("operator");
    const other = await cookieFor("player");
    const sessionId = randomUUID();
    const dup = await post(app, `/dm/sessions/${sessionId}/start`, cookie, {
      seedId: "greyhollow-ford-duo",
      seats: { tamsin: userId, kestrel: userId },
    });
    expect(dup.status).toBe(400);
    const json = (await dup.json()) as {
      error: { issues: { path: string; message: string }[] };
    };
    expect(json.error.issues).toEqual([
      { path: "seats.kestrel", message: "A user can hold only one seat." },
    ]);
    expect(await listDmJobs(requireDb(), sessionId, 10, "turn")).toHaveLength(
      0,
    );
    const ok = await post(app, `/dm/sessions/${sessionId}/start`, cookie, {
      seedId: "greyhollow-ford-duo",
      seats: { tamsin: userId, kestrel: other.userId },
    });
    expect(ok.status).toBe(202);
  });

  it("trio start: one user in two seats is 400 and queues nothing; three users are 202", async () => {
    const nudges = { count: 0 };
    const app = appWith(nudges);
    const { cookie, userId } = await cookieFor("operator");
    const second = await cookieFor("player");
    const third = await cookieFor("player");
    const sessionId = randomUUID();
    const dup = await post(app, `/dm/sessions/${sessionId}/start`, cookie, {
      seedId: "greyhollow-ford-trio",
      seats: { tamsin: userId, odo: second.userId, kestrel: second.userId },
    });
    expect(dup.status).toBe(400);
    const json = (await dup.json()) as {
      error: { issues: { path: string; message: string }[] };
    };
    expect(json.error.issues).toEqual([
      { path: "seats.kestrel", message: "A user can hold only one seat." },
    ]);
    expect(await listDmJobs(requireDb(), sessionId, 10, "turn")).toHaveLength(
      0,
    );
    const ok = await post(app, `/dm/sessions/${sessionId}/start`, cookie, {
      seedId: "greyhollow-ford-trio",
      seats: { tamsin: userId, odo: second.userId, kestrel: third.userId },
    });
    expect(ok.status).toBe(202);
  });

  it("turn: 202 and a manual turn job", async () => {
    const app = appWith({ count: 0 });
    const { cookie } = await cookieFor("operator");
    const sessionId = randomUUID();
    const res = await post(app, `/dm/sessions/${sessionId}/turn`, cookie);
    expect(res.status).toBe(202);
    const jobs = await listDmJobs(requireDb(), sessionId, 10, "turn");
    expect(jobs).toHaveLength(1);
    const manual = jobs[0]?.input as { trigger: string } | undefined;
    expect(manual?.trigger).toBe("manual");
  });

  it("turns: lists records without prose", async () => {
    const app = appWith({ count: 0 });
    const { cookie } = await cookieFor("operator");
    const sessionId = randomUUID();
    const res0 = await post(app, `/dm/sessions/${sessionId}/turn`, cookie);
    const { jobId } = (await res0.json()) as { jobId: string };
    const [claimed] = await requireDb()
      .execute(
        sql`UPDATE jobs SET status='running', claim_token=gen_random_uuid(), heartbeat_at=now() WHERE id=${jobId} RETURNING claim_token AS "claimToken"`,
      )
      .then((r) => r.rows as { claimToken: string }[]);
    await finishJob(
      requireDb(),
      { id: jobId, claimToken: (claimed as { claimToken: string }).claimToken },
      {
        result: {
          checkpoint: { secret: "PROMPT TEXT MUST NOT LEAK" },
          outcome: { status: "completed" },
          audit: {
            attempts: [],
            final: "passed",
            flagged: false,
            shippedProseSha256: "ab",
          },
          calls: [
            {
              purpose: "dm.director",
              promptVersion: "dm.director-v2",
              attempt: 1,
              outcome: "ok",
              errorKind: null,
              provider: "scripted",
              model: "scripted-chat",
              inputTokens: 10,
              outputTokens: 5,
              costUsd: null,
              durationMs: 12,
            },
          ],
        },
      },
    );

    const res = await app.request(`/dm/sessions/${sessionId}/turns?limit=5`, {
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("PROMPT TEXT MUST NOT LEAK");
    const json = JSON.parse(text) as {
      turns: {
        id: string;
        kind: string;
        status: string;
        trigger: string;
        outcome: string;
        audit: { final: string };
        calls: { purpose: string }[];
      }[];
    };
    expect(json.turns).toHaveLength(1);
    expect(json.turns[0]).toMatchObject({
      id: jobId,
      kind: "turn",
      status: "succeeded",
      trigger: "manual",
      outcome: "completed",
    });
    expect(json.turns[0]?.audit.final).toBe("passed");
    expect(json.turns[0]?.calls[0]?.purpose).toBe("dm.director");
  });

  it("401 with no session and 403 for a player on every route", async () => {
    const app = appWith({ count: 0 });
    const player = await cookieFor("player");
    const sessionId = randomUUID();
    const body = {
      seedId: "greyhollow-ford",
      seats: { tamsin: player.userId },
    };
    for (const [method, path] of [
      ["POST", `/dm/sessions/${sessionId}/start`],
      ["POST", `/dm/sessions/${sessionId}/turn`],
      ["GET", `/dm/sessions/${sessionId}/turns`],
    ] as const) {
      const init = (cookie: string | null) => ({
        method,
        headers: {
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: method === "POST" ? JSON.stringify(body) : undefined,
      });
      expect((await app.request(path, init(null))).status).toBe(401);
      expect((await app.request(path, init(player.cookie))).status).toBe(403);
    }
  });
});

// --- Operator debug routes (specs/037-debug-api contracts/debug-api.md) ---

const MARKER = "SCRIPTED-OUTPUT-MARKER-7f3a";
const getJson = async (
  app: ReturnType<typeof appWith>,
  path: string,
  cookie: string,
) => {
  const res = await app.request(path, { headers: { cookie } });
  const text = await res.text();
  return { status: res.status, text, json: JSON.parse(text) as never };
};

const DEBUG_ROUTES = ["events", "jobs", "seed", "calls"] as const;

describe.skipIf(!reachable)("DM debug routes (database)", () => {
  it("401 with no session and 403 for a player, before query validation", async () => {
    const app = appWith({ count: 0 });
    const player = await cookieFor("player");
    const sessionId = randomUUID();
    for (const name of DEBUG_ROUTES) {
      // An invalid query and an invalid session id: refusal still wins.
      for (const path of [
        `/dm/sessions/${sessionId}/${name}?after=nope&limit=0&before=x`,
        `/dm/sessions/not-a-uuid/${name}`,
      ]) {
        expect((await app.request(path)).status).toBe(401);
        const res = await app.request(path, {
          headers: { cookie: player.cookie },
        });
        expect(res.status).toBe(403);
      }
    }
  });

  it("events: every visibility, paged once each, empty poll at the head", async () => {
    const app = appWith({ count: 0 });
    const { cookie } = await cookieFor("operator");
    const w = await createWorld();
    await startScene(w);
    await commitAction(w, "Tamsin knocks.", "act-knock");
    const all = await readRows(w);
    expect(all.length).toBeGreaterThan(3);
    const base = `/dm/sessions/${w.sessionId}/events`;

    const full = await getJson(app, base, cookie);
    expect(full.status).toBe(200);
    const body = full.json as {
      events: { seq: number; visibility: string }[];
      nextAfter: number;
      hasMore: boolean;
      headSeq: number;
    };
    expect(body.events.map((e) => e.seq)).toEqual(all.map((e) => e.seq));
    expect(body.events.map((e) => e.visibility)).toEqual(
      all.map((e) => e.visibility),
    );
    expect(new Set(body.events.map((e) => e.visibility)).size).toBeGreaterThan(
      1,
    );
    expect(body.hasMore).toBe(false);
    expect(body.headSeq).toBe(all.at(-1)?.seq);
    expect(body.nextAfter).toBe(body.headSeq);

    const seen: number[] = [];
    let after = 0;
    for (let i = 0; i < 50; i++) {
      const page = (
        await getJson(app, `${base}?after=${after}&limit=2`, cookie)
      ).json as typeof body;
      expect(page.events.length).toBeLessThanOrEqual(2);
      seen.push(...page.events.map((e) => e.seq));
      after = page.nextAfter;
      if (!page.hasMore) break;
    }
    expect(seen).toEqual(all.map((e) => e.seq));

    const head = (await getJson(app, `${base}?after=${body.headSeq}`, cookie))
      .json as typeof body;
    expect(head.events).toEqual([]);
    expect(head.nextAfter).toBe(body.headSeq);
    expect(head.hasMore).toBe(false);
    expect(head.headSeq).toBe(body.headSeq);

    for (const q of ["after=-1", "after=x", "limit=0", "limit=1001"]) {
      expect((await getJson(app, `${base}?${q}`, cookie)).status).toBe(400);
    }

    const empty = (
      await getJson(app, `/dm/sessions/${randomUUID()}/events`, cookie)
    ).json as typeof body;
    expect(empty).toMatchObject({
      events: [],
      nextAfter: 0,
      hasMore: false,
      headSeq: 0,
    });
  });

  it("jobs: stored input and result unchanged, paged without gap, no claim token", async () => {
    const app = appWith({ count: 0 });
    const { cookie } = await cookieFor("operator");
    const sessionId = randomUUID();
    const t0 = Date.now() - 60_000;
    const mk = (
      i: number,
      kind: "turn" | "companion" | "chronicle",
      status: string,
      result: unknown,
      extra: Record<string, unknown> = {},
    ) => ({
      id: randomUUID(),
      kind,
      sessionId,
      status,
      attempts: 1,
      input: { v: 1, sessionId, marker: `in-${i}` },
      result,
      createdAt: new Date(t0 + i * 1000),
      ...extra,
    });
    const completed = mk(0, "turn", "succeeded", {
      checkpoint: { beat: ["a"], submissions: [{ seqs: [3] }] },
      outcome: { status: "completed" },
      audit: null,
      calls: [{ purpose: "dm.director", provider: "scripted" }],
    });
    const held = mk(1, "turn", "succeeded", {
      checkpoint: { beat: ["a"] },
      outcome: { status: "held" },
      audit: null,
      calls: [{ purpose: "dm.director" }],
    });
    const failed = mk(
      2,
      "chronicle",
      "failed",
      { checkpoint: {}, failure: { node: "x" }, calls: [] },
      { error: "stopped at director: invalid-output" },
    );
    const running = mk(
      3,
      "turn",
      "running",
      { checkpoint: { beat: ["b"], director: { saved: true } } },
      {
        stage: "narrate",
        claimToken: randomUUID(),
        heartbeatAt: new Date(t0 + 5000),
        startedAt: new Date(t0 + 3000),
      },
    );
    const queued = mk(4, "companion", "queued", null);
    const rows = [completed, held, failed, running, queued];
    await requireDb()
      .insert(jobs)
      .values(rows as never);
    const stored = new Map<string, (typeof rows)[number]>(
      rows.map((r) => [r.id as string, r]),
    );

    const base = `/dm/sessions/${sessionId}/jobs`;
    const first = await getJson(app, base, cookie);
    expect(first.status).toBe(200);
    expect(first.text).not.toContain("claimToken");
    expect(first.text).not.toContain("claim_token");
    const page = first.json as {
      jobs: {
        id: string;
        input: unknown;
        result: unknown;
        heartbeatAt: string | null;
        stage: string | null;
        error: string | null;
      }[];
      nextBefore: string | null;
    };
    expect(page.jobs.map((j) => j.id)).toEqual(
      [queued, running, failed, held, completed].map((r) => r.id),
    );
    expect(page.nextBefore).toBeNull();
    for (const j of page.jobs) {
      const row = stored.get(j.id);
      expect(j.input).toEqual(row?.input);
      expect(j.result).toEqual(row?.result ?? null);
    }
    const run = page.jobs.find((j) => j.id === running.id);
    expect(run?.stage).toBe("narrate");
    expect(run?.heartbeatAt).toBe(new Date(t0 + 5000).toISOString());
    expect(run?.result).toEqual({
      checkpoint: { beat: ["b"], director: { saved: true } },
    });
    expect(page.jobs.find((j) => j.id === failed.id)?.error).toBe(
      "stopped at director: invalid-output",
    );

    // Paging: limit 2 returns every job once, in order.
    const seen: string[] = [];
    let before: string | null = null;
    for (let i = 0; i < 10; i++) {
      const q: string = before
        ? `${base}?limit=2&before=${before}`
        : `${base}?limit=2`;
      const p = (await getJson(app, q, cookie)).json as typeof page;
      seen.push(...p.jobs.map((j) => j.id));
      before = p.nextBefore;
      if (!before) break;
    }
    expect(seen).toEqual(page.jobs.map((j) => j.id));

    // A foreign or unknown before id is 400.
    const otherSession = randomUUID();
    const foreign = mk(0, "turn", "succeeded", null);
    await requireDb()
      .insert(jobs)
      .values({ ...foreign, sessionId: otherSession } as never);
    for (const id of [foreign.id, randomUUID()]) {
      expect((await getJson(app, `${base}?before=${id}`, cookie)).status).toBe(
        400,
      );
    }
    expect((await getJson(app, `${base}?before=nope`, cookie)).status).toBe(
      400,
    );
    expect((await getJson(app, `${base}?limit=201`, cookie)).status).toBe(400);
  });

  it("seed: 404 without a scene, 200 with DM-only paths", async () => {
    const app = appWith({ count: 0 });
    const { cookie } = await cookieFor("operator");
    const none = await getJson(
      app,
      `/dm/sessions/${randomUUID()}/seed`,
      cookie,
    );
    expect(none.status).toBe(404);

    const w = await createWorld();
    await startScene(w);
    const res = await getJson(app, `/dm/sessions/${w.sessionId}/seed`, cookie);
    expect(res.status).toBe(200);
    const body = res.json as {
      seedId: string;
      seed: { goal: { success: string } };
      dmOnlyPaths: string[];
    };
    expect(body.seedId).toBe("greyhollow-ford");
    expect(body.dmOnlyPaths).toContain("/goal/success");
    expect(body.seed.goal.success.length).toBeGreaterThan(0);
  });

  it("calls: rows after a cursor and whole-session totals", async () => {
    const app = appWith({ count: 0 });
    const { cookie } = await cookieFor("operator");
    const sessionId = randomUUID();
    const jobId = randomUUID();
    await requireDb()
      .insert(jobs)
      .values({
        id: jobId,
        kind: "turn",
        sessionId,
        status: "succeeded",
        attempts: 1,
        input: { v: 1 },
      });
    const bind = { jobId, sessionId, jobKind: "turn" as const, jobAttempt: 1 };
    const base = {
      promptVersion: "dm.director-v2",
      attempt: 1,
      outcome: "ok" as const,
      errorKind: null,
      provider: "scripted",
      model: "scripted-chat",
      httpAttempts: 1,
    };
    for (const [purpose, cost] of [
      ["dm.director", 0.25],
      ["dm.narrate", 0.5],
      ["dm.companion", null],
    ] as const) {
      await insertModelCall(requireDb(), bind, {
        ...base,
        purpose,
        inputTokens: 10,
        outputTokens: 5,
        costUsd: cost,
        durationMs: 20,
      });
    }
    const url = `/dm/sessions/${sessionId}/calls`;
    const all = (await getJson(app, url, cookie)).json as {
      calls: { id: number; purpose: string; at: string }[];
      nextAfter: number;
      hasMore: boolean;
      totals: {
        all: { calls: number; costUsd: number; unpricedCalls: number };
        byPurpose: Record<string, unknown>;
        byModel: Record<string, { calls: number }>;
      };
    };
    expect(all.calls.map((c) => c.purpose)).toEqual([
      "dm.director",
      "dm.narrate",
      "dm.companion",
    ]);
    expect(all.nextAfter).toBe(all.calls[2]?.id);

    const second = (
      await getJson(app, `${url}?after=${all.calls[0]?.id}&limit=1`, cookie)
    ).json as typeof all;
    expect(second.calls.map((c) => c.purpose)).toEqual(["dm.narrate"]);
    expect(second.hasMore).toBe(true);
    expect(second.nextAfter).toBe(all.calls[1]?.id);
    // Totals cover the whole session, not the page.
    expect(second.totals.all).toMatchObject({
      calls: 3,
      costUsd: 0.75,
      unpricedCalls: 1,
    });
    expect(second.totals.byModel["scripted/scripted-chat"]?.calls).toBe(3);
    expect(Object.keys(second.totals.byPurpose).sort()).toEqual([
      "dm.companion",
      "dm.director",
      "dm.narrate",
    ]);
    expect((await getJson(app, `${url}?limit=1001`, cookie)).status).toBe(400);
  });

  it("no debug response carries scripted model text outside failure excerpts", async () => {
    const bad = {
      beat: { decision: "resolve" },
      tableMode: "stay",
      note: MARKER,
    };
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
    await drainAll(worker);

    const app = appWith({ count: 0 });
    const { cookie } = await cookieFor("operator");
    const bodies: Record<string, string> = {};
    for (const name of DEBUG_ROUTES) {
      const res = await getJson(
        app,
        `/dm/sessions/${w.sessionId}/${name}`,
        cookie,
      );
      expect(res.status).toBe(200);
      bodies[name] = res.text;
    }
    bodies.turns = (
      await getJson(app, `/dm/sessions/${w.sessionId}/turns`, cookie)
    ).text;
    // The ledger has the failed turn's director attempts.
    expect(
      (JSON.parse(bodies.calls as string) as { calls: unknown[] }).calls,
    ).toHaveLength(2);
    for (const name of ["events", "seed", "calls", "turns"]) {
      expect(bodies[name]).not.toContain(MARKER);
    }
    // The jobs route holds it only inside failure.detail.attempts[].excerpt.
    const jobsBody = JSON.parse(bodies.jobs as string) as {
      jobs: { result: unknown }[];
    };
    expect(bodies.jobs).toContain(MARKER);
    const strip = (v: unknown): unknown =>
      JSON.parse(
        JSON.stringify(v, (k, val) => (k === "excerpt" ? "<excerpt>" : val)),
      );
    expect(JSON.stringify(strip(jobsBody))).not.toContain(MARKER);
    const failed = jobsBody.jobs.find(
      (j) => (j.result as { failure?: unknown } | null)?.failure,
    ) as {
      result: { failure: { detail: { attempts: { excerpt: string }[] } } };
    };
    expect(
      failed.result.failure.detail.attempts.some((a) =>
        a.excerpt.includes(MARKER),
      ),
    ).toBe(true);
  });

  it("/turns still carries only purpose, promptVersion and outcome per call", async () => {
    const app = appWith({ count: 0 });
    const { cookie } = await cookieFor("operator");
    const sessionId = randomUUID();
    await requireDb()
      .insert(jobs)
      .values({
        kind: "turn",
        sessionId,
        status: "succeeded",
        attempts: 1,
        input: { v: 1, trigger: "manual" },
        result: {
          outcome: { status: "completed" },
          audit: null,
          calls: [
            {
              purpose: "dm.director",
              promptVersion: "dm.director-v2",
              attempt: 1,
              outcome: "ok",
              errorKind: null,
              provider: "scripted",
              model: "scripted-chat",
              inputTokens: 1,
              outputTokens: 2,
              costUsd: 0.1,
              durationMs: 3,
            },
          ],
        },
      });
    const { json } = await getJson(
      app,
      `/dm/sessions/${sessionId}/turns`,
      cookie,
    );
    const turns = (json as { turns: { calls: object[]; seqs?: unknown }[] })
      .turns;
    expect(Object.keys(turns[0]?.calls[0] ?? {}).sort()).toEqual([
      "outcome",
      "promptVersion",
      "purpose",
    ]);
    expect(Object.keys(turns[0] ?? {}).sort()).toEqual([
      "attempts",
      "audit",
      "calls",
      "createdAt",
      "error",
      "finishedAt",
      "id",
      "kind",
      "outcome",
      "stage",
      "status",
      "trigger",
    ]);
  });
});
