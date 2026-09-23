import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createDb } from "../src/db.js";

function fakeProbe(reachable: boolean) {
  return { reachable: async () => reachable };
}

/** A minimal built-SPA fixture: an index.html shell plus one hashed asset. */
function makeFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "spa-fixture-"));
  writeFileSync(
    join(root, "index.html"),
    "<!doctype html><html><body>spa-shell</body></html>",
  );
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "assets", "app-abc123.js"), "console.log('hi');");
  return root;
}

// /health never touches the database directly, so a Pool that's never
// queried is enough (same pattern as test/health.test.ts).
const unusedDb = createDb("postgres://unused:unused@127.0.0.1:1/unused");
const staticRoot = makeFixtureRoot();
const app = createApp({
  databaseProbe: fakeProbe(true),
  db: unusedDb,
  staticRoot,
});

describe("SPA static serving (FR-002, FR-003, plan D2)", () => {
  it("serves a real static asset", async () => {
    const res = await app.request("/assets/app-abc123.js");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("console.log");
  });

  it("serves the SPA shell for an unmatched non-API path (deep link)", async () => {
    const res = await app.request("/play/some-session-id");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("spa-shell");
  });

  it("does NOT shadow /api/*: an unknown sub-path still returns the structured JSON 404", async () => {
    const res = await app.request("/api/does-not-exist");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.kind).toBe("not_found");
  });

  it("does NOT shadow /auth/*: an unknown sub-path still returns the structured JSON 404", async () => {
    const res = await app.request("/auth/does-not-exist");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.kind).toBe("not_found");
  });

  it("still serves /health normally, unaffected by the static mount", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
