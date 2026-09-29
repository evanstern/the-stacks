import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../auth/middleware.js";
import { createAuthMiddleware } from "../auth/middleware.js";
import type { DbClient, ValidateSession } from "../auth/session.js";
import {
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnauthorizedError,
  ValidationError,
} from "../errors.js";
import {
  enqueueIngest,
  getJob,
  type JobFormat,
  type JobStatus,
  listJobs,
} from "../library/ingest/jobs.js";

const JobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * `POST /library/uploads` (specs/017-ingestion-pipeline
 * contracts/http-ingest.md, research R1). Streams the file part straight to
 * disk through `busboy` — never `parseBody`/`formData`/`arrayBuffer`/`text`
 * on the upload — and only touches the database (job insert) once the file
 * is fully and successfully on disk.
 */

const ONE_MIB = 1024 * 1024;
const ZIP_LOCAL_SIG = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_EMPTY_SIG = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

const BookFieldSchema = z.string().trim().min(1).max(200);

function oversizeMessage(uploadMaxBytes: number): string {
  return `Upload exceeds the configured limit of ${uploadMaxBytes} bytes (UPLOAD_MAX_BYTES).`;
}

function detectFormat(first4: Buffer, filename: string): JobFormat {
  if (
    first4.length >= 4 &&
    (first4.subarray(0, 4).equals(ZIP_LOCAL_SIG) ||
      first4.subarray(0, 4).equals(ZIP_EMPTY_SIG))
  ) {
    return "zip";
  }
  if (/\.(md|markdown)$/i.test(filename)) return "markdown";
  return "html";
}

/** Records the file part's total byte count and first 4 bytes, unchanged. */
class ByteCounter extends Transform {
  bytes = 0;
  first4 = Buffer.alloc(0);

  override _transform(
    chunk: Buffer,
    _encoding: string,
    callback: (error?: Error | null, data?: Buffer) => void,
  ) {
    if (this.first4.length < 4) {
      this.first4 = Buffer.concat([this.first4, chunk]).subarray(0, 4);
    }
    this.bytes += chunk.length;
    callback(null, chunk);
  }
}

async function safeUnlink(filePath: string | undefined): Promise<void> {
  if (!filePath) return;
  await unlink(filePath).catch(() => {});
}

export interface CreateLibraryRoutesOptions {
  db: DbClient;
  validateSession: ValidateSession;
  uploadMaxBytes: number;
  uploadDir: string;
  onEnqueued: () => void;
}

/**
 * Streams the multipart body to disk and returns the queued job. Rejects
 * with `ValidationError`/`PayloadTooLargeError`/`ConflictError`; on any
 * rejection the caller's `finally` deletes the temp file (contract
 * guarantee 2).
 */
async function handleUpload(
  c: Context<{ Variables: AuthVariables }>,
  opts: { db: DbClient; uploadMaxBytes: number; uploadDir: string },
): Promise<JobStatus> {
  let bb: ReturnType<typeof Busboy>;
  try {
    bb = Busboy({
      headers: { "content-type": c.req.header("content-type") ?? "" },
      limits: {
        files: 1,
        fields: 4,
        fieldSize: 1024,
        parts: 5,
        fileSize: opts.uploadMaxBytes,
      },
    });
  } catch {
    throw new ValidationError([
      { path: "(root)", message: "Expected multipart/form-data." },
    ]);
  }

  const webBody = c.req.raw.body;
  const source = webBody ? Readable.fromWeb(webBody) : Readable.from([]);

  const fields = new Map<string, string>();
  // Left without an initializer: a `let x: T | undefined = value` would have
  // TypeScript's control-flow analysis narrow `x` to that literal value at
  // every read outside the closures below (a known CFA quirk), which is
  // wrong here — these are only ever set inside the busboy event handlers.
  let tempPath: string | undefined;
  let fileSeen = false;
  let filename = "upload";
  let fileIssue: string | undefined;
  let counter: ByteCounter | undefined;
  let activeFileStream: (Readable & { truncated?: boolean }) | undefined;
  let activeWriteStream: ReturnType<typeof createWriteStream> | undefined;
  let pipelineDone: Promise<unknown> | undefined;

  function earlyRefuse() {
    c.header("Connection", "close");
    source.unpipe(bb);
    source.destroy();
    activeFileStream?.destroy();
    activeWriteStream?.destroy();
  }

  // Everything from here on either returns the queued job or throws; on ANY
  // throw the outer `finally` deletes the temp file (contract guarantee 2 —
  // "on any non-202 outcome... the partial file is deleted").
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (err: Error, early = false) => {
        if (settled) return;
        settled = true;
        if (early) earlyRefuse();
        // Wait for any in-flight write pipeline to fully settle (its fd
        // closed) before rejecting — otherwise the caller's cleanup can
        // `unlink` a temp file a moment before the abandoned write actually
        // creates or finishes writing it, orphaning it on disk.
        Promise.resolve(pipelineDone)
          .catch(() => {})
          .finally(() => reject(err));
      };
      const succeed = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      bb.on("field", (name, value, info) => {
        if (info.valueTruncated) {
          fail(
            new ValidationError([
              { path: name, message: "Field value too long." },
            ]),
            true,
          );
          return;
        }
        fields.set(name, value);
      });

      bb.on("file", (name, stream, info) => {
        if (name !== "file") {
          fileIssue = fileIssue ?? "A file part is required.";
          stream.resume();
          return;
        }
        fileSeen = true;
        filename = (info.filename || "upload").slice(0, 255);
        tempPath = path.join(opts.uploadDir, `${randomUUID()}.upload`);
        counter = new ByteCounter();
        activeFileStream = stream;
        activeWriteStream = createWriteStream(tempPath);

        stream.on("limit", () => {
          fail(
            new PayloadTooLargeError(oversizeMessage(opts.uploadMaxBytes)),
            true,
          );
        });

        pipelineDone = pipeline(stream, counter, activeWriteStream).catch(
          (err) => {
            // A "limit" (or another early refusal) may have already failed
            // the promise; this is just the pipeline unwinding — fail() is
            // a no-op once settled.
            fail(err instanceof Error ? err : new Error(String(err)), true);
          },
        );
      });

      bb.on("filesLimit", () => {
        fail(
          new ValidationError([
            { path: "file", message: "Exactly one file part is allowed." },
          ]),
          true,
        );
      });
      bb.on("fieldsLimit", () => {
        fail(
          new ValidationError([
            { path: "(root)", message: "Too many fields." },
          ]),
          true,
        );
      });
      bb.on("partsLimit", () => {
        fail(
          new ValidationError([{ path: "(root)", message: "Too many parts." }]),
          true,
        );
      });
      bb.on("error", (err) => {
        fail(err instanceof Error ? err : new Error(String(err)), true);
      });
      // Wait for busboy's `close` AND the write stream's `finish` (via
      // `pipelineDone`) before declaring success — either can lag the other.
      bb.on("close", () => {
        Promise.resolve(pipelineDone).then(() => {
          if (activeFileStream?.truncated) {
            fail(
              new PayloadTooLargeError(oversizeMessage(opts.uploadMaxBytes)),
              true,
            );
            return;
          }
          succeed();
        });
      });

      source.on("error", (err) => fail(err, true));
      source.pipe(bb);
    });

    if (!fileSeen) {
      throw new ValidationError([
        { path: "file", message: "A file part is required." },
      ]);
    }
    if (fileIssue) {
      throw new ValidationError([{ path: "file", message: fileIssue }]);
    }

    const bookParsed = BookFieldSchema.safeParse(fields.get("book"));
    if (!bookParsed.success) {
      throw new ValidationError([
        { path: "book", message: "book is required, 1-200 characters." },
      ]);
    }

    const bytes = counter?.bytes ?? 0;
    if (bytes === 0) {
      throw new ValidationError([
        { path: "file", message: "Upload body is empty." },
      ]);
    }

    const format = detectFormat(counter?.first4 ?? Buffer.alloc(0), filename);

    // fileSeen (checked above) is only ever set alongside tempPath.
    if (!tempPath) throw new Error("unreachable: fileSeen without tempPath");

    return await enqueueIngest(opts.db, {
      book: bookParsed.data,
      format,
      filename,
      bytes,
      uploadPath: tempPath,
    });
  } catch (err) {
    await safeUnlink(tempPath);
    throw err;
  }
}

export function createLibraryRoutes({
  db,
  validateSession,
  uploadMaxBytes,
  uploadDir,
  onEnqueued,
}: CreateLibraryRoutesOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();
  const authMiddleware = createAuthMiddleware(validateSession);
  route.use("*", authMiddleware);

  function requireOperator(c: Context<{ Variables: AuthVariables }>) {
    const identity = c.get("identity");
    if (!identity) throw new UnauthorizedError();
    if (identity.role !== "operator") throw new ForbiddenError();
  }

  route.post("/uploads", async (c) => {
    requireOperator(c);

    const contentLengthHeader = c.req.header("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (
        Number.isFinite(contentLength) &&
        contentLength > uploadMaxBytes + ONE_MIB
      ) {
        c.header("Connection", "close");
        throw new PayloadTooLargeError(oversizeMessage(uploadMaxBytes));
      }
    }

    const job = await handleUpload(c, { db, uploadMaxBytes, uploadDir });
    onEnqueued();
    return c.json({ job }, 202);
  });

  route.get("/jobs", async (c) => {
    requireOperator(c);
    const parsedQuery = JobsQuerySchema.safeParse({
      limit: c.req.query("limit"),
    });
    if (!parsedQuery.success) {
      throw new ValidationError([
        { path: "limit", message: "limit must be an integer 1-100." },
      ]);
    }
    // listJobs already serializes each row through JobStatusSchema.
    const jobs = await listJobs(db, parsedQuery.data.limit);
    return c.json({ jobs });
  });

  route.get("/jobs/:id", async (c) => {
    requireOperator(c);
    const id = c.req.param("id");
    if (!z.string().uuid().safeParse(id).success) {
      throw new NotFoundError();
    }
    // getJob already serializes through JobStatusSchema.
    const job = await getJob(db, id);
    if (!job) throw new NotFoundError();
    return c.json({ job });
  });

  return route;
}
