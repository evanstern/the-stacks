// SSR render suite against the built server bundle (plan D13). Run
// `pnpm --filter @the-stacks/web build` first — turbo.json wires this test
// task to depend on the build task, so a bare `pnpm test` builds first too.

import assert from "node:assert/strict";
import { test } from "node:test";
import { handle } from "../build/server/index.js";

/** A stub StacksLoadContext (plan D2) — no server, no cookie, no database. */
function stubContext(user) {
  return { identity: async () => user };
}

test("/ signed out shows the sign-in form", async () => {
  const res = await handle(new Request("http://localhost/"), stubContext(null));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<form/);
});

test("/ signed in shows the display name", async () => {
  const res = await handle(
    new Request("http://localhost/"),
    stubContext({ id: "u1", displayName: "Ada Lovelace", role: "operator" }),
  );
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Ada Lovelace/);
});

test("/play/<uuid> shows the hydrate fallback and no event list", async () => {
  const sessionId = "11111111-1111-1111-1111-111111111111";
  const res = await handle(
    new Request(`http://localhost/play/${sessionId}`),
    stubContext({ id: "u1", displayName: "Ada Lovelace", role: "operator" }),
  );
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Loading…/);
  assert.doesNotMatch(html, /<ul>/);
});
