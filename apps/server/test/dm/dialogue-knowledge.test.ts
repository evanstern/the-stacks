import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoredEvent } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import {
  checkNarration,
  dropPlan,
  dropSentences,
  speechLeaks,
} from "../../src/dm/narration-check.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { projectDm, testSeed } from "./helpers.js";
import { PLAYER_USER } from "./snapshot-fixtures.js";

/**
 * Spec 112 Phase 1: the knowledge model (met, knows) and the speech rule, replayed against the
 * R1 spine test-drive (session 0106e608, findings 4 and 7).
 */

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(
  readFileSync(join(here, "fixtures/r1-spine-0106e608.json"), "utf8"),
) as {
  react: Record<"seq21" | "seq30", { speaker: string; text: string }>;
  correctedSeq21: string;
  rows: StoredEvent[];
};
const seed = testSeed();

/** The snapshot after the fixture rows up to `seq`; `override` swaps the seq 21 narration text. */
function snapshotAt(seq: number, override?: string) {
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
  return buildSnapshot(projectDm(rows), seed);
}

function check(
  snapshot: ReturnType<typeof snapshotAt>,
  text: string,
  speakerId: string | null,
) {
  const issues = checkNarration({
    slots: { restate: "", describe: text, ask: "" },
    rows: [],
    hasRoll: false,
    snapshot,
    dmOnlyText: [],
    unmetSuccess: [],
    departedIds: [],
    speakerId,
  });
  const drop = dropPlan(
    issues.filter((i) => i.check === "leak" || i.kind === "digit"),
  );
  return { issues, shipped: dropSentences(text, drop.sentences, drop.inners) };
}

const actor = (s: ReturnType<typeof snapshotAt>, id: string) => {
  const a = s.actors.find((x) => x.id === id);
  if (!a) throw new Error(`no actor ${id}`);
  return a;
};

describe("fixture", () => {
  it("holds no human user id", () => {
    expect(JSON.stringify(fx)).not.toContain("6ff0a0f1");
    expect(JSON.stringify(fx)).toContain("PLAYER_USER");
    expect(PLAYER_USER).toMatch(/^0+-/);
  });
});

describe("snapshot met and knows at seq 20", () => {
  const s = snapshotAt(20);
  it("marks Wenna and the party met; Pell and Snag unmet", () => {
    expect(actor(s, "wenna").met).toBe(true);
    expect(actor(s, "tamsin").met).toBe(true);
    expect(actor(s, "pell").met).toBe(false);
    expect(actor(s, "snag").met).toBe(false);
  });
  it("derives knows from seed relationships", () => {
    expect(actor(s, "wenna").knows).toEqual(["wenna", "pell"]);
    expect(actor(s, "snag").knows).toEqual(["snag"]);
  });
  it("marks an actor met once a public DM row names them", () => {
    const after = snapshotAt(21);
    expect(actor(after, "pell").met).toBe(true);
    expect(actor(after, "snag").met).toBe(true);
    const corrected = snapshotAt(21, fx.correctedSeq21);
    expect(actor(corrected, "pell").met).toBe(true);
    expect(actor(corrected, "snag").met).toBe(false);
  });
});

describe("seq 21 replay (US1)", () => {
  const { issues, shipped } = check(
    snapshotAt(20),
    fx.react.seq21.text,
    fx.react.seq21.speaker,
  );
  it("raises one unmet-actor issue naming Snag and none naming Pell", () => {
    const hits = issues.filter((i) => i.kind === "unmet-actor");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.actorIds).toEqual(["snag"]);
    expect(issues.some((i) => i.actorIds.includes("pell"))).toBe(false);
  });
  it("ships Pell's line and drops the Snag sentence", () => {
    expect(shipped).toBe(fx.correctedSeq21);
    expect(shipped).toContain("Pell's not back.");
    expect(shipped).not.toContain("Snag");
  });
  it("is the same without a speaker: Wenna is the attributed speaker", () => {
    expect(check(snapshotAt(20), fx.react.seq21.text, null).shipped).toBe(
      fx.correctedSeq21,
    );
  });
});

describe("seq 30 replay (US2)", () => {
  const corrected = snapshotAt(21, fx.correctedSeq21);
  const { issues, shipped } = check(
    corrected,
    fx.react.seq30.text,
    fx.react.seq30.speaker,
  );
  it("raises no issue naming Pell and drops the sentence naming Snag", () => {
    expect(issues.some((i) => i.actorIds.includes("pell"))).toBe(false);
    expect(
      issues.filter((i) => i.kind === "unmet-actor").map((i) => i.actorIds),
    ).toEqual([["snag"]]);
    expect(shipped).not.toContain("Snag");
    expect(shipped).toContain("Neither come back for supper");
  });
  it("lets a reply name only Pell", () => {
    const r = check(
      corrected,
      "Pell went for eel-traps, three days gone.",
      "wenna",
    );
    expect(r.issues).toEqual([]);
  });
  it("keeps the absent-actor rule for unquoted narrator prose", () => {
    const r = check(corrected, "Pell steps out of the reeds.", null);
    expect(r.issues.map((i) => i.kind)).toEqual(["absent-actor"]);
  });
});

describe("speechLeaks", () => {
  it("flags a fogged zone in a quote", () => {
    const s = snapshotAt(20);
    const hits = speechLeaks(
      s,
      'Wenna says, "Nobody goes up to the Loft."',
      null,
    );
    expect(hits.map((h) => h.kind)).toEqual(["fogged-zone"]);
  });
});
