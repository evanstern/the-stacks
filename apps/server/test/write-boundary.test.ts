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
    expect(builders).toEqual(["dm/nodes/resolve.ts"]);
  });
});
