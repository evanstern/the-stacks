import { describe, expect, it } from "vitest";
import { fixtures } from "../src/fixtures/index.js";
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

describe("talk isolation over every fixture (AC #2)", () => {
  for (const f of fixtures) {
    for (const viewer of [f.viewers.dm, ...f.viewers.players]) {
      const who =
        viewer.role === "dm" ? "dm" : `player ${viewer.userId.slice(-1)}`;
      it(`${f.name} (${who}): talk after every prefix changes only transcript, throughSeq and diagnostics`, () => {
        const clean = f.events.filter((e) => e.seq > 0);
        const top = Math.max(...clean.map((e) => e.seq));
        for (let n = 1; n <= clean.length; n++) {
          const before = project(clean.slice(0, n), viewer);
          const talk = row(
            "talk",
            { text: "Hi", channel: "ic", characterId: "ana" },
            { seq: top + 1 },
          );
          const after = applyEvent(before, talk);
          expect(strip(after)).toEqual(strip(before));
          expect(after.transcript.length).toBe(before.transcript.length + 1);
        }
      });
    }
  }
});
