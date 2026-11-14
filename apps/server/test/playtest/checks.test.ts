import { describe, expect, it } from "vitest";
import {
  collectFacts,
  type NarrationFacts,
  renderDiceLines,
} from "../../src/dm/facts.js";
import {
  type CheckId,
  runChecks,
  splitNarration,
} from "../../src/playtest/auditor/checks.js";
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

  describe("hidden-info and secret trackers", () => {
    function hiddenFindings(extra: string) {
      const d = loadClean();
      const row = d.transcript.find((r) => r.seq === 72);
      if (!row) throw new Error("seq 72 missing");
      (row.payload as { text: string }).text += ` ${extra}`;
      return run(d)
        .flat()
        .filter((r) => r.id === "hidden-info")
        .flatMap((r) => r.findings);
    }

    it("passes a sentence that tells a tracker's outcome without its state", () => {
      expect(
        hiddenFindings(
          "Full dark falls on the ford, and the reed-camp is alerted.",
        ),
      ).toEqual([]);
    });

    it.each([
      "Full dark falls on the ford: 3 of 4 segments filled.",
      "The reed-camp is alerted, two of three.",
      "The dusk clock is nearly full.",
      "The tracker for full dark falls on the ford is at 2/4.",
    ])("flags tracker state: %s", (sentence) => {
      const found = hiddenFindings(sentence);
      expect(found).toHaveLength(1);
      expect(found[0]?.kind).toBe("hidden-info-leak");
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
      party: [
        { characterId: "tamsin", name: "Tamsin Vale", controller: "human" },
      ],
      events: [],
      setting: { locationName: "Greyhollow Ford", openingFraming: "" },
    } as unknown as NarrationFacts;
    const prose = "Goblin with a pot-helm falls to the stroke.";
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

const REAL_10 = {
  "provider-playtest":
    "The amber light finds Greyhollow Ford gone quiet in the wrong way \u2014 no bell, no ferry-keeper's call across the water, only the river shouldering past its banks and not one bird in the reeds. The ferry sits chained at its post. The ferry-house door stands open on nothing.\n\nInside, a rope hangs cut a yard off the floor, and the strongbox lies pried and empty on its side. Small clawed tracks cross the dust \u2014 not toward the water, but downriver, along the causeway, away from the crossing you meant to take.\n\nAbove, the loft boards creak once, then hold still, as if something up there is holding its breath to match yours.",
  "provider-playtest-failed-2":
    "The ford announces itself before you see it \u2014 water shouldering over stone, loud enough to swallow footsteps. The ferry sits chained to its post, patient and useless. The ferry-house door hangs open on one hinge, and inside, the bell-rope lies cut on the floorboards, the strongbox pried and empty beside it. No birds. No bell. Amber light slants through the gaps in the wall, catching small clawed tracks pressed into the dust \u2014 not toward the far bank, but south, along the causoway, downriver.\n\nOverhead, something shifts. A single creak, deliberate, like weight settled and then stilled, waiting to see if you noticed.",
};

describe("dice-lines false positive (multi-paragraph prose)", () => {
  it.each(Object.entries(REAL_10))(
    "counts no dice lines in real scene-start narration (%s)",
    (_run, text) => {
      const { prose, diceLines } = splitNarration(text);
      expect(diceLines).toEqual([]);
      expect(prose).toBe(text);
      const d = loadClean();
      const row = d.transcript.find((r) => r.seq === 10);
      if (!row) throw new Error("seq 10 missing");
      (row.payload as { text: string }).text = text;
      const results = run(d).flat();
      expect(
        results.filter((r) => r.id === "dice-lines").flatMap((r) => r.findings),
      ).toEqual([]);
    },
  );

  it("still counts a trailing block of rendered dice lines", () => {
    const text =
      "One.\n\nTwo.\n\nTamsin Vale \u2014 Strike: 1d20+5 \u2192 12+5 = 17 vs AC 13: Hit\nGoblin takes 6 slashing (7\u21921 HP)";
    const { prose, diceLines } = splitNarration(text);
    expect(prose).toBe("One.\n\nTwo.");
    expect(diceLines).toHaveLength(2);
  });

  it("treats a trailing prose block without arrows as prose", () => {
    const { diceLines } = splitNarration("One.\n\nTwo \u2014 a yard off.");
    expect(diceLines).toEqual([]);
  });
});

describe("splitNarration: row forms and the State line (spec 098 D8)", () => {
  const rows: [string, string][] = [
    ["life-state", "Snag: conscious → dead"],
    ["condition applied", "Snag: prone applied"],
    ["condition removed", "Snag: prone removed"],
    ["death saves", "Ana death saves: 1 success, 2 failures"],
    ["spell slot", "Ana spends a level 2 spell slot"],
    ["assist", "Odo helps Ana (ability check)"],
    ["hp", "Snag takes 3 fire (9→6 HP)"],
  ];
  for (const [name, line] of rows) {
    it(`accepts a ${name} row before a State line`, () => {
      const { prose, diceLines } = splitNarration(
        `Prose.\n\n${line}\nState: Anyone may act.`,
      );
      expect(prose).toBe("Prose.");
      expect(diceLines).toEqual([line]);
    });
  }
  it("accepts a refusal row and drops it from the compared lines", () => {
    const { diceLines } = splitNarration(
      "Prose.\n\nAna: refused, it is not that character's turn (NOT_YOUR_TURN)\nState: Ana's action did not happen. It is Odo's turn.",
    );
    expect(diceLines).toEqual([]);
  });
  it("accepts a State line alone as the code block", () => {
    const { prose, diceLines } = splitNarration(
      "Prose.\n\nState: Anyone may act.",
    );
    expect(prose).toBe("Prose.");
    expect(diceLines).toEqual([]);
  });
  it("leaves a prose paragraph that merely mentions state as prose", () => {
    const t = "One.\n\nThe state of the ford is poor.";
    expect(splitNarration(t).prose).toBe(t);
  });
});

describe("splitNarration: Deed rows (spec 111)", () => {
  it("accepts a Deed row and drops it from the compared lines", () => {
    const { prose, diceLines } = splitNarration(
      "Prose.\n\nDeed: Ana: /search #ferry-house\nAna: 1d20 → 14 = 14\nState: Anyone may act.",
    );
    expect(prose).toBe("Prose.");
    expect(diceLines).toEqual(["Ana: 1d20 → 14 = 14"]);
  });
});
