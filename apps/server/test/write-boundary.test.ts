import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkWriteBoundary } from "./helpers/import-graph.js";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

describe("write boundary (AC #1)", () => {
  it("the real server source has no violations", () => {
    expect(checkWriteBoundary(here("../src"))).toEqual([]);
  });

  it("the seeded violation tree trips exactly the three rules", () => {
    const found = checkWriteBoundary(here("./fixtures/write-boundary/src")).map(
      (v) => ({ file: v.file, rule: v.rule }),
    );
    expect(found.sort((a, b) => a.file.localeCompare(b.file))).toEqual([
      { file: "ai/leak.ts", rule: "writer-import" },
      { file: "dm/raw.ts", rule: "writer-import" },
      { file: "gate/model.ts", rule: "model-reach" },
    ]);
  });
});

describe("scene-presence write boundary (spec 048, User Story 5)", () => {
  const listTs = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return listTs(full);
      return name.endsWith(".ts") ? [full] : [];
    });

  it("only dm/nodes/resolve.ts builds a scene-presence proposal", () => {
    const root = here("../src");
    const builders = listTs(root)
      .filter((f) => /kind:\s*"scene-presence"/.test(readFileSync(f, "utf8")))
      .map((f) => relative(root, f).split("\\").join("/"));
    // spec 104: the stage runner builds the band effects' presence proposals
    expect(builders).toEqual(["dm/intent-runner.ts", "dm/nodes/resolve.ts"]);
  });
});

describe("floor write boundary (spec 049, FT-3)", () => {
  const listTs = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return listTs(full);
      return name.endsWith(".ts") ? [full] : [];
    });
  const buildersOf = (pattern: RegExp) => {
    const root = here("../src");
    return listTs(root)
      .filter((f) => pattern.test(readFileSync(f, "utf8")))
      .map((f) => relative(root, f).split("\\").join("/"));
  };

  it("only dm/floor.ts builds a floor proposal", () => {
    expect(buildersOf(/kind:\s*"floor"[^}]*op:/s)).toEqual(["dm/floor.ts"]);
  });

  it("only dm/floor.ts builds a stall override", () => {
    expect(buildersOf(/override:\s*"stall"/)).toEqual(["dm/floor.ts"]);
  });
});

describe("suggestion write boundary (spec 066, plan D2)", () => {
  const listTs = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return listTs(full);
      return name.endsWith(".ts") ? [full] : [];
    });
  const buildersOf = (pattern: RegExp) => {
    const root = here("../src");
    return listTs(root)
      .filter((f) => pattern.test(readFileSync(f, "utf8")))
      .map((f) => relative(root, f).split("\\").join("/"));
  };

  // Phase 3 adds dm/talk-turn.ts, the only builder of an action.suggest proposal.
  it("only dm/talk-turn.ts builds an action.suggest proposal", () => {
    const found = buildersOf(/kind:\s*"action\.suggest"/);
    expect(found.filter((f) => f !== "dm/talk-turn.ts")).toEqual([]);
  });

  it("only playtest/harness.ts (the scripted seat) builds an action.accept proposal", () => {
    // The playtest harness plays the human seat's thumbs-up (spec 114 `confirm` move); the DM never does.
    expect(buildersOf(/kind:\s*"action\.accept"/)).toEqual([
      "playtest/harness.ts",
    ]);
  });
});
