import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ChronicleOutput } from "../../src/dm/chronicle.js";
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

  it("greyhollow-live is scene-start, exploration-check and their two chronicle calls, with dice [14]", () => {
    const live = loadDmScript(read(LIVE_DIR, "greyhollow-live.json"));
    const start = loadDmScript(read(TEST_SCRIPTS, "scene-start.json"));
    const explore = loadDmScript(read(TEST_SCRIPTS, "exploration-check.json"));
    const base = [...start.calls, ...explore.calls];
    // Each narrated turn queues one chronicle job (TASK-0158 Phase 3).
    expect(live.calls.slice(0, base.length)).toEqual(base);
    const extra = live.calls.slice(base.length);
    expect(extra.map((c) => c.purpose)).toEqual([
      "dm.chronicle",
      "dm.chronicle",
    ]);
    for (const c of extra) {
      expect(
        ChronicleOutput.safeParse((c.respond as { value: unknown }).value),
      ).toMatchObject({ success: true });
    }
    expect(live.dice).toEqual([14]);
  });
  it("greyhollow-human-dm is scene-start plus human-dm-approval, then only chronicle calls", () => {
    const human = loadDmScript(read(LIVE_DIR, "greyhollow-human-dm.json"));
    const start = loadDmScript(read(TEST_SCRIPTS, "scene-start.json"));
    const approval = loadDmScript(read(TEST_SCRIPTS, "human-dm-approval.json"));
    const base = [...start.calls, ...approval.calls];
    expect(human.calls.slice(0, base.length)).toEqual(base);
    const extra = human.calls.slice(base.length);
    expect(extra.length).toBeGreaterThan(0);
    for (const c of extra) {
      expect(c.purpose).toBe("dm.chronicle");
      expect(
        ChronicleOutput.safeParse((c.respond as { value: unknown }).value),
      ).toMatchObject({ success: true });
    }
    expect(human.dice).toEqual(approval.dice);
  });
  it("greyhollow-plan-approach is scene-start plus plan-approach, then only chronicle calls", () => {
    const live = loadDmScript(read(LIVE_DIR, "greyhollow-plan-approach.json"));
    const start = loadDmScript(read(TEST_SCRIPTS, "scene-start.json"));
    const plan = loadDmScript(read(TEST_SCRIPTS, "plan-approach.json"));
    const base = [...start.calls, ...plan.calls];
    expect(live.calls.slice(0, base.length)).toEqual(base);
    const extra = live.calls.slice(base.length);
    expect(extra.map((c) => c.purpose)).toEqual([
      "dm.chronicle",
      "dm.chronicle",
    ]);
    for (const c of extra) {
      expect(
        ChronicleOutput.safeParse((c.respond as { value: unknown }).value),
      ).toMatchObject({ success: true });
    }
    expect(live.dice).toEqual(plan.dice);
  });
});
