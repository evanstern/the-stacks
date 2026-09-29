import { drizzle } from "drizzle-orm/node-postgres";
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

/**
 * Builds a `pg.Pool` with the error handler every pool in this module needs
 * (see the comment below). Both the health probe and the Drizzle client are
 * built through this one helper rather than each wiring a pool by hand —
 * that duplication is exactly how a second, unprotected connection path
 * could reappear.
 */
function createPool(databaseUrl: string, timeoutMs: number): Pool {
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
  return pool;
}

/** Production wiring: a bounded probe backed by a real Postgres pool. */
export function createDatabaseProbe(
  databaseUrl: string,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
): DatabaseProbe {
  const pool = createPool(databaseUrl, timeoutMs);
  return {
    reachable: () => probeReachable(pool, timeoutMs),
    close: () => pool.end(),
  };
}

/**
 * The Drizzle client for the event log (and any later table). Built on the
 * same pool wiring as the health probe (see `createPool`) rather than a
 * second connection path. The return type exposes `$client` (the
 * underlying pool) so callers — e.g. scripts/migrate.ts — can close it.
 */
export function createDb(databaseUrl: string) {
  return drizzle(createPool(databaseUrl, DEFAULT_PROBE_TIMEOUT_MS));
}

const POSTGRES_UNIQUE_VIOLATION = "23505";

// drizzle-orm wraps every driver error in a DrizzleQueryError, so the pg
// driver's own `code` lands on `err.cause`, not `err` itself. Bare `err.code`
// still matters for raw `pg` calls outside drizzle.
// ponytail: inspects one level of `cause` only; walk the chain when a
// caller wraps errors twice.
export function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  const causeCode = (err as { cause?: { code?: unknown } })?.cause?.code;
  return (
    code === POSTGRES_UNIQUE_VIOLATION || causeCode === POSTGRES_UNIQUE_VIOLATION
  );
}
