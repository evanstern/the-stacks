import { describe, expect, it } from "vitest";
import {
  type CheckInput,
  checkNarration,
  dropPlan,
  dropSentences,
} from "../../src/dm/narration-check.js";
import { namedActorIds } from "../../src/dm/snapshot/aliases.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import type { LifeState, ScenePresence } from "../../src/dm/snapshot/types.js";
import { M2_LOG, narrationAt, stateAt } from "./claim-fixtures.js";
import { greyhollowFight } from "./snapshot-fixtures.js";

/** Spec 103 Phase 1: leak and contradiction kinds. Cases ported from claims.test.ts and audit.test.ts. */

interface Over {
  life?: Partial<Record<string, LifeState | null>>;
  presence?: Partial<Record<string, ScenePresence>>;
  /** Actor ids to mark met; every other non-party actor is unmet. */
  met?: string[];
  fog?: string[];
}

function input(
  describe: string,
  over: Over = {},
  extra: Partial<CheckInput> = {},
): CheckInput {
  const { projections, seed } = greyhollowFight();
  const snapshot = buildSnapshot(projections, seed);
  for (const a of snapshot.actors) {
    if (over.life && a.id in over.life)
      a.lifeState = over.life[a.id] as LifeState | null;
    if (over.presence?.[a.id])
      a.presence = over.presence[a.id] as ScenePresence;
  }
  if (over.met)
    for (const a of snapshot.actors)
      if (a.kind !== "party") a.met = over.met.includes(a.id);
  if (over.fog)
    snapshot.stage.zones = over.fog.map((name) => ({
      id: name,
      name,
      kind: "area",
      revealed: false,
    }));
  return {
    slots: { restate: "", describe, ask: "" },
    rows: [],
    hasRoll: false,
    snapshot,
    dmOnlyText: [],
    unmetSuccess: [],
    departedIds: [],
    ...extra,
  };
}

const kinds = (i: CheckInput) => checkNarration(i).map((x) => x.kind);

describe("leak check", () => {
  it("names an absent actor by a unique alias", () => {
    expect(
      kinds(
        input("Pell steps out of the reeds.", { presence: { pell: "absent" } }),
      ),
    ).toEqual(["absent-actor"]);
  });

  it("skips an actor who departed in this beat but not one absent before it", () => {
    const o = { presence: { pell: "absent" as ScenePresence } };
    const t = "Pell steps out of the reeds.";
    expect(kinds(input(t, o, { departedIds: ["pell"] }))).toEqual([]);
    expect(kinds(input(t, o, { departedIds: ["goblin-2"] }))).toEqual([
      "absent-actor",
    ]);
  });

  it("passes quotes, negation, 'no sign of' and a question", () => {
    const o = { presence: { pell: "absent" as ScenePresence }, met: ["pell"] };
    for (const t of [
      'Tamsin shouts, "Pell, where are you?"',
      "Tamsin cannot see Pell.",
      "There is no sign of Pell.",
      "Where is Pell?",
    ])
      expect([t, kinds(input(t, o))]).toEqual([t, []]);
  });

  it("passes a shared group noun and a present actor", () => {
    expect(
      kinds(input("The goblin waits.", { presence: { "goblin-2": "absent" } })),
    ).toEqual([]);
    expect(kinds(input("Pell steps out of the reeds."))).toEqual([]);
  });

  it("flags an unmet success naming an absent actor", () => {
    const i = input(
      "Pell steps out of the reeds.",
      { presence: { pell: "absent" } },
      { unmetSuccess: ["Pell appears."] },
    );
    expect(kinds(i)).toEqual(["unmet-success"]);
  });

  it("flags a fogged zone by whole word", () => {
    const i = input("Beyond the Sunken Gate the road bends.", {
      fog: ["Sunken Gate"],
    });
    expect(kinds(i)).toEqual(["fogged-zone"]);
    expect(
      kinds(input("The Sunken Gates creak.", { fog: ["Sunken Gate"] })),
    ).toEqual([]);
  });

  it("flags an unmet actor named in a quote and cuts the inner sentence (spec 112)", () => {
    const i = input('Tamsin shouts, "Pell, where are you? Come out."', {
      met: [],
    });
    const issues = checkNarration(i);
    expect(issues.map((x) => [x.kind, x.actorIds, x.inner])).toEqual([
      ["unmet-actor", ["pell"], "Pell, where are you?"],
    ]);
    const plan = dropPlan(issues);
    expect(dropSentences(i.slots.describe, plan.sentences, plan.inners)).toBe(
      'Tamsin shouts, "Come out."',
    );
  });

  it("drops the whole sentence when no inner sentence is left", () => {
    const i = input('Tamsin shouts, "Pell, where are you?"', { met: [] });
    const plan = dropPlan(checkNarration(i));
    expect(dropSentences(i.slots.describe, plan.sentences, plan.inners)).toBe(
      "",
    );
  });

  it("lets a speaker name an actor they know, and a met actor", () => {
    const wenna = 'Wenna says, "Pell is late."';
    expect(kinds(input(wenna, { met: [] }))).toEqual([]);
    expect(kinds(input('Tamsin says, "Pell is late."', { met: [] }))).toEqual([
      "unmet-actor",
    ]);
    expect(
      kinds(input('Tamsin says, "Pell is late."', { met: ["pell"] })),
    ).toEqual([]);
  });

  it("flags a fogged zone inside a quote and an unknown speaker", () => {
    expect(
      kinds(
        input('Tamsin says, "Beyond the Sunken Gate."', {
          fog: ["Sunken Gate"],
        }),
      ),
    ).toEqual(["fogged-zone"]);
    const i = input('"Pell is late."', { met: [] });
    expect(checkNarration(i)[0]?.detail).toContain("no known speaker");
  });

  it("treats a speakerId reply with no quote marks as speech", () => {
    const i = input(
      "Pell went for eel-traps.",
      { met: [] },
      { speakerId: "tamsin" },
    );
    expect(kinds(i)).toEqual(["unmet-actor"]);
    expect(
      kinds(
        input("Pell went for eel-traps.", { met: [] }, { speakerId: "wenna" }),
      ),
    ).toEqual([]);
  });

  it("flags DM-only text", () => {
    const i = input(
      "The vault holds a silver key under the altar.",
      {},
      { dmOnlyText: ["silver key under the altar"] },
    );
    expect(kinds(i)).toEqual(["dm-only-text"]);
  });
});

describe("contradiction check", () => {
  it("flags a digit in describe and ask", () => {
    const i = input("Snag deals 7 damage.");
    expect(kinds(i)).toEqual(["digit"]);
    i.slots = { restate: "", describe: "", ask: "Do you take 2 steps?" };
    expect(kinds(i)).toEqual(["digit"]);
  });

  it("flags dice language only with no roll", () => {
    expect(kinds(input("The dice favour Tamsin."))).toEqual(["dice-language"]);
    expect(
      kinds(input("The dice favour Tamsin.", {}, { hasRoll: true })),
    ).toEqual([]);
  });

  it("flags a death or down word on an actor in another state", () => {
    const r = checkNarration(
      input("Snag dies in the mud.", {}, { rows: ["Snag: HP 4 -> 4"] }),
    );
    expect(r.map((x) => x.kind)).toEqual(["life-state"]);
    expect(r[0]?.detail).toBe("Snag: HP 4 -> 4");
    expect(kinds(input("Tamsin is unconscious."))).toEqual(["life-state"]);
  });

  it("passes a matching state, an object, an active verb and quotes", () => {
    expect(kinds(input("Snag is dead.", { life: { snag: "dead" } }))).toEqual(
      [],
    );
    expect(
      kinds(
        input("Tamsin is unconscious.", { life: { tamsin: "unconscious" } }),
      ),
    ).toEqual([]);
    expect(kinds(input("Kestrel killed the goblin lookout."))).toEqual([]);
    expect(kinds(input('Odo mutters, "Snag is dead."'))).toEqual([]);
    expect(kinds(input("Snag drops the clapper."))).toEqual([]);
  });
});

describe("dropSentences", () => {
  it("removes only the listed sentences", () => {
    expect(dropSentences("One. Two 2. Three.", ["Two 2."])).toBe("One. Three.");
    expect(dropSentences("Only 1.", ["Only 1."])).toBe("");
  });
});

describe("recorded evidence (ported from claim-evidence.test.ts)", () => {
  const at = (
    text: string,
    s: number,
    e: number,
    extra: Partial<CheckInput> = {},
  ) =>
    checkNarration({
      slots: { restate: "", describe: text, ask: "" },
      rows: [],
      hasRoll: true,
      snapshot: stateAt(M2_LOG, s, e).snapshot,
      dmOnlyText: [],
      unmetSuccess: [],
      departedIds: [],
      ...extra,
    }).map((i) => i.kind);

  it("shipped M2 seq 225 and seq 220 prose raise no life-state or leak hit", () => {
    expect(at(narrationAt(M2_LOG, 225), 220, 224)).not.toContain("life-state");
    expect(at(narrationAt(M2_LOG, 220), 213, 219)).not.toContain("life-state");
  });

  it("a dead actor called dead passes; a live one called dead is flagged", () => {
    expect(at("Goblin lookout is dead.", 220, 224)).toEqual([]);
    expect(at("Snag is dead.", 220, 224)).toEqual(["life-state"]);
  });
});

describe("namedActorIds (spec 089 D1, ported)", () => {
  const { projections, seed } = greyhollowFight();
  const snapshot = buildSnapshot(projections, seed);
  it("finds a unique alias, once, in order", () => {
    expect(
      namedActorIds(snapshot, "Pell is bound. Pell! Tamsin sees Pell."),
    ).toEqual(["pell", "tamsin"]);
  });
  it("skips a shared noun and a description with no alias", () => {
    expect(namedActorIds(snapshot, "the goblin waits")).toEqual([]);
    expect(namedActorIds(snapshot, "a small figure at the post")).toEqual([]);
  });
});
