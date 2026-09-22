import net from "node:net";
import { describe, expect, it } from "vitest";
import { createDatabaseProbe } from "../src/db.js";

// --- Minimal Postgres wire-protocol message builders, just enough to fake a
// backend that authenticates a connection and answers one simple query. ---

function pgMessage(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(5);
  header.write(type, 0, "ascii");
  header.writeUInt32BE(4 + payload.length, 1);
  return Buffer.concat([header, payload]);
}

function cstring(value: string): Buffer {
  return Buffer.concat([Buffer.from(value, "ascii"), Buffer.from([0])]);
}

const authenticationOk = () => pgMessage("R", Buffer.alloc(4)); // int32 code 0
const readyForQuery = () => pgMessage("Z", Buffer.from("I", "ascii"));
const commandComplete = (tag: string) => pgMessage("C", cstring(tag));

/** The 57P01 ErrorResponse Postgres sends when an admin terminates a connection. */
function errorResponse57P01(): Buffer {
  const payload = Buffer.concat([
    Buffer.from("S"),
    cstring("FATAL"),
    Buffer.from("C"),
    cstring("57P01"),
    Buffer.from("M"),
    cstring("terminating connection due to administrator command"),
    Buffer.from([0]),
  ]);
  return pgMessage("E", payload);
}

/**
 * A raw TCP server that speaks just enough real Postgres wire protocol to
 * authenticate a connection and answer "SELECT 1" — so a real `pg.Pool`
 * completes a real query and checks a real client into its idle pool.
 */
function createFakePostgresServer() {
  const sockets: net.Socket[] = [];
  const server = net.createServer((socket) => {
    sockets.push(socket);
    socket.on("error", () => {});
    // Answers exactly the startup message, then exactly one query, then goes
    // silent — so a later stray byte from the client (e.g. the Terminate
    // message `client.end()` sends while the test is tearing the connection
    // down) is never mistaken for a second query and answered.
    let stage: "startup" | "query" | "done" = "startup";
    socket.on("data", () => {
      if (stage === "startup") {
        stage = "query";
        socket.write(Buffer.concat([authenticationOk(), readyForQuery()]));
        return;
      }
      if (stage === "query") {
        stage = "done";
        socket.write(
          Buffer.concat([commandComplete("SELECT 1"), readyForQuery()]),
        );
      }
    });
  });
  return { server, sockets };
}

describe("createDatabaseProbe — pool error survival", () => {
  it("survives a real pool 'error' event from an idle connection dropped like Postgres's 57P01", async () => {
    const { server, sockets } = createFakePostgresServer();
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const { port } = server.address() as net.AddressInfo;

    const uncaught: unknown[] = [];
    const onUncaught = (err: unknown) => uncaught.push(err);
    process.on("uncaughtException", onUncaught);

    const probe = createDatabaseProbe(
      `postgres://user:pass@127.0.0.1:${port}/db`,
      2000,
    );

    try {
      // Real connect + real query against the fake backend: the pool's
      // client authenticates, runs "SELECT 1", and is released back to
      // the pool as idle — exactly the state a healthy connection sits in
      // between health checks.
      expect(await probe.reachable()).toBe(true);
      expect(sockets.length).toBe(1);

      // Simulate Postgres terminating that now-idle connection the way
      // "docker compose stop db" does: an ErrorResponse (57P01) is what a
      // real backend sends before closing.
      sockets[0].write(errorResponse57P01());
      sockets[0].end();

      // Give the pool's idle-client error listener a turn on the event
      // loop to run (and, without the fix, to throw).
      await new Promise((resolve) => setTimeout(resolve, 50));

      // The defining assertion. pg.Pool is an EventEmitter; the pool's
      // idle-client error handling calls `pool.emit('error', err, client)`.
      // Without a listener registered in createDatabaseProbe, Node's
      // default behavior for an unhandled EventEmitter 'error' event is
      // to throw — which, without this test's own safety net, would
      // surface here as an uncaught exception and, in the real process,
      // would kill it outright.
      expect(uncaught).toEqual([]);

      // The probe still works afterward: a fresh connection succeeds.
      expect(await probe.reachable()).toBe(true);
    } finally {
      process.removeListener("uncaughtException", onUncaught);
      await probe.close?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 10_000);
});
