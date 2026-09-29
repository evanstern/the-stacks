import { CASES, type RunContext, selectCases } from "./cases.js";
import { recreateLoadDb, resolveLoadUrl } from "./db.js";
import { printConcurrency } from "./concurrency.js";
import { printIngest } from "./ingest.js";
import { loadProfile, type Profile, type Tier } from "./profile.js";
import type { CaseOutcome, ConcurrencyStep, IngestStep } from "./results.js";
import { concurrencyVerdict, ingestVerdict, percentile } from "./stats.js";
import { printExpectations } from "./stress.js";
import { synthDoc } from "./synth.js";

/**
 * The load bench's agent-operable module API (specs/021-load-bench
 * contracts/bench-cli.md "Module API"). `cli.ts` is a thin argv/exit-code
 * wrapper over this file; an agent can call `runTier` directly for
 * outcomes without going through a subprocess.
 */

export { CASES, selectCases, type RunContext };
export { loadProfile };
export { resolveLoadUrl, recreateLoadDb };
export { synthDoc };
export { percentile, ingestVerdict, concurrencyVerdict };

export interface RunResult {
  outcomes: CaseOutcome[];
  failed: boolean;
}

function isIngestStep(step: IngestStep | ConcurrencyStep): step is IngestStep {
  return "volume" in step;
}

/** Prints a case outcome's table/expectations and verdict (contracts/bench-cli.md "Output format"). */
export function printOutcome(outcome: CaseOutcome): void {
  if (outcome.status === "skipped") {
    console.log(`SKIP ${outcome.id} [tier ${outcome.tier}]: ${outcome.reason}`);
    return;
  }
  if (outcome.steps && outcome.steps.length > 0) {
    if (isIngestStep(outcome.steps[0])) {
      printIngest(outcome.id, outcome.steps as IngestStep[], outcome.verdicts ?? []);
    } else {
      printConcurrency(
        outcome.id,
        outcome.steps as ConcurrencyStep[],
        outcome.verdicts?.[0] ?? null,
      );
    }
  } else if (outcome.expectations) {
    printExpectations(outcome.id, outcome.expectations);
  }
  if (outcome.status === "fail") {
    console.log(`FAIL ${outcome.id}: ${outcome.reason ?? "unknown failure"}`);
  } else if (!outcome.verdicts && !outcome.expectations) {
    // No degradation series or expectation list to speak for it
    // (concurrency-smoke) — say so plainly.
    console.log(`PASS ${outcome.id}`);
  }
}

/**
 * Runs every case `selectCases` selects for `tier`, in registry order,
 * printing each outcome as it finishes (contracts/bench-cli.md `run` steps
 * 2 and 5). Callers needing the dev-tier `--allow-dev`/credential guards or
 * results persistence (steps 3, 4, 6, 7 — process/env/exit-code concerns)
 * are `cli.ts`'s job, not this function's.
 */
export async function runTier(
  ctx: RunContext,
  tier: Tier,
  profile: Profile,
  only?: string[],
): Promise<RunResult> {
  const { run, skipped } = selectCases(tier, only);
  for (const outcome of skipped) printOutcome(outcome);

  const outcomes: CaseOutcome[] = [...skipped];
  let failed = false;
  for (const c of run) {
    const outcome = await c.run(ctx, profile);
    printOutcome(outcome);
    outcomes.push(outcome);
    if (outcome.status === "fail") failed = true;
  }
  return { outcomes, failed };
}
