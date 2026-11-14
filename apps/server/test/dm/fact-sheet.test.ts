import { describe, expect, it } from "vitest";
import {
  buildFactSheet,
  composeReply,
  defaultRestate,
  isRestateLine,
  type FactSheetInput,
  parseSlots,
  REFUSAL_REASON,
  renderRows,
} from "../../src/dm/fact-sheet.js";
import type { FactAction, NarrationFacts } from "../../src/dm/facts.js";
import { createNarrationStream } from "../../src/dm/narration-stream.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { greyhollowFight } from "./snapshot-fixtures.js";

const NAMES: Record<string, string> = {
  tamsin: "Tamsin Vale",
  snag: "Snag",
  odo: "Odo",
};
const nameOf = (id: string | null) => (id ? (NAMES[id] ?? id) : "The scene");

function action(over: Partial<FactAction> = {}): FactAction {
  return {
    actionId: "a1",
    characterName: "Tamsin Vale",
    text: "I swing at Snag",
    outcome: "applied",
    refusalCode: null,
    rolls: [],
    outcomes: [],
    changes: [],
    followUps: [],
    ...over,
  };
}

function facts(over: Partial<NarrationFacts> = {}): NarrationFacts {
  return {
    trigger: "commit",
    actions: [action()],
    npcTurn: null,
    director: {
      pacing: { tension: "low", spotlight: null, beatId: null },
      goalNote: "",
      sceneEnded: false,
    },
    modeChange: null,
    presentNpcs: [],
    clarify: [],
    party: [
      { characterId: "c-tamsin", name: "Tamsin Vale", controller: "human" },
    ],
    events: [],
    setting: { locationName: "The Ford", openingFraming: "The ford waits." },
    ...over,
  };
}

function input(
  settled: NarrationFacts,
  over: Partial<FactSheetInput> = {},
  active = "snag",
  turn = false,
): FactSheetInput {
  return {
    settled,
    beat: [
      {
        actionId: "a1",
        characterId: "c-tamsin",
        scope: "character",
        actor: "user-1",
        text: "I swing at Snag",
      },
    ],
    projections: {
      party: [
        {
          characterId: "c-tamsin",
          name: "Tamsin Vale",
          controller: { kind: "player", userId: "user-1" },
          combatantId: "tamsin",
        },
      ],
      tableMode: turn
        ? { mode: "turn", activeActor: active, activeCharacterId: null }
        : { mode: "free" },
      encounter: turn ? ({ activeCombatantId: active } as never) : null,
    } as never,
    nameOf,
    submissions: [],
    ...over,
  };
}

const state = (i: FactSheetInput) => buildFactSheet(i).state;

describe("fact sheet: State line per branch (contract §4)", () => {
  it("applied, turn", () => {
    expect(state(input(facts(), {}, "snag", true))).toBe(
      "State: Tamsin Vale's action is done. It is Snag's turn.",
    );
  });
  it("applied, free", () => {
    expect(state(input(facts()))).toBe(
      "State: Tamsin Vale's action is done. Anyone may act.",
    );
  });
  it("refused, turn", () => {
    const f = facts({
      actions: [action({ outcome: "refused", refusalCode: "NOT_YOUR_TURN" })],
    });
    expect(state(input(f, {}, "odo", true))).toBe(
      "State: Tamsin Vale's action did not happen. It is Odo's turn.",
    );
  });
  it("no-effect", () => {
    const f = facts({ actions: [action({ outcome: "no-effect" })] });
    expect(state(input(f))).toBe(
      "State: Tamsin Vale's action is done; nothing changed. Anyone may act.",
    );
  });
  it("partial from followUps", () => {
    const f = facts({ actions: [action({ followUps: ["then flee"] })] });
    expect(state(input(f))).toContain("is partly done; the rest has not");
  });
  it("partial from a refused later submission", () => {
    const i = input(facts(), {
      submissions: [{ key: "act:a1:step2", result: "refused" }],
    });
    expect(state(i)).toContain("partly done");
  });
  it("run 1 seq 15-20: party clarify, free", () => {
    const f = facts({
      actions: [],
      clarify: [{ actionId: "a1", question: "How does she lead them?" }],
    });
    const i = input(f, {
      beat: [
        {
          actionId: "a1",
          characterId: null,
          scope: "party",
          actor: "user-1",
          text: "We go on",
        },
      ],
    });
    const s = buildFactSheet(i);
    expect(s.state).toBe(
      "State: Nothing has happened yet. The party's action waits on Tamsin Vale's answer. Anyone else may act.",
    );
    expect(s.ask).toBe("How does she lead them?");
    expect(s.slots).toEqual(["restate", "describe"]);
  });
  it("held", () => {
    const f = facts({
      actions: [],
      held: [{ name: "Snag", text: "I swing at Snag" }],
    });
    expect(state(input(f, {}, "snag", true))).toBe(
      "State: Tamsin Vale's action waits for Snag's turn. It is Snag's turn.",
    );
  });
  it("npc turn", () => {
    const f = facts({ trigger: "npc-turn", actions: [] });
    const i = input(f, { beat: [] }, "snag", true);
    const s = buildFactSheet(i);
    expect(s.state).toBe("State: It is Snag's turn.");
    expect(s.slots).toEqual(["describe"]);
  });
  it("scene start", () => {
    const f = facts({ trigger: "scene-start", actions: [] });
    const s = buildFactSheet(input(f, { beat: [] }));
    expect(s.state).toBe("State: Anyone may act.");
    expect(s.slots).toEqual(["describe", "ask"]);
  });
  it("scene end", () => {
    const f = facts({
      director: {
        pacing: { tension: "low", spotlight: null, beatId: null },
        goalNote: "",
        sceneEnded: true,
      },
    });
    expect(state(input(f))).toBe(
      "State: Tamsin Vale's action is done. The scene is over; the DM moves next.",
    );
  });
  it("encounter start", () => {
    const f = facts({
      events: [{ kind: "encounter-started", combatants: [], first: "Snag" }],
    });
    expect(state(input(f, {}, "snag", true))).toBe(
      "State: Tamsin Vale's action is done. The fight begins. It is Snag's turn.",
    );
  });
  it("encounter end", () => {
    const f = facts({ events: [{ kind: "encounter-ended" }] });
    expect(state(input(f))).toBe(
      "State: Tamsin Vale's action is done. The fight is over. Anyone may act.",
    );
  });
  it("talk reply has no State line and no slots", () => {
    const f = facts({ trigger: "talk", actions: [] });
    const s = buildFactSheet(input(f, { beat: [] }));
    expect(s.state).toBeNull();
    expect(s.slots).toEqual([]);
  });
  it("no State line holds ? and each names a mover", () => {
    const variants: FactSheetInput[] = [
      input(facts()),
      input(facts(), {}, "snag", true),
      input(
        facts({
          clarify: [{ actionId: "a1", question: "Which door?" }],
          actions: [],
        }),
      ),
      input(facts({ events: [{ kind: "encounter-ended" }] })),
      input(facts({ actions: [action({ outcome: "refused" })] })),
    ];
    for (const v of variants) {
      const st = state(v) ?? "";
      expect(st).not.toContain("?");
      expect(st).toMatch(/Anyone|the DM|Snag|Tamsin Vale|Odo/);
    }
  });
});

describe("fact sheet: rows", () => {
  it("renders a refusal row per code, with a fallback reason", () => {
    for (const code of [...Object.keys(REFUSAL_REASON), "WEIRD"]) {
      const rows = renderRows(
        facts({ actions: [action({ outcome: "refused", refusalCode: code })] }),
      );
      expect(rows).toEqual([
        {
          kind: "refusal",
          text: `Tamsin Vale: refused, ${REFUSAL_REASON[code] ?? "the rules do not allow it"} (${code})`,
        },
      ]);
    }
  });
  it("orders rolls and change rows per action", () => {
    const rows = renderRows(
      facts({
        actions: [
          action({
            changes: [
              { kind: "life-state", target: "Snag", before: "a", after: "b" },
            ],
          }),
        ],
      }),
    );
    expect(rows.map((r) => r.kind)).toEqual(["life-state"]);
  });
});

describe("fact sheet: deed rows (spec 111)", () => {
  it("renders a Deed row before the direct entry's rows", () => {
    const rows = renderRows(
      facts({
        actions: [],
        direct: [
          {
            name: "Tamsin Vale",
            deed: { text: "/search #ferry-house", stopped: null },
            rolls: [],
            outcomes: [],
            changes: [
              { kind: "life-state", target: "Snag", before: "a", after: "b" },
            ],
          },
          {
            name: "Odo",
            deed: { text: "/move #causeway", stopped: "BLOCKED" },
            rolls: [],
            outcomes: [],
            changes: [],
          },
        ],
      }),
    );
    expect(rows.map((r) => r.kind)).toEqual(["deed", "life-state", "deed"]);
    expect(rows[0]?.text).toBe("Deed: Tamsin Vale: /search #ferry-house");
    expect(rows[2]?.text).toBe("Deed: Odo: /move #causeway (stopped, BLOCKED)");
  });
});

describe("fact sheet: parseSlots and composeReply", () => {
  const sheet = buildFactSheet(input(facts()));
  it("an untagged reply is describe", () => {
    const s = parseSlots("The blade bites.", sheet);
    expect(s.describe).toBe("The blade bites.");
    expect(s.restate).toBe('Tamsin Vale means to: "I swing at Snag".');
  });
  it("a digit in restate falls back to the code default", () => {
    const s = parseSlots("[restate] She hits for 5.\n[describe] Ok.", sheet);
    expect(s.restate).toContain("means to:");
    expect(s.describe).toBe("Ok.");
  });
  it("keeps a clean restate", () => {
    const s = parseSlots(
      "[restate] Tamsin means to strike.\n[describe] Ok.",
      sheet,
    );
    expect(s.restate).toBe("Tamsin means to strike.");
  });
  it("drops either-or and stock asks", () => {
    expect(parseSlots("[describe] Ok.\n[ask] Left or right?", sheet).ask).toBe(
      "",
    );
    expect(parseSlots("[describe] Ok.\n[ask] What do you do?", sheet).ask).toBe(
      "",
    );
    const opening = buildFactSheet(
      input(facts({ trigger: "scene-start", actions: [] }), { beat: [] }),
    );
    expect(parseSlots("[describe] Ok.\n[ask] Who steps up?", opening).ask).toBe(
      "Who steps up?",
    );
  });
  it("a routine turn drops a model ask that only prompts the player to act", () => {
    expect(sheet.slots).toEqual(["restate", "describe"]);
    const s = parseSlots(
      "restate: She swings.\ndescribe: Steel rings.\nask: What does she see?",
      sheet,
    );
    expect(s.ask).toBe("");
    expect(s.describe).toBe("Steel rings.");
  });
  it.each([
    ["[restate] A\n[describe] B", "A", "B"],
    ["[restate]: A\n[describe]: B", "A", "B"],
    ["restate: A\ndescribe: B", "A", "B"],
    ["RESTATE: A\nDescribe: B", "A", "B"],
    ["**restate:** A\n**describe:** B", "A", "B"],
    ["**Restate**: A\n**Describe**: B", "A", "B"],
  ])("accepts and strips label form %j", (text, restate, describe) => {
    const s = parseSlots(text, sheet);
    expect(s.restate).toBe(restate);
    expect(s.describe).toBe(describe);
  });
  it("a label word mid-sentence is not a tag", () => {
    const s = parseSlots(
      "She will describe: the hall, and restate: it.",
      sheet,
    );
    expect(s.describe).toBe("She will describe: the hall, and restate: it.");
  });
  it("a model restate suppresses the means-to fallback", () => {
    const s = parseSlots("restate: She lunges.\ndescribe: Ok.", sheet);
    expect(composeReply(s, sheet)).not.toContain("means to");
  });
  it("digit restate with a restate of digits is replaced even in turn mode", () => {
    expect(
      parseSlots("[restate] 2 swings\n[describe] x", sheet).restate,
    ).not.toMatch(/[0-9]/);
  });
  it("a code ask wins over a model ask", () => {
    const f = facts({
      actions: [],
      clarify: [{ actionId: "a1", question: "How does she lead them?" }],
    });
    const s = buildFactSheet(input(f));
    const slots = parseSlots("[describe] Mist.\n[ask] Why?", s);
    expect(slots.ask).toBe("How does she lead them?");
  });
  it("composes in template order and omits empty blocks", () => {
    const s = buildFactSheet(
      input(
        facts({
          actions: [
            action({
              changes: [
                { kind: "life-state", target: "Snag", before: "a", after: "b" },
              ],
            }),
          ],
        }),
      ),
    );
    const text = composeReply({ restate: "R.", describe: "D.", ask: "" }, s);
    expect(text).toBe(
      "R.\n\nD.\n\nSnag: a → b\nState: Tamsin Vale's action is done. Anyone may act.",
    );
    const talk = buildFactSheet(
      input(facts({ trigger: "talk", actions: [] }), { beat: [] }),
    );
    expect(composeReply({ restate: "", describe: "Hi.", ask: "" }, talk)).toBe(
      "Hi.",
    );
  });
});

describe("fact sheet: digits come only from rows (constitution VII)", () => {
  it("drops describe and ask sentences with a digit; every digit left is in a row or the State line", () => {
    const s = buildFactSheet(
      input(
        facts({
          actions: [
            action({
              changes: [
                {
                  kind: "life-state",
                  target: "Goblin-3",
                  before: "a",
                  after: "b",
                },
              ],
            }),
          ],
        }),
      ),
    );
    const slots = parseSlots(
      "[describe] Snag deals 7 damage. The mist thickens. He grins at 3 goblins.",
      s,
    );
    expect(slots.describe).toBe("The mist thickens.");
    const rowText = [...s.rows.map((r) => r.text), s.state ?? ""].join("\n");
    const reply = composeReply(slots, s);
    for (const d of reply.match(/[0-9]/g) ?? []) expect(rowText).toContain(d);
    expect(parseSlots("[describe] Only 2.", s).describe).toBe("");
  });
});

describe("fact sheet: stream parts hold digits only from rows (spec 108, constitution VII)", () => {
  it("every digit in any stream part lies in a code-rendered row or the State line", () => {
    const s = buildFactSheet(
      input(
        facts({
          actions: [
            action({
              changes: [
                {
                  kind: "hp",
                  target: "Snag",
                  before: "7",
                  after: "0",
                } as never,
              ],
            }),
          ],
        }),
      ),
    );
    const rows = [...s.rows.map((r) => r.text), s.state ?? ""];
    const rowText = rows.join("\n");
    const { projections, seed } = greyhollowFight();
    const text =
      "[restate] Tamsin means to hit Snag 3 times.\n[describe] Snag deals 7 damage. The mist thickens. He grins at 3 goblins. The reeds sway. Cold air stirs.\n[ask] What do the next 2 do?";
    for (const step of [1, 4, 1000]) {
      const st = createNarrationStream({
        rows,
        hasRoll: false,
        snapshot: buildSnapshot(projections, seed),
        dmOnlyText: [],
        unmetSuccess: [],
        departedIds: [],
        sheet: s,
      });
      const parts = [];
      for (let i = 0; i < text.length; i += step)
        parts.push(...st.push(text.slice(i, i + step)));
      const settled = parseSlots(text, s);
      parts.push(...st.finish(settled));
      expect(parts.length).toBeGreaterThan(0);
      for (const p of [{ slot: "rows", text: rowText }, ...parts])
        for (const d of p.text.match(/[0-9]/g) ?? [])
          expect(rowText, `${p.slot} "${p.text}"`).toContain(d);
    }
  });
});

it("isRestateLine matches what defaultRestate writes", () => {
  const sheet = { restate: [{ subject: "Mira", text: "open the door" }] };
  expect(isRestateLine(defaultRestate(sheet as never))).toBe(true);
  expect(isRestateLine("Mira smiles.")).toBe(false);
});
