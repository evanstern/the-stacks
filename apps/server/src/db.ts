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
  return {
    reachable: () => probeReachable(pool, timeoutMs),
    close: () => pool.end(),
  };
}
