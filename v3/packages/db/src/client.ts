import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as jobsSchema from "./schema/jobs";
import * as skeletonChecksSchema from "./schema/skeleton-checks";
import * as skeletonVectorsSchema from "./schema/skeleton-vectors";

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
