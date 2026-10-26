import { describe, expect, it } from "vitest";
import {
  collectFacts,
  type NarrationFacts,
  renderDiceLines,
} from "../../src/dm/facts.js";
import { factualSummary } from "../../src/dm/fallback.js";
import { type CheckId, runChecks } from "../../src/playtest/auditor/checks.js";
import { segment } from "../../src/playtest/auditor/segments.js";
import { loadClean, loadDoctored } from "./helpers.js";

/** [segment index, check id, row seq] — the doctored fixture README. */
const PLANTED: [number, CheckId, number][] = [
  [0, "dice-language", 10],
  [1, "roll-reasons", 15],
  [1, "prose-digits", 18],
  [2, "dice-lines", 26],
  [4, "life-states", 50],
  [6, "hidden-info", 72],
];

function run(d: ReturnType<typeof loadDoctored>) {
  const segs = segment(d.transcript, d.ledger);
  return segs.map((seg) =>
    runChecks(seg, { transcript: d.transcript, seed: d.seed }),
  );
}

describe("segments", () => {
  it("closes a segment at each DM narration", () => {
    const d = loadClean();
    const segs = segment(d.transcript, d.ledger);
    expect(segs.map((s) => s.narrationSeq)).toEqual([
      10, 18, 26, 45, 50, 61, 72, 83,
    ]);
    expect(segs[0]?.fromSeq).toBe(1);
    expect(segs[1]?.fromSeq).toBe(11);
  });

  it("drops a tail without talk and keeps one with talk", () => {
    const d = loadClean();
    const base = d.transcript.filter((r) => r.seq <= 83);
    const extra = (type: string, seq: number) => ({
      ...(base[0] as (typeof base)[number]),
      seq,
      type,
      actor: "ai:companion:odo",
      payload: { text: "hi", channel: "ic", characterId: "odo" },
    });
    expect(
      segment([...base, extra("journal.entry.added", 84)], d.ledger),
    ).toHaveLength(8);
    const withTalk = segment([...base, extra("talk", 84)], d.ledger);
    expect(withTalk).toHaveLength(9);
    expect(withTalk[8]?.narrationSeq).toBeNull();
  });

  it("yields no segments without a scene.changed row", () => {
    const d = loadClean();
    expect(
      segment(
        d.transcript.filter((r) => r.type !== "scene.changed"),
        d.ledger,
      ),
    ).toEqual([]);
  });
});

describe("code checks", () => {
  it("pass on every segment of the clean run", () => {
    for (const results of run(loadClean())) {
      for (const r of results) expect(r.pass, r.id).toBe(true);
    }
  });

  it("fail each planted problem with the right kind and seqs, and nothing else", () => {
    const results = run(loadDoctored());
    const got: [number, string, number[], string][] = [];
    results.forEach((rs, i) => {
      for (const r of rs) {
        for (const f of r.findings) got.push([i, r.id, f.seqs, f.kind]);
      }
    });
    const byKey = (a: [number, string, number], b: [number, string, number]) =>
      a[0] - b[0] || a[2] - b[2];
    expect(
      got
        .map(([i, id, seqs]): [number, string, number] => [
          i,
          id,
          seqs[0] as number,
        ])
        .sort(byKey),
    ).toEqual([...PLANTED].sort(byKey));
    const kinds = Object.fromEntries(got.map(([, id, , kind]) => [id, kind]));
    expect(kinds).toEqual({
      "dice-language": "invented-mechanics",
      "roll-reasons": "roll-without-reason",
      "prose-digits": "ledger-contradiction",
      "dice-lines": "ledger-contradiction",
      "life-states": "ledger-contradiction",
      "hidden-info": "hidden-info-leak",
    });
  });

  it("passes the DM runtime's factual summary, with a recorded death", () => {
    const d = loadClean();
    const segs = segment(d.transcript, d.ledger);
    const seg = segs[5]; // narration 61: Tamsin's strike
    if (!seg) throw new Error("segment 5 missing");
    // Record a death for the struck goblin in the ledger.
    const death = {
      kind: "change" as const,
      seq: 60,
      actor: "ai:dm",
      visibility: "public",
      reason: "The goblin dies.",
      type: "life-state.changed",
      subject: "goblin-2",
      before: "alive",
      after: "dead",
      batchId: "id-x",
      index: 9,
      actionId: "act-strike",
    };
    seg.ledger = [...seg.ledger, death];
    const nameOf = (id: string | null) =>
      id === "tamsin"
        ? "Tamsin Vale"
        : id === "goblin-2"
          ? "Goblin with a pot-helm"
          : String(id);
    const rows = seg.ledger.filter((l) => l.actionId === "act-strike");
    const facts = {
      trigger: "action",
      actions: [
        {
          actionId: "act-strike",
          characterName: "Tamsin Vale",
          text: "",
          outcome: "applied",
          refusalCode: null,
          ...collectFacts(rows, nameOf, new Map([[57, "slashing"]])),
        },
      ],
      npcTurn: null,
      director: { pacing: {}, goalNote: "", sceneEnded: false },
      modeChange: null,
      presentNpcs: [],
      rulings: [],
      clarify: [],
    } as unknown as NarrationFacts;
    const prose = factualSummary(facts);
    const text = `${prose}\n\n${renderDiceLines(facts).join("\n")}`;
    const narration = seg.rows.find((r) => r.seq === 61);
    if (!narration) throw new Error("narration missing");
    (narration.payload as { text: string }).text = text;
    for (const r of runChecks(seg, {
      transcript: d.transcript,
      seed: d.seed,
    })) {
      expect(r.pass, `${r.id}: ${JSON.stringify(r.findings)}`).toBe(true);
    }
  });
});
