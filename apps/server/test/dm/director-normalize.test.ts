import { describe, expect, it } from "vitest";
import { normalizeDirector } from "../../src/dm/nodes/director.js";
import { DirectorOutput } from "../../src/dm/nodes/schemas.js";

const CAP = 300;
const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
const long = words(100); // 499 chars

function base(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    beat: { decision: "resolve" },
    tableMode: { to: "stay" },
    trackers: [],
    scene: { status: "continue" },
    pacing: { tension: "rising", spotlight: null, beatId: null },
    goalNote: "keep it moving",
    companionPrompts: [],
    ...over,
  };
}
interface Out {
  goalNote: string;
  beat: { decision: string; reason: string };
  tableMode: { to: string; reason: string };
  scene: { status: string; reason: string };
  trackers: { trackerId: string; advance: number; reason: string }[];
  pacing: unknown;
  companionPrompts: unknown;
}
const asRecord = (v: unknown) => v as Out;

describe("normalizeDirector (C4)", () => {
  it("cuts an over-cap goalNote at the last space before the cap", () => {
    const out = asRecord(normalizeDirector(base({ goalNote: long })));
    expect(out.goalNote.length).toBeLessThanOrEqual(CAP);
    expect(out.goalNote.endsWith("word")).toBe(true);
    expect(long.startsWith(out.goalNote)).toBe(true);
    expect(DirectorOutput.safeParse(out).success).toBe(true);
  });

  it("cuts an over-cap reason in each reason-bearing field", () => {
    const out = asRecord(
      normalizeDirector(
        base({
          beat: { decision: "hold", companions: ["bram"], reason: long },
          tableMode: { to: "turn", encounterId: "e1", reason: long },
          scene: { status: "end", outcome: "failed", reason: long },
          trackers: [{ trackerId: "dusk", advance: 1, reason: long }],
        }),
      ),
    );
    for (const r of [
      out.beat.reason,
      out.tableMode.reason,
      out.scene.reason,
      out.trackers[0].reason,
    ]) {
      expect(r.length).toBeLessThanOrEqual(CAP);
      expect(long.startsWith(r)).toBe(true);
    }
    expect(DirectorOutput.safeParse(out).success).toBe(true);
  });

  it("cuts a string with no space hard at the cap", () => {
    const out = asRecord(
      normalizeDirector(base({ goalNote: "x".repeat(450) })),
    );
    expect(out.goalNote).toBe("x".repeat(CAP));
  });

  it("trims after the cut", () => {
    const note = `${"a".repeat(CAP - 1)} ${"b".repeat(50)}`;
    const out = asRecord(normalizeDirector(base({ goalNote: note })));
    expect(out.goalNote).toBe("a".repeat(CAP - 1));
  });

  it("leaves under-cap strings unchanged", () => {
    const input = base({
      goalNote: "x".repeat(CAP),
      scene: { status: "end", outcome: "retreat", reason: "short" },
    });
    expect(normalizeDirector(input)).toEqual(input);
  });

  it.each([null, undefined, 7, "text", ["a"]])(
    "returns non-object input %j unchanged",
    (input) => {
      expect(normalizeDirector(input)).toBe(input);
    },
  );

  it("adds no default for a missing field", () => {
    const { goalNote: _g, ...rest } = base();
    expect(normalizeDirector(rest)).toEqual(rest);
  });
});

describe("normalizeDirector leaves numbers, ids and discriminants alone", () => {
  const rules: [string, Record<string, unknown>][] = [
    ["goalNote cut", { goalNote: long }],
    [
      "reason cut",
      {
        beat: { decision: "hold", companions: ["bram"], reason: long },
        tableMode: { to: "turn", encounterId: "e1", reason: long },
        scene: { status: "end", outcome: "failed", reason: long },
      },
    ],
    ["no-space cut", { goalNote: "x".repeat(450) }],
    ["under-cap", { goalNote: "ok" }],
  ];

  it.each(rules)("%s", (_name, over) => {
    const input = base({
      ...over,
      trackers: [
        { trackerId: "dusk", advance: 99, reason: long },
        { trackerId: "tide", advance: -42, reason: "fine" },
        { trackerId: "ash", advance: 0, reason: "fine" },
      ],
      pacing: {
        tension: "extreme",
        spotlight: "kestrel",
        beatId: "b".repeat(90),
      },
      companionPrompts: ["a", "b", "c", "d", "e", "f"],
    });
    const out = asRecord(normalizeDirector(input));
    expect(out.trackers.map((t) => t.advance)).toEqual([99, -42, 0]);
    expect(out.trackers.map((t) => t.trackerId)).toEqual([
      "dusk",
      "tide",
      "ash",
    ]);
    expect(out.pacing).toEqual(asRecord(input).pacing);
    expect(out.companionPrompts).toEqual(asRecord(input).companionPrompts);
    expect(out.beat.decision).toBe((input.beat as Out["beat"]).decision);
    expect(out.tableMode.to).toBe((input.tableMode as Out["tableMode"]).to);
    expect(out.scene.status).toBe((input.scene as Out["scene"]).status);
    // the strict schema still rejects the out-of-range numbers
    expect(DirectorOutput.safeParse(out).success).toBe(false);
  });
});
