import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { FakeProvider } from "../../src/ai/adapters/fake.js";
import { createDb, probeReachable } from "../../src/db.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { ReportSchema } from "../../src/playtest/auditor/schema.js";
import {
  type ProviderRunOptions,
  queueAuditScript,
  runPlaytest,
} from "../../src/playtest/harness.js";
import { loadAuditScript, loadScenario } from "../../src/playtest/scenario.js";

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\nSKIPPING apps/server/test/playtest/provider.integration.test.ts — no reachable database ` +
    `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `A skip here proves NOTHING about provider mode. Start one with: pnpm env:up.\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await db?.$client.end();
});
beforeEach(async () => {
  if (db) {
    await db.execute(
      sql`DELETE FROM jobs WHERE kind IN ('turn', 'companion', 'chronicle')`,
    );
  }
});

const SHIPPED = new URL(
  "../../playtests/scenarios/greyhollow-ford.json",
  import.meta.url,
).pathname;

/**
 * Provider mode with the strict fake adapter standing in as a priced
 * "provider": every call costs 2 USD (1000 tokens in and out at 1000 USD/MTok).
 * No real provider is reached.
 */
function pricedProvider(ceilingUsd: number): ProviderRunOptions {
  const scenario = loadScenario(SHIPPED);
  const ci = scenario.ci as NonNullable<typeof scenario.ci>;
  const script = loadDmScript(JSON.parse(readFileSync(ci.dmScript, "utf8")));
  for (const c of script.calls) {
    c.usage = { inputTokens: 1000, outputTokens: 1000 };
  }
  const scripted = createScriptedDm(script);
  const audit = loadAuditScript(ci.auditScript);
  for (const r of audit.responses)
    r.usage = { inputTokens: 1000, outputTokens: 1000 };
  queueAuditScript(scripted.provider as FakeProvider, audit);
  scripted.aiConfig.purposes["playtest.audit"] = {
    provider: "scripted",
    model: "scripted-chat",
    op: "chat",
  };
  scripted.aiConfig.prices["scripted/scripted-chat"] = {
    inputPerMTok: 1000,
    outputPerMTok: 1000,
  };
  scripted.aiConfig.prices["scripted/scripted-embed"] = {
    inputPerMTok: 0,
    outputPerMTok: 0,
  };
  const retrieveResult = JSON.parse(readFileSync(ci.retrieve, "utf8"));
  return {
    aiConfig: scripted.aiConfig,
    env: {},
    ceilingUsd,
    seed: 7,
    libraryDb: db as NonNullable<typeof db>,
    adapters: { fake: () => scripted.provider as FakeProvider },
    retrieve: async () => retrieveResult,
    rng: scripted.gateRng(),
  };
}

describe.skipIf(!reachable)("provider mode on a priced fake provider", () => {
  it("plays to the end under a generous ceiling and records spend", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "playtest-prov-")), "run");
    const manifest = await runPlaytest({
      db: db as NonNullable<typeof db>,
      scenario: loadScenario(SHIPPED),
      mode: "provider",
      provider: pricedProvider(1000),
      out,
    });
    expect(manifest.mode).toBe("provider");
    expect(manifest.outcome).toBe("ended");
    expect(manifest.spend?.ceilingUsd).toBe(1000);
    expect(manifest.spend?.calls).toBeGreaterThan(0);
    expect(manifest.spend?.costUsd).toBeGreaterThan(0);
    expect(manifest.dice?.seed).toBe(7);
    expect(manifest.models["playtest.audit"]).toEqual({
      provider: "scripted",
      model: "scripted-chat",
    });
    const report = ReportSchema.parse(
      JSON.parse(readFileSync(join(out, "report.json"), "utf8")),
    );
    expect(report.verdict).toBe("pass");
    expect(report.usage.costUsd).toBeGreaterThan(0);
  });

  it("stops budget-stopped once spend reaches the ceiling", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "playtest-prov-")), "run");
    const manifest = await runPlaytest({
      db: db as NonNullable<typeof db>,
      scenario: loadScenario(SHIPPED),
      mode: "provider",
      provider: pricedProvider(5),
      out,
    });
    expect(manifest.outcome).toBe("budget-stopped");
    expect(manifest.failedJobId).toBeUndefined();
    const spend = manifest.spend;
    expect(spend?.costUsd).toBeGreaterThanOrEqual(5);
    // Overshoot is bounded by the calls in flight when the ceiling was crossed.
    expect(spend?.costUsd).toBeLessThan(5 + 2 * 8);
  });

  it("refuses to run under CI even when called directly", async () => {
    const p = pricedProvider(1000);
    await expect(
      runPlaytest({
        db: db as NonNullable<typeof db>,
        scenario: loadScenario(SHIPPED),
        mode: "provider",
        provider: { ...p, env: { CI: "1" } },
        out: join(tmpdir(), "never-written"),
      }),
    ).rejects.toThrow(/refused under CI/);
  });
});
