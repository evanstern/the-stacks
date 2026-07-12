/**
 * Retrieval & eval schema (spec 010, data-model.md). Four tables, two data
 * disciplines:
 *
 *   1. RECEIPTS (retrieval_runs + retrieval_results): append-only BY
 *      CONSTRUCTION — the sole writer is recordRetrievalRun
 *      (../retrieval-runs.ts), one transaction per run, and no UPDATE/DELETE
 *      path exists anywhere in product code. Results SNAPSHOT the passage
 *      (content, anchor, section ids) at retrieval time, so a receipt keeps
 *      rendering after 008's generation sweep deletes the live chunk
 *      (Principle III: citations are receipts). "Superseded" is DERIVED at
 *      view time — a stored flag would need an UPDATE, which this design
 *      makes unrepresentable.
 *
 *   2. LABELS & MEASUREMENTS (gold_items + eval_runs): gold items are
 *      operator-owned labels — plain mutable rows (re-labeling is curation,
 *      not history-rewriting) referencing passages by content hash so
 *      identical re-ingests auto-heal (research R6). Eval runs pin a
 *      gold_snapshot at execution, so later re-labeling can't rewrite what
 *      a measurement measured; status is the ONE mutable column
 *      (running → completed|failed exactly once, the job handler's job).
 */
import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { corpora, sources } from "./ingestion";

export const retrievalRuns = pgTable("retrieval_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  query: text("query").notNull(),
  // The fully RESOLVED config (research R10), verbatim — receipts never
  // depend on ambient env, and eval comparisons key on what actually ran.
  config: jsonb("config").notNull(),
  corpusId: uuid("corpus_id")
    .notNull()
    .references(() => corpora.id),
  // interactive (an operator at /search) or eval (the harness) — same
  // engine, same receipt, different origin (contracts/api.md).
  origin: text("origin").notNull(),
  // The query embedding's stamp: a receipt proves WHICH vector space it
  // searched (Principle VII's detectability, recorded).
  embeddingProvider: text("embedding_provider").notNull(),
  embeddingModel: text("embedding_model").notNull(),
  embeddingDimensions: integer("embedding_dimensions").notNull(),
  // ms per stage: { embed, fts, vector, fusion, rerank } — null where skipped.
  stageTimings: jsonb("stage_timings").notNull(),
  resultCount: integer("result_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const retrievalResults = pgTable(
  "retrieval_results",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => retrievalRuns.id),
    // Final position, 1-based. Composite PK (runId, rank): a run's ranking
    // is a fact, and facts don't need surrogate ids.
    rank: integer("rank").notNull(),
    // Durable identity, deliberately NOT an FK: the chunk row may be swept
    // by a later re-ingest — the receipt outlives it (data-model.md).
    chunkId: text("chunk_id").notNull(),
    // Sources are never deleted this cycle, so attribution keeps a real FK.
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    generation: integer("generation").notNull(),
    // The snapshot: what the operator (or a future citation) actually saw.
    contentSnapshot: text("content_snapshot").notNull(),
    anchorSnapshot: jsonb("anchor_snapshot").notNull(),
    sectionIds: jsonb("section_ids").notNull(),
    // Enables the view-time superseded/auto-heal derivations without
    // comparing full text.
    contentSha256: text("content_sha256").notNull(),
    // Raw per-signal scores; null = that signal didn't propose this chunk.
    ftsScore: real("fts_score"),
    vectorScore: real("vector_score"),
    fusedScore: real("fused_score").notNull(),
    rerankScore: real("rerank_score"),
    // Fused-order position before reranking (FR-022) — null when not reranked.
    prerankPosition: integer("prerank_position"),
  },
  (table) => [primaryKey({ columns: [table.runId, table.rank] })],
);

export const goldItems = pgTable("gold_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  corpusId: uuid("corpus_id")
    .notNull()
    .references(() => corpora.id),
  question: text("question").notNull(),
  // [{ chunkId, sourceId, contentSha256 }] — ≥ 1 entry; hash is the durable
  // reference (research R6: identical re-ingest auto-heals, changed text
  // flags for re-confirmation — both DERIVED at read time).
  expected: jsonb("expected").notNull(),
  // tuning | heldout — assigned at creation, immutable afterwards (FR-013:
  // moving items after tuning began would leak choices into the holdout).
  split: text("split").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  corpusId: uuid("corpus_id")
    .notNull()
    .references(() => corpora.id),
  config: jsonb("config").notNull(),
  configName: text("config_name").notNull(),
  // The gold items AS EVALUATED (id, question, expected, split) — pinned so
  // re-labeling after the run changes nothing retroactively.
  goldSnapshot: jsonb("gold_snapshot").notNull(),
  // running → completed | failed, exactly once; the worker handler is the
  // sole writer of this transition (data-model.md invariant).
  status: text("status").notNull(),
  // Per-slice metrics per contracts/metrics.md; null until completed.
  metrics: jsonb("metrics"),
  itemOutcomes: jsonb("item_outcomes"),
  retrievalRunIds: jsonb("retrieval_run_ids"),
  // Scrubbed failure summary (FR-018 lineage: internals stay operator-side
  // in logs; this column is renderable in the UI).
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
