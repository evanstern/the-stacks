import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CASES, selectCases } from "../../src/bench/load/cases.js";
import { resolveLoadUrl } from "../../src/bench/load/db.js";
import { ProfileSchema } from "../../src/bench/load/profile.js";
import {
  type CaseOutcome,
  type ConcurrencyStep,
  type IngestStep,
  writeResults,
} from "../../src/bench/load/results.js";
import {
  concurrencyVerdict,
  ingestVerdict,
  percentile,
} from "../../src/bench/load/stats.js";
import { synthDoc } from "../../src/bench/load/synth.js";
import { parseMarkdown } from "../../src/library/ingest/markdown.js";

/**
 * Unit tests for the pure load-bench modules (specs/021-load-bench
 * contracts/bench-cli.md, invariants 1-6, 8, 9). No database needed.
 */

describe("cases registry (invariant 1)", () => {
  it("every case has exactly one tier and a unique id", () => {
    const ids = CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CASES) {
      expect(["commit", "demand", "dev"]).toContain(c.tier);
    }
  });

  it("only dev-tier cases have target dev", () => {
    for (const c of CASES) {
      if (c.target === "dev") expect(c.tier).toBe("dev");
      if (c.tier !== "dev") expect(c.target).toBe("local");
    }
  });
});

describe("selectCases (invariant 2)", () => {
  it("every non-selected case is skipped with a non-empty reason; run + skipped = CASES", () => {
    const { run, skipped } = selectCases("demand", undefined);
    for (const c of run) expect(c.tier).toBe("demand");
    for (const outcome of skipped) {
      expect(outcome.status).toBe("skipped");
      expect(outcome.reason).toBeTruthy();
    }
    const allIds = new Set([
      ...run.map((c) => c.id),
      ...skipped.map((c) => c.id),
    ]);
    expect(allIds.size).toBe(CASES.length);
  });

  it("--case filters within the tier", () => {
    const { run, skipped } = selectCases("demand", ["ingest-scaling"]);
    expect(run.map((c) => c.id)).toEqual(["ingest-scaling"]);
    const other = skipped.find((o) => o.id === "concurrency-local");
    expect(other?.reason).toBe("not selected by --case");
  });
});

describe("resolveLoadUrl (invariant 3)", () => {
  const base = "postgres://stacks:stacks@localhost:5433/stacks";

  it("appends _load to the base database name", () => {
    const { baseUrl, loadUrl } = resolveLoadUrl({ TEST_DATABASE_URL: base });
    expect(baseUrl).toBe(base);
    expect(loadUrl).toBe("postgres://stacks:stacks@localhost:5433/stacks_load");
  });

  it("honors LOAD_DATABASE_URL", () => {
    const override = "postgres://stacks:stacks@127.0.0.1:5433/custom_load";
    const { loadUrl } = resolveLoadUrl({
      TEST_DATABASE_URL: base,
      LOAD_DATABASE_URL: override,
    });
    expect(loadUrl).toBe(override);
  });

  it("throws when the load URL equals the base URL", () => {
    expect(() =>
      resolveLoadUrl({ TEST_DATABASE_URL: base, LOAD_DATABASE_URL: base }),
    ).toThrow();
  });

  it("throws for a non-loopback host", () => {
    expect(() =>
      resolveLoadUrl({
        TEST_DATABASE_URL: "postgres://stacks:stacks@db:5432/stacks",
      }),
    ).toThrow();
  });
});

describe("synthDoc (invariant 4)", () => {
  it("is deterministic for the same seed and bytes", () => {
    expect(synthDoc(42, 8192)).toBe(synthDoc(42, 8192));
  });

  it("differs for a different seed", () => {
    expect(synthDoc(1, 8192)).not.toBe(synthDoc(2, 8192));
  });

  it("is within 5% of the requested bytes", () => {
    const bytes = 8192;
    const doc = synthDoc(7, bytes);
    const actual = Buffer.byteLength(doc, "utf8");
    expect(actual).toBeGreaterThanOrEqual(bytes);
    expect(actual).toBeLessThanOrEqual(bytes * 1.05);
  });

  it("parses with parseMarkdown into at least one chunk", () => {
    const parsed = parseMarkdown({
      book: "load-bench-synth-test",
      text: synthDoc(3, 8192),
    });
    expect(parsed.blocks.length).toBeGreaterThanOrEqual(1);
  });
});

describe("percentile (invariant 6)", () => {
  it("nearest-rank: p95 of [1..100] is 95", () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(sorted, 95)).toBe(95);
  });

  it("a single sample returns it for any percentile", () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 99)).toBe(42);
  });
});

function ingestStep(overrides: Partial<IngestStep>): IngestStep {
  return {
    workers: 1,
    volume: 10,
    stepJobs: 10,
    tableRows: 10,
    wallMs: 1000,
    throughputPerSec: 10,
    queueWaitP50Ms: 5,
    queueWaitP95Ms: 10,
    serviceP50Ms: 20,
    serviceP95Ms: 30,
    enqueueP95Ms: 5,
    failed: 0,
    timedOut: false,
    ...overrides,
  };
}

const INGEST_THRESHOLDS = {
  throughputFloor: 0.7,
  serviceMultiple: 2.0,
  enqueueMultiple: 3.0,
};

describe("ingestVerdict (invariant 5)", () => {
  it("a flat series is not degraded", () => {
    const steps = [
      ingestStep({ volume: 10 }),
      ingestStep({ volume: 20 }),
      ingestStep({ volume: 30 }),
    ];
    expect(ingestVerdict(steps, INGEST_THRESHOLDS)).toEqual({
      degraded: false,
      through: 30,
    });
  });

  it("names the first degraded step and every rule that fired there", () => {
    const steps = [
      ingestStep({ volume: 10, throughputPerSec: 10, serviceP95Ms: 30 }),
      ingestStep({ volume: 20, throughputPerSec: 9, serviceP95Ms: 35 }), // within tolerance
      ingestStep({ volume: 30, throughputPerSec: 2, serviceP95Ms: 200 }), // throughput + service fire
    ];
    expect(ingestVerdict(steps, INGEST_THRESHOLDS)).toEqual({
      degraded: true,
      at: 30,
      rules: ["throughput", "service"],
    });
  });

  it("absolute floors suppress sub-floor changes even past the ratio", () => {
    // service p95 triples (past the 2.0x multiple) but both values are
    // under the 100ms floor, so it must not count as degraded.
    const steps = [
      ingestStep({ volume: 10, serviceP95Ms: 10, enqueueP95Ms: 2 }),
      ingestStep({ volume: 20, serviceP95Ms: 35, enqueueP95Ms: 8 }),
    ];
    expect(ingestVerdict(steps, INGEST_THRESHOLDS)).toEqual({
      degraded: false,
      through: 20,
    });
  });

  it("a failed job degrades regardless of thresholds", () => {
    const steps = [
      ingestStep({ volume: 10 }),
      ingestStep({ volume: 20, failed: 1 }),
    ];
    expect(ingestVerdict(steps, INGEST_THRESHOLDS)).toEqual({
      degraded: true,
      at: 20,
      rules: ["failed"],
    });
  });
});

function concurrencyStep(overrides: Partial<ConcurrencyStep>): ConcurrencyStep {
  return {
    users: 1,
    requests: 10,
    errors: 0,
    errorRate: 0,
    httpP50Ms: 10,
    httpP95Ms: 20,
    httpP99Ms: 25,
    wsConnectP95Ms: 15,
    wsSubscribeP95Ms: 15,
    wsRoundTripP95Ms: 15,
    errorKinds: {},
    ...overrides,
  };
}

const CONCURRENCY_THRESHOLDS = { latencyMultiple: 3.0, errorRate: 0.01 };

describe("concurrencyVerdict (invariant 5)", () => {
  it("a flat series is not degraded", () => {
    const steps = [
      concurrencyStep({ users: 1 }),
      concurrencyStep({ users: 10 }),
    ];
    expect(concurrencyVerdict(steps, CONCURRENCY_THRESHOLDS)).toEqual({
      degraded: false,
      through: 10,
    });
  });

  it("names latency and errors when both fire", () => {
    const steps = [
      concurrencyStep({ users: 1, httpP95Ms: 20 }),
      concurrencyStep({ users: 50, httpP95Ms: 200, errorRate: 0.05 }),
    ];
    expect(concurrencyVerdict(steps, CONCURRENCY_THRESHOLDS)).toEqual({
      degraded: true,
      at: 50,
      rules: ["latency", "errors"],
    });
  });

  it("the latency floor suppresses a sub-floor change", () => {
    const steps = [
      concurrencyStep({ users: 1, httpP95Ms: 5 }),
      concurrencyStep({ users: 10, httpP95Ms: 40 }), // 8x baseline, still under the 50ms floor
    ];
    expect(concurrencyVerdict(steps, CONCURRENCY_THRESHOLDS)).toEqual({
      degraded: false,
      through: 10,
    });
  });
});

describe("ProfileSchema dev validation (invariant 8)", () => {
  const base = {
    tier: "dev" as const,
    concurrency: {
      users: [1, 5],
      durationMs: 1000,
      thinkMs: 250,
      wsSend: false,
      thresholds: { latencyMultiple: 3.0, errorRate: 0.01 },
    },
  };

  it("accepts a valid dev profile", () => {
    expect(ProfileSchema.safeParse(base).success).toBe(true);
  });

  it("rejects wsSend: true", () => {
    const profile = {
      ...base,
      concurrency: { ...base.concurrency, wsSend: true },
    };
    expect(ProfileSchema.safeParse(profile).success).toBe(false);
  });

  it("rejects more than 25 users", () => {
    const profile = {
      ...base,
      concurrency: { ...base.concurrency, users: [1, 30] },
    };
    expect(ProfileSchema.safeParse(profile).success).toBe(false);
  });
});

describe("writeResults (invariant 9)", () => {
  it("a results file for a dev-target run contains no URL, credential, or session cookie", () => {
    // The forbidden fixtures below never appear anywhere in the fabricated
    // outcome or profile below — CaseOutcome and Profile carry only fixed
    // strings, numbers, and ids (contracts/results-format.md).
    const forbiddenDevUrl = "https://vm-104.tailb3c1b6.ts.net:8443";
    const forbiddenUsername = "operator-dev-account";
    const forbiddenPassword = "s3cret-dev-password";
    const forbiddenSessionCookie = "session=abc123";

    const profile = ProfileSchema.parse({
      tier: "dev",
      concurrency: {
        users: [1, 5],
        durationMs: 1000,
        thinkMs: 250,
        wsSend: false,
        thresholds: { latencyMultiple: 3.0, errorRate: 0.01 },
      },
    });

    const outcomes: CaseOutcome[] = [
      {
        id: "concurrency-dev",
        tier: "dev",
        target: "dev",
        status: "pass",
        durationMs: 12_345,
        steps: [concurrencyStep({ users: 1 }), concurrencyStep({ users: 5 })],
        verdicts: [{ degraded: false, through: 5 }],
        observed: { sessionEnded: 1 },
      },
    ];

    const dir = mkdtempSync(path.join(os.tmpdir(), "load-bench-results-test-"));
    try {
      const { path: filePath } = writeResults({
        runId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        startedAt: "2026-09-29T00:00:00.000Z",
        finishedAt: "2026-09-29T00:01:00.000Z",
        tier: "dev",
        target: {
          kind: "dev",
          postgres: null,
          maxConnections: null,
          appCommit: "abc1234",
        },
        profileHash: "deadbeef",
        profile,
        cases: outcomes,
        dir,
      });
      const contents = readFileSync(filePath, "utf8");
      expect(contents).not.toContain(forbiddenDevUrl);
      expect(contents).not.toContain(forbiddenUsername);
      expect(contents).not.toContain(forbiddenPassword);
      expect(contents).not.toContain(forbiddenSessionCookie);
      expect(contents).not.toContain("session=");
      expect(contents.endsWith("\n")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
