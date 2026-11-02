import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AuthVariables } from "../auth/middleware.js";
import { createAuthMiddleware } from "../auth/middleware.js";
import type { DbClient, ValidateSession } from "../auth/session.js";
import { UnauthorizedError } from "../errors.js";

/**
 * The Table landing's read (specs/069-table-landing-list). A table is the
 * `events` rows sharing a session id; there is no sessions table. One query
 * derives seats from the latest seat rows and returns, per table, the latest
 * title and time among rows the account may see as a player.
 */

export type TableRelation = "dm" | "player" | "started";

export interface TableSummary {
  sessionId: string;
  title: string | null;
  lastActivityAt: string | null;
  relation: TableRelation;
}

const RELATIONS: Record<number, TableRelation> = {
  1: "dm",
  2: "player",
  3: "started",
};
const LIST_CAP = 50;

// ponytail: scans `events` by type with no index beyond the primary key.
// Ceiling: a few thousand sessions. Upgrade path: a (type, session_id, seq)
// index or a session summary table. See TASK-0198.
export async function listTables(
  db: DbClient,
  identity: { userId: string; role: string },
): Promise<TableSummary[]> {
  const u = identity.userId;
  const isOperator = identity.role === "operator";
  const result = await db.execute(sql`
    WITH seats AS (
      SELECT DISTINCT ON (session_id, payload->>'characterId')
             session_id, payload->'after'->'controller' AS ctl
        FROM events WHERE type = 'party.member.changed'
       ORDER BY session_id, payload->>'characterId', seq DESC
    ), dm AS (
      SELECT DISTINCT ON (session_id) session_id, payload->'after' AS seat
        FROM events WHERE type = 'dm.seat.changed'
       ORDER BY session_id, seq DESC
    ), mine AS (
      SELECT session_id, min(rank) AS rank FROM (
        SELECT session_id, 1 AS rank FROM dm
         WHERE seat->>'kind' = 'human' AND seat->>'userId' = ${u}
        UNION ALL
        SELECT session_id, 2 FROM seats
         WHERE ctl->>'kind' = 'player' AND ctl->>'userId' = ${u}
        UNION ALL
        SELECT DISTINCT session_id, 3 FROM events WHERE ${isOperator}::boolean
      ) r GROUP BY session_id
    ), visible AS (
      SELECT session_id, max(ts) AS last_at FROM events
       WHERE visibility = 'public' OR visibility = ${u}
       GROUP BY session_id
    ), title AS (
      SELECT DISTINCT ON (session_id) session_id, payload->'after'->>'title' AS title
        FROM events
       WHERE type = 'scene.changed'
         AND jsonb_typeof(payload->'after') = 'object'
         AND (visibility = 'public' OR visibility = ${u})
       ORDER BY session_id, seq DESC
    )
    SELECT mine.session_id AS "sessionId", title.title AS title,
           visible.last_at AS "lastAt", mine.rank AS rank
      FROM mine
      LEFT JOIN visible USING (session_id)
      LEFT JOIN title USING (session_id)
     ORDER BY visible.last_at DESC NULLS LAST, mine.session_id ASC
     LIMIT ${LIST_CAP}
  `);
  return (
    result.rows as {
      sessionId: string;
      title: string | null;
      lastAt: Date | string | null;
      rank: number | string;
    }[]
  ).map((r) => ({
    sessionId: r.sessionId,
    title: r.title,
    lastActivityAt: r.lastAt ? new Date(r.lastAt).toISOString() : null,
    relation: RELATIONS[Number(r.rank)] as TableRelation,
  }));
}

export interface CreateTablesRouteOptions {
  db: DbClient;
  validateSession: ValidateSession;
}

export function createTablesRoute({
  db,
  validateSession,
}: CreateTablesRouteOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();
  route.use("*", createAuthMiddleware(validateSession));
  route.get("/", async (c) => {
    const identity = c.get("identity");
    if (!identity) throw new UnauthorizedError();
    return c.json({ tables: await listTables(db, identity) });
  });
  return route;
}
