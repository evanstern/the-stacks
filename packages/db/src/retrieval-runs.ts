/**
 * retrieval_runs / retrieval_results — append-only BY CONSTRUCTION
 * (spec 010, Principle III: citations are receipts).
 *
 * This module is the ONLY writer, and it only ever INSERTs — one transaction
 * per receipt, header and lines together, so a torn receipt is
 * unrepresentable. There is deliberately no update or delete helper here and
 * none may be added: "superseded" is derived at view time, corrections are
 * new runs, and history never changes shape. Same construction — and same
 * warning — as recordEvent in ./events.ts.
 */
import type { Database } from "./client";
import { retrievalResults, retrievalRuns } from "./schema/retrieval";

export interface RetrievalResultLine {
  rank: number;
  chunkId: string;
  sourceId: string;
  generation: number;
  contentSnapshot: string;
  anchorSnapshot: unknown;
  sectionIds: unknown;
  contentSha256: string;
  ftsScore: number | null;
  vectorScore: number | null;
  fusedScore: number;
  rerankScore: number | null;
  prerankPosition: number | null;
}

export interface RecordRetrievalRunInput {
  query: string;
  config: unknown;
  corpusId: string;
  origin: "interactive" | "eval";
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimensions: number;
  stageTimings: unknown;
  results: RetrievalResultLine[];
}

export interface RecordedRetrievalRun {
  id: string;
  resultCount: number;
  createdAt: Date;
}

export async function recordRetrievalRun(
  db: Database,
  input: RecordRetrievalRunInput,
): Promise<RecordedRetrievalRun> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .insert(retrievalRuns)
      .values({
        query: input.query,
        config: input.config,
        corpusId: input.corpusId,
        origin: input.origin,
        embeddingProvider: input.embeddingProvider,
        embeddingModel: input.embeddingModel,
        embeddingDimensions: input.embeddingDimensions,
        stageTimings: input.stageTimings,
        // Derived HERE from the lines actually inserted below — a caller
        // cannot make the denormalization disagree with the receipt.
        resultCount: input.results.length,
      })
      .returning({ id: retrievalRuns.id, createdAt: retrievalRuns.createdAt });

    if (input.results.length > 0) {
      await tx.insert(retrievalResults).values(
        input.results.map((r) => ({
          runId: run!.id,
          rank: r.rank,
          chunkId: r.chunkId,
          sourceId: r.sourceId,
          generation: r.generation,
          contentSnapshot: r.contentSnapshot,
          anchorSnapshot: r.anchorSnapshot,
          sectionIds: r.sectionIds,
          contentSha256: r.contentSha256,
          ftsScore: r.ftsScore,
          vectorScore: r.vectorScore,
          fusedScore: r.fusedScore,
          rerankScore: r.rerankScore,
          prerankPosition: r.prerankPosition,
        })),
      );
    }

    return { id: run!.id, resultCount: input.results.length, createdAt: run!.createdAt };
  });
}
