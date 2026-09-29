import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { type Profile, ProfileSchema, TierSchema } from "./profile.js";

/**
 * The load results file (specs/021-load-bench contracts/results-format.md).
 * Follows TASK-0029's results conventions (naming, provenance, formatting)
 * without importing its code (research R13): both benches write their own
 * small copy of this shape.
 */

export const IngestStepSchema = z.object({
  workers: z.number().int(),
  volume: z.number().int(),
  stepJobs: z.number().int(),
  tableRows: z.number().int(),
  wallMs: z.number(),
  throughputPerSec: z.number(),
  queueWaitP50Ms: z.number(),
  queueWaitP95Ms: z.number(),
  serviceP50Ms: z.number(),
  serviceP95Ms: z.number(),
  enqueueP95Ms: z.number(),
  failed: z.number().int(),
  timedOut: z.boolean(),
});
export type IngestStep = z.infer<typeof IngestStepSchema>;

export const ConcurrencyStepSchema = z.object({
  users: z.number().int(),
  requests: z.number().int(),
  errors: z.number().int(),
  errorRate: z.number(),
  httpP50Ms: z.number(),
  httpP95Ms: z.number(),
  httpP99Ms: z.number(),
  wsConnectP95Ms: z.number(),
  wsSubscribeP95Ms: z.number(),
  wsRoundTripP95Ms: z.number().nullable(),
  errorKinds: z.record(z.string(), z.number().int()),
});
export type ConcurrencyStep = z.infer<typeof ConcurrencyStepSchema>;

const VERDICT_RULES = [
  "throughput",
  "service",
  "enqueue",
  "failed",
  "latency",
  "errors",
] as const;

export const VerdictSchema = z.union([
  z.object({ degraded: z.literal(false), through: z.number() }),
  z.object({
    degraded: z.literal(true),
    at: z.number(),
    workers: z.number().int().optional(),
    rules: z.array(z.enum(VERDICT_RULES)).min(1),
  }),
]);
export type Verdict = z.infer<typeof VerdictSchema>;
export type VerdictRule = (typeof VERDICT_RULES)[number];

export const ExpectationSchema = z.object({
  name: z.string(),
  pass: z.boolean(),
  observed: z.union([z.string(), z.number(), z.null()]),
});
export type Expectation = z.infer<typeof ExpectationSchema>;

export const CaseOutcomeSchema = z
  .object({
    id: z.string(),
    tier: TierSchema,
    target: z.enum(["local", "dev"]),
    status: z.enum(["pass", "fail", "skipped"]),
    reason: z.string().optional(),
    durationMs: z.number(),
    steps: z
      .array(z.union([IngestStepSchema, ConcurrencyStepSchema]))
      .optional(),
    verdicts: z.array(VerdictSchema).optional(),
    expectations: z.array(ExpectationSchema).optional(),
    observed: z.record(z.string(), z.number()).optional(),
  })
  .superRefine((outcome, ctx) => {
    if (
      (outcome.status === "skipped" || outcome.status === "fail") &&
      !outcome.reason
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "reason is required when status is skipped or fail",
      });
    }
  });
export type CaseOutcome = z.infer<typeof CaseOutcomeSchema>;

export const LoadResultsSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().uuid(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  dirty: z.boolean(),
  host: z.object({
    node: z.string(),
    platform: z.string(),
    arch: z.string(),
    cpus: z.number().int(),
    memGiB: z.number(),
  }),
  tier: TierSchema,
  target: z.object({
    kind: z.enum(["local", "dev"]),
    postgres: z.string().nullable(),
    maxConnections: z.number().int().nullable(),
    appCommit: z.string().nullable(),
  }),
  profileHash: z.string(),
  profile: ProfileSchema,
  cases: z.array(CaseOutcomeSchema),
});
export type LoadResults = z.infer<typeof LoadResultsSchema>;
export type LoadResultsTarget = LoadResults["target"];

const DEFAULT_RESULTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../bench/load/results",
);

export interface WriteResultsInput {
  runId: string;
  startedAt: string;
  finishedAt: string;
  tier: LoadResults["tier"];
  target: LoadResultsTarget;
  profileHash: string;
  profile: Profile;
  cases: CaseOutcome[];
  /** Override the results directory; tests use this to avoid writing into the tracked directory. */
  dir?: string;
}

export interface WriteResultsOutput {
  path: string;
  results: LoadResults;
}

/**
 * Builds provenance (git commit/dirty, host facts), validates the full
 * results object, and writes it as two-space-indented JSON with a trailing
 * newline to `<dir>/<date>-<sha7>-<runId8>.json`.
 */
export function writeResults(input: WriteResultsInput): WriteResultsOutput {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const dirty =
    execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
    }).trim().length > 0;
  const host = {
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    memGiB: Math.round((os.totalmem() / 1024 ** 3) * 100) / 100,
  };

  const results = LoadResultsSchema.parse({
    schemaVersion: 1,
    runId: input.runId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    commit,
    dirty,
    host,
    tier: input.tier,
    target: input.target,
    profileHash: input.profileHash,
    profile: input.profile,
    cases: input.cases,
  });

  const dir = input.dir ?? DEFAULT_RESULTS_DIR;
  mkdirSync(dir, { recursive: true });
  const date = input.startedAt.slice(0, 10);
  const sha7 = commit.slice(0, 7);
  const runId8 = input.runId.slice(0, 8);
  const filePath = path.join(dir, `${date}-${sha7}-${runId8}.json`);
  writeFileSync(filePath, `${JSON.stringify(results, null, 2)}\n`);
  return { path: filePath, results };
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function verdictSummary(verdicts: Verdict[] | undefined): string {
  if (!verdicts || verdicts.length === 0) return "-";
  return verdicts
    .map((v) =>
      v.degraded
        ? `degraded at ${v.at}${v.workers !== undefined ? ` workers=${v.workers}` : ""} (${v.rules.join(",")})`
        : `ok through ${v.through}`,
    )
    .join("; ");
}

function expectationSummary(expectations: Expectation[] | undefined): string {
  if (!expectations || expectations.length === 0) return "-";
  const failed = expectations.filter((e) => !e.pass).map((e) => e.name);
  return failed.length === 0
    ? `${expectations.length}/${expectations.length} passed`
    : `${expectations.length - failed.length}/${expectations.length} passed (failed: ${failed.join(", ")})`;
}

const REPORT_COLUMNS: [string, number][] = [
  ["date", 12],
  ["sha7", 9],
  ["dirty", 7],
  ["cpus", 6],
  ["status", 9],
];

/**
 * Reads every results file in `dir`, warns and skips invalid or
 * unknown-`schemaVersion` files, and prints one table per (case id, target)
 * group, rows sorted by `startedAt` (contracts/bench-cli.md `report`).
 * ponytail: the "case's step columns" collapse into one summary column
 * (the verdict, or a pass/fail count for stress expectations) instead of
 * per-case-shaped columns — add real per-type columns if a reader needs raw
 * step numbers here rather than in the run's own printed table.
 */
export function report(dir?: string): void {
  const resultsDir = dir ?? DEFAULT_RESULTS_DIR;
  let files: string[];
  try {
    files = readdirSync(resultsDir).filter((f) => f.endsWith(".json"));
  } catch {
    console.log(`no results directory found at ${resultsDir}`);
    return;
  }

  interface Row {
    startedAt: string;
    date: string;
    sha7: string;
    dirty: boolean;
    cpus: number;
    status: string;
    summary: string;
  }
  const groups = new Map<string, Row[]>();

  for (const file of files) {
    const filePath = path.join(resultsDir, file);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(filePath, "utf8"));
    } catch {
      console.warn(`report: skipping ${file} (invalid JSON)`);
      continue;
    }
    const parsed = LoadResultsSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`report: skipping ${file} (invalid or unknown schemaVersion)`);
      continue;
    }
    const results = parsed.data;
    for (const c of results.cases) {
      if (c.status === "skipped") continue;
      const key = `${c.id}|${c.target}`;
      const rows = groups.get(key) ?? [];
      rows.push({
        startedAt: results.startedAt,
        date: results.startedAt.slice(0, 10),
        sha7: results.commit.slice(0, 7),
        dirty: results.dirty,
        cpus: results.host.cpus,
        status: c.status,
        summary: c.expectations
          ? expectationSummary(c.expectations)
          : verdictSummary(c.verdicts),
      });
      groups.set(key, rows);
    }
  }

  for (const key of [...groups.keys()].sort()) {
    const [id, target] = key.split("|");
    console.log(`\n== ${id} (${target}) ==`);
    console.log(
      `${REPORT_COLUMNS.map(([name, w]) => pad(name, w)).join("")}summary`,
    );
    const rows = groups.get(key)!.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    for (const row of rows) {
      console.log(
        [
          pad(row.date, REPORT_COLUMNS[0][1]),
          pad(row.sha7, REPORT_COLUMNS[1][1]),
          pad(String(row.dirty), REPORT_COLUMNS[2][1]),
          pad(String(row.cpus), REPORT_COLUMNS[3][1]),
          pad(row.status, REPORT_COLUMNS[4][1]),
          row.summary,
        ].join(""),
      );
    }
  }
}
