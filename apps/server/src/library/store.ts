import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { ZodError } from "zod";
import type { createDb } from "../db.js";
import { ConflictError, type ErrorIssue, ValidationError } from "../errors.js";
import { libraryChunks, libraryDocuments } from "../schema/library.js";
import { type ParsedBook, ParsedBookSchema } from "./ddb/index.js";

/**
 * The library plane's only write path (contracts/library-store.md,
 * specs/013-library-schema US1). `attachEmbeddings` (US3) is a later phase.
 */

export type DbClient = ReturnType<typeof createDb>;

export interface StoreParsedBookMeta {
  source?: { files?: string[]; bytes?: number };
}

export interface StoreParsedBookResult {
  documentId: string;
  chunkCount: number;
  replaced: boolean;
}

// 7 params per chunk row (documentId, ordinal, kind, path, text,
// startOffset, endOffset); comfortably under Postgres's 65,535-parameter
// limit per statement so an ~8,000-chunk book (the PHB, research R6/SC-005)
// inserts in a handful of round trips rather than exceeding it.
const CHUNK_INSERT_BATCH_SIZE = 2000;

const POSTGRES_UNIQUE_VIOLATION = "23505";

// Same shape and reasoning as auth/invitations.ts's isUniqueViolation: the
// pg driver's raw error, not wrapped by Drizzle, for insert operations.
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === POSTGRES_UNIQUE_VIOLATION
  );
}

function zodIssues(error: ZodError): ErrorIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

/**
 * Span integrity (research R5, contracts/library-store.md invariant 1):
 * checked in TS, not the database, because offsets are UTF-16 (the
 * parser's and JS `String.slice`'s unit) and a DB-side `substring()` check
 * would compare Postgres character offsets instead, diverging on astral
 * text. Throws on the first bad block; nothing is written.
 */
function validateSpans(book: ParsedBook): void {
  const issues: ErrorIssue[] = [];
  book.blocks.forEach((block, i) => {
    const { start, end } = block.anchor;
    if (!(start >= 0 && start < end)) {
      issues.push({
        path: `blocks.${i}.anchor`,
        message: "span must be a non-empty, non-reversed range (start < end)",
      });
      return;
    }
    if (end > book.text.length) {
      issues.push({
        path: `blocks.${i}.anchor`,
        message: "span end must not exceed the document text length",
      });
      return;
    }
    if (book.text.slice(start, end) !== block.text) {
      issues.push({
        path: `blocks.${i}.text`,
        message:
          "block text does not match the document text sliced at its span",
      });
    }
  });
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
}

/**
 * Stores a parsed book as one document plus its ordered chunks
 * (contracts/library-store.md). Validates everything before touching the
 * database (invariant 1); a book already stored under the same
 * case/whitespace-insensitive name is replaced wholesale, atomically
 * (invariant 2, FR-010).
 */
export async function storeParsedBook(
  db: DbClient,
  book: ParsedBook,
  meta: StoreParsedBookMeta = {},
): Promise<StoreParsedBookResult> {
  const parsed = ParsedBookSchema.safeParse(book);
  if (!parsed.success) {
    throw new ValidationError(zodIssues(parsed.error));
  }
  const validBook = parsed.data;
  validateSpans(validBook);

  const contentHash = createHash("sha256").update(validBook.text).digest("hex");

  try {
    return await db.transaction(async (tx) => {
      // Lock any existing document under this book key for the duration of
      // the transaction (research R8): concurrent stores of the same book
      // serialize here rather than racing to insert.
      const [existing] = await tx
        .select({ id: libraryDocuments.id })
        .from(libraryDocuments)
        .where(
          sql`lower(trim(${libraryDocuments.book})) = lower(trim(${validBook.book}))`,
        )
        .for("update");

      const replaced = Boolean(existing);
      if (existing) {
        // Cascades to chunks and their embeddings (ON DELETE CASCADE).
        await tx
          .delete(libraryDocuments)
          .where(eq(libraryDocuments.id, existing.id));
      }

      const [doc] = await tx
        .insert(libraryDocuments)
        .values({
          book: validBook.book,
          text: validBook.text,
          contentHash,
          source: meta.source ?? null,
        })
        .returning({ id: libraryDocuments.id });

      for (
        let i = 0;
        i < validBook.blocks.length;
        i += CHUNK_INSERT_BATCH_SIZE
      ) {
        const batch = validBook.blocks
          .slice(i, i + CHUNK_INSERT_BATCH_SIZE)
          .map((block, offset) => ({
            documentId: doc.id,
            ordinal: i + offset,
            kind: block.kind,
            path: block.path,
            text: block.text,
            startOffset: block.anchor.start,
            endOffset: block.anchor.end,
          }));
        await tx.insert(libraryChunks).values(batch);
      }

      return {
        documentId: doc.id,
        chunkCount: validBook.blocks.length,
        replaced,
      };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError(
        "A document with this book name was just created by another writer.",
      );
    }
    throw err;
  }
}
