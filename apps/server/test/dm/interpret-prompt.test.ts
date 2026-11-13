import { readFileSync } from "node:fs";
import { DamageTypeSchema } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import { agencyRule } from "../../src/dm/doctrine/doctrine.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import {
  CONDITION_KEYS,
  INTERPRET_KINDS,
  InterpretOutput,
  SKILL_KEYS,
} from "../../src/dm/nodes/schemas.js";
import {
  buildInterpretPrompt,
  EXAMPLE_OUTPUT,
  INTENT_GRAMMAR,
  PROMPT_VERSION as INTERPRET_VERSION,
  OUTPUT_SHAPE,
} from "../../src/dm/prompts/interpret.js";
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
  return { interpret };
}

const NARRATIVE =
  "A narrative outcome such as spotting, learning or noticing something is narration, not an effect";

describe("interpret prompt", () => {
  it("bumps the prompt versions", () => {
    expect(INTERPRET_VERSION).toBe("dm.interpret-v18");
  });

  it("lists arriving monsters, and only then (spec 088)", async () => {
    const { interpret } = await prompts();
    expect(interpret.user).not.toContain("Arriving this beat");
    const ctx = makeCtx({
      deps: {
        loadProjections: async () =>
          projectDm(freeEventsThrough("action.committed")),
      },
    });
    const assembled = await assemble(ctx);
    if (!assembled.ok) throw new Error("assemble failed");
    const arrival = buildInterpretPrompt({
      ctx,
      assembled: assembled.output,
      director: { ...director, arrivals: ["goblin-3"] },
    });
    expect(arrival.user).toContain("Arriving this beat");
    expect(arrival.user).toContain('goblin-3 "Goblin lookout" (monster;');
    const start = buildInterpretPrompt({
      ctx,
      assembled: assembled.output,
      director: {
        ...director,
        tableMode: { to: "turn", encounterId: "reed-camp", reason: "x" },
      },
    });
    expect(start.user).toContain('goblin-3 "Goblin lookout"');
  });

  it("states the attack name and the ability-check stakes (TASK-0203)", async () => {
    expect(INTENT_GRAMMAR).toContain(
      "the attack's name from the attacker's list",
    );
    expect(OUTPUT_SHAPE).toContain(
      "writes `stakes.cost` and `stakes.severe` as text, never null",
    );
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
    expect(interpret.system).toContain("write only the first stage");
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

  it("tells interpret to write a move stage and no reaction attack (spec 079 D6)", () => {
    expect(OUTPUT_SHAPE).toContain(
      "write a move stage for it and no attack for the hostile: the engine decides any reaction.",
    );
  });

  it("the example object parses under InterpretOutput and is a search stage with beside", () => {
    const parsed = InterpretOutput.safeParse(EXAMPLE_OUTPUT);
    expect(parsed.success).toBe(true);
    const stage = EXAMPLE_OUTPUT.readings[0]?.stages[0];
    expect(stage?.intent.kind).toBe("search");
    expect(stage?.beside?.reveals).toBe("ford-crossing#1");
  });

  it("carries the stakes rules and the beside shape (spec 070)", () => {
    expect(OUTPUT_SHAPE).toContain("Write the stakes of every beside block");
    expect(OUTPUT_SHAPE).toContain('"stakes":{"success"');
    expect(OUTPUT_SHAPE).toContain("set reveals to that clue");
    expect(INTENT_GRAMMAR).toContain("Beside rules");
  });

  it("describes every interpret kind and states the model writes no actor or DC", () => {
    for (const k of INTERPRET_KINDS) expect(INTENT_GRAMMAR).toContain(k);
    expect(INTENT_GRAMMAR).toContain(
      "You write no id, actor, source, commit or DC",
    );
    expect(INTENT_GRAMMAR).toContain("character id");
    expect(INTENT_GRAMMAR).toContain("seed id");
    expect(OUTPUT_SHAPE).toContain(
      "write one help stage for the helper and no check for the ally",
    );
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
  });

  it("matches the Intent grammar and output shape snapshot", () => {
    expect(`${INTENT_GRAMMAR}\n\n${OUTPUT_SHAPE}`).toMatchInlineSnapshot(`
      "Intent grammar. Each stage is {intent:{kind,targets,params,text?},beside}. You write no id, actor, source, commit or DC: the engine and the server supply them. The actor is the beat item's own character.
      Target refs: {kind:"actor",id} for a party member (their character id) or an NPC or monster (its seed id); {kind:"entity",id} for a scene object; {kind:"zone",id} for a place; {kind:"item",id}.
      Kinds:
      - attempt: any action no other kind fits. targets 0-4 refs; params {scope:"character"|"party"}; text required, the declaration in one sentence.
      - check: an ability check. targets 0-1 (actor, entity or zone); params {skill?,ability?,mode?}, at least one of skill or ability. Never a dc.
      - save: a saving throw. targets none; params {ability,mode?}.
      - contest: an opposed check. targets 1 actor; params {skill?,ability?,opposed?,mode?}.
      - attack: a weapon attack. targets 1 (actor or entity); params {weapon:"unarmed"|the attack's name from the attacker's list,mode?}.
      - cast: a spell. targets 0-12 (actors, or one zone); params {spell:slug,slot?,mode?}.
      - help: the Help action. targets 1 actor; params {assist:{kind:"check",skill}|{kind:"attack"}}.
      - hide, dash, dodge, disengage, stand, drop_prone: no targets; params {}.
      - search: targets 0-1 (zone or entity); params {skill:"perception"|"investigation"}.
      - grapple: targets 1 actor; params {}. shove: targets 1 actor; params {effect:"prone"|"push"}.
      - use_object: targets 1 entity; params {}.
      - move: targets 1 zone to go to; params {}.
      Write one stage for each thing the actor does, in the order they do it, at most 6 stages. Plan only stages that are not already applied (see Already applied).
      An effect (in a beside list) is one of:
      {"effect":"damage","targetId":id,"components":[{"amount":Amount,"damageType":damage type}],"defenses":{"resistances":[],"vulnerabilities":[],"immunities":[]}|null}
      {"effect":"heal","targetId":id,"amount":Amount}
      {"effect":"condition","op":"apply"|"remove","targetId":id,"condition":condition key,"source":str}
      {"effect":"presence","targetId":id,"reason":presence reason}
      Amount is {"kind":"roll","expression":"1d8+3"} or {"kind":"fixed","value":int}; use fixed only where the SRD names a fixed value.
      Conditions (the only allowed values of "condition"): blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious
      Presence reasons (the only allowed values of "reason" in a presence effect): arrived, left, fled, removed, surrendered, conceded
      Skills (the only allowed values of "skill"): acrobatics, animal-handling, arcana, athletics, deception, history, insight, intimidation, investigation, medicine, nature, perception, performance, persuasion, religion, sleight-of-hand, stealth, survival
      Damage types (the only allowed values of "damageType"): acid, bludgeoning, cold, fire, force, lightning, necrotic, piercing, poison, psychic, radiant, slashing, thunder
      A condition effect may use only a listed condition. A narrative outcome such as spotting, learning or noticing something is narration, not an effect: leave onSuccess empty; write what is learned in stakes.success and name the clue in reveals. Name the ability, skill and attack only: the engine derives every modifier, DC, AC and damage, and decides every number.
      Beside rules: put \`beside\` only on a check, save, contest, search or hide stage; set \`beside\` null on every other stage. A stage that is certain to succeed or fail with nothing at stake gets no check: use an attempt or no stage.

      Reply with one JSON object, no prose, no code fence.
      {"readings":[{"actionId":id|null,"clarify":str|null,"followUps":[str],"say":str|null,"stages":[{"intent":{"kind":str,"targets":[ref],"params":{},"text":str?},"beside":{"stakes":{"success":str,"cost":str|null,"failure":str,"severe":str|null},"onSuccess":[effect],"onFailure":[effect],"onCost":[effect],"onSevere":[effect],"newRisk":str|null,"reveals":str|null,"autoFail":{"reason":str}|null}|null}]}]}
      Write exactly one reading per beat item, keyed by its actionId. When intent is unclear, set clarify to one short question and leave stages empty. When a post holds a plan, an approach and later stages, write only the first stage: the move or approach, with a check for anyone moving hidden or over hard ground. List each later stage that depends on it in followUps, one short sentence each, and write no stage for it. When a party member moves away from a hostile it stands next to, write a move stage for it and no attack for the hostile: the engine decides any reaction. When a character helps another, write one help stage for the helper and no check for the ally.
      Set say null. Never put speech in followUps. Write each text as what the actor does, with no rules note such as whether a roll is needed.
      Write the stakes of every beside block before the dice: one short consequence per outcome band. Write failure as something that happens. Write cost as a price the player pays while still getting the goal, and severe as a worse turn, not only a missed goal. Write no stakes text that tells the player's character what they think or do. Write stakes.success as the concrete outcome of this attempt: what happens to the task and the world when the roll succeeds, so a success always delivers what the player declared. When a success would show one listed discoverable clue, name the thing found in stakes.success and set reveals to that clue's reference, such as ford-crossing#1; otherwise set reveals null. Set newRisk only when a failed attempt has changed the situation so that a repeat is dangerous.
      Keep every field short. Write at most 6 stages per reading and at most 4 effects per list. Write source at most 100 characters and expression at most 200 characters. An ability check writes \`stakes.cost\` and \`stakes.severe\` as text, never null; only a saving throw sets them null.
      Example of one complete reading:
      {"readings":[{"actionId":"act-1","clarify":null,"followUps":[],"say":null,"stages":[{"intent":{"kind":"search","targets":[{"kind":"zone","id":"ford"}],"params":{"skill":"perception"},"text":"Ana searches the ford for tracks."},"beside":{"stakes":{"success":"She finds fresh tracks leading north: three goblins passed here.","cost":"She finds the tracks, but the cold ford soaks her boots.","failure":"The trail goes cold and the light fades.","severe":"She loses the trail and wanders into the reeds, noisily."},"onSuccess":[],"onFailure":[],"onCost":[],"onSevere":[],"newRisk":null,"reveals":"ford-crossing#1","autoFail":null}}]}]}"
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
