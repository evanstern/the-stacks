import assert from "node:assert/strict";
import { test } from "node:test";
import { createDebugClient } from "../../app/debug/client.ts";

const S = "sess-1";
function fake(responses) {
  const calls = [];
  const queue = [...responses];
  const f = async (url, init) => {
    calls.push({ url, init });
    const r = queue.shift();
    if (r instanceof Error) throw r;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body,
    };
  };
  return { f, calls };
}

test("each method builds the contract URL with same-origin credentials", async () => {
  const { f, calls } = fake(
    Array.from({ length: 6 }, () => ({ status: 200, body: {} })),
  );
  const c = createDebugClient(S, f);
  await c.events(7, 500);
  await c.jobs(50);
  await c.jobs(50, "job-9");
  await c.calls(3, 500);
  await c.seed();
  await c.retry();
  assert.deepEqual(
    calls.map((x) => [x.init.method, x.url]),
    [
      ["GET", "/dm/sessions/sess-1/events?after=7&limit=500"],
      ["GET", "/dm/sessions/sess-1/jobs?limit=50"],
      ["GET", "/dm/sessions/sess-1/jobs?limit=50&before=job-9"],
      ["GET", "/dm/sessions/sess-1/calls?after=3&limit=500"],
      ["GET", "/dm/sessions/sess-1/seed"],
      ["POST", "/dm/sessions/sess-1/turn"],
    ],
  );
  for (const x of calls) assert.equal(x.init.credentials, "same-origin");
});

test("401 and 403 are auth; 500 is http; a thrown fetch is network", async () => {
  const { f } = fake([
    { status: 401, body: {} },
    { status: 403, body: {} },
    { status: 500, body: { error: { message: "boom" } } },
    new Error("offline"),
  ]);
  const c = createDebugClient(S, f);
  assert.deepEqual(await c.events(0, 1), {
    ok: false,
    error: { kind: "auth", status: 401 },
  });
  assert.deepEqual(await c.events(0, 1), {
    ok: false,
    error: { kind: "auth", status: 403 },
  });
  assert.deepEqual(await c.events(0, 1), {
    ok: false,
    error: { kind: "http", status: 500, message: "boom" },
  });
  assert.deepEqual(await c.events(0, 1), {
    ok: false,
    error: { kind: "network" },
  });
});

test("seed: 200 reads ok, 404 none, 409 failed", async () => {
  const { f } = fake([
    { status: 200, body: { seedId: "s", seed: { a: 1 }, dmOnlyPaths: ["/a"] } },
    { status: 404, body: {} },
    { status: 409, body: {} },
  ]);
  const c = createDebugClient(S, f);
  const ok = await c.seed();
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, {
    kind: "ok",
    seedId: "s",
    seed: { a: 1 },
    dmOnlyPaths: ["/a"],
  });
  assert.deepEqual(await c.seed(), { ok: true, value: { kind: "none" } });
  assert.deepEqual(await c.seed(), { ok: true, value: { kind: "failed" } });
});

test("loadAllEvents and loadAllCalls loop while hasMore", async () => {
  const ev = (seq) => ({ seq });
  const { f, calls } = fake([
    {
      status: 200,
      body: { events: [ev(1), ev(2)], nextAfter: 2, hasMore: true, headSeq: 3 },
    },
    {
      status: 200,
      body: { events: [ev(3)], nextAfter: 3, hasMore: false, headSeq: 3 },
    },
    {
      status: 200,
      body: {
        calls: [{ id: 1 }],
        nextAfter: 1,
        hasMore: true,
        totals: { t: 1 },
      },
    },
    {
      status: 200,
      body: {
        calls: [{ id: 2 }],
        nextAfter: 2,
        hasMore: false,
        totals: { t: 2 },
      },
    },
  ]);
  const c = createDebugClient(S, f);
  const e = await c.loadAllEvents(0);
  assert.deepEqual(
    e.value.events.map((x) => x.seq),
    [1, 2, 3],
  );
  assert.equal(e.value.nextAfter, 3);
  assert.equal(e.value.hasMore, false);
  const k = await c.loadAllCalls(0);
  assert.deepEqual(
    k.value.calls.map((x) => x.id),
    [1, 2],
  );
  assert.deepEqual(k.value.totals, { t: 2 });
  assert.equal(calls[0].url, "/dm/sessions/sess-1/events?after=0&limit=1000");
  assert.equal(calls[1].url, "/dm/sessions/sess-1/events?after=2&limit=1000");
});

test("loadAllEvents stops at an error", async () => {
  const { f } = fake([{ status: 403, body: {} }]);
  const r = await createDebugClient(S, f).loadAllEvents(0);
  assert.equal(r.ok, false);
});
