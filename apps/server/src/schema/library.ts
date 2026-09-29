import { sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/**
 * The library plane's storage (spec 013): imported reference books as
 * documents, chunks, and per-model embeddings.
 *
 * **Immutable after ingestion** (constitution III): UPDATE on any of these
 * three tables is refused by a database trigger hand-added to the generated
 * migration (research R4) — Drizzle's schema DSL can't express a trigger.
 * DELETE is allowed (wholesale replace, operator removal) and cascades
 * documents → chunks → embeddings via `ON DELETE CASCADE`.
 */

/** `tsvector`, generated from `text` (research R3) — no `customType` for it ships in drizzle-orm@0.45. */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const libraryDocuments = pgTable(
  "library_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    book: text("book").notNull(),
    text: text("text").notNull(),
    contentHash: text("content_hash"),
    source: jsonb("source"),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Case-insensitive, trimmed uniqueness (research R8, edge case): a
    // re-import of the same book replaces it wholesale rather than
    // coexisting under a differently-cased or padded name.
    uniqueIndex("library_documents_book_key").on(
      sql`lower(trim(${table.book}))`,
    ),
  ],
);

export const libraryChunks = pgTable(
  "library_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => libraryDocuments.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    // The parser's block kinds (data-model.md) — a CHECK-constrained text
    // column, not an enum, same reasoning as `users.role`.
    kind: text("kind").notNull(),
    // Section path (headings), outermost first.
    path: text("path").array().notNull(),
    text: text("text").notNull(),
    // UTF-16 offsets into the document's text, the same unit the parser
    // and JS `String.slice` use (research R5) — the store-time equality
    // check (`text.slice(start, end) === chunk.text`) lives in TS, not
    // here, for exactly that reason.
    startOffset: integer("start_offset").notNull(),
    endOffset: integer("end_offset").notNull(),
    // Populated automatically on insert (spec US2 AC2) — never written by
    // application code.
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('english', "text")`),
  },
  (table) => [
    uniqueIndex("library_chunks_document_ordinal_key").on(
      table.documentId,
      table.ordinal,
    ),
    check(
      "library_chunks_kind_valid",
      sql`${table.kind} IN ('heading', 'prose', 'list', 'table', 'statBlock', 'sidebar')`,
    ),
    check(
      "library_chunks_span_valid",
      sql`${table.startOffset} >= 0 AND ${table.endOffset} > ${table.startOffset}`,
    ),
    index("library_chunks_tsv_idx").using("gin", table.tsv),
  ],
);

export const libraryEmbeddings = pgTable(
  "library_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => libraryChunks.id, { onDelete: "cascade" }),
    // The gateway's model name (decision-0002): one row per chunk per
    // model, so a model switch is a re-embed job, never a schema change.
    model: text("model").notNull(),
    dim: integer("dim").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("library_embeddings_chunk_model_key").on(
      table.chunkId,
      table.model,
    ),
    index("library_embeddings_model_idx").on(table.model),
    check("library_embeddings_dim_valid", sql`${table.dim} = 1024`),
    // Cosine: embedding models are trained for it and it is insensitive to
    // vector norm across providers behind the gateway (research R2). HNSW:
    // builds incrementally with no training data, so it is valid on an
    // empty table from the first migration (unlike IVFFlat).
    // ponytail: one HNSW index shared by every model, no per-model partial
    // indexes — add when TASK-0029 shows filtered recall dropping at scale.
    index("library_embeddings_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);
