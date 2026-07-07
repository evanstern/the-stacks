/**
 * Ingestion intake — the synchronous front door (008 FR-001..005, research
 * R7; contracts/api.md). The ONLY work done while the operator waits:
 * validate, fingerprint, archive, enqueue, answer with a claim ticket.
 * Everything slower is the worker's job (Principle IV, accept-then-async).
 *
 * Refusals are typed and residue-free: unsupported/oversized submissions
 * throw DomainError BEFORE any row is written — the app.ts error handler owns
 * the HTTP mapping (unsupported_type -> 415), never this file.
 */
import multipart from "@fastify/multipart";
import { DomainError } from "@stacks/core";
import type { Database } from "@stacks/db";
import { corpora } from "@stacks/db";
import { admitBatch, admitSource, sniffMediaType } from "@stacks/ingestion";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export interface IngestionRoutesDeps {
  db: Database;
  /** Injectable for tests; env-resolved in main.ts wiring. */
  maxUploadBytes?: number;
}

export async function registerIngestionRoutes(
  app: FastifyInstance,
  deps: IngestionRoutesDeps,
): Promise<void> {
  const { db } = deps;
  const maxUploadBytes =
    deps.maxUploadBytes ?? Number.parseInt(process.env.INGEST_MAX_UPLOAD_BYTES ?? "26214400", 10);

  // The size cap is enforced INSIDE the multipart stream (limits.fileSize):
  // an oversized upload is refused without ever being buffered whole (R7).
  await app.register(multipart, { limits: { fileSize: maxUploadBytes, files: 1 } });

  app.post("/api/uploads", async (request, reply) => {
    const file = await request.file();
    if (!file) {
      throw new DomainError({
        class: "unsupported_type",
        message: "Upload requires exactly one multipart 'file' field.",
      });
    }

    let bytes: Buffer;
    try {
      bytes = await file.toBuffer();
    } catch {
      // @fastify/multipart aborts the buffer once limits.fileSize trips.
      throw new DomainError({
        class: "unsupported_type",
        message: `File exceeds the upload size limit (${maxUploadBytes} bytes, INGEST_MAX_UPLOAD_BYTES).`,
      });
    }

    // Magic bytes + extension — the client's declared content type is never
    // trusted (renamed-binary edge case sniffs as null and is refused here).
    const sniffed = sniffMediaType(file.filename, bytes);
    if (!sniffed) {
      throw new DomainError({
        class: "unsupported_type",
        message: `Unsupported file type: "${file.filename}". Supported: HTML, Markdown, plain text, ZIP. (PDF is deliberately unsupported in v3.)`,
      });
    }

    const corpusField = file.fields["corpus"];
    const corpusName =
      corpusField && "value" in corpusField && typeof corpusField.value === "string"
        ? corpusField.value
        : "default";
    const [corpus] = await db.select().from(corpora).where(sql`${corpora.name} = ${corpusName}`);
    if (!corpus) {
      throw new DomainError({ class: "unknown_thing", message: `No such corpus: "${corpusName}".` });
    }

    if (sniffed.mediaType === "application/zip") {
      const { batch, duplicate } = await admitBatch(db, {
        corpusId: corpus.id,
        filename: file.filename,
        bytes,
      });
      // Duplicate content answers 200 with the EXISTING ticket — the operator
      // learns why nothing new happened (FR-003); new content answers 201.
      reply.code(duplicate ? 200 : 201);
      return {
        ticket: { kind: "batch", id: batch.id },
        duplicate,
        status: batch.status,
      };
    }

    const { source, duplicate } = await admitSource(db, {
      corpusId: corpus.id,
      filename: file.filename,
      bytes,
      mediaType: sniffed.mediaType,
    });
    reply.code(duplicate ? 200 : 201);
    return {
      ticket: { kind: "source", id: source.id },
      duplicate,
      status: source.status,
    };
  });
}
