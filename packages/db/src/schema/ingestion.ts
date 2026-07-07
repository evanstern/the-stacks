/**
 * Ingestion schema (spec 008, specs/008-ingestion-service/data-model.md) —
 * seven tables carrying the pipeline's four data disciplines:
 *
 *   1. IMMUTABLE ARCHIVES (source_archives): content-addressed bytea, the
 *      permanent "what went in" (R1). Append-only BY CONSTRUCTION — intake and
 *      expand insert; no UPDATE/DELETE path exists anywhere in code (FR-023).
 *   2. GENERATION-FLIP REPLACEMENT (sources.current_generation): derived rows
 *      (sections, chunks) are written ASIDE at generation N+1, then one UPDATE
 *      flips the pointer and the old generation is swept — readers filtering
 *      on the current generation never see a half-swapped source (R8).
 *   3. DETERMINISTIC IDENTITY (sections.id, chunks.id): sha256 of provenance +
 *      position + content (@stacks/core ingestion-ids), so retries are no-ops
 *      via ON CONFLICT DO NOTHING (R9, SC-004).
 *   4. APPEND-ONLY EVENTS (ingestion_events): the authoritative history; the
 *      sole writer is recordIngestionEvent in ../ingestion-events.ts
 *      (Principle IV — same construction as skeleton_check_events).
 *
 * Conventions follow the skeleton: text + CHECK over pg enums (adding a state
 * is a one-line migration, not an ALTER TYPE dance); timestamptz everywhere.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { bytea, tsvector, vector } from "./column-types";

/** Exactly one row ("default") exists in v3, seeded by migration — but every
 * source and chunk carries corpus_id so multi-corpus returns cheaply (D4,
 * FR-022). The door stays open; nothing walks through it yet. */
export const corpora = pgTable("corpora", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Content addressing IS the key: fingerprint = sha256(bytes), so dedupe
 * (FR-003) is a primary-key lookup and immutability has no update to forget. */
export const sourceArchives = pgTable("source_archives", {
  fingerprint: text("fingerprint").primaryKey(),
  bytes: bytea("bytes").notNull(),
  // Denormalized so listings never have to lift the bytea column.
  byteSize: integer("byte_size").notNull(),
  // Sniffed from magic bytes at intake (R7) — never the client's declaration.
  mediaType: text("media_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One ZIP submission. Its per-entry outcomes land in entry_report once at
 * expand completion; per-entry sources link back via sources.batch_id. */
export const batches = pgTable(
  "batches",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    corpusId: uuid("corpus_id")
      .notNull()
      .references(() => corpora.id),
    originalFilename: text("original_filename").notNull(),
    // `empty` = zero ingestible entries — an honest terminal outcome (R6),
    // distinct from `failed` (the expand itself broke).
    status: text("status").notNull().default("expanding"),
    // [{ name, outcome: "ingested"|"skipped", reason?, sourceId? }]
    entryReport: jsonb("entry_report").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "batches_status_check",
      sql`${table.status} IN ('expanding', 'expanded', 'failed', 'empty')`,
    ),
  ],
);

/** One ingestible unit and its lifecycle. status is a DERIVED convenience for
 * listings; ingestion_events is the authoritative history (Principle IV). */
export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    corpusId: uuid("corpus_id")
      .notNull()
      .references(() => corpora.id),
    batchId: uuid("batch_id").references(() => batches.id),
    fingerprint: text("fingerprint")
      .notNull()
      .references(() => sourceArchives.fingerprint),
    originalFilename: text("original_filename").notNull(),
    status: text("status").notNull().default("queued"),
    // Which plugin claimed this source, at what confidence (FR-011) — NULL
    // until detect runs. (plugin_name, plugin_version) is FR-016's
    // re-ingestion index: "which sources did version X produce?"
    pluginName: text("plugin_name"),
    pluginVersion: text("plugin_version"),
    detectConfidence: real("detect_confidence"),
    // 0 = nothing ingested yet. The flip of this integer is THE atomic commit
    // of an ingest run (R8); readers join through it.
    currentGeneration: integer("current_generation").notNull().default(0),
    // NormalizedDocument version the current generation was produced under —
    // a contract MAJOR bump enumerates re-ingestion candidates like a plugin
    // bump does (contracts/normalized-document.md).
    contractVersion: text("contract_version"),
    // Scrubbed { class, stage, message } copy for status reads; full
    // diagnostics live in the event trail and operator logs.
    lastError: jsonb("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "sources_status_check",
      sql`${table.status} IN ('queued', 'processing', 'ingested', 'failed', 'empty')`,
    ),
    // Dedupe is per corpus and by CONTENT, never filename (FR-003). The API
    // catches this constraint's violation and answers 200 + existing ticket.
    uniqueIndex("sources_corpus_fingerprint_idx").on(table.corpusId, table.fingerprint),
    index("sources_plugin_version_idx").on(table.pluginName, table.pluginVersion),
    index("sources_batch_idx").on(table.batchId),
  ],
);

/** The persisted normalized document (FR-017): kept (not just piped) so
 * archive-viewer artifacts and citation anchors survive (Principle III), and
 * so a future re-chunk (eval program) can skip extract/transform. Replaced
 * wholesale per generation — never edited in place. */
export const documentSections = pgTable(
  "document_sections",
  {
    // deterministic: deriveSectionId (@stacks/core) — R9.
    id: text("id").primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    generation: integer("generation").notNull(),
    sectionIndex: integer("section_index").notNull(),
    // Heading trail from document root, e.g. ["Chapter 3","Goblin"].
    path: jsonb("path").notNull(),
    kind: text("kind").notNull(),
    heading: text("heading"),
    content: text("content").notNull(),
    // { artifactId, elementId?, charStart, charEnd } — the citation deep-link
    // target (contracts/normalized-document.md anchor semantics).
    anchor: jsonb("anchor").notNull(),
    // Sanitized HTML fragment for the future archive viewer (R2). Nullable:
    // not every section carries its own fragment.
    displayArtifact: text("display_artifact"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "document_sections_kind_check",
      sql`${table.kind} IN ('prose', 'stat_block', 'table', 'spell_entry', 'unclassified')`,
    ),
    index("document_sections_source_gen_idx").on(
      table.sourceId,
      table.generation,
      table.sectionIndex,
    ),
  ],
);

/** Indexed passages (FR-021): vector + FTS in ONE row — D5's hybrid-retrieval
 * payoff. Un-dimensioned vector column, so the provenance stamp is mandatory
 * whenever an embedding exists (the CHECK below makes FR-020 structural). */
export const chunks = pgTable(
  "chunks",
  {
    // deterministic: deriveChunkId (@stacks/core) — includes generation, so
    // retry hits ON CONFLICT (idempotent) while re-ingest builds aside (R8/R9).
    id: text("id").primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    // Denormalized for retrieval-time filtering without a join (FR-022).
    corpusId: uuid("corpus_id")
      .notNull()
      .references(() => corpora.id),
    generation: integer("generation").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    // ids of contributing document_sections — the chunk→section→anchor→archive
    // traceability chain (Principle III).
    sectionIds: jsonb("section_ids").notNull(),
    // First contributing section's anchor: where a citation of this chunk opens.
    anchor: jsonb("anchor").notNull(),
    // An ATOMIC section (stat block/table/spell entry) larger than
    // CHUNK_MAX_CHARS becomes ONE flagged oversized chunk — never split (R4).
    oversized: boolean("oversized").notNull().default(false),
    pluginName: text("plugin_name").notNull(),
    pluginVersion: text("plugin_version").notNull(),
    // NULL until the embed stage's UPDATE-where-NULL fills it — which is also
    // what makes a retried embed stage skip already-embedded rows (R10).
    embedding: vector("embedding"),
    embeddingProvider: text("embedding_provider"),
    embeddingModel: text("embedding_model"),
    embeddingDimensions: integer("embedding_dimensions"),
    // GENERATED ALWAYS: the FTS index can never drift from content (R5).
    fts: tsvector("fts").generatedAlwaysAs(sql`to_tsvector('english', content)`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // FR-020 made structural: an embedding without its full identity stamp is
    // unrepresentable — mixed vector spaces are detectable by construction.
    check(
      "chunks_embedding_stamp_check",
      sql`${table.embedding} IS NULL OR (${table.embeddingProvider} IS NOT NULL AND ${table.embeddingModel} IS NOT NULL AND ${table.embeddingDimensions} IS NOT NULL)`,
    ),
    index("chunks_source_gen_idx").on(table.sourceId, table.generation),
    index("chunks_corpus_gen_idx").on(table.corpusId, table.generation),
    // GIN over the generated tsvector; ANN (HNSW/IVFFlat) is deliberately
    // deferred to the retrieval spec — correct rows are 008's job.
    index("chunks_fts_idx").using("gin", table.fts),
  ],
);

/** The append-only trail (FR-007/FR-010). Sole writer:
 * recordIngestionEvent (../ingestion-events.ts). Corrections are new events,
 * never edits — the skeleton's doctrine, copied wholesale. */
export const ingestionEvents = pgTable(
  "ingestion_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    sourceId: uuid("source_id").references(() => sources.id),
    batchId: uuid("batch_id").references(() => batches.id),
    stage: text("stage").notNull(),
    event: text("event").notNull(),
    ok: boolean("ok").notNull(),
    // Scrubbed detail: counts, reasons, durations — never bytes or secrets
    // (contracts/events.md pins the per-stage vocabulary).
    detail: jsonb("detail").notNull().default({}),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "ingestion_events_stage_check",
      sql`${table.stage} IN ('intake', 'expand', 'detect', 'extract', 'transform', 'chunk', 'embed', 'index', 'commit')`,
    ),
    check(
      "ingestion_events_event_check",
      sql`${table.event} IN ('started', 'completed', 'failed', 'skipped')`,
    ),
    // An event belongs to a source, a batch, or both — never neither.
    check(
      "ingestion_events_scope_check",
      sql`${table.sourceId} IS NOT NULL OR ${table.batchId} IS NOT NULL`,
    ),
    index("ingestion_events_source_idx").on(table.sourceId, table.createdAt),
    index("ingestion_events_batch_idx").on(table.batchId, table.createdAt),
  ],
);
