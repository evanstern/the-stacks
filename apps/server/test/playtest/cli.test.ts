import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DM_PURPOSES } from "../../src/dm/purposes.js";
import { main } from "../../src/playtest/cli.js";
import { DOCTORED } from "./helpers.js";

function harness() {
  const out: string[] = [];
  const err: string[] = [];
  const calls: unknown[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    deps: {
      runPlaytest: async (o: unknown) => {
        calls.push(o);
        throw new Error("the gateway must not be reached");
      },
    },
    out,
    err,
    calls,
    text: () => [...out, ...err].join("\n"),
  };
}

/** A complete priced config on the strict fake adapter: the stand-in "provider". */
function pricedEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const purposes = Object.fromEntries(
    [...DM_PURPOSES, "playtest.audit"].map((p) => [
      p,
      { provider: "fake", model: "m" },
    ]),
  );
  return {
    AI_PROVIDERS: JSON.stringify({
      fake: { kind: "fake", baseUrl: "http://fake/x" },
    }),
    AI_PURPOSES: JSON.stringify(purposes),
    AI_PRICES: JSON.stringify({
      "fake/m": { inputPerMTok: 1, outputPerMTok: 1 },
    }),
    ...extra,
  };
}

describe("playtest CLI guards", () => {
  it("refuses provider mode under CI with exit 4", async () => {
    const h = harness();
    const code = await main(
      ["run", "--mode", "provider"],
      pricedEnv({ CI: "1" }),
      h.io,
      h.deps,
    );
    expect(code).toBe(4);
    expect(h.text()).toContain("refused under CI");
    expect(h.calls).toHaveLength(0);
  });

  it("refuses with no AI config, naming the purposes, exit 4", async () => {
    const h = harness();
    const code = await main(["run", "--mode", "provider"], {}, h.io, h.deps);
    expect(code).toBe(4);
    for (const p of [...DM_PURPOSES, "playtest.audit"]) {
      expect(h.text()).toContain(p);
    }
    expect(h.calls).toHaveLength(0);
  });

  it("refuses an unpriced model, exit 4", async () => {
    const h = harness();
    const env = pricedEnv({ AI_PRICES: "{}" });
    const code = await main(["run", "--mode", "provider"], env, h.io, h.deps);
    expect(code).toBe(4);
    expect(h.text()).toContain("fake/m");
  });

  it("prints the estimate and exits 3 with no ceiling, no run and no directory", async () => {
    const h = harness();
    const dir = join(mkdtempSync(join(tmpdir(), "pt-cli-")), "run");
    const code = await main(
      ["run", "--mode", "provider", "--out", dir],
      pricedEnv(),
      h.io,
      h.deps,
    );
    expect(code).toBe(3);
    expect(h.out.join("\n")).toContain("Estimate");
    expect(h.text()).toContain("spend not confirmed");
    expect(h.calls).toHaveLength(0);
    expect(existsSync(dir)).toBe(false);
  });

  it("exits 3 when the ceiling is below the upper-bound estimate", async () => {
    const h = harness();
    const dir = join(mkdtempSync(join(tmpdir(), "pt-cli-")), "run");
    const code = await main(
      [
        "run",
        "--mode",
        "provider",
        "--out",
        dir,
        "--spend-ceiling-usd",
        "0.0001",
      ],
      pricedEnv(),
      h.io,
      h.deps,
    );
    expect(code).toBe(3);
    expect(h.text()).toContain("ceiling below upper-bound estimate");
    expect(h.calls).toHaveLength(0);
    expect(existsSync(dir)).toBe(false);
  });

  it("estimate exits 0 for a complete config and makes no run", async () => {
    const h = harness();
    const code = await main(["estimate"], pricedEnv(), h.io, h.deps);
    expect(code).toBe(0);
    expect(h.out.join("\n")).toContain("playtest.audit");
    expect(h.calls).toHaveLength(0);
  });

  it("estimate exits 4 naming the missing purposes with no config", async () => {
    const h = harness();
    const code = await main(["estimate"], {}, h.io, h.deps);
    expect(code).toBe(4);
    expect(h.text()).toContain("dm.director");
  });

  it("exits 64 on a bad flag, a bad mode and a missing scenario", async () => {
    for (const argv of [
      ["run", "--nope"],
      ["run", "--mode", "turbo"],
      ["run", "--scenario", "/nonexistent/scenario.json"],
      ["frobnicate"],
      ["run", "--mode", "provider", "--spend-ceiling-usd", "-3"],
    ]) {
      const h = harness();
      expect(await main(argv, pricedEnv(), h.io, h.deps), argv.join(" ")).toBe(
        64,
      );
    }
  });

  it("audits a doctored run directory without a model and exits 1", async () => {
    const h = harness();
    const out = mkdtempSync(join(tmpdir(), "pt-audit-"));
    const code = await main(
      ["audit", "--dir", DOCTORED, "--auditor", "none", "--out", out],
      {},
      h.io,
      h.deps,
    );
    expect(code).toBe(1);
    expect(h.out.join("\n")).toContain("verdict: fail");
    expect(existsSync(join(out, "report.json"))).toBe(true);
    expect(existsSync(join(out, "report.md"))).toBe(true);
  });
});
