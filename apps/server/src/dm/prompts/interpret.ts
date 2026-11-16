/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import { DamageTypeSchema } from "@the-stacks/dnd5e-engine";
import { PresenceReasonSchema } from "@the-stacks/session-model";
import { agencyRule, renderDoctrine } from "../doctrine/doctrine.js";
import { arrivingMonsters } from "../gates/plan-gate.js";
import type { AssembleOutput } from "../nodes/assemble.js";
import type { DirectorNodeOutput } from "../nodes/director.js";
import { CONDITION_KEYS, SKILL_KEYS } from "../nodes/schemas.js";
import type { TurnContext } from "../pipeline/context.js";
import {
  beatEntries,
  CAPS,
  capEntries,
  clueEntries,
  dmStateSection,
  joinSections,
  seatsOf,
  section,
  seedEntries,
  srdEntries,
  transcriptEntries,
} from "./common.js";

export const PROMPT_VERSION = "dm.interpret-v19";

/** One complete minimal reading: a `search` stage with beside data. */
export const EXAMPLE_OUTPUT = {
  readings: [
    {
      actionId: "act-1",
      clarify: null,
      followUps: [],
      say: null,
      stages: [
        {
          intent: {
            kind: "search",
            targets: [{ kind: "zone", id: "ford" }],
            params: { skill: "perception" },
            text: "Ana searches the ford for tracks.",
          },
          beside: {
            stakes: {
              success:
                "She finds fresh tracks leading north: three goblins passed here.",
              cost: "She finds the tracks, but the cold ford soaks her boots.",
              failure: "The trail goes cold and the light fades.",
              severe:
                "She loses the trail and wanders into the reeds, noisily.",
            },
            onSuccess: [],
            onFailure: [],
            onCost: [],
            onSevere: [],
            newRisk: null,
            reveals: "ford-crossing#1",
            autoFail: null,
          },
        },
      ],
    },
  ],
};

/** The Intent body grammar (plan D4): one line per kind, targets and params. */
export const INTENT_GRAMMAR = [
  "Intent grammar. Each stage is {intent:{kind,targets,params,text?},beside}. You write no id, actor, source, commit or DC: the engine and the server supply them. The actor is the beat item's own character.",
  'Target refs: {kind:"actor",id} for a party member (their character id) or an NPC or monster (its seed id); {kind:"entity",id} for a scene object; {kind:"zone",id} for a place; {kind:"item",id}.',
  "Kinds:",
  '- attempt: any action no other kind fits. targets 0-4 refs; params {scope:"character"|"party"}; text required, the declaration in one sentence.',
  "- check: an ability check. targets 0-1 (actor, entity or zone); params {skill?,ability?,mode?}, at least one of skill or ability. Never a dc.",
  "- save: a saving throw. targets none; params {ability,mode?}.",
  "- contest: an opposed check. targets 1 actor; params {skill?,ability?,opposed?,mode?}.",
  "- attack: a weapon attack. targets 1 (actor or entity); params {weapon:\"unarmed\"|the attack's name from the attacker's list,mode?}.",
  "- cast: a spell. targets 0-12 (actors, or one zone); params {spell:slug,slot?,mode?}.",
  '- help: the Help action. targets 1 actor; params {assist:{kind:"check",skill}|{kind:"attack"}}.',
  "- hide, dash, dodge, disengage, stand, drop_prone: no targets; params {}.",
  '- search: targets 0-1 (zone or entity); params {skill:"perception"|"investigation"}.',
  '- grapple: targets 1 actor; params {}. shove: targets 1 actor; params {effect:"prone"|"push"}.',
  "- use_object: targets 1 entity; params {}.",
  "- move: targets 1 zone to go to; params {}.",
  "Write one stage for each thing the actor does, in the order they do it, at most 6 stages. Plan only stages that are not already applied (see Already applied).",
  "An effect (in a beside list) is one of:",
  '{"effect":"damage","targetId":id,"components":[{"amount":Amount,"damageType":damage type}],"defenses":{"resistances":[],"vulnerabilities":[],"immunities":[]}|null}',
  '{"effect":"heal","targetId":id,"amount":Amount}',
  '{"effect":"condition","op":"apply"|"remove","targetId":id,"condition":condition key,"source":str}',
  '{"effect":"presence","targetId":id,"reason":presence reason}',
  'Amount is {"kind":"roll","expression":"1d8+3"} or {"kind":"fixed","value":int}; use fixed only where the SRD names a fixed value.',
  `Conditions (the only allowed values of "condition"): ${CONDITION_KEYS.join(", ")}`,
  `Presence reasons (the only allowed values of "reason" in a presence effect): ${PresenceReasonSchema.options.join(", ")}`,
  `Skills (the only allowed values of "skill"): ${SKILL_KEYS.join(", ")}`,
  `Damage types (the only allowed values of "damageType"): ${DamageTypeSchema.options.join(", ")}`,
  "A condition effect may use only a listed condition. A narrative outcome such as spotting, learning or noticing something is narration, not an effect: leave onSuccess empty; write what is learned in stakes.success and name the clue in reveals. Name the ability, skill and attack only: the engine derives every modifier, DC, AC and damage, and decides every number.",
  "Beside rules: put `beside` only on a check, save, contest, search or hide stage; set `beside` null on every other stage. A stage that is certain to succeed or fail with nothing at stake gets no check: use an attempt or no stage.",
].join("\n");

export const OUTPUT_SHAPE = [
  "Reply with one JSON object, no prose, no code fence.",
  '{"readings":[{"actionId":id|null,"clarify":str|null,"followUps":[str],"say":str|null,"stages":[{"intent":{"kind":str,"targets":[ref],"params":{},"text":str?},"beside":{"stakes":{"success":str,"cost":str|null,"failure":str,"severe":str|null},"onSuccess":[effect],"onFailure":[effect],"onCost":[effect],"onSevere":[effect],"newRisk":str|null,"reveals":str|null,"autoFail":{"reason":str}|null}|null}]}]}',
  "Write exactly one reading per beat item, keyed by its actionId. When intent is unclear, set clarify to one short question and leave stages empty. When a post holds a plan, an approach and later stages, write only the first stage: the move or approach, with a check for anyone moving hidden or over hard ground. List each later stage that depends on it in followUps, one short sentence each, and write no stage for it. When a party member moves away from a hostile it stands next to, write a move stage for it and no attack for the hostile: the engine decides any reaction. When a character helps another, write one help stage for the helper and no check for the ally.",
  "Set say null. Never put speech in followUps. Write each text as what the actor does, with no rules note such as whether a roll is needed.",
  "Write the stakes of every beside block before the dice: one short consequence per outcome band. Write failure as something that happens. Write cost as a price the player pays while still getting the goal, and severe as a worse turn, not only a missed goal. Write no stakes text that tells the player's character what they think or do. Write stakes.success as the concrete outcome of this attempt: what happens to the task and the world when the roll succeeds, so a success always delivers what the player declared. When a success would show one listed discoverable clue, name the thing found in stakes.success and set reveals to that clue's reference, such as ford-crossing#1; otherwise set reveals null. Set newRisk only when a failed attempt has changed the situation so that a repeat is dangerous.",
  "Keep every field short. Write at most 6 stages per reading and at most 4 effects per list. Write source at most 100 characters and expression at most 200 characters. An ability check writes `stakes.cost` and `stakes.severe` as text, never null; only a saving throw sets them null.",
  `Example of one complete reading:\n${JSON.stringify(EXAMPLE_OUTPUT)}`,
].join("\n");

export function buildInterpretPrompt(input: {
  ctx: TurnContext;
  assembled: AssembleOutput;
  director: DirectorNodeOutput;
  /** Action ids the node parsed itself (slash text); they never reach the model. */
  skip?: ReadonlySet<string>;
}): { system: string; user: string } {
  const { ctx, assembled, director } = input;
  const skip = input.skip ?? new Set<string>();
  const seats = seatsOf(assembled.projections.party);
  const doctrine = capEntries(
    renderDoctrine("interpret").split("\n\n"),
    CAPS.doctrine,
    "end",
  ).join("\n\n");
  const system = [
    "You are the rules reader of a tabletop role-playing pipeline. You turn each declared action into Intents. You never decide a result.",
    agencyRule("interpret"),
    "Doctrine:",
    doctrine,
    INTENT_GRAMMAR,
    OUTPUT_SHAPE,
  ].join("\n\n");

  // Resumed items keep their earlier plan; the prompt carries fresh items only.
  const resumedIds = new Set((assembled.resumed ?? []).map((r) => r.actionId));
  const freshBeat = assembled.beat.filter(
    (b) => !resumedIds.has(b.actionId) && !skip.has(b.actionId),
  );
  const applied = Object.entries(assembled.priorSteps)
    .filter(([actionId]) => !resumedIds.has(actionId))
    .map(
      ([actionId, rows]) =>
        `${actionId}: ${rows.length} ledger rows already applied (${rows
          .map((r) => r.reason)
          .slice(0, 4)
          .join(" | ")})`,
    );
  const user = joinSections([
    section("Scene seed", seedEntries(ctx.seed, assembled), CAPS.seed, "end"),
    section(
      "Discoverable clues",
      clueEntries(ctx.seed, director.pacing.beatId),
      1200,
      "end",
    ),
    dmStateSection(assembled.snapshot, ctx.seed, false),
    section(
      "Arriving this beat",
      arrivingMonsters(
        ctx.seed,
        assembled.projections,
        director,
        ctx.job.trigger,
      ).map(
        (m) =>
          `${m.id} "${m.name}" (monster; joins the scene before any stage runs; name it by this id)`,
      ),
      300,
      "end",
    ),
    section(
      "Recent transcript",
      transcriptEntries(assembled.transcriptTail, undefined, seats),
      CAPS.transcript,
      "start",
    ),
    section(
      "SRD records",
      srdEntries(assembled),
      CAPS.srdRecords * CAPS.srdPerRecord,
      "end",
    ),
    `Pacing: ${director.pacing.tension}. Director's note (pacing advice only; it never adds a step, a method or a skill): ${director.goalNote}`,
    section("Beat items", beatEntries(freshBeat, seats), 800, "end"),
    section("Already applied", applied, 400, "end"),
  ]);
  return { system, user };
}
