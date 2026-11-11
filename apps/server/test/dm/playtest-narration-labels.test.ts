import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FactSheetInput } from "../../src/dm/fact-sheet.js";
import {
  buildFactSheet,
  composeReply,
  parseSlots,
} from "../../src/dm/fact-sheet.js";
import type { NarrationFacts } from "../../src/dm/facts.js";

// Shipped narrations from playtest session 86abad65 (TASK-0307). The model wrote
// bare `restate:`, `describe:`, `ask:` labels; strip the code parts to recover its raw reply.
const shipped: { seq: number; text: string }[] = JSON.parse(
  readFileSync(
    new URL("./fixtures/playtest-86abad65-narrations.json", import.meta.url),
    "utf8",
  ),
);

/** The model's raw reply: drop the "means to" fallback block, the code rows and the State line. */
function rawReply(text: string): string {
  return text
    .split("\n\n")
    .filter((b) => !/^[^\n]* means to: /.test(b))
    .filter(
      (b) =>
        /^(restate|describe|ask):/i.test(b) ||
        !/^(State:|[^\n]+ \u2014 )/.test(b),
    )
    .join("\n\n");
}

const settled = (trigger: NarrationFacts["trigger"]): NarrationFacts =>
  ({
    trigger,
    actions:
      trigger === "commit"
        ? [
            {
              actionId: "a1",
              characterName: "Tamsin Vale",
              text: "I press on",
              outcome: "applied",
              refusalCode: null,
              rolls: [],
              outcomes: [],
              changes: [],
              followUps: [],
            },
          ]
        : [],
    npcTurn: null,
    director: { pacing: { tension: "low", spotlight: null, beatId: null } },
    modeChange: null,
    presentNpcs: [],
    rulings: [],
    clarify: [],
    party: [],
    events: [],
    setting: { locationName: "The Ford", openingFraming: "" },
  }) as unknown as NarrationFacts;

const sheetFor = (trigger: NarrationFacts["trigger"]) =>
  buildFactSheet({
    settled: settled(trigger),
    beat:
      trigger === "commit"
        ? [
            {
              actionId: "a1",
              characterId: "c1",
              scope: "character",
              actor: "u1",
              text: "I press on",
            },
          ]
        : [],
    projections: {
      party: [
        {
          characterId: "c1",
          name: "Tamsin Vale",
          controller: { kind: "player", userId: "u1" },
          combatantId: "tamsin",
        },
      ],
      tableMode: { mode: "free" },
      encounter: null,
    },
    nameOf: () => "Tamsin Vale",
    submissions: [],
  } as unknown as FactSheetInput);

describe("playtest 86abad65 narrations (TASK-0307)", () => {
  for (const { seq, text } of shipped) {
    it(`seq ${seq}: no slot label, no doubled restate`, () => {
      const raw = rawReply(text);
      const sheet = sheetFor(seq === 15 ? "scene-start" : "commit");
      const slots = parseSlots(raw, sheet);
      const out = composeReply(slots, sheet);
      expect(out).not.toMatch(/^\s*(restate|describe|ask):/im);
      if (/^restate:/im.test(raw)) {
        expect(slots.restate).not.toBe("");
        expect(out).not.toContain("means to:");
      }
      expect(slots.describe).not.toMatch(/^(restate|describe|ask):/i);
      if (seq === 15) expect(slots.ask).toMatch(/^What do you make of/);
      else expect(slots.ask).toBe("");
    });
  }
  it("seq 24 yields the model's restate and describe", () => {
    const rec = shipped.find((r) => r.seq === 24);
    const slots = parseSlots(rawReply(rec?.text ?? ""), sheetFor("commit"));
    expect(slots.restate).toMatch(/^Tamsin presses Wenna/);
    expect(slots.describe).toMatch(/^Wenna's grip tightens/);
  });
});
