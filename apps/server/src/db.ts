import { Pool } from "pg";

/**
 * Default bound for the liveness probe (research D1). Leaves headroom under
 * the 5-second overall bound the /health contract guarantees (SC-002).
 */
const DEFAULT_PROBE_TIMEOUT_MS = 3_000;

export interface DatabaseProbe {
  reachable(): Promise<boolean>;
  /** Releases the underlying connection pool. Optional — tests use it, the running process doesn't need to. */
  close?(): Promise<void>;
}

/** The minimal shape this module needs from a pg-like client, so the timeout logic below is testable without a real Postgres connection. */
export interface Queryable {
  query(sql: string): Promise<unknown>;
}

/**
 * Wraps any queryable in an explicit timeout: a query that hasn't resolved in
 * time reports unreachable rather than hanging the caller (research D1). Any
 * other failure (refused, errored) is unreachable too — never thrown.
 */
export function probeReachable(
  db: Queryable,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  return Promise.race([
    db.query("SELECT 1").then(() => true),
    new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), timeoutMs),
    ),
  ]).catch(() => false);
}

/** Production wiring: a bounded probe backed by a real Postgres pool. */
export function createDatabaseProbe(
  databaseUrl: string,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
): DatabaseProbe {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: timeoutMs,
  });
  // pg.Pool is an EventEmitter; when Postgres drops an idle connection in the
  // pool (e.g. 57P01 "terminating connection due to administrator command",
  // which happens when the db container stops), it emits 'error' on the pool
  // itself. With no listener, Node's default behavior for an unhandled
  // EventEmitter 'error' is to throw — crashing the whole process before
  // /health ever gets a chance to report degraded. Do not remove this: it
  // looks like a no-op, but it is what keeps the server alive during a
  // database outage.
  pool.on("error", (err) => {
    // pg-pool attaches the dead client to `err.client`; log the message only
    // so this doesn't dump a whole pg.Client (sockets, buffers) to stderr.
    console.error("Database pool error (connection dropped):", err.message);
  });
  return {
    reachable: () => probeReachable(pool, timeoutMs),
    close: () => pool.end(),
  };
}
