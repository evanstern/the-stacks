import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  fetchSeeds,
  issuesBySeat,
  postStart,
  seatMapIssues,
  startBody,
} from "../../app/play/start-scene.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const humans = [
  { characterId: "tamsin", name: "Tamsin Vale" },
  { characterId: "kestrel", name: "Kestrel" },
];

test("seatMapIssues flags each empty seat", () => {
  assert.deepEqual(seatMapIssues(humans, {}), [
    { path: "seats.tamsin", message: "A human seat needs a user." },
    { path: "seats.kestrel", message: "A human seat needs a user." },
  ]);
  assert.equal(seatMapIssues(humans, { tamsin: "u1", kestrel: "" }).length, 1);
});

test("seatMapIssues flags the later seat of a repeated user", () => {
  assert.deepEqual(seatMapIssues(humans, { tamsin: "u1", kestrel: "u1" }), [
    { path: "seats.kestrel", message: "A user can hold only one seat." },
  ]);
});

test("seatMapIssues is empty for a full distinct map", () => {
  assert.deepEqual(seatMapIssues(humans, { tamsin: "u1", kestrel: "u2" }), []);
});

test("startBody drops empty seats", () => {
  assert.deepEqual(startBody("duo", { tamsin: "u1", kestrel: "" }), {
    seedId: "duo",
    seats: { tamsin: "u1" },
  });
});

test("issuesBySeat maps seat paths to seats and the rest to the form", () => {
  assert.deepEqual(
    issuesBySeat([
      { path: "seats.tamsin", message: "A user can hold only one seat." },
      { path: "seedId", message: "Unknown seed." },
    ]),
    {
      bySeat: { tamsin: ["A user can hold only one seat."] },
      form: ["Unknown seed."],
    },
  );
});

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stub(fn) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push([url, init]);
    return fn();
  };
  return calls;
}

test("fetchSeeds reads GET /dm/seeds", async () => {
  const calls = stub(() => json(200, { seeds: [{ seedId: "a" }] }));
  assert.deepEqual(await fetchSeeds(), [{ seedId: "a" }]);
  assert.equal(calls[0][0], "/dm/seeds");
});

test("fetchSeeds throws on a refusal", async () => {
  stub(() => json(403, {}));
  await assert.rejects(fetchSeeds());
});

test("postStart posts the body and reports 202", async () => {
  const calls = stub(() => json(202, {}));
  const body = { seedId: "duo", seats: { tamsin: "u1" } };
  assert.deepEqual(await postStart("s1", body), { ok: true });
  const [url, init] = calls[0];
  assert.equal(url, "/dm/sessions/s1/start");
  assert.equal(init.method, "POST");
  assert.deepEqual(JSON.parse(init.body), body);
});

test("postStart returns the 400 issues and the 409 message", async () => {
  stub(() =>
    json(400, {
      error: {
        message: "bad",
        issues: [{ path: "seats.tamsin", message: "x" }],
      },
    }),
  );
  assert.deepEqual(await postStart("s1", { seedId: "d", seats: {} }), {
    ok: false,
    status: 400,
    issues: [{ path: "seats.tamsin", message: "x" }],
    message: "bad",
  });
  stub(() => json(409, { error: { message: "Scene running." } }));
  const r = await postStart("s1", { seedId: "d", seats: {} });
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
  assert.equal(r.message, "Scene running.");
});
