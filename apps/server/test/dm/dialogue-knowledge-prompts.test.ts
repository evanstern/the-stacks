import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoredEvent } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { buildCompanionPrompt } from "../../src/dm/prompts/companion.js";
import { buildReactPrompt } from "../../src/dm/prompts/react.js";
import { playerFacingSeed } from "../../src/dm/seed/views.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { projectDm, testSeed } from "./helpers.js";

/** Spec 112 Phase 2 (US3): prompts carry only met names, replayed from the R1 spine fixture. */

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(
  readFileSync(join(here, "fixtures/r1-spine-0106e608.json"), "utf8"),
) as { correctedSeq21: string; rows: StoredEvent[] };
const seed = testSeed();

function at(seq: number, override?: string) {
  const rows = fx.rows
    .filter((r) => r.seq <= seq)
    .map((r) =>
      override && r.seq === 21
        ? ({
            ...r,
            payload: { ...(r.payload as object), text: override },
          } as StoredEvent)
        : r,
    );
  const projections = projectDm(rows);
  return { projections, snapshot: buildSnapshot(projections, seed) };
}

function prompts(seq: number, override?: string) {
  const { projections, snapshot } = at(seq, override);
  const companion = buildCompanionPrompt({
    seed: playerFacingSeed(seed),
    projections,
    snapshot,
    characterId: "odo",
    active: false,
  });
  const react = buildReactPrompt({
    seed: playerFacingSeed(seed),
    roster: [],
    snapshot,
    posts: [],
    humans: [],
    triggers: [],
    transcriptTail: [],
    presentNpcIds: ["wenna"],
    encounterIds: [],
    reachesCap: false,
  });
  return { companion, react };
}

/** Everything except the react roster block, which quotes Wenna's seed portrayal ("grandson Pell"). */
const all = (p: ReturnType<typeof prompts>, skipPresent = false) => {
  const react = skipPresent
    ? p.react.user.replace(/## Present characters[\s\S]*?(\n\n|$)/, "")
    : p.react.user;
  return `${p.companion.system}\n${p.companion.user}\n${p.react.system}\n${react}`;
};

describe("prompts see only met names (spec 112 US3)", () => {
  it("names no Snag at seq 20, and no Pell outside Wenna's own portrayal", () => {
    const p = prompts(20);
    expect(all(p)).not.toMatch(/\bSnag\b/i);
    expect(all(p, true)).not.toMatch(/\bPell\b/i);
  });

  it("names Pell, not Snag, after corrected seq 21", () => {
    const p = prompts(21, fx.correctedSeq21);
    expect(all(p, true)).toMatch(/\bPell\b/);
    expect(all(p)).not.toMatch(/\bSnag\b/i);
  });
});
