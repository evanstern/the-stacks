import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadDmScript } from "../../src/dm/script/load.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const LIVE_DIR = join(HERE, "..", "..", "dm-scripts");
const TEST_SCRIPTS = join(HERE, "scripts");

const read = (dir: string, file: string) =>
  JSON.parse(readFileSync(join(dir, file), "utf8"));

describe("shipped DM scripts (apps/server/dm-scripts)", () => {
  const files = readdirSync(LIVE_DIR).filter((f) => f.endsWith(".json"));

  it("ships at least one script", () => {
    expect(files).toContain("greyhollow-live.json");
  });

  it.each(files)("%s loads with loadDmScript", (file) => {
    const script = loadDmScript(read(LIVE_DIR, file));
    expect(script.name).toBe(file.slice(0, -".json".length));
  });

  it("greyhollow-live is scene-start then exploration-check, with dice [14]", () => {
    const live = loadDmScript(read(LIVE_DIR, "greyhollow-live.json"));
    const start = loadDmScript(read(TEST_SCRIPTS, "scene-start.json"));
    const explore = loadDmScript(read(TEST_SCRIPTS, "exploration-check.json"));
    expect(live.calls).toEqual([...start.calls, ...explore.calls]);
    expect(live.dice).toEqual([14]);
  });
});
