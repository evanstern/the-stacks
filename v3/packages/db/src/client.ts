/**
 * The single door into Postgres for the whole skeleton. api and worker each
 * call createDbClient once at boot and thread the returned Database through
 * every db helper (queue.ts, events.ts, migrate.ts) — no module-level
 * singleton, so tests can construct isolated clients and shutdown can end
 * the pool it owns.
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as jobsSchema from "./schema/jobs";
import * as skeletonChecksSchema from "./schema/skeleton-checks";
import * as skeletonVectorsSchema from "./schema/skeleton-vectors";

// Merge every schema module into one object so drizzle's relational query API
// and $inferSelect types see the full database. The Database type is derived
// from this merged shape — helpers typed against it work with any table, and
// a new schema file only needs to be spread in here (and re-exported from
// index.ts) to become visible everywhere.
const schema = { ...jobsSchema, ...skeletonChecksSchema, ...skeletonVectorsSchema };

export type Database = NodePgDatabase<typeof schema>;

export function createDbClient(connectionString: string): {
  db: Database;
  pool: Pool;
} {
  const pool = new Pool({ connectionString });
  // node-postgres crashes the process on an unhandled idle-client error
  // otherwise; a dead DB must surface as dependency_down, not a process exit.
  pool.on("error", (err) => {
    console.error("Postgres pool error:", err);
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
