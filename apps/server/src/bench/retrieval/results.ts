import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { z } from "zod";
import { MatrixSchema } from "./load.js";
import type { BenchRow } from "./run.js";

/**
 * Stored bench runs (contracts/results-format.md, data-model.md Baseline):
 * one JSON file per run under `bench/retrieval/results/`, plus the CI
 * matrix's committed `baseline.json`. No corpus, passage, or question text
 * ever lands in either file (constitution VIII, contract invariant 8).
 */

const BenchRowSchema = z.object({
  key: z.string(),
  model: z.string().nullable(),
  embeddingModel: z.string().nullable(),
  dim: z.number().nullable(),
  dimMethod: z.enum(["native", "truncate"]).nullable(),
  chunking: z.string(),
  maxChars: z.number(),
  mode: z.enum(["vector", "fts", "hybrid"]),
  chunks: z.number(),
  questions: z.number(),
  recall1: z.number(),
  recall5: z.number(),
  recall10: z.number(),
  mrr10: z.number(),
  latencyMs: z.object({ p50: z.number(), p95: z.number() }),
  corpusEmbed: z
    .object({ tokens: z.number(), costUsd: z.number().nullable() })
    .nullable(),
  questionEmbed: z
    .object({ tokens: z.number(), costUsd: z.number().nullable() })
    .nullable(),
  misses: z.array(z.string()),
});

export const ResultsSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().uuid(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  dirty: z.boolean(),
  host: z.object({ node: z.string(), platform: z.string() }),
  corpusHash: z.string(),
  questionsHash: z.string(),
  matrixHash: z.string(),
  matrix: MatrixSchema,
  models: z.record(
    z.string(),
    z.object({ embeddingModel: z.string(), provider: z.string() }),
  ),
  rows: z.array(BenchRowSchema),
});
export type Results = z.infer<typeof ResultsSchema>;

export const BaselineSchema = z.object({
  matrixHash: z.string(),
  corpusHash: z.string(),
  questionsHash: z.string(),
  recall5: z.record(z.string(), z.number()),
});
export type Baseline = z.infer<typeof BaselineSchema>;

/** `$0.0000`, `unpriced`, or `-` for a column that doesn't apply to this row (e.g. fts). */
export function fmtCost(v: number | null | undefined): string {
  if (v === undefined) return "-";
  if (v === null) return "unpriced";
  return `$${v.toFixed(4)}`;
}

/**
 * Writes one results file (contracts/results-format.md): commit and dirty
 * flag come straight from git, never a passed-in value, so a results file
 * always reflects what was actually on disk for the run it describes.
 */
export function writeResults(
  dir: string,
  input: {
    startedAt: Date;
    matrix: Results["matrix"];
    matrixHash: string;
    corpusHash: string;
    questionsHash: string;
    models: Results["models"];
    rows: BenchRow[];
  },
): { filePath: string; results: Results } {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const dirty =
    execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
    }).trim().length > 0;
  const runId = randomUUID();
  const finishedAt = new Date();

  const results: Results = {
    schemaVersion: 1,
    runId,
    startedAt: input.startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    commit,
    dirty,
    host: { node: process.version, platform: process.platform },
    corpusHash: input.corpusHash,
    questionsHash: input.questionsHash,
    matrixHash: input.matrixHash,
    matrix: input.matrix,
    models: input.models,
    rows: input.rows,
  };
  ResultsSchema.parse(results);

  mkdirSync(dir, { recursive: true });
  const date = finishedAt.toISOString().slice(0, 10);
  const filePath = path.join(
    dir,
    `${date}-${commit.slice(0, 7)}-${runId.slice(0, 8)}.json`,
  );
  writeFileSync(filePath, `${JSON.stringify(results, null, 2)}\n`);
  return { filePath, results };
}

/** `run --write-baseline` (bow-only matrices): the CI matrix's recall@5 floor. */
export function writeBaseline(
  filePath: string,
  input: {
    matrixHash: string;
    corpusHash: string;
    questionsHash: string;
    rows: BenchRow[];
  },
): Baseline {
  const baseline: Baseline = {
    matrixHash: input.matrixHash,
    corpusHash: input.corpusHash,
    questionsHash: input.questionsHash,
    recall5: Object.fromEntries(input.rows.map((r) => [r.key, r.recall5])),
  };
  BaselineSchema.parse(baseline);
  writeFileSync(filePath, `${JSON.stringify(baseline, null, 2)}\n`);
  return baseline;
}

const REPORT_COLUMNS: {
  label: string;
  width: number;
  value: (r: Results, row: BenchRow) => string;
}[] = [
  { label: "date", width: 12, value: (r) => r.startedAt.slice(0, 10) },
  { label: "sha7", width: 9, value: (r) => r.commit.slice(0, 7) },
  { label: "dirty", width: 6, value: (r) => (r.dirty ? "yes" : "no") },
  { label: "key", width: 30, value: (_r, row) => row.key },
  { label: "R@1", width: 6, value: (_r, row) => row.recall1.toFixed(3) },
  { label: "R@5", width: 6, value: (_r, row) => row.recall5.toFixed(3) },
  { label: "R@10", width: 6, value: (_r, row) => row.recall10.toFixed(3) },
  { label: "MRR", width: 6, value: (_r, row) => row.mrr10.toFixed(3) },
  { label: "p50ms", width: 8, value: (_r, row) => row.latencyMs.p50.toFixed(1) },
  { label: "p95ms", width: 8, value: (_r, row) => row.latencyMs.p95.toFixed(1) },
  {
    label: "tokens",
    width: 8,
    value: (_r, row) => String(row.corpusEmbed?.tokens ?? "-"),
  },
  {
    label: "cost",
    width: 10,
    value: (_r, row) => fmtCost(row.corpusEmbed?.costUsd),
  },
];

/**
 * `pnpm bench:retrieval report`: every stored results file, grouped by
 * corpus hash so rows over different corpora are never mixed (contract,
 * US3 AC2). An invalid file or an unrecognized `schemaVersion` is skipped
 * with a warning naming the file, never thrown.
 */
export function report(
  dir: string,
  io: { log?: (line: string) => void; warn?: (line: string) => void } = {},
): void {
  const log = io.log ?? console.log;
  const warn = io.warn ?? console.warn;

  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  } catch {
    files = [];
  }

  const byCorpus = new Map<string, Results[]>();
  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    } catch {
      warn(`report: skipping "${file}" — not valid JSON`);
      continue;
    }
    const version = (raw as { schemaVersion?: unknown } | null)
      ?.schemaVersion;
    if (version !== 1) {
      warn(
        `report: skipping "${file}" — unknown schemaVersion ${JSON.stringify(version)}`,
      );
      continue;
    }
    const parsed = ResultsSchema.safeParse(raw);
    if (!parsed.success) {
      warn(
        `report: skipping "${file}" — ${parsed.error.issues[0]?.message ?? "invalid results file"}`,
      );
      continue;
    }
    const list = byCorpus.get(parsed.data.corpusHash) ?? [];
    list.push(parsed.data);
    byCorpus.set(parsed.data.corpusHash, list);
  }

  for (const [corpusHash, results] of byCorpus) {
    log(`\ncorpus ${corpusHash.slice(0, 12)}`);
    log(REPORT_COLUMNS.map((c) => c.label.padEnd(c.width)).join(" "));
    const entries = results
      .flatMap((r) => r.rows.map((row) => ({ r, row })))
      .sort(
        (a, b) =>
          a.r.startedAt.localeCompare(b.r.startedAt) ||
          a.row.key.localeCompare(b.row.key),
      );
    for (const { r, row } of entries) {
      log(REPORT_COLUMNS.map((c) => c.value(r, row).padEnd(c.width)).join(" "));
    }
  }
}
