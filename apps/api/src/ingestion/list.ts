/**
 * Library listing — the collection read over what the operator SUBMITTED
 * (009 FR-002..008; contracts/api.md). One newest-first page of standalone
 * sources + batches in a {items,total,limit,offset} envelope, each row
 * carrying the ingestion evidence US3 turns into a dashboard: plugin
 * attribution, generation, current-generation counts, scrubbed failure,
 * batch entry summaries.
 *
 * Doctrine carried from the specs:
 *  - Rows are SUBMISSIONS (research R2): sources born from a ZIP expand
 *    (batch_id IS NOT NULL) never appear as their own rows — their batch row
 *    speaks for them via entrySummary. A 200-entry ZIP is one timeline line.
 *  - Counts obey the 008 R8 READER PREDICATE: aggregates join on
 *    generation = current_generation, so a re-ingest being written aside is
 *    invisible until its one-UPDATE flip commits it.
 *  - Constant query count per page (research R3's no-N+1 rule): 1 page +
 *    1 total + 3 grouped aggregates (sections, chunks, member statuses) = 5,
 *    regardless of page size; the aggregates skip when the page has no rows
 *    of their kind.
 *  - Read-only end to end (FR-009): the slice's only new verb is this GET.
 *    Malformed paging -> invalid_input 400 via app.ts (Fastify schema);
 *    in-range numerics are CLAMPED (limit into [1,200]), not refused.
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

interface EntryReportEntry {
  name: string;
  outcome: "ingested" | "skipped";
  reason?: string;
  sourceId?: string;
}

/** Per-source aggregate rows → Map<sourceId, count>. */
function countsBySource(rows: Array<Record<string, unknown>>): Map<string, number> {
  return new Map(rows.map((row) => [row.source_id as string, Number(row.n)]));
}

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
      // correct across both kinds by construction. Kind-specific columns ride
      // as NULLs on the other kind. id DESC tiebreaks same-millisecond rows
      // so paging is deterministic.
      const page = await db.execute(sql`
        SELECT kind, id, original_filename, status, created_at, updated_at,
               plugin_name, plugin_version, detect_confidence, current_generation,
               last_error, entry_report
        FROM (
          SELECT 'source' AS kind, id, original_filename, status, created_at, updated_at,
                 plugin_name, plugin_version, detect_confidence, current_generation,
                 last_error, NULL::jsonb AS entry_report
            FROM sources WHERE batch_id IS NULL
          UNION ALL
          SELECT 'batch' AS kind, id, original_filename, status, created_at, updated_at,
                 NULL, NULL, NULL, NULL, NULL::jsonb, entry_report
            FROM batches
        ) submissions
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const sourceIds = page.rows.filter((row) => row.kind === "source").map((row) => row.id as string);
      const batchIds = page.rows.filter((row) => row.kind === "batch").map((row) => row.id as string);

      // drizzle's sql template expands a JS array into comma-joined params —
      // fine for IN (...), wrong inside ANY(...). Build IN lists explicitly.
      const idList = (ids: string[]) => sql.join(ids.map((id) => sql`${id}`), sql`, `);

      // Grouped aggregates for exactly the page's sources, joined through
      // current_generation — the reader predicate applied to observability.
      const [sectionCounts, chunkCounts] = await Promise.all([
        sourceIds.length === 0
          ? { rows: [] as Array<Record<string, unknown>> }
          : db.execute(sql`
              SELECT ds.source_id, count(*) AS n
              FROM document_sections ds
              JOIN sources s ON s.id = ds.source_id
              WHERE ds.source_id IN (${idList(sourceIds)}) AND ds.generation = s.current_generation
              GROUP BY ds.source_id
            `),
        sourceIds.length === 0
          ? { rows: [] as Array<Record<string, unknown>> }
          : db.execute(sql`
              SELECT c.source_id, count(*) AS n
              FROM chunks c
              JOIN sources s ON s.id = c.source_id
              WHERE c.source_id IN (${idList(sourceIds)}) AND c.generation = s.current_generation
              GROUP BY c.source_id
            `),
      ]);
      const sections = countsBySource(sectionCounts.rows);
      const chunks = countsBySource(chunkCounts.rows);

      // Batch summaries need member STATUSES, not just the expand report: the
      // report says admitted-vs-skipped at expand time; whether an admitted
      // member then ingested or failed lives on the member source row.
      const memberStatuses =
        batchIds.length === 0
          ? { rows: [] as Array<Record<string, unknown>> }
          : await db.execute(sql`
              SELECT batch_id, status, count(*) AS n
              FROM sources
              WHERE batch_id IN (${idList(batchIds)})
              GROUP BY batch_id, status
            `);
      const byBatch = new Map<string, Map<string, number>>();
      for (const row of memberStatuses.rows) {
        const batch = byBatch.get(row.batch_id as string) ?? new Map<string, number>();
        batch.set(row.status as string, Number(row.n));
        byBatch.set(row.batch_id as string, batch);
      }

      // The honest total behind FR-008's "indication that more exist" —
      // two index-only counts, cheap at single-operator scale (research R4).
      const totals = await db.execute(sql`
        SELECT (SELECT count(*) FROM sources WHERE batch_id IS NULL)
             + (SELECT count(*) FROM batches) AS total
      `);

      return {
        items: page.rows.map((row) => {
          const base = {
            kind: row.kind as "source" | "batch",
            id: row.id as string,
            originalFilename: row.original_filename as string,
            status: row.status as string,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date,
          };
          if (row.kind === "source") {
            return {
              ...base,
              plugin: row.plugin_name
                ? {
                    name: row.plugin_name as string,
                    version: row.plugin_version as string,
                    confidence: row.detect_confidence as number,
                  }
                : null,
              generation: Number(row.current_generation),
              counts: {
                sections: sections.get(base.id) ?? 0,
                chunks: chunks.get(base.id) ?? 0,
              },
              lastError: (row.last_error as { class: string; stage: string; message: string } | null) ?? null,
            };
          }
          const report = (row.entry_report as EntryReportEntry[] | null) ?? [];
          const members = byBatch.get(base.id) ?? new Map<string, number>();
          return {
            ...base,
            entrySummary: {
              ingested: members.get("ingested") ?? 0,
              skipped: report.filter((entry) => entry.outcome === "skipped").length,
              failed: members.get("failed") ?? 0,
              total: report.length,
            },
          };
        }),
        total: Number((totals.rows[0] as { total: string | number }).total),
        limit,
        offset,
      };
    },
  );
}
