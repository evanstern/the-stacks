/**
 * `ingest_batch_expand` job handler (008 research R6, FR-004): fans a ZIP
 * batch out into per-entry sources + `ingest_source` jobs. yauzl streams the
 * central directory — the archive is never inflated wholesale — and every
 * entry gets an individual outcome: admitted (source + job), or skipped with
 * a reason (unsupported type, nested ZIP, over the entry cap, duplicate
 * content). A bad entry NEVER fails the batch; a bad ZIP does, honestly.
 *
 * yauzl lives HERE and only here (boundary rule 5): ZIP handling is transport
 * concern of the async door, not parsing knowledge (that's plugins') and not
 * pipeline policy (that's @stacks/ingestion's).
 */
import { DomainError } from "@stacks/core";
import type { Database, Job } from "@stacks/db";
import { batches, recordIngestionEvent, sourceArchives } from "@stacks/db";
import { admitSource, sniffMediaType } from "@stacks/ingestion";
import { sql } from "drizzle-orm";
import yauzl from "yauzl";

interface ExpandPayload {
  batchId: string;
}

interface EntryOutcome {
  name: string;
  outcome: "ingested" | "skipped";
  reason?: string;
  sourceId?: string;
}

interface ZipEntry {
  name: string;
  bytes: Buffer;
}

/** Streams every non-directory entry out of the ZIP buffer. Rejects on a
 * corrupt archive — the caller turns that into an honest batch failure. */
function readZipEntries(buffer: Buffer, perEntryCap: number): Promise<Array<ZipEntry | { name: string; oversized: true }>> {
  return new Promise((resolve, reject) => {
    const entries: Array<ZipEntry | { name: string; oversized: true }> = [];
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      zip.on("error", reject);
      zip.on("end", () => resolve(entries));
      zip.on("entry", (entry: yauzl.Entry) => {
        if (/\/$/.test(entry.fileName)) return zip.readEntry(); // directory
        if (entry.uncompressedSize > perEntryCap) {
          entries.push({ name: entry.fileName, oversized: true });
          return zip.readEntry();
        }
        zip.openReadStream(entry, (streamErr, stream) => {
          if (streamErr) return reject(streamErr);
          const parts: Buffer[] = [];
          stream.on("data", (part: Buffer) => parts.push(part));
          stream.on("error", reject);
          stream.on("end", () => {
            entries.push({ name: entry.fileName, bytes: Buffer.concat(parts) });
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

export async function ingestBatchExpandHandler(db: Database, job: Job): Promise<void> {
  const { batchId } = job.payload as Partial<ExpandPayload>;
  if (!batchId) throw new Error(`ingest_batch_expand job ${job.id} has a malformed payload`);

  const [batch] = await db.select().from(batches).where(sql`${batches.id} = ${batchId}`);
  if (!batch) {
    throw new DomainError({
      class: "internal_fault",
      seam: "expand",
      message: `ingest_batch_expand references unknown batch ${batchId}.`,
    });
  }
  const [archive] = await db
    .select()
    .from(sourceArchives)
    .where(sql`${sourceArchives.fingerprint} = ${batch.fingerprint}`);
  if (!archive) {
    throw new DomainError({
      class: "internal_fault",
      seam: "expand",
      message: `batch ${batchId} has no archive ${batch.fingerprint}.`,
    });
  }

  const perEntryCap = Number.parseInt(process.env.INGEST_MAX_UPLOAD_BYTES ?? "26214400", 10);
  const entryCap = Number.parseInt(process.env.INGEST_MAX_BATCH_ENTRIES ?? "200", 10);

  await recordIngestionEvent(db, { batchId, stage: "expand", event: "started" });
  const startedAt = Date.now();

  let entries: Awaited<ReturnType<typeof readZipEntries>>;
  try {
    entries = await readZipEntries(Buffer.from(archive.bytes), perEntryCap);
    if (entries.length > entryCap) {
      throw new DomainError({
        class: "unsupported_type",
        seam: "expand",
        message: `ZIP contains ${entries.length} entries; the cap is ${entryCap} (INGEST_MAX_BATCH_ENTRIES).`,
      });
    }
  } catch (cause) {
    const error =
      cause instanceof DomainError
        ? cause
        : new DomainError({
            class: "unsupported_type",
            seam: "expand",
            message: "ZIP archive is corrupt or unreadable.",
            cause,
          });
    await recordIngestionEvent(db, {
      batchId,
      stage: "expand",
      event: "failed",
      detail: { class: error.class, message: error.message },
      durationMs: Date.now() - startedAt,
    });
    await db
      .update(batches)
      .set({ status: "failed", updatedAt: new Date() })
      .where(sql`${batches.id} = ${batchId}`);
    throw error;
  }

  const report: EntryOutcome[] = [];
  for (const entry of entries) {
    if ("oversized" in entry) {
      report.push({ name: entry.name, outcome: "skipped", reason: "entry exceeds the upload size cap" });
      continue;
    }

    const sniffed = sniffMediaType(entry.name, entry.bytes);
    if (!sniffed) {
      report.push({ name: entry.name, outcome: "skipped", reason: "unsupported entry type" });
      continue;
    }
    if (sniffed.mediaType === "application/zip") {
      // Bounded by POLICY, not recursion depth (spec edge case).
      report.push({ name: entry.name, outcome: "skipped", reason: "nested ZIP archives are not supported" });
      continue;
    }

    const admitted = await admitSource(db, {
      corpusId: batch.corpusId,
      batchId,
      filename: entry.name,
      bytes: entry.bytes,
      mediaType: sniffed.mediaType,
    });
    report.push(
      admitted.duplicate
        ? {
            name: entry.name,
            outcome: "skipped",
            reason: "duplicate content already in the corpus",
            sourceId: admitted.source.id,
          }
        : { name: entry.name, outcome: "ingested", sourceId: admitted.source.id },
    );
  }

  // Per-entry skip events land in the batch trail (contracts/events.md).
  for (const entry of report) {
    if (entry.outcome === "skipped") {
      await recordIngestionEvent(db, {
        batchId,
        stage: "expand",
        event: "skipped",
        detail: { entryName: entry.name, reason: entry.reason },
      });
    }
  }

  const ingestible = report.filter((entry) => entry.outcome === "ingested").length;
  await db
    .update(batches)
    .set({
      // Zero ingestible entries is `empty` — an HONEST outcome, distinct from
      // `failed` (nothing broke; there was just nothing to ingest — R6).
      status: ingestible > 0 ? "expanded" : "empty",
      entryReport: report,
      updatedAt: new Date(),
    })
    .where(sql`${batches.id} = ${batchId}`);
  await recordIngestionEvent(db, {
    batchId,
    stage: "expand",
    event: "completed",
    detail: { entries: report.length, ingestible },
    durationMs: Date.now() - startedAt,
  });
}
