import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createSession } from "../../src/auth/session.js";
import { listDmJobs } from "../../src/dm/jobs.js";
import { finishJob } from "../../src/jobs/queue.js";
import { users } from "../../src/schema/auth.js";
import { clearDmJobsBeforeEach } from "./worker-world.js";
import { db, loudSkip, reachable, requireDb } from "./world.js";

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

describe.skipIf(!reachable)("DM routes (database)", () => {
  it("starts a scene: 202 and a scene-start job; a second start is 409", async () => {
    const nudges = { count: 0 };
    const app = appWith(nudges);
    const { cookie, userId } = await cookieFor("operator");
    const sessionId = randomUUID();
    const body = { seedId: "greyhollow-ford", seats: { tamsin: userId } };

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

    const second = await post(
      app,
      `/dm/sessions/${sessionId}/start`,
      cookie,
      body,
    );
    expect(second.status).toBe(409);
    expect(
      ((await second.json()) as { error: { kind: string } }).error.kind,
    ).toBe("conflict");
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
