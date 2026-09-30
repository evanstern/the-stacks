// SSR render suite against the built server bundle (plan D13). Run
// `pnpm --filter @the-stacks/web build` first — turbo.json wires this test
// task to depend on the build task, so a bare `pnpm test` builds first too.

import assert from "node:assert/strict";
import { test } from "node:test";
import { handle } from "../build/server/index.js";

/**
 * A stub StacksLoadContext (plan D2) — no server, no cookie, no database.
 * `jobs()` mirrors the real rule (null for no user or a non-operator) and
 * counts its own calls, so a test can assert it was never touched (T020).
 */
function stubContext(user, jobsList = []) {
  let jobsCallCount = 0;
  return {
    identity: async () => user,
    async jobs() {
      jobsCallCount += 1;
      if (user?.role !== "operator") return null;
      return jobsList;
    },
    get jobsCallCount() {
      return jobsCallCount;
    },
  };
}

test("/ signed out shows the sign-in form", async () => {
  const res = await handle(new Request("http://localhost/"), stubContext(null));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<form/);
});

test("/ as operator redirects to /ask", async () => {
  const res = await handle(
    new Request("http://localhost/"),
    stubContext({ id: "u1", displayName: "Ada Lovelace", role: "operator" }),
  );
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/ask");
});

test("/ as player redirects to /play", async () => {
  const res = await handle(
    new Request("http://localhost/"),
    stubContext({ id: "u2", displayName: "Rin", role: "player" }),
  );
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/play");
});

test("/ask signed in shows the display name", async () => {
  const res = await handle(
    new Request("http://localhost/ask"),
    stubContext({ id: "u1", displayName: "Ada Lovelace", role: "operator" }),
  );
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Ada Lovelace/);
});

test("cookie stacks-theme=dark sets data-theme on <html>", async () => {
  const res = await handle(
    new Request("http://localhost/ask", {
      headers: { cookie: "stacks-theme=dark" },
    }),
    stubContext({ id: "u1", displayName: "Ada Lovelace", role: "operator" }),
  );
  const html = await res.text();
  assert.match(html, /<html[^>]*data-theme="dark"/);
});

test("cookie stacks-sidebar=collapsed sets data-sidebar on the shell", async () => {
  const res = await handle(
    new Request("http://localhost/ask", {
      headers: { cookie: "stacks-sidebar=collapsed" },
    }),
    stubContext({ id: "u1", displayName: "Ada Lovelace", role: "operator" }),
  );
  const html = await res.text();
  assert.match(html, /data-sidebar="collapsed"/);
});

test("no UI cookie sets neither data-theme nor data-sidebar", async () => {
  const res = await handle(
    new Request("http://localhost/ask"),
    stubContext({ id: "u1", displayName: "Ada Lovelace", role: "operator" }),
  );
  const html = await res.text();
  assert.doesNotMatch(html, /data-theme="/);
  assert.doesNotMatch(html, /data-sidebar="/);
});

test("/books as operator with one embedded job shows Ready and the book", async () => {
  const job = {
    id: "j1",
    book: "Basic Rules",
    status: "succeeded",
    stage: null,
    format: "markdown",
    filename: "basic-rules.md",
    bytes: 1024,
    attempts: 1,
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    heartbeatAt: null,
    result: {
      documentId: "d1",
      chunkCount: 10,
      pages: 5,
      embedding: { status: "embedded", model: "bge-m3", count: 10 },
    },
    error: null,
  };
  const res = await handle(
    new Request("http://localhost/books"),
    stubContext({ id: "u1", displayName: "Ada Lovelace", role: "operator" }, [
      job,
    ]),
  );
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Ready/);
  assert.match(html, /Basic Rules/);
});

test("/books as operator with no jobs shows FR-015's empty text", async () => {
  const res = await handle(
    new Request("http://localhost/books"),
    stubContext(
      { id: "u1", displayName: "Ada Lovelace", role: "operator" },
      [],
    ),
  );
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(
    html,
    /Your library is empty\. Upload your first book to start asking questions\./,
  );
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
