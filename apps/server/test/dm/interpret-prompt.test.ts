import { readFileSync } from "node:fs";
import { DamageTypeSchema } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import { agencyRule } from "../../src/dm/doctrine/doctrine.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import {
  CONDITION_KEYS,
  InterpretOutput,
  SKILL_KEYS,
} from "../../src/dm/nodes/schemas.js";
import {
  PROMPT_VERSION as ADJUDICATE_VERSION,
  buildAdjudicatePrompt,
} from "../../src/dm/prompts/adjudicate.js";
import {
  buildInterpretPrompt,
  EXAMPLE_OUTPUT,
  PROMPT_VERSION as INTERPRET_VERSION,
  OUTPUT_SHAPE,
} from "../../src/dm/prompts/interpret.js";
import { STEP_GRAMMAR } from "../../src/dm/prompts/step-grammar.js";
import {
  commit,
  declare,
  freeEventsThrough,
  makeCtx,
  projectDm,
  row,
} from "./helpers.js";
import { clone, condition, greyhollowFight } from "./snapshot-fixtures.js";

const director: DirectorNodeOutput = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
};

async function prompts() {
  const ctx = makeCtx({
    deps: {
      loadProjections: async () =>
        projectDm(freeEventsThrough("action.committed")),
    },
  });
  const assembled = await assemble(ctx);
  if (!assembled.ok) throw new Error("assemble failed");
  const interpret = buildInterpretPrompt({
    ctx,
    assembled: assembled.output,
    director,
  });
  const adjudicate = buildAdjudicatePrompt({
    seed: ctx.seed,
    assembled: assembled.output,
    reading: InterpretOutput.parse(EXAMPLE_OUTPUT).readings[0] as never,
    actionText: "x",
    passages: [],
  });
  return { interpret, adjudicate };
}

const NARRATIVE =
  "A narrative outcome such as spotting, learning or noticing something is narration, not an effect";

describe("interpret and adjudicate prompts", () => {
  it("bumps the prompt versions", () => {
    expect(INTERPRET_VERSION).toBe("dm.interpret-v11");
    expect(ADJUDICATE_VERSION).toBe("dm.adjudicate-v8");
  });

  it("renders a frightened monster's condition and AC from S0 (G6)", async () => {
    const { projections, seed } = greyhollowFight();
    const p = clone(projections);
    const goblin = p.engine.combatants["goblin-2"];
    if (!goblin) throw new Error("fixture lacks goblin-2");
    goblin.conditions = [condition("f1", "frightened")];
    const ctx = makeCtx({
      seed,
      deps: { loadProjections: async () => p },
    });
    const assembled = await assemble(ctx);
    if (!assembled.ok) throw new Error("assemble failed");
    const { interpret } = {
      interpret: buildInterpretPrompt({
        ctx,
        assembled: assembled.output,
        director,
      }),
    };
    const line = interpret.user
      .split("\n")
      .find((l) => l.startsWith('goblin-2 "'));
    expect(line).toContain("AC 15");
    expect(line).toContain("frightened");
    const adj = buildAdjudicatePrompt({
      seed,
      assembled: assembled.output,
      reading: InterpretOutput.parse(EXAMPLE_OUTPUT).readings[0] as never,
      actionText: "x",
      passages: [],
    });
    expect(adj.user).toContain("frightened");
  });

  it("the interpret system prompt holds every rules-term key", async () => {
    const { interpret } = await prompts();
    for (const key of [
      ...CONDITION_KEYS,
      ...SKILL_KEYS,
      ...DamageTypeSchema.options,
    ]) {
      expect(interpret.system).toContain(key);
    }
    expect(interpret.system).toContain(NARRATIVE);
    expect(interpret.system).toContain("no prose, no code fence");
  });

  it("the adjudicate system prompt holds the three lists", async () => {
    const { adjudicate } = await prompts();
    for (const key of [
      ...CONDITION_KEYS,
      ...SKILL_KEYS,
      ...DamageTypeSchema.options,
    ]) {
      expect(adjudicate.system).toContain(key);
    }
    expect(adjudicate.system).toContain(NARRATIVE);
  });

  it("InterpretOutput parses a reading with and without say (specs/081)", () => {
    const base = EXAMPLE_OUTPUT.readings[0];
    const withSay = InterpretOutput.parse({
      readings: [{ ...base, say: "Two more hide left of the fire!" }],
    });
    expect(withSay.readings[0]?.say).toBe("Two more hide left of the fire!");
    const { say: _say, ...bare } = base;
    expect(
      InterpretOutput.parse({ readings: [bare] }).readings[0]?.say,
    ).toBeUndefined();
    expect(
      InterpretOutput.safeParse({ readings: [{ ...base, say: "" }] }).success,
    ).toBe(false);
  });

  it("the interpret system prompt holds the first-stage rule", async () => {
    const { interpret } = await prompts();
    expect(interpret.system).toContain("plan only the first stage");
    expect(interpret.system).toContain("followUps");
  });

  it("holds the agency rule and labels the goal note as pacing advice", async () => {
    const ctx = makeCtx({
      deps: {
        loadProjections: async () =>
          projectDm(freeEventsThrough("action.committed")),
      },
    });
    const assembled = await assemble(ctx);
    if (!assembled.ok) throw new Error("assemble failed");
    const p = buildInterpretPrompt({
      ctx,
      assembled: assembled.output,
      director: {
        ...director,
        goalNote: "Approach beat: call Stealth (Kestrel leads, +5)",
      },
    });
    expect(p.system).toContain(agencyRule("interpret"));
    expect(p.user).toContain(
      "pacing advice only; it never adds a step, a method or a skill",
    );
    expect(p.user).toContain("Approach beat: call Stealth");
  });

  it("tells interpret to plan a move step and no reaction attack (spec 079 D6)", () => {
    expect(OUTPUT_SHAPE).toContain(
      "plan a move step for it that lists that hostile in leavesReachOf. Plan no attack for the hostile: the engine decides any reaction.",
    );
  });

  it("the example object parses under InterpretOutput", () => {
    expect(InterpretOutput.safeParse(EXAMPLE_OUTPUT).success).toBe(true);
  });

  it("carries the stakes rules and a stakes example (spec 070)", () => {
    expect(OUTPUT_SHAPE).toContain("Write the stakes of every check");
    expect(OUTPUT_SHAPE).toContain('"stakes":{"success"');
    expect(STEP_GRAMMAR).toContain('"stakes":{"success"');
    expect(STEP_GRAMMAR).toContain("newRisk");
  });

  it("lists the current beat's clues without a DC (spec 080)", async () => {
    const seed = JSON.parse(
      readFileSync(
        new URL("../../seeds/greyhollow-ford-duo.json", import.meta.url),
        "utf8",
      ),
    );
    const ctx = makeCtx({
      seed,
      deps: {
        loadProjections: async () =>
          projectDm(freeEventsThrough("action.committed")),
      },
    });
    const assembled = await assemble(ctx);
    if (!assembled.ok) throw new Error("assemble failed");
    const build = (beatId: string | null) =>
      buildInterpretPrompt({
        ctx,
        assembled: assembled.output,
        director: { ...director, pacing: { ...director.pacing, beatId } },
      });
    const text = build("ferry-house").user;
    const lines = text.split("\n").filter((l) => /^ferry-house#[1-3]:/.test(l));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("goblin feet");
    expect(lines.join("\n")).not.toMatch(/DC|\b1[0-9]\b/);
    expect(text).not.toContain("the-keeper#");
    expect(build(null).user).not.toMatch(/^[a-z0-9-]+#\d:/m);
    expect(OUTPUT_SHAPE).toContain("set reveals to that clue");
  });

  it("renders the tier list and the derivation rule, with no number field (spec 082)", () => {
    expect(STEP_GRAMMAR).toContain("medium (DC 15)");
    expect(STEP_GRAMMAR).toContain("nearly-impossible (DC 30)");
    expect(STEP_GRAMMAR).toContain("The engine derives every modifier, DC, AC");
    const lines = STEP_GRAMMAR.split("\n").filter(
      (l) =>
        l.startsWith('{"step":"check"') || l.startsWith('{"step":"attack"'),
    );
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l).not.toMatch(/"dc"|targetAc|1d20/);
  });

  it("matches the step grammar and output shape snapshot", () => {
    expect(`${STEP_GRAMMAR}\n\n${OUTPUT_SHAPE}`).toMatchInlineSnapshot(`
      "A step states mechanics INPUTS as data. Allowed steps:
      {"step":"none","reason":str}  (certain outcome; no roll)
      {"step":"check","reason":str,"combatantId":id|null,"kind":"ability-check"|"saving-throw","ability":"str"|"dex"|"con"|"int"|"wis"|"cha","skill":skill key|null,"difficulty":difficulty tier,"circumstance":{"mode":"advantage"|"disadvantage","reason":str}|null,"autoFail":{"reason":str}|null,"onSuccess":[effect],"onFailure":[effect],"stakes":{"success":str,"cost":str|null,"failure":str,"severe":str|null},"onCost":[effect],"onSevere":[effect],"newRisk":str|null,"reveals":clue ref|null}
      A check's stakes are declared before the dice. stakes.success: what happens when the attempt succeeds, written as the concrete outcome of this attempt; always written. reveals: the reference of one listed discoverable clue that a success shows, else null. stakes.cost: what happens on success at a cost, a miss by 1 or 2 (the goal is met, with a price). stakes.failure: what a plain failure costs; always written. stakes.severe: what happens on a severe failure, a miss by 5 or more. An ability check needs cost and severe; a saving throw sets them null. onCost and onSevere hold the effects of those bands. newRisk is a new danger that makes a repeat attempt a fresh roll; null otherwise.
      {"step":"attack","reason":str,"attackerId":id,"targetId":id,"attack":attack name,"circumstance":{"mode":"advantage"|"disadvantage","reason":str}|null,"onHit":[effect]}  (onHit holds conditions, healing or presence, never damage: the engine applies the attack's own damage on a hit)
      Difficulty tiers (the only allowed values of "difficulty"): very-easy (DC 5), easy (DC 10), medium (DC 15), hard (DC 20), very-hard (DC 25), nearly-impossible (DC 30)
      {"step":"effect","reason":str,"effects":[effect]}
      {"step":"roll","reason":str,"expression":"1d6","mode":roll mode}
      {"step":"move","reason":str,"combatantId":id,"leavesReachOf":[id]}  (the mover moves; list each hostile it stands next to and moves away from without Disengage)
      An effect is one of:
      {"effect":"damage","targetId":id,"components":[{"amount":Amount,"damageType":damage type}],"defenses":{"resistances":[],"vulnerabilities":[],"immunities":[]}|null}
      {"effect":"heal","targetId":id,"amount":Amount}
      {"effect":"condition","op":"apply"|"remove","targetId":id,"condition":condition key,"source":str}
      {"effect":"presence","targetId":id,"reason":presence reason}
      Amount is {"kind":"roll","expression":"1d8+3"} or {"kind":"fixed","value":int}; use fixed only where the SRD names a fixed value.
      Name the ability, skill, difficulty and attack only. The engine derives every modifier, DC, AC and damage from the combatant's stats, and advantage or disadvantage from conditions. Add a circumstance only for a source no condition states. Never state a total, an applied amount or whether anything succeeds: the engine rolls and decides every number.
      Conditions (the only allowed values of "condition"): blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious
      Presence reasons (the only allowed values of "reason" in a presence effect): arrived, left, fled, removed, surrendered, conceded
      A presence effect states that an actor arrived, left, fled, was removed, surrendered or conceded. Put another actor's presence change in onSuccess, onFailure or onHit of a roll against that actor. The acting actor's own presence change may stand in an effect step.
      Skills (the only allowed values of "skill", or null): acrobatics, animal-handling, arcana, athletics, deception, history, insight, intimidation, investigation, medicine, nature, perception, performance, persuasion, religion, sleight-of-hand, stealth, survival
      Damage types (the only allowed values of "damageType"): acid, bludgeoning, cold, fire, force, lightning, necrotic, piercing, poison, psychic, radiant, slashing, thunder
      A condition effect may use only a listed condition. A narrative outcome such as spotting, learning or noticing something is narration, not an effect: leave onSuccess empty; write what is learned in stakes.success and name the clue in reveals.

      Reply with one JSON object, no prose, no code fence.
      {"readings":[{"actionId":id|null,"intent":"talk"|"move"|"check"|"save"|"attack"|"spell"|"help"|"rest"|"other","uncertain":bool,"needsAdjudication":bool,"rulesQuestion":str|null,"clarify":str|null,"followUps":[str],"say":str|null,"steps":[step]}]}
      Write exactly one reading per beat item, keyed by its actionId. Write one reading with actionId null for a monster turn. Roll only when the outcome is uncertain and failure is interesting; for a certain outcome use a none step. Set needsAdjudication true, with a rulesQuestion, when the rules are unclear or the action is inventive; then leave steps empty. When intent is unclear, set clarify to one short question and leave steps empty. Plan only the steps that are not already applied (see Already applied). When a post holds a plan, an approach and later steps, plan only the first stage: the move or approach, with a check for anyone moving hidden or over hard ground. List each later step that depends on it in followUps, one short sentence each, and plan no step for it. When a party member moves away from a hostile it stands next to, without Disengage, plan a move step for it that lists that hostile in leavesReachOf. Plan no attack for the hostile: the engine decides any reaction.
      On a monster turn, put the words the monster speaks this beat in say: one short line, at most 200 characters, no quote marks. Otherwise set say null. Never put speech in followUps. Write each reason as what the actor does, with no rules note such as whether a roll is needed.
      Write the stakes of every check before the dice: one short consequence per outcome band. Write failure as something that happens. When failure would cost nothing, use a none step instead of a check. Write cost as a price the player pays while still getting the goal, and severe as a worse turn, not only a missed goal. Write no stakes text that tells the player's character what they think or do. Write stakes.success as the concrete outcome of this attempt: what happens to the task and the world when the roll succeeds, so a success always delivers what the player declared. When a success would show one listed discoverable clue, name the thing found in stakes.success and set reveals to that clue's reference, such as ford-crossing#1; otherwise set reveals null. Set newRisk only when a failed attempt has changed the situation so that a repeat is dangerous.
      Keep every field short. Write one sentence per reason, at most 500 characters. Write rulesQuestion at most 500 characters. Write clarify as one short question, at most 200 characters. Write at most 6 steps per reading and at most 4 effects per list. Write source at most 100 characters and expression at most 200 characters.
      Example of one complete reading:
      {"readings":[{"actionId":"act-1","intent":"check","uncertain":true,"needsAdjudication":false,"rulesQuestion":null,"clarify":null,"followUps":[],"say":null,"steps":[{"step":"check","reason":"Ana searches the ford for tracks.","combatantId":"pc-ana","kind":"ability-check","ability":"wis","skill":"survival","difficulty":"medium","circumstance":null,"autoFail":null,"onSuccess":[],"onFailure":[],"stakes":{"success":"She finds fresh tracks leading north: three goblins passed here.","cost":"She finds the tracks, but the cold ford soaks her boots.","failure":"The trail goes cold and the light fades.","severe":"She loses the trail and wanders into the reeds, noisily."},"onCost":[],"onSevere":[],"newRisk":null,"reveals":"ford-crossing#1"}]}]}"
    `);
  });

  it("an answer turn's prompt holds the declaration and the question under Recent transcript", async () => {
    const q = "Longsword in melee, or the light crossbow at range?";
    const base = freeEventsThrough("action.committed");
    const seq = (n: number) => base.length + n;
    const events = [
      ...base,
      row(seq(1), "ai:dm", "narration", {
        text: `Pell watches you. ${q}`,
        actionIds: [],
      }),
      declare(seq(2), "act-answer", "tamsin", "I swing my longsword at Pell."),
      commit(seq(3), "act-answer"),
    ];
    const ctx = makeCtx({
      deps: { loadProjections: async () => projectDm(events) },
    });
    const assembled = await assemble(ctx);
    if (!assembled.ok) throw new Error("assemble failed");
    const { user } = buildInterpretPrompt({
      ctx,
      assembled: assembled.output,
      director,
    });
    const at = user.indexOf("Recent transcript");
    expect(at).toBeGreaterThanOrEqual(0);
    const tail = user.slice(at);
    expect(tail).toContain(`narration: Pell watches you. ${q}`);
    expect(tail).toContain("I swing my longsword at Pell.");
  });
});
