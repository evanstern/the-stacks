import net from "node:net";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import {
  createDatabaseProbe,
  createDb,
  type DatabaseProbe,
} from "../src/db.js";

function fakeProbe(reachable: boolean): DatabaseProbe {
  return { reachable: async () => reachable };
}

// /health never touches the database directly (it only calls the injected
// probe), so a Pool that's never queried is enough — createApp now
// requires `db` unconditionally since the auth routes need one.
const unusedDb = createDb("postgres://unused:unused@127.0.0.1:1/unused");

describe("GET /health", () => {
  it("reports ok when the database is reachable", async () => {
    const app = createApp({ databaseProbe: fakeProbe(true), db: unusedDb });
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe("ok");
    expect(body.database.reachable).toBe(true);
    expect(body.process.uptimeSeconds).toBeGreaterThan(0);
  });

  it("stays 200 and reports degraded when the database is unreachable", async () => {
    const app = createApp({ databaseProbe: fakeProbe(false), db: unusedDb });
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe("degraded");
    expect(body.database.reachable).toBe(false);
  });

  it("answers within the 5-second bound when the database connection hangs", async () => {
    // A raw TCP server that accepts the connection and never responds —
    // simulates a HUNG database (accepts, never answers), not merely a
    // refused one. This is the case an unbounded probe would hang on
    // forever (research D1); the probe's own timeout is what must save us.
    const sockets = new Set<import("node:net").Socket>();
    const server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on("error", () => {});
      socket.on("close", () => sockets.delete(socket));
      // deliberately: no write, no end, no destroy — this is the hang
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const { port } = server.address() as net.AddressInfo;

    // Real probe (not a fake) with a short timeout, pointed at the hung
    // server, so this test exercises db.ts's actual bounded-timeout logic.
    const probe = createDatabaseProbe(
      `postgres://user:pass@127.0.0.1:${port}/db`,
      1000,
    );
    const app = createApp({ databaseProbe: probe, db: unusedDb });

    const start = Date.now();
    const res = await app.request("/health");
    const elapsedMs = Date.now() - start;

    expect(elapsedMs).toBeLessThan(5000);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe("degraded");
    expect(body.database.reachable).toBe(false);

    await probe.close?.();
    // Destroy any sockets our handler accepted but never closed, so
    // server.close()'s callback (which waits for open connections) fires.
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }, 10_000);
});
