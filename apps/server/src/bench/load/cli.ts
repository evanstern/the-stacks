import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ZodError } from "zod";
import { describeLoadDb, dropLoadDb, resolveLoadUrl } from "./db.js";
import { CASES, type RunContext, runTier } from "./index.js";
import {
  loadProfile,
  type Profile,
  profileHash,
  type Tier,
} from "./profile.js";
import { type LoadResultsTarget, report, writeResults } from "./results.js";

/**
 * The load bench CLI (specs/021-load-bench contracts/bench-cli.md). Argv
 * parsing, the dev-tier guards, results persistence, and exit codes — the
 * process-level shell around `index.ts`'s module API.
 */

const PROFILES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../bench/load/profiles",
);

function gitCommit(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

function printList(): number {
  for (const c of CASES) {
    console.log(`${c.id}\t${c.tier}\t${c.target}\t${c.summary}`);
  }
  return 0;
}

function isTier(value: unknown): value is Tier {
  return value === "commit" || value === "demand" || value === "dev";
}

async function cmdRun(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      tier: { type: "string" },
      case: { type: "string", multiple: true },
      profile: { type: "string" },
      "allow-dev": { type: "boolean", default: false },
      "no-save": { type: "boolean", default: false },
    },
  });

  if (!isTier(values.tier)) {
    console.error(
      `run requires --tier commit|demand|dev, got "${values.tier ?? ""}"`,
    );
    return 1;
  }
  const tier = values.tier;
  const only = values.case;
  const profilePath = values.profile ?? path.join(PROFILES_DIR, `${tier}.json`);

  let profile: Profile;
  try {
    profile = loadProfile(profilePath);
  } catch (err) {
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      console.error(
        `invalid profile ${profilePath}: ${issue.path.join(".")}: ${issue.message}`,
      );
    } else {
      console.error(
        `invalid profile ${profilePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return 1;
  }

  if (tier === "commit" || tier === "demand") {
    try {
      resolveLoadUrl(env);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      return 1;
    }
  }

  if (tier === "dev" && env.LOAD_DEV_URL) {
    if (!values["allow-dev"]) {
      console.error(
        "dev run refused; re-run with --allow-dev after operator sign-off",
      );
      return 2;
    }
    if (!env.LOAD_DEV_USERNAME) {
      console.error("LOAD_DEV_USERNAME is required for the dev tier");
      return 1;
    }
    if (!env.LOAD_DEV_PASSWORD) {
      console.error("LOAD_DEV_PASSWORD is required for the dev tier");
      return 1;
    }
  }

  const ctx: RunContext = { runId: randomUUID() };
  const startedAt = new Date().toISOString();
  const result = await runTier(ctx, tier, profile, only);
  const finishedAt = new Date().toISOString();

  if (!values["no-save"]) {
    const commit = gitCommit();
    let target: LoadResultsTarget;
    if (tier === "dev") {
      // ponytail: appCommit stays null here — the dev case's /health commit
      // isn't threaded back through CaseOutcome (`observed` is numbers-only,
      // research R11). Add a second /health read here (only ever reached
      // under an operator-approved --allow-dev run) if a reader needs it.
      target = {
        kind: "dev",
        postgres: null,
        maxConnections: null,
        appCommit: null,
      };
    } else {
      const { loadUrl } = resolveLoadUrl(env);
      const facts = await describeLoadDb(loadUrl).catch(() => null);
      target = {
        kind: "local",
        postgres: facts?.postgres ?? null,
        maxConnections: facts?.maxConnections ?? null,
        appCommit: commit,
      };
    }
    const { path: resultsPath } = writeResults({
      runId: ctx.runId,
      startedAt,
      finishedAt,
      tier,
      target,
      profileHash: profileHash(profile),
      profile,
      cases: result.outcomes,
    });
    console.log(`results written to ${resultsPath}`);
  }

  if (tier === "commit" || tier === "demand") {
    try {
      const { baseUrl, loadUrl } = resolveLoadUrl(env);
      await dropLoadDb(baseUrl, loadUrl);
    } catch (err) {
      console.warn(
        `warning: failed to drop the load database: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result.failed ? 1 : 0;
}

function cmdReport(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: { dir: { type: "string" } },
  });
  report(values.dir);
  return 0;
}

export async function main(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const [sub, ...rest] = argv;
  switch (sub) {
    case "list":
      return printList();
    case "run":
      return cmdRun(rest, env);
    case "report":
      return cmdReport(rest);
    default:
      console.error(
        `unknown subcommand "${sub ?? ""}"; expected list, run, or report`,
      );
      return 1;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
