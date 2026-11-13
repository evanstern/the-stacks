import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  defaultRestate,
  type FactSheet,
  type NarrationSlots,
  parseSlots,
} from "../../src/dm/fact-sheet.js";
import { checkNarration, dropSentences } from "../../src/dm/narration-check.js";
import {
  createNarrationStream,
  type StreamPart,
} from "../../src/dm/narration-stream.js";
import { stripThink } from "../../src/dm/pipeline/call.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import type { ScenePresence } from "../../src/dm/snapshot/types.js";
import { greyhollowFight } from "./snapshot-fixtures.js";

/** Spec 108 Phase 1: the stream parser. Leak safety (constitution III) is the core. */

const SECRET = "the ferryman buried the lantern key under the third plank";
const sheet = {
  slots: ["restate", "describe", "ask"],
  restate: [{ subject: "Tamsin", text: "pick the lock" }],
  rows: [],
  ask: null,
  state: "State: calm",
} as unknown as FactSheet;

function world(over: { fog?: string[]; absent?: string[] } = {}) {
  const { projections, seed } = greyhollowFight();
  const snapshot = buildSnapshot(projections, seed);
  for (const a of snapshot.actors) {
    if (over.absent?.includes(a.id)) a.presence = "absent" as ScenePresence;
  }
  if (over.fog)
    snapshot.stage.zones = over.fog.map((name) => ({
      id: name,
      name,
      kind: "area",
      revealed: false,
    }));
  return {
    rows: [],
    hasRoll: false,
    snapshot,
    dmOnlyText: [SECRET],
    unmetSuccess: [],
    departedIds: [],
  };
}

/** The check node's kept slots, replicated from `nodes/check.ts`. */
function settle(text: string, w: ReturnType<typeof world>): NarrationSlots {
  const slots = parseSlots(stripThink(text), sheet);
  const drop = checkNarration({ ...w, slots })
    .filter((i) => i.check === "leak" || i.kind === "digit")
    .map((i) => i.sentence);
  const kept = {
    restate: slots.restate,
    describe: dropSentences(slots.describe, drop),
    ask: dropSentences(slots.ask, drop),
  };
  if (!kept.restate) kept.restate = defaultRestate(sheet);
  return kept;
}

function stream(text: string, w: ReturnType<typeof world>, step: number) {
  const s = createNarrationStream({ ...w, sheet });
  const parts: StreamPart[] = [];
  const pushed: StreamPart[] = [];
  for (let i = 0; i < text.length; i += step) {
    const p = s.push(text.slice(i, i + step));
    pushed.push(...p);
    parts.push(...p);
  }
  const settled = settle(text, w);
  parts.push(...s.finish(settled));
  const join = (parts_: StreamPart[], slot: string) =>
    parts_
      .filter((p) => p.slot === slot)
      .map((p) => p.text)
      .join("");
  return { parts, pushed, settled, join };
}

const CASES: Record<string, { text: string; w?: Parameters<typeof world>[0] }> =
  {
    plain: {
      text: "[restate] Tamsin means to pick the lock.\n[describe] The tumblers give way. The door swings inward. Dust falls.\n[ask] What does Kestrel do?",
    },
    "fogged zone": {
      text: "[describe] The door opens. Something moves in the Cellar below. Dust falls. The bell hangs still.",
      w: { fog: ["Cellar"] },
    },
    "dm-only text": {
      text: `[describe] The door opens. It is known that ${SECRET}. Dust falls. A boot scrapes.`,
    },
    "absent actor": {
      text: "[describe] The door opens. Pell steps out of the reeds. Dust falls. A boot scrapes.",
      w: { absent: ["pell"] },
    },
    digit: {
      text: "[describe] The lock gives way. It takes 12 tries. The door opens. Dust falls.",
    },
    "unclosed quote": {
      text: '[describe] The door opens. Tamsin says, "Wait here. I will be back. Do not follow me.',
    },
    "closed quote with periods": {
      text: '[describe] Tamsin whispers, "Wait. Quiet now." The door opens. Dust falls.',
    },
    "stock ending": {
      text: "[describe] The door opens. Dust falls. What do you do?",
    },
    "stock ending then ask": {
      text: "[describe] The door opens. Dust falls.\n[ask] What do you do?",
    },
    cap: {
      text: `[describe] ${"The reeds sway in the cold wind. ".repeat(60)}The end comes.`,
    },
    "cap with restate digit": {
      text: `[restate] Tamsin picks 3 locks.\n[describe] The door opens. ${"Mist rolls over the ford. ".repeat(40)}Done.`,
    },
    think: {
      text: "<think>The leak is the Cellar and 12 goblins.</think>[describe] The door opens. Dust falls. A boot scrapes.",
    },
    "open think": {
      text: "<think>planning the Cellar scene",
    },
    "tag drift": {
      text: "**Describe:** The door opens. Dust falls. A boot scrapes.\n**Ask:** What does Odo do?",
    },
    "no tags": {
      text: "The door opens. Dust falls. A boot scrapes.",
    },
    "slot not in sheet": {
      text: "[describe] The door opens. Dust falls.\n[narrate] Extra text. More.",
    },
  };

// The 106 narrate fixtures the repo ships, checked against the same world.
const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES: string[] = [];
for (const dir of [join(here, "scripts"), join(here, "../../dm-scripts")]) {
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const d = JSON.parse(readFileSync(join(dir, f), "utf8")) as {
      calls?: { purpose: string; respond?: { value?: unknown } }[];
    };
    for (const c of d.calls ?? [])
      if (c.purpose === "dm.narrate" && typeof c.respond?.value === "string")
        FIXTURES.push(c.respond.value);
  }
}

describe("narration stream", () => {
  it("holds the last sentence of describe until a successor or finish", () => {
    const s = createNarrationStream({ ...world(), sheet });
    expect(s.push("[describe] The door opens. ")).toEqual([]);
    expect(s.push("Dust falls")).toEqual([
      { slot: "describe", text: "The door opens." },
    ]);
    expect(
      s.finish({
        restate: "",
        describe: "The door opens. Dust falls.",
        ask: "",
      }),
    ).toEqual([{ slot: "describe", text: " Dust falls." }]);
  });

  it("emits restate when the next tag arrives and ask only at finish", () => {
    const { pushed, parts } = stream(CASES.plain?.text as string, world(), 5);
    expect(pushed.map((p) => p.slot)).toContain("restate");
    expect(pushed.map((p) => p.slot)).not.toContain("ask");
    expect(parts.at(-1)).toEqual({
      slot: "ask",
      text: "What does Kestrel do?",
    });
  });

  it("falls back to the code restate on a digit", () => {
    const r = stream(
      CASES["cap with restate digit"]?.text as string,
      world(),
      7,
    );
    expect(r.join(r.parts, "restate")).toBe(defaultRestate(sheet));
  });

  it("never streams a slot the sheet lacks", () => {
    const only = { ...sheet, slots: ["describe"] } as unknown as FactSheet;
    const s = createNarrationStream({ ...world(), sheet: only });
    const out = s.push("[restate] Hello there. More.\n[describe] A. B. C.");
    expect(out.map((p) => p.slot)).toEqual(["describe"]);
  });

  it("never emits think text", () => {
    const r = stream(CASES.think?.text as string, world(), 1);
    expect(JSON.stringify(r.parts)).not.toMatch(/think|Cellar|goblins/i);
    expect(
      stream(CASES["open think"]?.text as string, world(), 1).pushed,
    ).toEqual([]);
  });

  it("drops leaks and digits from every part", () => {
    for (const k of ["fogged zone", "dm-only text", "absent actor", "digit"]) {
      const c = CASES[k] as (typeof CASES)[string];
      for (const step of [1, 3, 17, 1000]) {
        const r = stream(c.text, world(c.w), step);
        const all = r.parts.map((p) => p.text).join(" ");
        expect(all, `${k}/${step}`).not.toMatch(
          /Cellar|ferryman|Pell steps|[0-9]/,
        );
      }
    }
  });

  it("holds an unclosed quote and the capped slot", () => {
    const q = stream(CASES["unclosed quote"]?.text as string, world(), 1);
    expect(q.pushed.map((p) => p.text).join("")).not.toContain("Wait here");
    const c = stream(CASES.cap?.text as string, world(), 1);
    expect(c.pushed.map((p) => p.text).join("").length).toBeLessThanOrEqual(
      600,
    );
  });

  it("never streams a stock ending", () => {
    const r = stream(CASES["stock ending"]?.text as string, world(), 1);
    expect(r.parts.map((p) => p.text).join(" ")).not.toMatch(/What do you do/);
  });

  describe("prefix property", () => {
    const all: [string, string, ReturnType<typeof world>][] = [
      ...Object.entries(CASES).map(
        ([k, c]) =>
          [k, c.text, world(c.w)] as [string, string, ReturnType<typeof world>],
      ),
      ...FIXTURES.map(
        (t, i) =>
          [`fixture ${i}`, t, world()] as [
            string,
            string,
            ReturnType<typeof world>,
          ],
      ),
    ];
    it("has the narrate fixtures", () => {
      expect(FIXTURES.length).toBeGreaterThan(50);
    });
    for (const step of [1, 3, 17]) {
      it(`streamed slot text is a prefix of the settled slot (${step}-char deltas)`, () => {
        for (const [name, text, w] of all) {
          const r = stream(text, w, step);
          const settled = settle(text, w);
          for (const slot of ["restate", "describe", "ask"] as const) {
            const streamed = r.join(r.pushed, slot);
            expect(
              settled[slot].startsWith(streamed),
              `${name}/${slot}: "${streamed}" vs "${settled[slot]}"`,
            ).toBe(true);
            // After finish the slot equals the settled text, never more.
            expect(r.join(r.parts, slot), `${name}/${slot} final`).toBe(
              settled[slot],
            );
          }
        }
      });
    }
  });
});
