import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import yauzl from "yauzl";

/**
 * Thin wrapper over `yauzl@^3.4.0` (operator ruling 2026-09-29;
 * specs/017-ingestion-pipeline research R2, contracts/ingest-modules.md).
 * Callers never import `yauzl` directly. Guards: encryption and an
 * unsupported compression method are rejected before any stream opens;
 * every read/extract is CRC-checked (`yauzl` does not verify CRC-32
 * itself) and its declared size is debited against a shared extraction
 * budget (zip-bomb guards). zip64 is supported — `yauzl` reads the zip64
 * extra field.
 */

export const MAX_ZIP_DEPTH = 3;
export const MAX_PAGE_BYTES = 16 * 1024 * 1024;
export const EXTRACT_BUDGET_BYTES = 2 * 1024 * 1024 * 1024;

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipError";
  }
}

export interface ZipEntryInfo {
  name: string;
  size: number;
  compressedSize: number;
  crc32: number;
  isDirectory: boolean;
}

/** What the visitor wants done with an entry. */
export type EntryAction = "skip" | "read" | "extract";

/** Shared across one job's whole nested walk. */
export interface ZipBudget {
  remaining: number;
}

export interface WalkZipOptions {
  tmpDir: string;
  budget: ZipBudget;
  decide(entry: ZipEntryInfo): EntryAction;
  onRead(entry: ZipEntryInfo, data: Buffer): Promise<void> | void;
  onExtract(entry: ZipEntryInfo, innerZipPath: string): Promise<void>;
}

function toEntryInfo(entry: yauzl.Entry): ZipEntryInfo {
  return {
    name: entry.fileName,
    size: entry.uncompressedSize,
    compressedSize: entry.compressedSize,
    crc32: entry.crc32,
    isDirectory: entry.fileName.endsWith("/"),
  };
}

function debit(budget: ZipBudget, bytes: number): void {
  budget.remaining -= bytes;
  if (budget.remaining < 0) {
    throw new ZipError("Zip extraction budget exceeded (zip-bomb guard).");
  }
}

/**
 * Marks an error thrown by a caller-supplied `decide`/`onRead`/`onExtract`
 * callback, so the walk's own catch-all (below) can tell "the caller
 * rejected this page" apart from "the zip itself is broken" and re-throw
 * the caller's original error unwrapped, instead of a `ZipError`.
 */
class CallbackError extends Error {
  constructor(readonly original: unknown) {
    super("ingest callback error");
  }
}

function guardOpenable(entry: yauzl.Entry): void {
  if (entry.isEncrypted()) {
    throw new ZipError("Encrypted zip entries are not supported.");
  }
  if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
    throw new ZipError(
      `Unsupported zip compression method ${entry.compressionMethod}.`,
    );
  }
}

async function readEntryToBuffer(
  zipfile: yauzl.ZipFile,
  entry: yauzl.Entry,
): Promise<Buffer> {
  const stream = await zipfile.openReadStreamPromise(entry);
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > MAX_PAGE_BYTES) {
      stream.destroy();
      throw new ZipError(
        `Zip entry exceeds MAX_PAGE_BYTES (${MAX_PAGE_BYTES}).`,
      );
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function extractEntryToFile(
  zipfile: yauzl.ZipFile,
  entry: yauzl.Entry,
  destPath: string,
): Promise<void> {
  const stream = await zipfile.openReadStreamPromise(entry);
  let running = 0;
  const crcCheck = new Transform({
    transform(chunk: Buffer, _enc, callback) {
      running = zlib.crc32(chunk, running);
      callback(null, chunk);
    },
  });
  await pipeline(stream, crcCheck, createWriteStream(destPath));
  if (running !== entry.crc32) {
    throw new ZipError("CRC-32 mismatch on extracted zip entry.");
  }
}

/**
 * Opens `path` with `yauzl` and visits its entries one at a time, in
 * central-directory order, calling `readEntry()` (via `eachEntry()`) only
 * after the previous visit resolves. The handle is closed in a `finally`.
 */
export async function walkZip(
  filePath: string,
  opts: WalkZipOptions,
): Promise<void> {
  let zipfile: yauzl.ZipFile;
  try {
    zipfile = await yauzl.openPromise(filePath, {
      lazyEntries: true,
      autoClose: false,
      decodeStrings: true,
      validateEntrySizes: true,
      strictFileNames: false,
    });
  } catch (err) {
    throw new ZipError(
      `Could not open zip file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    for await (const entry of zipfile.eachEntry()) {
      const info = toEntryInfo(entry);
      let action: EntryAction;
      try {
        action = opts.decide(info);
      } catch (err) {
        throw new CallbackError(err);
      }
      if (action === "skip") continue;

      guardOpenable(entry);
      debit(opts.budget, entry.uncompressedSize);

      if (action === "read") {
        if (entry.uncompressedSize > MAX_PAGE_BYTES) {
          throw new ZipError(
            `Zip entry exceeds MAX_PAGE_BYTES (${MAX_PAGE_BYTES}).`,
          );
        }
        const buf = await readEntryToBuffer(zipfile, entry);
        if (zlib.crc32(buf) !== entry.crc32) {
          throw new ZipError("CRC-32 mismatch on zip entry.");
        }
        try {
          await opts.onRead(info, buf);
        } catch (err) {
          throw new CallbackError(err);
        }
        continue;
      }

      // A per-call counter would restart at 1 for every nested walkZip
      // call while all levels share opts.tmpDir — a nested zip's first
      // extraction could then collide with (and truncate) an ancestor's
      // still-open temp file of the same name. A UUID is unique across
      // the whole nested walk regardless of depth or sibling order.
      const destPath = path.join(opts.tmpDir, `${randomUUID()}.zip`);
      try {
        await extractEntryToFile(zipfile, entry, destPath);
        try {
          await opts.onExtract(info, destPath);
        } catch (err) {
          throw new CallbackError(err);
        }
      } finally {
        await unlink(destPath).catch(() => {});
      }
    }
  } catch (err) {
    if (err instanceof CallbackError) throw err.original;
    if (err instanceof ZipError) throw err;
    throw new ZipError(
      `Zip read failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    zipfile.close();
  }
}
