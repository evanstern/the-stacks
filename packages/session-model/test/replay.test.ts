import { describe, expect, it } from "vitest";
import { fixtures } from "../src/fixtures/index.js";
import {
  applyEvent,
  emptyProjections,
  project,
  type Viewer,
} from "../src/index.js";
import { deepFreeze, PLAYER_A, richRows, row } from "./helpers.js";

const viewers: Viewer[] = [
  { role: "dm" },
  { role: "player", userId: PLAYER_A },
];

describe("replay (AC #7, in memory)", () => {
  for (const viewer of viewers) {
    it(`project is repeatable and equals the incremental fold (${viewer.role})`, () => {
      const rows = richRows();
      const a = project(rows, viewer);
      const b = project(rows, viewer);
      expect(a).toEqual(b);
      const c = rows.reduce(applyEvent, emptyProjections(viewer));
      expect(c).toEqual(a);
      expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    });
  }

  it("applyEvent does not mutate a deep-frozen input", () => {
    const rows = richRows();
    let p = deepFreeze(emptyProjections({ role: "dm" }));
    for (const r of rows) {
      p = deepFreeze(applyEvent(p, deepFreeze(structuredClone(r))));
    }
    expect(p.throughSeq).toBe(rows.length);
  });

  it("a duplicated seq counts outOfOrder and changes nothing else", () => {
    const rows = richRows();
    const base = project(rows, { role: "dm" });
    const dup = project([...rows, rows[3] as (typeof rows)[number]], {
      role: "dm",
    });
    expect(dup.diagnostics.outOfOrder).toBe(1);
    expect({ ...dup, diagnostics: base.diagnostics }).toEqual(base);
    const { outOfOrder: _a, ...restDup } = dup.diagnostics;
    const { outOfOrder: _b, ...restBase } = base.diagnostics;
    expect(restDup).toEqual(restBase);
  });

  it("an empty log projects to the empty state", () => {
    expect(project([], { role: "dm" })).toEqual(
      emptyProjections({ role: "dm" }),
    );
    expect(
      row("talk", { text: "x", channel: "ic", characterId: null }).seq,
    ).toBe(1);
  });
});

describe("replay over every fixture (AC #7, in memory)", () => {
  for (const f of fixtures) {
    for (const viewer of [f.viewers.dm, ...f.viewers.players]) {
      const who =
        viewer.role === "dm" ? "dm" : `player ${viewer.userId.slice(-1)}`;
      it(`${f.name} (${who}): repeatable, incremental and JSON-stable`, () => {
        const a = project(f.events, viewer);
        expect(project(f.events, viewer)).toEqual(a);
        expect(f.events.reduce(applyEvent, emptyProjections(viewer))).toEqual(
          a,
        );
        expect(JSON.parse(JSON.stringify(a))).toEqual(a);
      });

      it(`${f.name} (${who}): applyEvent does not mutate deep-frozen input`, () => {
        let p = deepFreeze(emptyProjections(viewer));
        for (const e of f.events) {
          p = deepFreeze(applyEvent(p, deepFreeze(structuredClone(e))));
        }
        expect(p).toEqual(project(f.events, viewer));
      });
    }
  }
});
