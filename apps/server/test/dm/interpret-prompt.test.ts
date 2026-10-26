import { DamageTypeSchema } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
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
import { freeEventsThrough, makeCtx, projectDm } from "./helpers.js";

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
    expect(INTERPRET_VERSION).toBe("dm.interpret-v2");
    expect(ADJUDICATE_VERSION).toBe("dm.adjudicate-v2");
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
      Amount is {"kind":"roll","expression":"1d8+3"} or {"kind":"fixed","value":int}; use fixed only where the SRD names a fixed value.
      The expression carries the modifier you choose (ability modifier, proficiency, bonus dice). Never state a total, an applied amount or whether anything succeeds: the engine rolls and decides every number.
      Conditions (the only allowed values of "condition"): blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious
      Skills (the only allowed values of "skill", or null): acrobatics, animal-handling, arcana, athletics, deception, history, insight, intimidation, investigation, medicine, nature, perception, performance, persuasion, religion, sleight-of-hand, stealth, survival
      Damage types (the only allowed values of "damageType"): acid, bludgeoning, cold, fire, force, lightning, necrotic, piercing, poison, psychic, radiant, slashing, thunder
      A condition effect may use only a listed condition. A narrative outcome such as spotting, learning or noticing something is narration, not an effect: leave onSuccess empty.

      Reply with one JSON object, no prose, no code fence.
      {"readings":[{"actionId":id|null,"intent":"talk"|"move"|"check"|"save"|"attack"|"spell"|"help"|"rest"|"other","uncertain":bool,"needsAdjudication":bool,"rulesQuestion":str|null,"clarify":str|null,"steps":[step]}]}
      Write exactly one reading per beat item, keyed by its actionId. Write one reading with actionId null for a monster turn. Roll only when the outcome is uncertain and failure is interesting; for a certain outcome use a none step. Set needsAdjudication true, with a rulesQuestion, when the rules are unclear or the action is inventive; then leave steps empty. When intent is unclear, set clarify to one short question and leave steps empty. Plan only the steps that are not already applied (see Already applied).
      Keep every field short. Write one sentence per reason, at most 500 characters. Write rulesQuestion at most 500 characters. Write clarify as one short question, at most 200 characters. Write at most 6 steps per reading and at most 4 effects per list. Write source at most 100 characters and expression at most 200 characters.
      Example of one complete reading:
      {"readings":[{"actionId":"act-1","intent":"check","uncertain":true,"needsAdjudication":false,"rulesQuestion":null,"clarify":null,"steps":[{"step":"check","reason":"Ana searches the ford for tracks.","combatantId":"pc-ana","kind":"ability-check","ability":"wis","skill":"survival","expression":"1d20+3","mode":"normal","dc":12,"autoFail":null,"onSuccess":[],"onFailure":[]}]}]}"
    `);
  });
});
