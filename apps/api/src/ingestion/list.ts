/**
 * Library listing — the collection read over what the operator SUBMITTED
 * (009 FR-002/003/007/008; contracts/api.md). One newest-first page of
 * standalone sources + batches in a {items,total,limit,offset} envelope.
 *
 * Two doctrine points carried from the specs:
 *  - Rows are SUBMISSIONS (research R2): sources born from a ZIP expand
 *    (batch_id IS NOT NULL) never appear as their own rows — their batch row
 *    speaks for them. A 200-entry ZIP is one line in the timeline, not 200.
 *  - Read-only end to end (FR-009): this module adds the slice's only new
 *    verb, a GET. Paging shape is enforced by Fastify schema validation
 *    (malformed -> invalid_input 400 via app.ts, never a silent default;
 *    in-range numerics are CLAMPED, not refused — limit into [1,200]).
 *
 * US3 (T017) extends the rows with ingestion evidence (plugin, generation,
 * current-generation counts, batch entry summaries) — deliberately absent in
 * the US1 slice this file lands with.
 */
import type { Database } from "@stacks/db";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export interface ListRoutesDeps {
  db: Database;
}

interface ListQuery {
  limit?: number;
  offset?: number;
}

// ajv coerces query strings to integers and refuses what won't coerce
// ("nope") or violates minimum (-1) — the 400 path. Clamping beyond that is
// handler logic: 0 and 9999 are honest requests with honest nearest answers.
const LIST_QUERY_SCHEMA = {
  type: "object",
  properties: {
    limit: { type: "integer", minimum: 0 },
    offset: { type: "integer", minimum: 0 },
  },
  additionalProperties: true,
} as const;

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export function registerListRoutes(app: FastifyInstance, deps: ListRoutesDeps): void {
  const { db } = deps;

  app.get<{ Querystring: ListQuery }>(
    "/api/uploads",
    { schema: { querystring: LIST_QUERY_SCHEMA } },
    async (request) => {
      const limit = Math.min(MAX_LIMIT, Math.max(1, request.query.limit ?? DEFAULT_LIMIT));
      const offset = request.query.offset ?? 0;

      // One UNION ALL page query: sorting sources and batches into a single
      // timeline is the database's job, not a TS merge — LIMIT/OFFSET stay
      // correct across both kinds by construction. id DESC tiebreaks rows
      // created in the same millisecond so paging is deterministic.
      const page = await db.execute(sql`
        SELECT kind, id, original_filename, status, created_at, updated_at
        FROM (
          SELECT 'source' AS kind, id, original_filename, status, created_at, updated_at
            FROM sources WHERE batch_id IS NULL
          UNION ALL
          SELECT 'batch' AS kind, id, original_filename, status, created_at, updated_at
            FROM batches
        ) submissions
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // The honest total behind FR-008's "indication that more exist" —
      // two index-only counts, cheap at single-operator scale (research R4).
      const totals = await db.execute(sql`
        SELECT (SELECT count(*) FROM sources WHERE batch_id IS NULL)
             + (SELECT count(*) FROM batches) AS total
      `);

      return {
        items: page.rows.map((row) => ({
          kind: row.kind as "source" | "batch",
          id: row.id as string,
          originalFilename: row.original_filename as string,
          status: row.status as string,
          createdAt: row.created_at as Date,
          updatedAt: row.updated_at as Date,
        })),
        total: Number((totals.rows[0] as { total: string | number }).total),
        limit,
        offset,
      };
    },
  );
}
