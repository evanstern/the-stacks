import { describe, expect, it } from "vitest";
import {
  applyEvent,
  emptyProjections,
  project,
  type Viewer,
} from "../src/index.js";
import { PLAYER_A, richRows, row } from "./helpers.js";

const viewers: Viewer[] = [
  { role: "dm" },
  { role: "player", userId: PLAYER_A },
];

function strip<
  T extends { transcript: unknown; throughSeq: number; diagnostics: unknown },
>(p: T) {
  const { transcript: _t, throughSeq: _s, diagnostics: _d, ...rest } = p;
  return rest;
}

describe("talk isolation (AC #2)", () => {
  for (const viewer of viewers) {
    const label = viewer.role === "dm" ? "dm" : "player";
    it(`talk changes only transcript, throughSeq and diagnostics (${label})`, () => {
      const rows = richRows();
      // Several non-trivial states: every prefix after the first few rows.
      for (let n = 1; n <= rows.length; n++) {
        const before = project(rows.slice(0, n), viewer);
        const talk = row(
          "talk",
          { text: "Hi", channel: "ic", characterId: "ana" },
          { seq: n + 1 },
        );
        const after = applyEvent(before, talk);
        expect(strip(after)).toEqual(strip(before));
        expect(after.transcript.length).toBe(before.transcript.length + 1);
        expect(after.throughSeq).toBe(n + 1);
      }
    });
  }

  it("narration also changes only the transcript", () => {
    const before = project(richRows(), { role: "dm" });
    const after = applyEvent(
      before,
      row(
        "narration",
        { text: "Thunder.", actionIds: [] },
        { seq: before.throughSeq + 1 },
      ),
    );
    expect(strip(after)).toEqual(strip(before));
  });

  it("starts from an empty state", () => {
    const p = emptyProjections({ role: "dm" });
    const after = applyEvent(
      p,
      row("talk", { text: "x", channel: "ooc", characterId: null }),
    );
    expect(strip(after)).toEqual(strip(p));
  });
});
