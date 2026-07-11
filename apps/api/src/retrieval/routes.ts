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
import { corpora, type Database, type RetrievalResultLine } from "@stacks/db";
import {
  QUERY_MAX_CHARS,
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
