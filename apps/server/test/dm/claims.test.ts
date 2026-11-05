import { describe, expect, it } from "vitest";
import {
  ACT_VERBS,
  INVOLUNTARY_VERBS,
  SPEECH_VERBS,
} from "../../src/dm/audit-words.js";
import {
  type ClaimIssue,
  type ClaimState,
  checkClaims,
  offTurnActs,
} from "../../src/dm/claims.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import type {
  ActorChange,
  LifeState,
  ScenePresence,
} from "../../src/dm/snapshot/types.js";
import { greyhollowFight } from "./snapshot-fixtures.js";

/**
 * Spec 051 Phase 2: unit cases for contracts/claim-gate.md rules 1 to 8.
 * Snapshots start from the Greyhollow Ford fight (nine actors: Tamsin, Odo,
 * Kestrel, Snag, goblin-2/3/4, Wenna, Pell) and are edited as plain data.
 */

interface Over {
  life?: Partial<Record<string, LifeState | null>>;
  presence?: Partial<Record<string, ScenePresence>>;
  changes?: ActorChange[];
}

function state(over: Over = {}): ClaimState {
  const { projections, seed } = greyhollowFight();
  const snapshot = buildSnapshot(projections, seed);
  for (const a of snapshot.actors) {
    if (over.life && a.id in over.life)
      a.lifeState = over.life[a.id] as LifeState | null;
    if (over.presence?.[a.id])
      a.presence = over.presence[a.id] as ScenePresence;
  }
  const diff = over.changes
    ? { fromSeq: 0, toSeq: 1, actors: over.changes, stage: [] }
    : null;
  return { snapshot, diff };
}

const died = (actorId: string): ActorChange => ({
  kind: "life-state",
  actorId,
  before: "conscious",
  after: "dead",
});
const dropped = (actorId: string): ActorChange => ({
  kind: "life-state",
  actorId,
  before: "conscious",
  after: "unconscious",
});
const fled = (actorId: string): ActorChange => ({
  kind: "presence",
  actorId,
  before: "present",
  after: "absent",
});

const kinds = (issues: ClaimIssue[]) => issues.map((i) => i.claim);
const tamsinDown = () => state({ life: { tamsin: "unconscious" } });

describe("rule 1: references (unique versus group terms)", () => {
  it("'goblin' is shared by four actors and never selects one", () => {
    const s = state({ life: { "goblin-3": "dead" }, presence: {} });
    const r = checkClaims(s, "The goblin shrieks at the ford.");
    expect(r.pass).toBe(true);
  });

  it("a unique alias selects its actor", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    const r = checkClaims(s, "The goblin lookout shrieks at Snag.");
    expect(kinds(r.issues)).toEqual(["speech"]);
    expect(r.issues[0]?.actorIds).toEqual(["goblin-3"]);
  });

  it("'the goblin leader' selects Snag, not the goblins", () => {
    const s = state({ presence: { snag: "absent" } });
    const r = checkClaims(s, "The goblin leader laughs from the reeds.");
    expect(r.issues[0]?.actorIds).toEqual(["snag"]);
  });

  it("a pronoun or a description resolves to no actor and passes", () => {
    const s = tamsinDown();
    expect(checkClaims(s, "She lifts her sword and speaks.").pass).toBe(true);
    expect(checkClaims(s, "The woman in the mud reaches out.").pass).toBe(true);
  });
});

describe("rule 1: possessives", () => {
  it("'Tamsin's hand reaches' attributes the act to Tamsin", () => {
    const r = checkClaims(tamsinDown(), "Tamsin's hand reaches for the hilt.");
    expect(kinds(r.issues)).toEqual(["act"]);
    expect(r.issues[0]?.actorIds).toEqual(["tamsin"]);
  });

  it("'Snag's goblins flee' attributes the act to the goblins, not Snag", () => {
    const s = state({ presence: { snag: "absent" } });
    expect(checkClaims(s, "Snag's goblins flee into the reeds.").pass).toBe(
      true,
    );
  });

  it("'Snag's belt once held it' is no act by Snag", () => {
    const s = state({ presence: { snag: "absent" } });
    expect(checkClaims(s, "Snag's belt once held the clapper.").pass).toBe(
      true,
    );
  });

  it("carries the actor across a comma to 'her fingers curling around'", () => {
    const r = checkClaims(
      tamsinDown(),
      "Tamsin's hand twitches toward her sword, her fingers curling around the hilt.",
    );
    expect(kinds(r.issues)).toEqual(["act"]);
    expect(r.issues[0]?.detail).toContain("Tamsin Vale");
  });
});

describe("rule 2: acts, speech, negation and involuntary verbs", () => {
  it("refuses an act by a dead actor", () => {
    const s = state({ life: { kestrel: "dead" } });
    const r = checkClaims(s, "Kestrel lunges at the goblin.");
    expect(kinds(r.issues)).toEqual(["act"]);
    expect(r.issues[0]?.detail).toContain("dead");
  });

  it("refuses an act by an absent actor", () => {
    const s = state({ presence: { snag: "absent" } });
    expect(
      kinds(checkClaims(s, "Snag charges across the ford.").issues),
    ).toEqual(["act"]);
  });

  it("negation turns the act into a state", () => {
    const s = tamsinDown();
    expect(checkClaims(s, "Tamsin cannot speak.").pass).toBe(true);
    expect(checkClaims(s, "Tamsin does not even lift a finger.").pass).toBe(
      true,
    );
    expect(checkClaims(s, "Tamsin can no longer stand.").pass).toBe(true);
  });

  it("involuntary verbs describe a downed actor and pass", () => {
    const s = tamsinDown();
    expect(
      checkClaims(s, "Tamsin lies where she fell, her breath shallow.").pass,
    ).toBe(true);
    expect(checkClaims(s, "Tamsin breathes and bleeds.").pass).toBe(true);
    expect(checkClaims(s, "Tamsin lies where she stood.").pass).toBe(true);
  });

  it("an actor named as the object of an act is not the actor", () => {
    const s = tamsinDown();
    expect(checkClaims(s, "Snag stands over Tamsin and grins.").pass).toBe(
      true,
    );
    expect(checkClaims(s, "Kestrel grabs Tamsin and runs.").pass).toBe(true);
  });

  it("quoted speech attributed before the quote", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    const r = checkClaims(s, 'The goblin lookout shouts, "Run!"');
    expect(kinds(r.issues)).toEqual(["speech"]);
  });

  it("quoted speech attributed after the quote", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    const r = checkClaims(s, '"Run!" the goblin lookout shrieks.');
    expect(kinds(r.issues)).toEqual(["speech"]);
  });

  it("a quote with no unique speaker passes", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    expect(checkClaims(s, '"Run!" it shrieks.').pass).toBe(true);
  });

  it("an act word inside a quote is not an act by the named actor", () => {
    const s = tamsinDown();
    expect(
      checkClaims(s, 'Kestrel whispers, "Tamsin reaches for it."').pass,
    ).toBe(true);
  });

  it("stable counts as downed", () => {
    const s = state({ life: { odo: "stable" } });
    expect(
      kinds(checkClaims(s, "Brother Odo reaches for his mace.").issues),
    ).toEqual(["act"]);
  });

  it("yielded may act and speak (US1.7)", () => {
    const s = state({ presence: { snag: "yielded" } });
    expect(checkClaims(s, "Snag begs for his life.").pass).toBe(true);
    expect(checkClaims(s, "Snag steps back and shouts.").pass).toBe(true);
  });

  it("a null life state (an NPC with no combatant) may act", () => {
    expect(checkClaims(state(), "Pell stumbles free and runs.").pass).toBe(
      true,
    );
  });
});

describe("FR-004a: transition and turn-order exemptions", () => {
  it("an actor that dies this turn may act in the same sentence", () => {
    const s = state({
      life: { "goblin-3": "dead" },
      changes: [died("goblin-3")],
    });
    expect(
      checkClaims(s, "The goblin lookout lunges, then drops dead.").pass,
    ).toBe(true);
  });

  it("without the diff change the same sentence is refused", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    expect(
      kinds(
        checkClaims(s, "The goblin lookout lunges, then drops dead.").issues,
      ),
    ).toContain("act");
  });

  it("an actor that flees this turn may act in the same sentence", () => {
    const s = state({ presence: { snag: "absent" }, changes: [fled("snag")] });
    expect(checkClaims(s, "Snag flees into the reeds.").pass).toBe(true);
  });

  it("'<name> moves next' passes for an unconscious actor", () => {
    expect(checkClaims(tamsinDown(), "Tamsin moves next.").pass).toBe(true);
    expect(checkClaims(tamsinDown(), "Tamsin acts next.").pass).toBe(true);
  });

  it("'<name> moves' without 'next' is still an act", () => {
    expect(
      kinds(checkClaims(tamsinDown(), "Tamsin moves again.").issues),
    ).toEqual(["act"]);
  });
});

describe("rules 4 and 5: death and down attribution", () => {
  const dying = () =>
    state({ life: { "goblin-3": "dead" }, changes: [died("goblin-3")] });

  it("'Snag falls dead' names the wrong actor (US2.1)", () => {
    const r = checkClaims(dying(), "Snag falls dead.");
    expect(kinds(r.issues)).toContain("death");
    expect(r.issues.find((i) => i.claim === "death")?.actorIds).toEqual([
      "snag",
    ]);
  });

  it("'Snag drops the clapper' is no down attribution", () => {
    expect(checkClaims(state(), "Snag drops the clapper.").pass).toBe(true);
  });

  it("'Snag stares at the dead lookout' does not call Snag dead", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    expect(checkClaims(s, "Snag stares at the dead lookout.").pass).toBe(true);
  });

  it("'Kestrel killed the goblin' does not call Kestrel dead", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    expect(checkClaims(s, "Kestrel killed the goblin.").pass).toBe(true);
  });

  it("'the dead lookout' passes when goblin-3 died earlier (US2.4)", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    expect(checkClaims(s, "Snag glares at the dead lookout.").pass).toBe(true);
  });

  it("calling a dead actor dead passes", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    expect(checkClaims(s, "The goblin lookout lies dead.").pass).toBe(true);
  });

  it("calling an unconscious actor unconscious passes (US2.3)", () => {
    expect(checkClaims(tamsinDown(), "Tamsin lies unconscious.").pass).toBe(
      true,
    );
  });

  it("calling a conscious actor unconscious is refused", () => {
    const r = checkClaims(state(), "Kestrel is knocked out.");
    expect(kinds(r.issues)).toEqual(["down"]);
    expect(r.issues[0]?.actorIds).toEqual(["kestrel"]);
  });

  it("an unconscious actor called dead is refused", () => {
    expect(kinds(checkClaims(tamsinDown(), "Tamsin dies.").issues)).toEqual([
      "death",
    ]);
  });

  it("an unattributed death word refuses when nobody is dead", () => {
    const r = checkClaims(state(), "Someone dies in the dark.");
    expect(kinds(r.issues)).toEqual(["death"]);
    expect(r.issues[0]?.actorIds).toEqual([]);
  });

  it("an unattributed death word passes when an actor is dead (FR-013)", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    expect(checkClaims(s, "Someone dies in the dark.").pass).toBe(true);
  });

  it("an unattributed down word refuses when nobody is down", () => {
    expect(kinds(checkClaims(state(), "A goblin passes out.").issues)).toEqual([
      "down",
    ]);
  });
});

describe("rule 6: omission", () => {
  it("a recorded drop with no sentence describing it refuses (US2.5)", () => {
    const s = state({
      life: { kestrel: "unconscious" },
      changes: [dropped("kestrel")],
    });
    const r = checkClaims(s, "The ford is quiet.");
    expect(kinds(r.issues)).toEqual(["omission"]);
    expect(r.issues[0]?.actorIds).toEqual(["kestrel"]);
  });

  it("a recorded drop named by a unique term passes", () => {
    const s = state({
      life: { kestrel: "unconscious" },
      changes: [dropped("kestrel")],
    });
    expect(checkClaims(s, "Kestrel crumples into the reeds.").pass).toBe(true);
  });

  it("a recorded death named by a group noun passes", () => {
    const s = state({
      life: { "goblin-3": "dead" },
      changes: [died("goblin-3")],
    });
    expect(
      checkClaims(s, "The goblin hauling Pell jerks once, dead.").pass,
    ).toBe(true);
  });

  it("a recorded death with no death word refuses", () => {
    const s = state({
      life: { "goblin-3": "dead" },
      changes: [died("goblin-3")],
    });
    expect(
      kinds(checkClaims(s, "The goblin lookout stumbles.").issues),
    ).toEqual(["omission"]);
  });

  it("no diff means no omission", () => {
    expect(
      checkClaims(state({ life: { kestrel: "unconscious" } }), "Quiet.").pass,
    ).toBe(true);
  });
});

describe("rule 7: counts", () => {
  it("'two goblins lie dead' passes with two dead (US3.4)", () => {
    const s = state({ life: { "goblin-2": "dead", "goblin-3": "dead" } });
    expect(checkClaims(s, "Two goblins lie dead in the reeds.").pass).toBe(
      true,
    );
  });

  it("'two goblins lie dead' refuses with one dead", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    const r = checkClaims(s, "Two goblins lie dead in the reeds.");
    expect(kinds(r.issues)).toEqual(["count"]);
    expect(r.issues[0]?.matched).toContain("Two goblins lie dead");
  });

  it("'both down' passes with two downed party members", () => {
    const s = state({ life: { tamsin: "unconscious", odo: "unconscious" } });
    expect(checkClaims(s, "Both are down.").pass).toBe(true);
  });

  it("a bare 'two down' passes when either side matches", () => {
    const party = state({ life: { tamsin: "unconscious", odo: "dead" } });
    expect(checkClaims(party, "Two down!").pass).toBe(true);
    const world = state({ life: { "goblin-2": "dead", "goblin-3": "dead" } });
    expect(checkClaims(world, "Two down!").pass).toBe(true);
  });

  it("'Goblin three is dead' names an actor and is not a count (TASK-0143 OQ-5)", () => {
    const s = state({
      life: { "goblin-3": "dead" },
      changes: [died("goblin-3")],
    });
    expect(kinds(checkClaims(s, "Goblin three is dead.").issues)).not.toContain(
      "count",
    );
    expect(checkClaims(s, "Goblin three is dead.").pass).toBe(true);
    expect(checkClaims(s, "Goblin 3 is dead.").pass).toBe(true);
  });

  it("a bare 'two down' refuses when neither side matches", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    expect(kinds(checkClaims(s, '"Two down!" it shrieks.').issues)).toEqual([
      "count",
    ]);
  });

  it("'his last goblin' refuses with three goblin-group actors standing", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    const r = checkClaims(s, "Snag eyes his last goblin.");
    expect(kinds(r.issues)).toContain("count");
  });

  it("'his last goblin' passes with exactly one standing", () => {
    const s = state({
      life: { "goblin-2": "dead", "goblin-3": "dead", "goblin-4": "dead" },
      presence: { snag: "absent" },
    });
    // Zero standing: 'last' needs exactly one.
    expect(
      kinds(checkClaims(s, "Snag eyes his last goblin.").issues),
    ).toContain("count");
    const one = state({
      life: { "goblin-2": "dead", "goblin-3": "dead" },
      presence: { snag: "absent" },
    });
    expect(checkClaims(one, "He turns on the last goblin.").pass).toBe(true);
  });

  it("'all the goblins are dead' refuses with one standing", () => {
    const s = state({
      life: { "goblin-2": "dead", "goblin-3": "dead" },
    });
    const r = checkClaims(s, "All the goblins are dead.");
    expect(kinds(r.issues)).toContain("count");
  });

  it("'all the goblins are dead' passes when every goblin is down", () => {
    const s = state({
      life: {
        "goblin-2": "dead",
        "goblin-3": "dead",
        "goblin-4": "unconscious",
        snag: "dead",
      },
    });
    expect(checkClaims(s, "All the goblins are dead.").pass).toBe(true);
  });

  it("'no goblins left' refuses while any goblin stands", () => {
    const s = state({ life: { "goblin-3": "dead" } });
    expect(kinds(checkClaims(s, "No goblins left to fight.").issues)).toEqual([
      "count",
    ]);
  });

  it("a yielded goblin counts as left", () => {
    const s = state({
      life: { "goblin-2": "dead", "goblin-3": "dead", "goblin-4": "dead" },
      presence: { snag: "yielded" },
    });
    expect(kinds(checkClaims(s, "No goblins left to fight.").issues)).toEqual([
      "count",
    ]);
  });

  it("'no goblins left' passes when every goblin is dead or absent", () => {
    const s = state({
      life: { "goblin-2": "dead", "goblin-3": "dead" },
      presence: { "goblin-4": "absent", snag: "absent" },
    });
    expect(checkClaims(s, "No goblins left to fight.").pass).toBe(true);
  });
});

describe("rule 8 and the result shape", () => {
  it("empty text passes", () => {
    expect(checkClaims(state(), "")).toEqual({ pass: true, issues: [] });
  });

  it("pass equals an empty issue list; issues come in text order", () => {
    const s = state({
      presence: { snag: "absent" },
      life: { tamsin: "unconscious" },
    });
    const r = checkClaims(
      s,
      "Tamsin reaches out. Later, Snag laughs from the reeds.",
    );
    expect(r.pass).toBe(false);
    expect(r.issues.map((i) => i.actorIds[0])).toEqual(["tamsin", "snag"]);
  });

  it("every matched text is at most 60 characters", () => {
    const s = tamsinDown();
    const long =
      "Tamsin's hand twitches toward her sword, her fingers curling around the hilt of the long blade.";
    for (const i of checkClaims(s, long).issues)
      expect(i.matched.length).toBeLessThanOrEqual(60);
  });
});

describe("lexicons (FR-014)", () => {
  const overlap = (a: readonly string[], b: readonly string[]) =>
    a.filter((x) => b.includes(x));

  it("ACT_VERBS, SPEECH_VERBS and INVOLUNTARY_VERBS are pairwise disjoint", () => {
    expect(overlap(ACT_VERBS, SPEECH_VERBS)).toEqual([]);
    expect(overlap(ACT_VERBS, INVOLUNTARY_VERBS)).toEqual([]);
    expect(overlap(SPEECH_VERBS, INVOLUNTARY_VERBS)).toEqual([]);
  });
});

describe("offTurnActs (TASK-0214)", () => {
  const off = ["Brother Odo", "Kestrel"];
  const acts = (text: string, s = state()) =>
    offTurnActs(s, text, off).map((i) => i.actorIds[0]);

  it("blocks an off-turn actor shown striking or shooting", () => {
    expect(acts("Brother Odo looses an arrow at Snag.")).toEqual(["odo"]);
    expect(acts("Kestrel lunges at the goblin.")).toEqual(["kestrel"]);
  });

  it("blocks readying for a next action (TASK-0246)", () => {
    expect(acts("Kestrel draws back for another try.")).toEqual(["kestrel"]);
    expect(acts("Brother Odo shifts his grip on the mace.")).toEqual(["odo"]);
    expect(acts("Kestrel raises his blade again.")).toEqual(["kestrel"]);
  });

  it("passes perceptual and passive verbs (TASK-0246)", () => {
    expect(acts("Kestrel watches the ford and waits.")).toEqual([]);
    expect(acts("Brother Odo turns his head toward the noise.")).toEqual([]);
    expect(acts("Kestrel shifts uneasily and draws a breath.")).toEqual([]);
  });

  it("passes words, looks and flinches", () => {
    expect(acts("Brother Odo winces and mutters a prayer.")).toEqual([]);
    expect(acts("Kestrel flinches as the blow goes wide.")).toEqual([]);
  });

  it("skips quoted speech, a negated act and an on-turn actor", () => {
    expect(acts('Snag grins. "Charge!" Odo cries.')).toEqual([]);
    expect(acts("Kestrel does not shoot.")).toEqual([]);
    expect(acts("Snag charges the ford.")).toEqual([]);
  });

  it("skips a shared group noun and a barred actor", () => {
    expect(acts("The goblin hurls a spear.")).toEqual([]);
    const s = state({ life: { odo: "dead" } });
    expect(acts("Brother Odo looses an arrow at Snag.", s)).toEqual([]);
  });
});
