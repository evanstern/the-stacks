import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { FakeProvider } from "../ai/adapters/fake.js";
import { type AiConfig, loadAiConfig } from "../ai/config.js";
import { createGateway, type Gateway } from "../ai/gateway.js";
import { memorySink } from "../ai/usage.js";
import { createDb } from "../db.js";
import { loadSeed } from "../dm/seed/load.js";
import { runAudit } from "./auditor/audit.js";
import { renderReport, renderTranscript } from "./auditor/render.js";
import {
  type Report,
  ReportSchema,
  type RunManifest,
} from "./auditor/schema.js";
import { segment } from "./auditor/segments.js";
import {
  budgetGateway,
  countingSink,
  estimate,
  formatEstimate,
  providerPreflight,
} from "./budget.js";
import { recreatePlaytestDb, resolvePlaytestUrl } from "./db.js";
import {
  exportSession,
  readRunDir,
  writeReportFiles,
  writeRunDir,
} from "./export.js";
import { queueAuditScript, runPlaytest } from "./harness.js";
import { PLAYTEST_AUDIT_PURPOSE } from "./purpose.js";
import {
  loadAuditScript,
  loadScenario,
  type Scenario,
  ScenarioError,
} from "./scenario.js";

/**
 * The playtest CLI (specs/032-playtest-harness contracts/cli.md):
 * `run`, `audit` and `estimate`. Logs go to stderr as JSON lines, the summary
 * to stdout. Provider mode is explicit and cannot spend without a ceiling.
 */

export const EXIT = {
  ok: 0,
  verdict: 1,
  outcome: 2,
  unconfirmed: 3,
  refused: 4,
  usage: 64,
} as const;

const PKG_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const DEFAULT_SCENARIO = path.join(
  PKG_ROOT,
  "playtests/scenarios/greyhollow-ford.json",
);
const DEFAULT_AUDIT_SCRIPT = path.join(
  PKG_ROOT,
  "playtests/fixtures/greyhollow-ford.audit.json",
);

export interface Io {
  out(line: string): void;
  err(line: string): void;
}

export interface Deps {
  /** Seam for tests: replaces the database-backed run. */
  runPlaytest?: (opts: {
    scenario: Scenario;
    mode: "ci" | "provider";
    out: string;
    runId: string;
    noAudit: boolean;
    aiConfig?: AiConfig;
    ceilingUsd?: number;
    seed: number | null;
  }) => Promise<RunManifest>;
}

const defaultIo: Io = {
  out: (l) => process.stdout.write(`${l}\n`),
  err: (l) => process.stderr.write(`${l}\n`),
};

class Exit extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

const OPTIONS = {
  scenario: { type: "string" },
  mode: { type: "string" },
  out: { type: "string" },
  seed: { type: "string" },
  "spend-ceiling-usd": { type: "string" },
  "no-audit": { type: "boolean", default: false },
  dir: { type: "string" },
  session: { type: "string" },
  "db-url": { type: "string" },
  auditor: { type: "string" },
  "audit-script": { type: "string" },
  segments: { type: "string" },
} as const;

type Values = ReturnType<typeof parseValues>;

function parseValues(argv: string[]) {
  return parseArgs({ args: argv, allowPositionals: true, options: OPTIONS });
}

function utcStamp(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
}

function gitCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function positiveNumber(raw: string | undefined, flag: string): number | null {
  if (raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Exit(EXIT.usage, `${flag} must be a positive number`);
  }
  return n;
}

function intFlag(raw: string | undefined, flag: string): number | null {
  if (raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Exit(EXIT.usage, `${flag} must be a non-negative integer`);
  }
  return n;
}

const money = (n: number) => `$${n.toFixed(4)}`;

interface Ctx {
  /** Provider runs replace this with the host-rewritten copy. */
  env: NodeJS.ProcessEnv;
  io: Io;
  deps: Deps;
  abs: (p: string) => string;
}

/**
 * True when the CLI runs on the host, not in a container. The override
 * `PLAYTEST_HOST_NETWORK` (`1` = host, `0` = container) wins; otherwise the
 * absence of `/.dockerenv` means host.
 */
export function runsOnHost(env: NodeJS.ProcessEnv): boolean {
  if (env.PLAYTEST_HOST_NETWORK === "1") return true;
  if (env.PLAYTEST_HOST_NETWORK === "0") return false;
  return !existsSync("/.dockerenv");
}

/**
 * The shared `.env` names provider base URLs with `host.docker.internal`,
 * which only containers resolve. On the host, rewrite that name to
 * `localhost` in `AI_PROVIDERS` and report each rewrite. Returns a new env.
 */
export function rewriteDockerHost(
  env: NodeJS.ProcessEnv,
  report: (e: {
    provider: string;
    from: string;
    to: string;
  }) => void = () => {},
): NodeJS.ProcessEnv {
  const raw = env.AI_PROVIDERS;
  if (!raw?.includes("host.docker.internal") || !runsOnHost(env)) {
    return env;
  }
  let parsed: Record<string, { baseUrl?: unknown }>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return env; // loadAiConfig reports the malformed value
  }
  for (const [provider, cfg] of Object.entries(parsed)) {
    const from = cfg?.baseUrl;
    if (typeof from !== "string" || !from.includes("host.docker.internal")) {
      continue;
    }
    const to = from.replace("host.docker.internal", "localhost");
    cfg.baseUrl = to;
    report({ provider, from, to });
  }
  return { ...env, AI_PROVIDERS: JSON.stringify(parsed) };
}

function log(ctx: Ctx, event: string, fields: Record<string, unknown> = {}) {
  ctx.io.err(JSON.stringify({ event, ...fields }));
}

function readScenario(ctx: Ctx, v: Values["values"]): Scenario {
  try {
    return loadScenario(v.scenario ? ctx.abs(v.scenario) : DEFAULT_SCENARIO);
  } catch (error) {
    if (error instanceof ScenarioError) {
      throw new Exit(EXIT.usage, error.message);
    }
    throw error;
  }
}

/**
 * Provider preflight steps 1 to 4 (contracts/cost-guard.md): throws
 * `Exit(4)` on a refusal, prints the estimate, returns it with the config.
 */
function preflight(
  ctx: Ctx,
  scenario: Pick<Scenario, "moves" | "limits">,
  needs: { dm: boolean; audit: boolean },
  segments?: number,
) {
  if (ctx.env.CI) {
    throw new Exit(EXIT.refused, "provider mode is refused under CI");
  }
  ctx.env = rewriteDockerHost(ctx.env, (e) =>
    log(ctx, "rewrite-provider-host", e),
  );
  let aiConfig: AiConfig;
  try {
    aiConfig = loadAiConfig(ctx.env);
  } catch (error) {
    throw new Exit(
      EXIT.refused,
      `AI configuration is invalid: ${(error as Error).message}`,
    );
  }
  const embedPurpose = ctx.env.RETRIEVAL_EMBED_PURPOSE || undefined;
  const refusals = providerPreflight(ctx.env, aiConfig, {
    ...needs,
    embedPurpose,
  });
  if (refusals.length > 0) {
    throw new Exit(EXIT.refused, refusals.map((r) => r.message).join("\n"));
  }
  const est = estimate({
    scenario,
    aiConfig,
    segments,
    include: needs,
    embedPurpose,
  });
  ctx.io.out(formatEstimate(est));
  return { aiConfig, est };
}

/** Steps 5 and 6: the ceiling must be given and cover the upper bound. */
function requireCeiling(
  ceiling: number | null,
  upperUsd: number | null,
): number {
  if (ceiling === null) {
    throw new Exit(
      EXIT.unconfirmed,
      "spend not confirmed; re-run with --spend-ceiling-usd <n>",
    );
  }
  if (upperUsd !== null && upperUsd > ceiling) {
    throw new Exit(
      EXIT.unconfirmed,
      `ceiling below upper-bound estimate (${money(ceiling)} < ${money(upperUsd)})`,
    );
  }
  return ceiling;
}

function readReport(dir: string): Report | null {
  const file = path.join(dir, "report.json");
  if (!existsSync(file)) return null;
  return ReportSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

async function defaultRun(
  ctx: Ctx,
  o: Parameters<NonNullable<Deps["runPlaytest"]>>[0],
): Promise<RunManifest> {
  const { baseUrl, playtestUrl } = (() => {
    try {
      return resolvePlaytestUrl(ctx.env);
    } catch (error) {
      throw new Exit(EXIT.usage, (error as Error).message);
    }
  })();
  await recreatePlaytestDb(baseUrl, playtestUrl);
  const db = createDb(playtestUrl);
  const libraryDb = o.mode === "provider" ? createDb(baseUrl) : undefined;
  try {
    return await runPlaytest({
      db,
      scenario: o.scenario,
      mode: o.mode,
      out: o.out,
      runId: o.runId,
      noAudit: o.noAudit,
      ...(o.mode === "provider" && libraryDb && o.aiConfig && o.ceilingUsd
        ? {
            provider: {
              aiConfig: o.aiConfig,
              env: ctx.env,
              ceilingUsd: o.ceilingUsd,
              seed: o.seed,
              libraryDb,
            },
          }
        : {}),
    });
  } finally {
    await db.$client.end();
    await libraryDb?.$client.end();
  }
}

async function cmdRun(ctx: Ctx, v: Values["values"]): Promise<number> {
  const mode = v.mode ?? "ci";
  if (mode !== "ci" && mode !== "provider") {
    throw new Exit(EXIT.usage, '--mode must be "ci" or "provider"');
  }
  const scenario = readScenario(ctx, v);
  const ceiling = positiveNumber(v["spend-ceiling-usd"], "--spend-ceiling-usd");
  const seedFlag = intFlag(v.seed, "--seed");
  const seed = seedFlag ?? scenario.dice.seed;
  const noAudit = Boolean(v["no-audit"]);

  let aiConfig: AiConfig | undefined;
  let ceilingUsd: number | undefined;
  if (mode === "provider") {
    const pre = preflight(ctx, scenario, { dm: true, audit: !noAudit });
    aiConfig = pre.aiConfig;
    ceilingUsd = requireCeiling(ceiling, pre.est.upperUsd);
  } else if (!scenario.ci) {
    throw new Exit(EXIT.usage, "this scenario has no `ci` fixtures");
  }

  const startedAt = new Date();
  const runId = `${utcStamp(startedAt)}-${scenario.name}-${mode}`;
  const out = v.out ? ctx.abs(v.out) : ctx.abs(path.join(".playtests", runId));
  log(ctx, "run.start", { mode, scenario: scenario.name, out, runId });
  const exec = ctx.deps.runPlaytest ?? ((o) => defaultRun(ctx, o));
  const manifest = await exec({
    scenario,
    mode,
    out,
    runId,
    noAudit,
    aiConfig,
    ceilingUsd,
    seed,
  });
  const report = readReport(out);
  log(ctx, "run.finish", { outcome: manifest.outcome });
  ctx.io.out(`run directory: ${out}`);
  ctx.io.out(`outcome: ${manifest.outcome}`);
  ctx.io.out(`verdict: ${report?.verdict ?? "not audited"}`);
  ctx.io.out(
    manifest.spend
      ? `spend: ${money(manifest.spend.costUsd ?? 0)} over ${manifest.spend.calls} calls (ceiling ${money(manifest.spend.ceilingUsd ?? 0)})`
      : "spend: none (ci mode)",
  );
  if (manifest.outcome !== "ended") return EXIT.outcome;
  if (report && report.verdict !== "pass") return EXIT.verdict;
  return EXIT.ok;
}

function fakeAuditGateway(scriptPath: string): {
  gateway: Gateway;
  models: RunManifest["models"];
} {
  const provider = new FakeProvider();
  provider.strict = true;
  queueAuditScript(provider, loadAuditScript(scriptPath));
  const config: AiConfig = {
    providers: { fake: { kind: "fake", baseUrl: "http://fake/audit" } },
    purposes: {
      [PLAYTEST_AUDIT_PURPOSE]: {
        provider: "fake",
        model: "scripted-chat",
        op: "chat",
      },
    },
    prices: {},
  };
  return {
    gateway: createGateway({
      config,
      sink: memorySink(),
      adapters: { fake: () => provider },
    }),
    models: {
      [PLAYTEST_AUDIT_PURPOSE]: { provider: "fake", model: "scripted-chat" },
    },
  };
}

async function cmdAudit(ctx: Ctx, v: Values["values"]): Promise<number> {
  if ((v.dir === undefined) === (v.session === undefined)) {
    throw new Exit(EXIT.usage, "audit needs exactly one of --dir or --session");
  }
  const ceiling = positiveNumber(v["spend-ceiling-usd"], "--spend-ceiling-usd");

  let dir: string;
  let contents: ReturnType<typeof readRunDir>;
  let sourceMode: RunManifest["mode"];
  if (v.dir !== undefined) {
    dir = ctx.abs(v.dir);
    try {
      contents = readRunDir(dir);
    } catch (error) {
      throw new Exit(
        EXIT.usage,
        `cannot read run directory: ${(error as Error).message}`,
      );
    }
    sourceMode = contents.manifest.mode;
  } else {
    const url = v["db-url"] ?? ctx.env.DATABASE_URL;
    if (!url)
      throw new Exit(EXIT.usage, "--session needs --db-url or DATABASE_URL");
    const sessionId = v.session as string;
    const db = createDb(url);
    let exported: Awaited<ReturnType<typeof exportSession>>;
    try {
      exported = await exportSession(db, sessionId);
    } finally {
      await db.$client.end();
    }
    const first = exported.transcript[0];
    const last = exported.transcript[exported.transcript.length - 1];
    const scenes = exported.transcript.filter(
      (r) => r.type === "scene.changed",
    );
    const lastScene = scenes[scenes.length - 1]?.payload as
      | {
          after?: { sceneId?: string } | null;
          before?: { sceneId?: string } | null;
        }
      | undefined;
    const runId = `${utcStamp(new Date())}-session-${sessionId.slice(0, 8)}`;
    dir = v.out ? ctx.abs(v.out) : ctx.abs(path.join(".playtests", runId));
    const manifest: RunManifest = {
      v: 1,
      runId,
      mode: "session",
      commit: gitCommit(),
      sessionId,
      seedId: lastScene?.after?.sceneId ?? lastScene?.before?.sceneId ?? null,
      models: {},
      startedAt: first?.ts ?? new Date().toISOString(),
      finishedAt: last?.ts ?? new Date().toISOString(),
      outcome: lastScene && lastScene.after === null ? "ended" : "stalled",
      moves: {
        committed: exported.transcript.filter(
          (r) => r.type === "action.committed",
        ).length,
        refusals: [],
      },
    };
    writeRunDir(dir, {
      manifest,
      transcript: exported.transcript,
      transcriptMd: renderTranscript(exported.transcript, exported.ledger),
      ledger: exported.ledger,
      jobs: exported.jobs,
    });
    contents = { manifest, ...exported };
    sourceMode = "session";
  }

  const auditor = v.auditor ?? (sourceMode === "ci" ? "fake" : "none");
  if (!["fake", "provider", "none"].includes(auditor)) {
    throw new Exit(
      EXIT.usage,
      '--auditor must be "fake", "provider" or "none"',
    );
  }
  const models: RunManifest["models"] = { ...contents.manifest.models };
  let gateway: Gateway | null = null;
  let sink: ReturnType<typeof countingSink> | null = null;
  if (auditor === "fake") {
    const fake = fakeAuditGateway(
      v["audit-script"] ? ctx.abs(v["audit-script"]) : DEFAULT_AUDIT_SCRIPT,
    );
    gateway = fake.gateway;
    Object.assign(models, fake.models);
  } else if (auditor === "provider") {
    const segments = segment(contents.transcript, contents.ledger).length;
    const scenario = readScenario(ctx, v);
    const pre = preflight(
      ctx,
      scenario,
      { dm: false, audit: true },
      Math.max(segments, 1),
    );
    const ceilingUsd = requireCeiling(ceiling, pre.est.upperUsd);
    sink = countingSink(memorySink());
    gateway = budgetGateway(
      createGateway({ config: pre.aiConfig, sink, env: ctx.env }),
      sink,
      ceilingUsd,
    );
    for (const p of [PLAYTEST_AUDIT_PURPOSE, "dm.narrate"]) {
      const c = pre.aiConfig.purposes[p];
      if (c) models[p] = { provider: c.provider, model: c.model };
    }
  }

  let seed = null;
  if (contents.manifest.seedId) {
    try {
      seed = loadSeed(contents.manifest.seedId);
    } catch {
      seed = null;
    }
  }
  log(ctx, "audit.start", { auditor, dir });
  const report = ReportSchema.parse(
    await runAudit({
      transcript: contents.transcript,
      ledger: contents.ledger,
      jobs: contents.jobs,
      seed,
      gateway,
      models,
      runId: contents.manifest.runId,
      commit: gitCommit(),
    }),
  );
  if (sink) {
    report.usage.costUsd = sink.totals().costUsd;
  }
  const outDir = v.out ? ctx.abs(v.out) : dir;
  writeReportFiles(outDir, report, renderReport(report));
  log(ctx, "audit.finish", { verdict: report.verdict });
  ctx.io.out(`report: ${path.join(outDir, "report.json")}`);
  ctx.io.out(`verdict: ${report.verdict}`);
  if (sink) ctx.io.out(`spend: ${money(sink.totals().costUsd)}`);
  return report.verdict === "pass" ? EXIT.ok : EXIT.verdict;
}

function cmdEstimate(ctx: Ctx, v: Values["values"]): number {
  const scenario = readScenario(ctx, v);
  const segments = intFlag(v.segments, "--segments");
  preflight(
    ctx,
    scenario,
    { dm: segments === null, audit: true },
    segments ?? undefined,
  );
  return EXIT.ok;
}

/** The CLI entry. Returns the exit code; never calls `process.exit`. */
export async function main(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  io: Io = defaultIo,
  deps: Deps = {},
): Promise<number> {
  const ctx: Ctx = {
    env,
    io,
    deps,
    abs: (p) => path.resolve(env.INIT_CWD || process.cwd(), p),
  };
  try {
    let parsed: ReturnType<typeof parseValues>;
    try {
      parsed = parseValues(argv);
    } catch (error) {
      throw new Exit(EXIT.usage, (error as Error).message);
    }
    const [command] = parsed.positionals;
    if (command === "run") return await cmdRun(ctx, parsed.values);
    if (command === "audit") return await cmdAudit(ctx, parsed.values);
    if (command === "estimate") return cmdEstimate(ctx, parsed.values);
    throw new Exit(
      EXIT.usage,
      "usage: playtest run|audit|estimate [flags] (see specs/032-playtest-harness/contracts/cli.md). On the host, provider base URLs using host.docker.internal are rewritten to localhost; set PLAYTEST_HOST_NETWORK=0 to keep them (1 forces the rewrite).",
    );
  } catch (error) {
    if (error instanceof Exit) {
      io.err(
        JSON.stringify({
          event: "exit",
          code: error.code,
          message: error.message,
        }),
      );
      return error.code;
    }
    io.err(
      JSON.stringify({
        event: "error",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return EXIT.outcome;
  }
}

// Run only when executed directly (`node dist/playtest/cli.js ...`).
if (
  path.resolve(fileURLToPath(import.meta.url)) ===
  path.resolve(process.argv[1] ?? "")
) {
  process.exitCode = await main(process.argv.slice(2));
}
