/**
 * Claim-ticket status reads (008 FR-010, US2; contracts/api.md). A ticket —
 * `source/<id>` or `batch/<id>` — resolves to current status plus the FULL
 * append-only event trail, retries included: the trail is authoritative
 * history ("this happened"), status is derived convenience (Principle IV/V).
 *
 * lastError here is the SCRUBBED copy ({class, stage, message}); full
 * diagnostics live operator-side (event detail + logs), never on this wire.
 */
import { DomainError } from "@stacks/core";
import type { Database } from "@stacks/db";
import { batches, chunks, documentSections, ingestionEvents, sources } from "@stacks/db";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export interface StatusRoutesDeps {
  db: Database;
}

async function eventTrail(db: Database, scope: { sourceId?: string; batchId?: string }) {
  const where = scope.sourceId
    ? sql`${ingestionEvents.sourceId} = ${scope.sourceId}`
    : sql`${ingestionEvents.batchId} = ${scope.batchId}`;
  const rows = await db
    .select()
    .from(ingestionEvents)
    .where(where)
    .orderBy(ingestionEvents.createdAt, ingestionEvents.id);
  return rows.map((event) => ({
    stage: event.stage,
    event: event.event,
    ok: event.ok,
    detail: event.detail,
    durationMs: event.durationMs,
    at: event.createdAt,
  }));
}

export function registerStatusRoutes(app: FastifyInstance, deps: StatusRoutesDeps): void {
  const { db } = deps;

  app.get<{ Params: { kind: string; id: string } }>(
    "/api/uploads/:kind/:id",
    async (request) => {
      const { kind, id } = request.params;

      if (kind === "source") {
        const [source] = await db.select().from(sources).where(sql`${sources.id} = ${id}`);
        if (!source) {
          throw new DomainError({ class: "unknown_thing", message: "No such upload ticket." });
        }

        // Counts are over the CURRENT generation only — what readers see is
        // what we report (R8's reader predicate, applied to observability too).
        const [sectionCount] = await db
          .select({ n: sql<number>`count(*)` })
          .from(documentSections)
          .where(
            sql`${documentSections.sourceId} = ${id} AND ${documentSections.generation} = ${source.currentGeneration}`,
          );
        const [chunkCount] = await db
          .select({ n: sql<number>`count(*)` })
          .from(chunks)
          .where(sql`${chunks.sourceId} = ${id} AND ${chunks.generation} = ${source.currentGeneration}`);

        return {
          ticket: { kind: "source", id },
          source: {
            originalFilename: source.originalFilename,
            status: source.status,
            plugin: source.pluginName
              ? {
                  name: source.pluginName,
                  version: source.pluginVersion,
                  confidence: source.detectConfidence,
                }
              : null,
            generation: source.currentGeneration,
            counts: { sections: Number(sectionCount!.n), chunks: Number(chunkCount!.n) },
            lastError: source.lastError,
            createdAt: source.createdAt,
            updatedAt: source.updatedAt,
          },
          events: await eventTrail(db, { sourceId: id }),
        };
      }

      if (kind === "batch") {
        const [batch] = await db.select().from(batches).where(sql`${batches.id} = ${id}`);
        if (!batch) {
          throw new DomainError({ class: "unknown_thing", message: "No such upload ticket." });
        }

        const memberSources = await db
          .select({
            sourceId: sources.id,
            filename: sources.originalFilename,
            status: sources.status,
          })
          .from(sources)
          .where(sql`${sources.batchId} = ${id}`)
          .orderBy(sources.createdAt);

        return {
          ticket: { kind: "batch", id },
          batch: {
            originalFilename: batch.originalFilename,
            status: batch.status,
            entryReport: batch.entryReport,
            createdAt: batch.createdAt,
            updatedAt: batch.updatedAt,
          },
          sources: memberSources,
          events: await eventTrail(db, { batchId: id }),
        };
      }

      // An unknown ticket KIND is the same honest 404 as an unknown id —
      // the URL names a thing that does not exist.
      throw new DomainError({ class: "unknown_thing", message: "No such upload ticket." });
    },
  );
}
