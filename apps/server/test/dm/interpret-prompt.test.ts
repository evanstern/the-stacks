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
    expect(INTERPRET_VERSION).toBe("dm.interpret-v6");
    expect(ADJUDICATE_VERSION).toBe("dm.adjudicate-v4");
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

  it("the example object parses under InterpretOutput", () => {
    expect(InterpretOutput.safeParse(EXAMPLE_OUTPUT).success).toBe(true);
  });

  it("matches the step grammar and output shape snapshot", () => {
    expect(`${STEP_GRAMMAR}\n\n${OUTPUT_SHAPE}`).toMatchInlineSnapshot(`
      "A step states mechanics INPUTS as data. Allowed steps:
      {"step":"none","reason":str}  (certain outcome; no roll)
      {"step":"check","reason":str,"combatantId":id|null,"kind":"ability-check"|"saving-throw","ability":"str"|"dex"|"con"|"int"|"wis"|"cha","skill":skill key|null,"expression":"1d20+5","mode":"normal"|"advantage"|"disadvantage","dc":int,"autoFail":{"reason":str}|null,"onSuccess":[effect],"onFailure":[effect]}
      {"step":"attack","reason":str,"attackerId":id|null,"targetId":id,"expression":"1d20+5","mode":roll mode,"targetAc":int|null,"onHit":[effect]}
      {"step":"effect","reason":str,"effects":[effect]}
      {"step":"roll","reason":str,"expression":"1d6","mode":roll mode}
      An effect is one of:
      {"effect":"damage","targetId":id,"components":[{"amount":Amount,"damageType":damage type}],"defenses":{"resistances":[],"vulnerabilities":[],"immunities":[]}|null}
      {"effect":"heal","targetId":id,"amount":Amount}
      {"effect":"condition","op":"apply"|"remove","targetId":id,"condition":condition key,"source":str}
      {"effect":"presence","targetId":id,"reason":presence reason}
      Amount is {"kind":"roll","expression":"1d8+3"} or {"kind":"fixed","value":int}; use fixed only where the SRD names a fixed value.
      The expression carries the modifier you choose (ability modifier, proficiency, bonus dice). Never state a total, an applied amount or whether anything succeeds: the engine rolls and decides every number.
      Conditions (the only allowed values of "condition"): blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious
      Presence reasons (the only allowed values of "reason" in a presence effect): arrived, left, fled, removed, surrendered, conceded
      A presence effect states that an actor arrived, left, fled, was removed, surrendered or conceded. Put another actor's presence change in onSuccess, onFailure or onHit of a roll against that actor. The acting actor's own presence change may stand in an effect step.
      Skills (the only allowed values of "skill", or null): acrobatics, animal-handling, arcana, athletics, deception, history, insight, intimidation, investigation, medicine, nature, perception, performance, persuasion, religion, sleight-of-hand, stealth, survival
      Damage types (the only allowed values of "damageType"): acid, bludgeoning, cold, fire, force, lightning, necrotic, piercing, poison, psychic, radiant, slashing, thunder
      A condition effect may use only a listed condition. A narrative outcome such as spotting, learning or noticing something is narration, not an effect: leave onSuccess empty.

      Reply with one JSON object, no prose, no code fence.
      {"readings":[{"actionId":id|null,"intent":"talk"|"move"|"check"|"save"|"attack"|"spell"|"help"|"rest"|"other","uncertain":bool,"needsAdjudication":bool,"rulesQuestion":str|null,"clarify":str|null,"followUps":[str],"steps":[step]}]}
      Write exactly one reading per beat item, keyed by its actionId. Write one reading with actionId null for a monster turn. Roll only when the outcome is uncertain and failure is interesting; for a certain outcome use a none step. Set needsAdjudication true, with a rulesQuestion, when the rules are unclear or the action is inventive; then leave steps empty. When intent is unclear, set clarify to one short question and leave steps empty. Plan only the steps that are not already applied (see Already applied). When a post holds a plan, an approach and later steps, plan only the first stage: the move or approach, with a check for anyone moving hidden or over hard ground. List each later step that depends on it in followUps, one short sentence each, and plan no step for it.
      Keep every field short. Write one sentence per reason, at most 500 characters. Write rulesQuestion at most 500 characters. Write clarify as one short question, at most 200 characters. Write at most 6 steps per reading and at most 4 effects per list. Write source at most 100 characters and expression at most 200 characters.
      Example of one complete reading:
      {"readings":[{"actionId":"act-1","intent":"check","uncertain":true,"needsAdjudication":false,"rulesQuestion":null,"clarify":null,"followUps":[],"steps":[{"step":"check","reason":"Ana searches the ford for tracks.","combatantId":"pc-ana","kind":"ability-check","ability":"wis","skill":"survival","expression":"1d20+3","mode":"normal","dc":12,"autoFail":null,"onSuccess":[],"onFailure":[]}]}]}"
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
