/**
 * Idempotent persistence for derived rows (008 FR-021, research R9/R10) —
 * the three storage moves the stage driver composes:
 *
 *   indexDerived()     — insert sections + chunks (with embeddings) using
 *                        ON CONFLICT DO NOTHING: deterministic ids make any
 *                        replay a no-op, and the inserted/conflictNoops split
 *                        is exactly the index event's detail.
 *   pendingEmbeddings()— which draft chunk ids already exist WITH embeddings
 *                        (a retried run skips re-embedding those — R10's
 *                        skippedExisting).
 *   commitGeneration() — THE atomic commit of a run (R8): flip
 *                        sources.current_generation in one UPDATE, then sweep
 *                        rows of older generations. Readers filter on the
 *                        current generation, so they never see a half-swap.
 */
import { and, inArray, isNotNull, lt, sql } from "drizzle-orm";

import type { Database } from "@stacks/db";
import { chunks, documentSections, sources } from "@stacks/db";

export type SectionRow = typeof documentSections.$inferInsert;
export type ChunkRow = typeof chunks.$inferInsert;

export interface IndexResult {
  inserted: number;
  conflictNoops: number;
}

export async function indexDerived(
  db: Database,
  input: { sections: SectionRow[]; chunks: ChunkRow[] },
): Promise<IndexResult> {
  let inserted = 0;
  if (input.sections.length > 0) {
    const rows = await db
      .insert(documentSections)
      .values(input.sections)
      .onConflictDoNothing()
      .returning({ id: documentSections.id });
    inserted += rows.length;
  }
  if (input.chunks.length > 0) {
    const rows = await db
      .insert(chunks)
      .values(input.chunks)
      .onConflictDoNothing()
      .returning({ id: chunks.id });
    inserted += rows.length;
  }
  const total = input.sections.length + input.chunks.length;
  return { inserted, conflictNoops: total - inserted };
}

/** Chunk ids (among the given) that already carry an embedding — a retry
 * skips these instead of paying the sidecar again (R10). */
export async function alreadyEmbedded(db: Database, chunkIds: string[]): Promise<Set<string>> {
  if (chunkIds.length === 0) return new Set();
  const rows = await db
    .select({ id: chunks.id })
    .from(chunks)
    .where(and(inArray(chunks.id, chunkIds), isNotNull(chunks.embedding)));
  return new Set(rows.map((row) => row.id));
}

export interface CommitResult {
  sweptSections: number;
  sweptChunks: number;
}

export async function commitGeneration(
  db: Database,
  input: { sourceId: string; generation: number; contractVersion: string },
): Promise<CommitResult> {
  return db.transaction(async (tx) => {
    // The flip IS the commit: one UPDATE makes generation N the one readers
    // see. Everything before this line was invisible build-aside work.
    await tx
      .update(sources)
      .set({
        currentGeneration: input.generation,
        status: "ingested",
        contractVersion: input.contractVersion,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(sql`${sources.id} = ${input.sourceId}`);

    // Sweep is AFTER the flip, same transaction: a reader either saw the old
    // generation before the transaction or the new one after — never neither.
    const sweptSections = await tx
      .delete(documentSections)
      .where(
        and(
          sql`${documentSections.sourceId} = ${input.sourceId}`,
          lt(documentSections.generation, input.generation),
        ),
      )
      .returning({ id: documentSections.id });
    const sweptChunks = await tx
      .delete(chunks)
      .where(and(sql`${chunks.sourceId} = ${input.sourceId}`, lt(chunks.generation, input.generation)))
      .returning({ id: chunks.id });

    return { sweptSections: sweptSections.length, sweptChunks: sweptChunks.length };
  });
}
