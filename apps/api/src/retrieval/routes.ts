/**
 * Retrieval routes (spec 010, contracts/api.md §1–§2). The route layer is
 * deliberately thin: schema-validate the request shape (Fastify → 400
 * invalid_input via the app error handler), resolve the corpus, call the
 * engine, reshape the receipt for the wire. Domain errors cross this file
 * untranslated — class → HTTP happens once, in app.ts (FR-018 lineage).
 *
 * The wire response for a search IS the receipt's content: same results,
 * same scores, same config the retrieval_runs row recorded. Anything else
 * would give the caller a story the record can't back.
 */
import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";

import { DomainError } from "@stacks/core";
import { corpora, enqueue, evalRuns, retrievalRuns, type Database, type RetrievalResultLine } from "@stacks/db";
import {
  createEvalRun,
  createGoldItem,
  listGoldItems,
  QUERY_MAX_CHARS,
  relabelGoldItem,
  resolveRetrievalConfig,
  searchCorpus,
  type QueryEmbedder,
  type ResolvedRetrievalConfig,
} from "@stacks/retrieval";

export interface RetrievalRouteDeps {
  db: Database;
  embedQuery: QueryEmbedder;
  config: ResolvedRetrievalConfig;
}

/** Receipt line → wire shape (scores grouped for reading, nothing added). */
function toWire(result: RetrievalResultLine) {
  return {
    rank: result.rank,
    chunkId: result.chunkId,
    sourceId: result.sourceId,
    generation: result.generation,
    content: result.contentSnapshot,
    anchor: result.anchorSnapshot,
    scores: {
      fts: result.ftsScore,
      vector: result.vectorScore,
      fused: result.fusedScore,
      rerank: result.rerankScore,
    },
    prerankPosition: result.prerankPosition,
  };
}

export function registerRetrievalRoutes(app: FastifyInstance, deps: RetrievalRouteDeps): void {
  app.post<{ Body: { query: string } }>(
    "/api/retrieval/search",
    {
      schema: {
        body: {
          type: "object",
          required: ["query"],
          additionalProperties: false,
          properties: {
            query: { type: "string", minLength: 1, maxLength: QUERY_MAX_CHARS },
          },
        },
      },
    },
    async (request) => {
      // Single-operator, single "default" corpus today; sources/chunks carry
      // corpus_id so multi-corpus stays a cheap door (008 doctrine).
      const [corpus] = await deps.db
        .select()
        .from(corpora)
        .where(sql`${corpora.name} = 'default'`);
      if (!corpus) {
        throw new DomainError({
          class: "unknown_thing",
          message: 'No such corpus: "default". Ingest something first.',
        });
      }

      const search = await searchCorpus(
        { db: deps.db, embedQuery: deps.embedQuery },
        { corpusId: corpus.id, query: request.body.query, config: deps.config },
      );

      return {
        runId: search.runId,
        query: search.query,
        config: search.config,
        results: search.results.map(toWire),
        timings: search.stageTimings,
      };
    },
  );
}

/** Paging clamps mirror 009's uploads listing: in-range numerics are
 *  CLAMPED, not refused (limit into [1,200]). */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function registerRetrievalRecordRoutes(
  app: FastifyInstance,
  deps: { db: Database },
): void {
  const { db } = deps;

  app.get<{ Querystring: { limit?: number; offset?: number } }>(
    "/api/retrieval/runs",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            limit: { type: "integer", minimum: 0 },
            offset: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    async (request) => {
      const limit = Math.min(MAX_LIMIT, Math.max(1, request.query.limit ?? DEFAULT_LIMIT));
      const offset = request.query.offset ?? 0;
      const [rows, totalRows] = await Promise.all([
        db.execute<{
          id: string;
          query: string;
          origin: string;
          result_count: number;
          created_at: string;
          config: { configName?: string };
        }>(sql`
          SELECT id, query, origin, result_count, created_at, config
          FROM retrieval_runs
          ORDER BY created_at DESC, id DESC
          LIMIT ${limit} OFFSET ${offset}
        `),
        db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM retrieval_runs`),
      ]);
      return {
        items: rows.rows.map((row) => ({
          id: row.id,
          query: row.query,
          origin: row.origin,
          resultCount: row.result_count,
          createdAt: row.created_at,
          configName: row.config?.configName ?? "unknown",
        })),
        total: totalRows.rows[0]!.n,
        limit,
        offset,
      };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/retrieval/runs/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request) => {
      const runRows = await db
        .select()
        .from(retrievalRuns)
        .where(sql`${retrievalRuns.id} = ${request.params.id}`);
      const run = runRows[0];
      if (!run) {
        throw new DomainError({
          class: "unknown_thing",
          message: `No retrieval run ${request.params.id}.`,
        });
      }

      // The receipt renders from its own snapshots; "superseded" is DERIVED
      // here and only here (data-model.md): no chunk with this content hash
      // exists at the source's CURRENT generation. An identical re-ingest
      // keeps the hash alive under a new chunk id — not superseded.
      interface ReceiptRow extends Record<string, unknown> {
        rank: number;
        chunk_id: string;
        source_id: string;
        generation: number;
        content_snapshot: string;
        anchor_snapshot: unknown;
        content_sha256: string;
        fts_score: number | null;
        vector_score: number | null;
        fused_score: number;
        rerank_score: number | null;
        prerank_position: number | null;
        superseded: boolean;
      }
      const resultRows = await db.execute<ReceiptRow>(sql`
        SELECT r.*,
               NOT EXISTS (
                 SELECT 1 FROM chunks c
                 JOIN sources s ON s.id = c.source_id
                 WHERE c.source_id = r.source_id
                   AND c.generation = s.current_generation
                   AND encode(sha256(convert_to(c.content, 'UTF8')), 'hex') = r.content_sha256
               ) AS superseded
        FROM retrieval_results r
        WHERE r.run_id = ${request.params.id}
        ORDER BY r.rank
      `);

      return {
        id: run.id,
        query: run.query,
        origin: run.origin,
        config: run.config,
        embedding: {
          provider: run.embeddingProvider,
          model: run.embeddingModel,
          dimensions: run.embeddingDimensions,
        },
        timings: run.stageTimings,
        createdAt: run.createdAt,
        results: resultRows.rows.map((row) => ({
          rank: row.rank,
          chunkId: row.chunk_id,
          sourceId: row.source_id,
          generation: row.generation,
          content: row.content_snapshot,
          anchor: row.anchor_snapshot,
          scores: {
            fts: row.fts_score,
            vector: row.vector_score,
            fused: row.fused_score,
            rerank: row.rerank_score,
          },
          prerankPosition: row.prerank_position,
          superseded: row.superseded,
        })),
      };
    },
  );
}

/** Gold-set routes (US3, contracts/api.md §3). Thin: schema-validate,
 *  resolve the corpus, delegate to the gold domain functions — split
 *  immutability and hash resolution live there, not here. */
export function registerGoldRoutes(app: FastifyInstance, deps: { db: Database }): void {
  const { db } = deps;

  const expectedSchema = {
    type: "array",
    minItems: 1,
    items: {
      type: "object",
      required: ["chunkId"],
      additionalProperties: false,
      properties: { chunkId: { type: "string", minLength: 1 } },
    },
  } as const;

  const defaultCorpus = async () => {
    const [corpus] = await db.select().from(corpora).where(sql`${corpora.name} = 'default'`);
    if (!corpus) {
      throw new DomainError({ class: "unknown_thing", message: 'No such corpus: "default".' });
    }
    return corpus;
  };

  app.post<{
    Body: { question: string; expected: Array<{ chunkId: string }>; split?: "tuning" | "heldout"; notes?: string };
  }>(
    "/api/evals/gold",
    {
      schema: {
        body: {
          type: "object",
          required: ["question", "expected"],
          additionalProperties: false,
          properties: {
            question: { type: "string", minLength: 1, maxLength: 1024 },
            expected: expectedSchema,
            split: { type: "string", enum: ["tuning", "heldout"] },
            notes: { type: "string", maxLength: 4096 },
          },
        },
      },
    },
    async (request, reply) => {
      const corpus = await defaultCorpus();
      const item = await createGoldItem(db, {
        corpusId: corpus.id,
        question: request.body.question,
        chunkIds: request.body.expected.map((e) => e.chunkId),
        split: request.body.split,
        notes: request.body.notes,
      });
      reply.code(201);
      return item;
    },
  );

  app.get("/api/evals/gold", async () => {
    const corpus = await defaultCorpus();
    return { items: await listGoldItems(db, corpus.id) };
  });

  app.put<{
    Params: { id: string };
    Body: { question: string; expected: Array<{ chunkId: string }>; split?: string; notes?: string };
  }>(
    "/api/evals/gold/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["question", "expected"],
          additionalProperties: false,
          properties: {
            question: { type: "string", minLength: 1, maxLength: 1024 },
            expected: expectedSchema,
            split: { type: "string" },
            notes: { type: "string", maxLength: 4096 },
          },
        },
      },
    },
    async (request) =>
      relabelGoldItem(db, {
        id: request.params.id,
        question: request.body.question,
        chunkIds: request.body.expected.map((e) => e.chunkId),
        notes: request.body.notes,
        split: request.body.split,
      }),
  );
}

/** Eval-run routes (US4, contracts/api.md §4). POST is accept-then-async
 *  (Principle IV): the row exists (`running`) and the D12 job is queued the
 *  moment the operator asks; the worker executes. Overrides are the A/B
 *  mechanism and ride the SAME validation as env (research R10). */
export function registerEvalRunRoutes(app: FastifyInstance, deps: { db: Database }): void {
  const { db } = deps;

  const defaultCorpus = async () => {
    const [corpus] = await db.select().from(corpora).where(sql`${corpora.name} = 'default'`);
    if (!corpus) {
      throw new DomainError({ class: "unknown_thing", message: 'No such corpus: "default".' });
    }
    return corpus;
  };

  app.post<{ Body: { configName: string; overrides?: Record<string, unknown> } }>(
    "/api/evals/runs",
    {
      schema: {
        body: {
          type: "object",
          required: ["configName"],
          additionalProperties: false,
          properties: {
            configName: { type: "string", minLength: 1, maxLength: 128 },
            overrides: { type: "object" },
          },
        },
      },
    },
    async (request, reply) => {
      const corpus = await defaultCorpus();
      let config;
      try {
        config = resolveRetrievalConfig(process.env, {
          ...(request.body.overrides ?? {}),
          configName: request.body.configName,
        });
      } catch (error) {
        // Config guards throw plain Errors with the variable named — at this
        // boundary they are the caller's override problem, hence 400.
        throw new DomainError({
          class: "invalid_input",
          message: error instanceof Error ? error.message : "Invalid overrides.",
        });
      }
      const evalRunId = await createEvalRun(db, { corpusId: corpus.id, config });
      await enqueue(db, { kind: "eval_run", payload: { evalRunId } });
      reply.code(202);
      return { evalRunId };
    },
  );

  app.get("/api/evals/runs", async () => {
    const rows = await db.execute<{
      id: string;
      config_name: string;
      status: string;
      created_at: string;
      completed_at: string | null;
      metrics: unknown;
    }>(sql`
      SELECT id, config_name, status, created_at, completed_at, metrics
      FROM eval_runs ORDER BY created_at DESC LIMIT 200
    `);
    return {
      items: rows.rows.map((row) => ({
        id: row.id,
        configName: row.config_name,
        status: row.status,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        metrics: row.metrics,
      })),
    };
  });

  app.get<{ Params: { id: string } }>(
    "/api/evals/runs/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request) => {
      const rows = await db.select().from(evalRuns).where(sql`${evalRuns.id} = ${request.params.id}`);
      const run = rows[0];
      if (!run) {
        throw new DomainError({ class: "unknown_thing", message: `No eval run ${request.params.id}.` });
      }
      return {
        id: run.id,
        configName: run.configName,
        config: run.config,
        status: run.status,
        metrics: run.metrics,
        itemOutcomes: run.itemOutcomes,
        retrievalRunIds: run.retrievalRunIds,
        goldSnapshot: run.goldSnapshot,
        error: run.error,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
      };
    },
  );
}
