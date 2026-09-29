import type { AiConfig } from "../../ai/config.js";
import { createGateway, type Gateway } from "../../ai/gateway.js";
import { memorySink } from "../../ai/usage.js";
import type { ParsedBook } from "../../library/ddb/index.js";
import { chunkBook } from "../../library/ingest/chunk.js";
import type { RetrieveDeps, RetrievedPassage } from "../../library/retrieve.js";
import { retrieve } from "../../library/retrieve.js";
import {
  attachEmbeddings,
  type DbClient,
  storeParsedBook,
} from "../../library/store.js";
import { libraryChunks } from "../../schema/library.js";
import { resetLibrary } from "./db.js";
import { bowProvider, warmUpModel, withDim } from "./embed.js";
import type { Matrix, ResolvedQuestion } from "./load.js";
import { scoreQuestion, summarize } from "./score.js";

/**
 * Runs a matrix against an already-migrated bench database (contracts/
 * bench-cli.md run steps 6-7). No job is ever enqueued: chunks are stored
 * and embedded directly through `storeParsedBook`/`attachEmbeddings`.
 */

const EMBED_BATCH_SIZE = 256;
const BUILTIN_BOW_PROVIDER = "builtin";
const BUILTIN_BOW_PURPOSE = "bench-bow";

export interface BenchRow {
  key: string;
  model: string | null;
  embeddingModel: string | null;
  dim: number | null;
  dimMethod: "native" | "truncate" | null;
  chunking: string;
  maxChars: number;
  mode: "vector" | "fts" | "hybrid";
  chunks: number;
  questions: number;
  recall1: number;
  recall5: number;
  recall10: number;
  mrr10: number;
  latencyMs: { p50: number; p95: number };
  corpusEmbed: { tokens: number; costUsd: number | null } | null;
  questionEmbed: { tokens: number; costUsd: number | null } | null;
  misses: string[];
}

export interface EstimateModel {
  model: string;
  tokens: number;
  costUsd: number | null;
}

export interface Estimate {
  corpusTokens: number;
  questionTokens: number;
  costUsd: number | null;
  models: EstimateModel[];
}

function priceKeyForPurpose(purposeName: string, ai: AiConfig): string | null {
  const purpose = ai.purposes[purposeName];
  if (!purpose) return null;
  return `${purpose.provider}/${purpose.model}`;
}

/**
 * Rough pre-run cost sanity check (research R10): corpus chars / 4, once
 * per (model, dim, chunking strategy) — matching what `runMatrix` actually
 * embeds — plus one question-embed pass per (model, dim) for every mode
 * that needs one (`vector`, `hybrid`). `builtin: "bow"` is always free.
 */
export function estimate(
  matrix: Matrix,
  corpus: ParsedBook[],
  questionCount: number,
  ai: AiConfig,
): Estimate {
  const corpusCharsTokens = Math.ceil(
    corpus.reduce((sum, b) => sum + b.text.length, 0) / 4,
  );
  const embedModesPerDim = matrix.modes.filter((m) => m !== "fts").length;

  let corpusTokens = 0;
  let questionTokens = 0;
  let costUsd = 0;
  let unpriced = false;
  const models: EstimateModel[] = [];

  for (const model of matrix.models) {
    const isBow = "builtin" in model.source;
    const priceKey =
      "purpose" in model.source
        ? priceKeyForPurpose(model.source.purpose, ai)
        : null;
    const price = priceKey ? ai.prices[priceKey] : undefined;
    if (priceKey && !price) unpriced = true;

    let modelTokens = 0;
    for (const _dim of model.dims) {
      const corpusTok = corpusCharsTokens * matrix.chunking.length;
      const questionTok = questionCount * embedModesPerDim;
      corpusTokens += corpusTok;
      questionTokens += questionTok;
      modelTokens += corpusTok + questionTok;
    }

    const modelCost = isBow
      ? 0
      : price
        ? (modelTokens * price.inputPerMTok) / 1_000_000
        : null;
    if (modelCost !== null) costUsd += modelCost;
    models.push({ model: model.name, tokens: modelTokens, costUsd: modelCost });
  }

  return {
    corpusTokens,
    questionTokens,
    costUsd: unpriced ? null : costUsd,
    models,
  };
}

function percentile(sortedAsc: number[], fraction: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil(fraction * sortedAsc.length) - 1),
  );
  return sortedAsc[idx];
}

function usageTokens(
  records: { inputTokens: number; costUsd: number | null }[],
): { tokens: number; costUsd: number | null } {
  let tokens = 0;
  let costUsd = 0;
  let anyUnpriced = false;
  for (const r of records) {
    tokens += r.inputTokens;
    if (r.costUsd === null) anyUnpriced = true;
    else costUsd += r.costUsd;
  }
  return { tokens, costUsd: anyUnpriced ? null : costUsd };
}

export async function runMatrix(
  deps: { db: DbClient; ai: AiConfig; env: NodeJS.ProcessEnv },
  input: { matrix: Matrix; books: ParsedBook[]; questions: ResolvedQuestion[] },
): Promise<BenchRow[]> {
  const { matrix, books, questions } = input;
  const usesBow = matrix.models.some((m) => "builtin" in m.source);

  const config: AiConfig = usesBow
    ? {
        providers: {
          ...deps.ai.providers,
          [BUILTIN_BOW_PROVIDER]: { kind: "fake", baseUrl: "" },
        },
        purposes: {
          ...deps.ai.purposes,
          [BUILTIN_BOW_PURPOSE]: {
            provider: BUILTIN_BOW_PROVIDER,
            model: "bow",
            op: "embed",
          },
        },
        // `bow` is known free (no network call, deterministic hash), not
        // merely unpriced (research R8): priced at $0 so a real run's rows
        // print "$0.0000", matching `estimate()`'s own bow branch, instead
        // of the "unpriced" a genuinely-unconfigured model would show.
        prices: {
          ...deps.ai.prices,
          [`${BUILTIN_BOW_PROVIDER}/bow`]: {
            inputPerMTok: 0,
            outputPerMTok: 0,
          },
        },
      }
    : deps.ai;

  const sink = memorySink();
  const gateway: Gateway = createGateway({
    config,
    sink,
    env: deps.env,
    adapters: usesBow ? { fake: () => bowProvider } : undefined,
  });

  const rows: BenchRow[] = [];

  // Re-chunks and re-stores the corpus under one chunking strategy, and
  // returns the bench's own current chunk rows to embed/search. Called once
  // per (model, chunking) — same total call count regardless of loop
  // nesting — and once more per chunking for the fts-only pass below.
  async function storeChunking(chunking: Matrix["chunking"][number]): Promise<{
    chunkCount: number;
    chunkRows: { id: string; text: string }[];
  }> {
    await resetLibrary(deps.db);
    const chunkedBooks = books.map((b) =>
      chunkBook(b, { maxChars: chunking.maxChars }),
    );
    for (const book of chunkedBooks) await storeParsedBook(deps.db, book);
    const chunkCount = chunkedBooks.reduce(
      (sum, b) => sum + b.blocks.length,
      0,
    );
    const chunkRows = await deps.db
      .select({ id: libraryChunks.id, text: libraryChunks.text })
      .from(libraryChunks);
    return { chunkCount, chunkRows };
  }

  // Model-outer, chunking-inner (operator ruling 2026-09-29): every cell for
  // one model runs back to back, so a real (Ollama-hosted) model is warmed
  // up once and never reloaded mid-run by another model's cells landing in
  // between. `bow` needs no warm-up — it is not a real model.
  for (const model of matrix.models) {
    const isBow = "builtin" in model.source;
    const purposeName =
      "purpose" in model.source ? model.source.purpose : BUILTIN_BOW_PURPOSE;
    const baseModelName = config.purposes[purposeName]?.model ?? purposeName;

    if (!isBow) {
      const purpose = config.purposes[purposeName];
      const provider = purpose ? config.providers[purpose.provider] : undefined;
      if (provider?.kind === "openai-compatible") {
        await warmUpModel(provider.baseUrl, purpose.model);
      }
    }

    for (const chunking of matrix.chunking) {
      const { chunkCount, chunkRows } = await storeChunking(chunking);

      for (const dim of model.dims) {
        const wrapped = withDim(gateway, dim);

        const corpusStart = sink.records.length;
        for (let i = 0; i < chunkRows.length; i += EMBED_BATCH_SIZE) {
          const batch = chunkRows.slice(i, i + EMBED_BATCH_SIZE);
          const result = await wrapped.embed({
            purpose: purposeName,
            texts: batch.map((c) => c.text),
          });
          await attachEmbeddings(
            deps.db,
            batch.map((chunk, j) => ({
              chunkId: chunk.id,
              model: result.vectors[j].model,
              dim: result.vectors[j].dim,
              vector: result.vectors[j].vector,
            })),
          );
        }
        const corpusEmbed = usageTokens(sink.records.slice(corpusStart));

        const embedModes = matrix.modes.filter((m) => m !== "fts");
        const questionStart = sink.records.length;
        const modeRanks = new Map<string, (number | null)[]>();
        const modeLatencies = new Map<string, number[]>();
        const modeMisses = new Map<string, string[]>();
        for (const mode of embedModes) {
          modeRanks.set(mode, []);
          modeLatencies.set(mode, []);
          modeMisses.set(mode, []);
        }

        for (const mode of embedModes) {
          const retrieveDeps: RetrieveDeps = {
            db: deps.db,
            gateway: wrapped,
            config: { mode, k: 10, embedPurpose: purposeName },
          };
          for (const q of questions) {
            const startedAt = performance.now();
            const result = await retrieve(retrieveDeps, {
              question: q.question,
              mode,
              k: 10,
            });
            modeLatencies.get(mode)?.push(performance.now() - startedAt);
            const { rank } = scoreQuestion(
              q,
              result.passages as RetrievedPassage[],
            );
            modeRanks.get(mode)?.push(rank);
            if (rank === null) modeMisses.get(mode)?.push(q.id);
          }
        }
        const questionEmbed = usageTokens(sink.records.slice(questionStart));

        for (const mode of embedModes) {
          const ranks = modeRanks.get(mode) ?? [];
          const latencies = [...(modeLatencies.get(mode) ?? [])].sort(
            (a, b) => a - b,
          );
          rows.push({
            key: `${model.name}@${dim}|${chunking.name}|${mode}`,
            model: model.name,
            embeddingModel: baseModelName,
            dim,
            dimMethod: dim === 1024 ? "native" : "truncate",
            chunking: chunking.name,
            maxChars: chunking.maxChars,
            mode,
            chunks: chunkCount,
            questions: questions.length,
            ...summarize(ranks),
            latencyMs: {
              p50: percentile(latencies, 0.5),
              p95: percentile(latencies, 0.95),
            },
            corpusEmbed,
            questionEmbed,
            misses: modeMisses.get(mode) ?? [],
          });
        }
      }
    }
  }

  // fts needs no embedding model, so it runs once per chunking strategy —
  // independent of, and after, every model's cells — never interleaved
  // with a model's timed run.
  if (matrix.modes.includes("fts")) {
    for (const chunking of matrix.chunking) {
      const { chunkCount } = await storeChunking(chunking);
      const ranks: (number | null)[] = [];
      const latencies: number[] = [];
      const misses: string[] = [];
      const retrieveDeps: RetrieveDeps = {
        db: deps.db,
        gateway,
        config: { mode: "fts", k: 10, embedPurpose: "" },
      };
      for (const q of questions) {
        const startedAt = performance.now();
        const result = await retrieve(retrieveDeps, {
          question: q.question,
          mode: "fts",
          k: 10,
        });
        latencies.push(performance.now() - startedAt);
        const { rank } = scoreQuestion(
          q,
          result.passages as RetrievedPassage[],
        );
        ranks.push(rank);
        if (rank === null) misses.push(q.id);
      }
      latencies.sort((a, b) => a - b);
      rows.push({
        key: `-|${chunking.name}|fts`,
        model: null,
        embeddingModel: null,
        dim: null,
        dimMethod: null,
        chunking: chunking.name,
        maxChars: chunking.maxChars,
        mode: "fts",
        chunks: chunkCount,
        questions: questions.length,
        ...summarize(ranks),
        latencyMs: {
          p50: percentile(latencies, 0.5),
          p95: percentile(latencies, 0.95),
        },
        corpusEmbed: null,
        questionEmbed: null,
        misses,
      });
    }
  }

  return rows;
}
