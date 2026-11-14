import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadDmScript } from "../../src/dm/script/load.js";
import {
  loadAuditScript,
  loadScenario,
  ScenarioError,
} from "../../src/playtest/scenario.js";

const SHIPPED = new URL(
  "../../playtests/scenarios/greyhollow-ford.json",
  import.meta.url,
).pathname;

function variant(patch: (s: Record<string, unknown>) => void): string {
  const raw = JSON.parse(readFileSync(SHIPPED, "utf8")) as Record<
    string,
    unknown
  >;
  patch(raw);
  const dir = mkdtempSync(join(tmpdir(), "scenario-"));
  const file = join(dir, "scenario.json");
  writeFileSync(file, JSON.stringify(raw));
  return file;
}

function issuesOf(path: string): string[] {
  try {
    loadScenario(path);
  } catch (error) {
    expect(error).toBeInstanceOf(ScenarioError);
    return (error as ScenarioError).issues;
  }
  throw new Error("expected loadScenario to throw");
}

describe("the shipped scenario", () => {
  it("loads and resolves its ci paths", () => {
    const s = loadScenario(SHIPPED);
    expect(s.name).toBe("greyhollow-ford");
    expect(s.ci).not.toBeNull();
    for (const p of Object.values(s.ci ?? {})) {
      expect(p.startsWith("/")).toBe(true);
      expect(existsSync(p), p).toBe(true);
    }
  });

  it("names a DM script that loads unchanged, and an auditor script", () => {
    const ci = loadScenario(SHIPPED).ci;
    if (!ci) throw new Error("no ci");
    const dm = loadDmScript(JSON.parse(readFileSync(ci.dmScript, "utf8")));
    const narrations = dm.calls.filter(
      (c) => c.purpose === "dm.narrate" && c.respond.type === "text",
    );
    const audit = loadAuditScript(ci.auditScript);
    expect(audit.responses).toHaveLength(narrations.length);
    expect(audit.responses).toHaveLength(11);
  });
});

describe("scenario validation", () => {
  it("rejects a seat that is not the human character", () => {
    const issues = issuesOf(
      variant((s) => {
        (s.seat as { characterId: string }).characterId = "odo";
      }),
    );
    expect(issues.join(" ")).toContain("seat.characterId");
  });

  it("rejects an unknown seed", () => {
    const issues = issuesOf(
      variant((s) => {
        s.seedId = "no-such-seed";
      }),
    );
    expect(issues.join(" ")).toContain("no-such-seed");
  });

  it("rejects a bad move id", () => {
    const issues = issuesOf(
      variant((s) => {
        const moves = s.moves as { free: { actionId: string }[] };
        const first = moves.free[0];
        if (first) first.actionId = "Bad Id!";
      }),
    );
    expect(issues.join(" ")).toContain("moves.free.0.actionId");
  });

  it("rejects a move that sets both intent and confirm", () => {
    const issues = issuesOf(
      variant((s) => {
        const moves = s.moves as { free: Record<string, unknown>[] };
        moves.free.push({ text: "/search #x", intent: true, confirm: true });
      }),
    );
    expect(issues.join(" ")).toContain("both `intent` and `confirm`");
  });

  it("rejects an unreadable auditor script", () => {
    expect(() => loadAuditScript("/no/such/file.json")).toThrow(ScenarioError);
  });
});

describe("moves.fallback", () => {
  it("accepts the list form", () => {
    const file = variant((s) => {
      (s.moves as { fallback: unknown }).fallback = [
        { text: "a" },
        { text: "b" },
      ];
    });
    expect(loadScenario(file).moves.fallback).toEqual([
      { text: "a" },
      { text: "b" },
    ]);
  });

  it("reads the legacy single object as a one-element list", () => {
    const file = variant((s) => {
      (s.moves as { fallback: unknown }).fallback = { text: "only" };
    });
    expect(loadScenario(file).moves.fallback).toEqual([{ text: "only" }]);
  });

  it("rejects an empty list", () => {
    const file = variant((s) => {
      (s.moves as { fallback: unknown }).fallback = [];
    });
    expect(issuesOf(file).join(" ")).toContain("moves.fallback");
  });
});
