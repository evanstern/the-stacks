import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { AiConfig } from "../../ai/config.js";
import { loadAiConfig } from "../../ai/config.js";
import { createDb } from "../../db.js";
import { ensureBenchDb, migrateBenchDb, resolveBenchUrl } from "./db.js";
import {
  loadCorpus,
  loadMatrix,
  loadQuestions,
  matrixHash,
  type Matrix,
} from "./load.js";
import {
  fmtCost,
  report,
  type Results,
  writeBaseline,
  writeResults,
} from "./results.js";
import { type BenchRow, type Estimate, estimate, runMatrix } from "./run.js";

/**
 * The retrieval bench CLI (contracts/bench-cli.md). `run` covers steps 1-9:
 * validate, estimate, the paid-run gate, run the matrix, print the table,
 * save a results file (T016/T017) and optionally the baseline (T021).
 * `report` prints every stored run (T017).
 */

const BENCH_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../bench/retrieval",
);
const RESULTS_DIR = path.join(BENCH_DIR, "results");
const BASELINE_PATH = path.join(BENCH_DIR, "baseline.json");

/** A relative `--matrix` resolves against the bench data dir first, then cwd. */
function resolveMatrixPath(input: string): string {
  const inBenchDir = path.resolve(BENCH_DIR, input);
  if (existsSync(inBenchDir)) return inBenchDir;
  return path.resolve(process.cwd(), input);
}

/** Contract step 1: an unknown purpose, or one whose op isn't "embed", is invalid input. */
function findPurposeError(matrix: Matrix, ai: AiConfig): string | null {
  for (const model of matrix.models) {
    if (!("purpose" in model.source)) continue;
    const purpose = ai.purposes[model.source.purpose];
    if (!purpose) {
      return `model "${model.name}" names unknown purpose "${model.source.purpose}"`;
    }
    if (purpose.op !== "embed") {
      return `model "${model.name}"'s purpose "${model.source.purpose}" has op "${purpose.op}", not "embed"`;
    }
  }
  return null;
}

/** Contract step 5: any model backed by a non-"fake" provider needs --allow-paid. */
function findPaidModel(matrix: Matrix, ai: AiConfig): string | null {
  for (const model of matrix.models) {
    if (!("purpose" in model.source)) continue;
    const purpose = ai.purposes[model.source.purpose];
    const provider = purpose ? ai.providers[purpose.provider] : undefined;
    if (provider && provider.kind !== "fake") return model.name;
  }
  return null;
}

function printEstimate(est: Estimate): void {
  console.log(
    `Estimate: ${est.corpusTokens} corpus tokens, ${est.questionTokens} question tokens, cost ${fmtCost(est.costUsd)}`,
  );
}

const COLUMNS: {
  label: string;
  width: number;
  value: (r: BenchRow) => string;
}[] = [
  { label: "key", width: 30, value: (r) => r.key },
  { label: "R@1", width: 6, value: (r) => r.recall1.toFixed(3) },
  { label: "R@5", width: 6, value: (r) => r.recall5.toFixed(3) },
  { label: "R@10", width: 6, value: (r) => r.recall10.toFixed(3) },
  { label: "MRR", width: 6, value: (r) => r.mrr10.toFixed(3) },
  { label: "p50ms", width: 8, value: (r) => r.latencyMs.p50.toFixed(1) },
  { label: "p95ms", width: 8, value: (r) => r.latencyMs.p95.toFixed(1) },
  {
    label: "tokens",
    width: 8,
    value: (r) => String(r.corpusEmbed?.tokens ?? "-"),
  },
  { label: "cost", width: 10, value: (r) => fmtCost(r.corpusEmbed?.costUsd) },
];

function printTable(rows: BenchRow[]): void {
  console.log(COLUMNS.map((c) => c.label.padEnd(c.width)).join(" "));
  for (const row of rows) {
    console.log(COLUMNS.map((c) => c.value(row).padEnd(c.width)).join(" "));
  }
}

/** matrix model name -> what actually served it (contracts/results-format.md `models`). */
function modelsServed(
  matrix: Matrix,
  rows: BenchRow[],
  ai: AiConfig,
): Results["models"] {
  const out: Results["models"] = {};
  for (const model of matrix.models) {
    const row = rows.find((r) => r.model === model.name && r.embeddingModel);
    if (!row?.embeddingModel) continue;
    const provider =
      "builtin" in model.source
        ? "builtin"
        : (ai.purposes[model.source.purpose]?.provider ?? "unknown");
    out[model.name] = { embeddingModel: row.embeddingModel, provider };
  }
  return out;
}

export async function runCommand(args: {
  matrix: string;
  dryRun: boolean;
  allowPaid: boolean;
  noSave?: boolean;
  writeBaseline?: boolean;
}): Promise<number> {
  const ai = loadAiConfig(process.env);

  let matrix: Matrix;
  try {
    matrix = loadMatrix(resolveMatrixPath(args.matrix));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  const purposeError = findPurposeError(matrix, ai);
  if (purposeError) {
    console.error(purposeError);
    return 1;
  }

  if (
    args.writeBaseline &&
    !matrix.models.every(
      (m) => "builtin" in m.source && m.source.builtin === "bow",
    )
  ) {
    console.error(
      '--write-baseline requires every model in the matrix to be builtin "bow"',
    );
    return 1;
  }

  let books: ReturnType<typeof loadCorpus>["books"];
  let corpusHash: string;
  let questions: ReturnType<typeof loadQuestions>["questions"];
  let questionsHash: string;
  try {
    ({ books, hash: corpusHash } = loadCorpus(path.join(BENCH_DIR, "corpus")));
    ({ questions, hash: questionsHash } = loadQuestions(
      path.join(BENCH_DIR, "questions.json"),
      books,
    ));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  printEstimate(estimate(matrix, books, questions.length, ai));

  if (args.dryRun) return 0;

  if (!args.allowPaid) {
    const paidModel = findPaidModel(matrix, ai);
    if (paidModel) {
      console.log(
        "paid run refused; re-run with --allow-paid after operator sign-off",
      );
      return 2;
    }
  }

  const startedAt = new Date();
  const { baseUrl, benchUrl } = resolveBenchUrl(process.env);
  await ensureBenchDb(baseUrl, benchUrl);
  await migrateBenchDb(benchUrl);

  const db = createDb(benchUrl);
  try {
    const rows = await runMatrix(
      { db, ai, env: process.env },
      { matrix, books, questions },
    );
    printTable(rows);

    if (args.writeBaseline) {
      writeBaseline(BASELINE_PATH, {
        matrixHash: matrixHash(matrix),
        corpusHash,
        questionsHash,
        rows,
      });
      console.log(`wrote baseline to ${BASELINE_PATH}`);
    }

    if (!args.noSave) {
      const { filePath } = writeResults(RESULTS_DIR, {
        startedAt,
        matrix,
        matrixHash: matrixHash(matrix),
        corpusHash,
        questionsHash,
        models: modelsServed(matrix, rows, ai),
        rows,
      });
      console.log(`wrote results to ${filePath}`);
    }
  } finally {
    await db.$client.end();
  }
  return 0;
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      matrix: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      "allow-paid": { type: "boolean", default: false },
      "write-baseline": { type: "boolean", default: false },
      "no-save": { type: "boolean", default: false },
      dir: { type: "string" },
    },
  });

  const subcommand = positionals[0];
  if (subcommand === "run") {
    if (!values.matrix) {
      console.error("run requires --matrix <path>");
      process.exitCode = 1;
      return;
    }
    process.exitCode = await runCommand({
      matrix: values.matrix,
      dryRun: Boolean(values["dry-run"]),
      allowPaid: Boolean(values["allow-paid"]),
      noSave: Boolean(values["no-save"]),
      writeBaseline: Boolean(values["write-baseline"]),
    });
    return;
  }

  if (subcommand === "report") {
    report(values.dir ? path.resolve(process.cwd(), values.dir) : RESULTS_DIR);
    process.exitCode = 0;
    return;
  }

  console.error(`unknown subcommand "${subcommand}"`);
  process.exitCode = 1;
}

// Run only when executed directly (`node dist/bench/retrieval/cli.js ...`),
// not when imported (tests import `runCommand` to exercise it directly).
if (
  path.resolve(fileURLToPath(import.meta.url)) ===
  path.resolve(process.argv[1] ?? "")
) {
  await main();
}
