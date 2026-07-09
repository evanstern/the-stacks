/**
 * Admission — the one code path that turns bytes into (archive, source/batch,
 * queued job) atomically. Both doors use it: API intake (whole uploads, R7)
 * and the worker's ZIP expansion (per entry, R6). One path means dedupe,
 * archiving, and enqueueing can never disagree between doors.
 *
 * Everything commits in ONE transaction — the queue being a Postgres table
 * (D12) is exactly what makes "archive + source + job" atomic: a source can
 * never exist without its job, a job never without its archive.
 *
 * Dedupe (FR-003) is the schema's unique (corpus_id, fingerprint) index doing
 * the work: we optimistically insert, and a conflict MEANS duplicate — no
 * check-then-insert race.
 */
import { deriveArchiveFingerprint } from "@stacks/core";
import type { Database } from "@stacks/db";
import { batches, enqueue, recordIngestionEvent, sourceArchives, sources } from "@stacks/db";
import { and, sql } from "drizzle-orm";

export interface AdmitSourceInput {
  corpusId: string;
  batchId?: string;
  filename: string;
  bytes: Buffer;
  mediaType: string;
}

export interface AdmitSourceResult {
  source: typeof sources.$inferSelect;
  duplicate: boolean;
}

export async function admitSource(db: Database, input: AdmitSourceInput): Promise<AdmitSourceResult> {
  const fingerprint = deriveArchiveFingerprint(input.bytes);

  return db.transaction(async (tx) => {
    // Content-addressed: same bytes, same row — re-insert is a no-op (R1).
    await tx
      .insert(sourceArchives)
      .values({
        fingerprint,
        bytes: input.bytes,
        byteSize: input.bytes.length,
        mediaType: input.mediaType,
      })
      .onConflictDoNothing();

    const inserted = await tx
      .insert(sources)
      .values({
        corpusId: input.corpusId,
        batchId: input.batchId,
        fingerprint,
        originalFilename: input.filename,
      })
      .onConflictDoNothing({ target: [sources.corpusId, sources.fingerprint] })
      .returning();

    const source = inserted[0];
    if (!source) {
      // Conflict = this corpus already has this CONTENT (filename is never
      // identity). Answer with the existing source's ticket (FR-003).
      const [existing] = await tx
        .select()
        .from(sources)
        .where(and(sql`${sources.corpusId} = ${input.corpusId}`, sql`${sources.fingerprint} = ${fingerprint}`));
      return { source: existing!, duplicate: true };
    }

    // New content: job + intake event commit atomically with the source row.
    await enqueue(tx as unknown as Database, {
      kind: "ingest_source",
      payload: { sourceId: source.id, targetGeneration: 1 },
    });
    await recordIngestionEvent(tx as unknown as Database, {
      sourceId: source.id,
      stage: "intake",
      event: "completed",
      detail: { byteSize: input.bytes.length, mediaType: input.mediaType, duplicate: false },
    });
    return { source, duplicate: false };
  });
}

export interface AdmitBatchInput {
  corpusId: string;
  filename: string;
  bytes: Buffer;
}

export interface AdmitBatchResult {
  batch: typeof batches.$inferSelect;
  duplicate: boolean;
}

export async function admitBatch(db: Database, input: AdmitBatchInput): Promise<AdmitBatchResult> {
  const fingerprint = deriveArchiveFingerprint(input.bytes);

  return db.transaction(async (tx) => {
    await tx
      .insert(sourceArchives)
      .values({
        fingerprint,
        bytes: input.bytes,
        byteSize: input.bytes.length,
        mediaType: "application/zip",
      })
      .onConflictDoNothing();

    const inserted = await tx
      .insert(batches)
      .values({ corpusId: input.corpusId, fingerprint, originalFilename: input.filename })
      .onConflictDoNothing({ target: [batches.corpusId, batches.fingerprint] })
      .returning();

    const batch = inserted[0];
    if (!batch) {
      const [existing] = await tx
        .select()
        .from(batches)
        .where(and(sql`${batches.corpusId} = ${input.corpusId}`, sql`${batches.fingerprint} = ${fingerprint}`));
      return { batch: existing!, duplicate: true };
    }

    await enqueue(tx as unknown as Database, {
      kind: "ingest_batch_expand",
      payload: { batchId: batch.id },
    });
    await recordIngestionEvent(tx as unknown as Database, {
      batchId: batch.id,
      stage: "intake",
      event: "completed",
      detail: { byteSize: input.bytes.length, mediaType: "application/zip", duplicate: false },
    });
    return { batch, duplicate: false };
  });
}
