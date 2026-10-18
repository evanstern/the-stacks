import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StacksLoadContext, WebRequestHandler } from "@the-stacks/shared";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createDb } from "../src/db.js";
import type { ErrorResponseBody } from "../src/errors.js";

/** A minimal built web-client fixture: one hashed asset. No index.html — React Router owns HTML now (plan D4). */
function makeFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "web-client-fixture-"));
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "assets", "app-abc123.js"), "console.log('hi');");
  return root;
}

interface RecordedCall {
  request: Request;
  context: StacksLoadContext;
}

/** Records every call instead of rendering anything, so tests assert on the handler seam itself (plan D13). */
function fakeHandler() {
  const calls: RecordedCall[] = [];
  const handle: WebRequestHandler = async (request, context) => {
    calls.push({ request, context });
    return new Response("handled", { status: 200 });
  };
  return { calls, handler: async () => handle };
}

// /health never touches the database directly, so a Pool that's never
// queried is enough (same pattern as test/health.test.ts). The identity
// lookup only touches it when a request carries a cookie, which none of
// these requests do.
const unusedDb = createDb("postgres://unused:unused@127.0.0.1:1/unused");
const clientRoot = makeFixtureRoot();

function buildApp(
  fake: ReturnType<typeof fakeHandler>,
  listJobs: () => Promise<never[]> = async () => [],
) {
  return createApp({
    databaseProbe: { reachable: async () => true },
    db: unusedDb,
    web: { clientRoot, handler: fake.handler, listJobs },
  });
}

describe("web middleware: reserved paths, assets, and the handler seam (plan D4, D13)", () => {
  it("never calls the handler for a reserved path, and unknown sub-paths return the structured JSON 404", async () => {
    const fake = fakeHandler();
    const app = buildApp(fake);

    const health = await app.request("/health");
    expect(health.status).toBe(200);

    for (const path of ["/api/x", "/auth/x", "/library/x", "/ws"]) {
      const res = await app.request(path);
      expect(res.status).toBe(404);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.kind).toBe("not_found");
    }

    expect(fake.calls).toHaveLength(0);
  });

  it("serves a real static asset without calling the handler", async () => {
    const fake = fakeHandler();
    const app = buildApp(fake);

    const res = await app.request("/assets/app-abc123.js");

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("console.log");
    expect(fake.calls).toHaveLength(0);
  });

  it("calls the handler once for an unmatched non-reserved path, with a Request for that URL", async () => {
    const fake = fakeHandler();
    const app = buildApp(fake);

    const res = await app.request("/play/abc");

    expect(res.status).toBe(200);
    expect(fake.calls).toHaveLength(1);
    expect(new URL(fake.calls[0].request.url).pathname).toBe("/play/abc");
  });

  it("hands the handler a load context whose identity() resolves null with no cookie, with no database touched", async () => {
    const fake = fakeHandler();
    const app = buildApp(fake);

    await app.request("/play/abc");

    expect(fake.calls).toHaveLength(1);
    await expect(fake.calls[0].context.identity()).resolves.toBeNull();
  });

  it("T008: the load context's jobs() resolves null with no cookie, and never calls the injected listJobs", async () => {
    const fake = fakeHandler();
    let calls = 0;
    const app = buildApp(fake, async () => {
      calls += 1;
      return [];
    });

    await app.request("/play/abc");

    expect(fake.calls).toHaveLength(1);
    await expect(fake.calls[0].context.jobs()).resolves.toBeNull();
    expect(calls).toBe(0);
  });
});

describe("favicon", () => {
  it("answers /favicon.ico with 204 without calling the handler", async () => {
    const fake = fakeHandler();
    const res = await buildApp(fake).request("/favicon.ico");

    expect(res.status).toBe(204);
    expect(fake.calls).toHaveLength(0);
  });
});
