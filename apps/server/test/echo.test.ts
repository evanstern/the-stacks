import type { EchoResponse } from "@the-stacks/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { DatabaseProbe } from "../src/db.js";
import { createDb } from "../src/db.js";
import type { ErrorIssue, ErrorResponseBody } from "../src/errors.js";
import { errorHandler, PayloadTooLargeError } from "../src/errors.js";

function fakeProbe(reachable: boolean): DatabaseProbe {
  return { reachable: async () => reachable };
}

/** The validation-error body always carries `issues` — unlike the general shape. */
interface ValidationErrorBody {
  error: { kind: "validation"; message: string; issues: ErrorIssue[] };
}

// The echo route never touches the database, so a Pool that's never
// queried (and therefore never connects) is enough — createApp now
// requires `db` unconditionally since the auth routes need one.
const unusedDb = createDb("postgres://unused:unused@127.0.0.1:1/unused");

describe("POST /api/echo", () => {
  it("returns 200 and a body matching the declared output shape for valid input", async () => {
    const app = createApp({ databaseProbe: fakeProbe(true), db: unusedDb });
    const res = await app.request("/api/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as EchoResponse;
    expect(body.message).toBe("hello");
    expect(new Date(body.receivedAt).toString()).not.toBe("Invalid Date");
  });

  it.each([
    ["missing field", {}],
    ["wrong type", { message: 42 }],
    ["over-length string", { message: "a".repeat(501) }],
  ])(
    "returns 400 kind:validation naming the offending path for %s",
    async (_label, payload) => {
      const app = createApp({ databaseProbe: fakeProbe(true), db: unusedDb });
      const res = await app.request("/api/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ValidationErrorBody;
      expect(body.error.kind).toBe("validation");
      expect(body.error.issues.length).toBeGreaterThan(0);
      expect(body.error.issues[0].path).toBe("message");
    },
  );

  it("returns kind:not_found in the same structured shape for an unknown path", async () => {
    const app = createApp({ databaseProbe: fakeProbe(true), db: unusedDb });
    const res = await app.request("/api/does-not-exist");

    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.error.kind).toBe("not_found");
    expect(typeof body.error.message).toBe("string");
  });

  it("discloses nothing for an internal failure (FR-006)", async () => {
    // Exercises the same errorHandler app.ts mounts via app.onError, rather
    // than threading a test-only failure hook through the echo route — the
    // route stays product-shapeless and free of test-only branches.
    const app = new Hono();
    app.onError(errorHandler);
    app.get("/boom", () => {
      throw new Error("secret: password=hunter2, at /internal/db/pool.ts:42");
    });

    const res = await app.request("/boom");

    expect(res.status).toBe(500);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.error.kind).toBe("internal");
    expect(body.error.message).toBe("An internal error occurred.");
    expect(body.error).not.toHaveProperty("issues");
    expect(JSON.stringify(body)).not.toMatch(
      /secret|password|hunter2|pool\.ts/,
    );
  });

  it("returns 413 kind:too_large for PayloadTooLargeError (specs/017-ingestion-pipeline)", async () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.get("/too-big", () => {
      throw new PayloadTooLargeError("Upload exceeds the configured limit of 100 bytes.");
    });

    const res = await app.request("/too-big");

    expect(res.status).toBe(413);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.error.kind).toBe("too_large");
    expect(body.error.message).toBe(
      "Upload exceeds the configured limit of 100 bytes.",
    );
  });
});
