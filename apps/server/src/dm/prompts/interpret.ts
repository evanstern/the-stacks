/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import { agencyRule, renderDoctrine } from "../doctrine/doctrine.js";
import type { AssembleOutput } from "../nodes/assemble.js";
import type { DirectorNodeOutput } from "../nodes/director.js";
import type { TurnContext } from "../pipeline/context.js";
import {
  beatEntries,
  CAPS,
  capEntries,
  clueEntries,
  dmStateSection,
  joinSections,
  section,
  seedEntries,
  srdEntries,
  transcriptEntries,
} from "./common.js";
import { STEP_GRAMMAR } from "./step-grammar.js";

export const PROMPT_VERSION = "dm.interpret-v12";

/** One complete minimal reading: a check step with empty effect lists. */
export const EXAMPLE_OUTPUT = {
  readings: [
    {
      actionId: "act-1",
      intent: "check",
      uncertain: true,
      needsAdjudication: false,
      rulesQuestion: null,
      clarify: null,
      followUps: [],
      say: null,
      steps: [
        {
          step: "check",
          reason: "Ana searches the ford for tracks.",
          combatantId: "pc-ana",
          kind: "ability-check",
          ability: "wis",
          skill: "survival",
          difficulty: "medium",
          circumstance: null,
          autoFail: null,
          onSuccess: [],
          onFailure: [],
          stakes: {
            success:
              "She finds fresh tracks leading north: three goblins passed here.",
            cost: "She finds the tracks, but the cold ford soaks her boots.",
            failure: "The trail goes cold and the light fades.",
            severe: "She loses the trail and wanders into the reeds, noisily.",
          },
          onCost: [],
          onSevere: [],
          newRisk: null,
          reveals: "ford-crossing#1",
        },
      ],
    },
  ],
};

export const OUTPUT_SHAPE = [
  "Reply with one JSON object, no prose, no code fence.",
  '{"readings":[{"actionId":id|null,"intent":"talk"|"move"|"check"|"save"|"attack"|"spell"|"help"|"rest"|"other","uncertain":bool,"needsAdjudication":bool,"rulesQuestion":str|null,"clarify":str|null,"followUps":[str],"say":str|null,"steps":[step]}]}',
  "Write exactly one reading per beat item, keyed by its actionId. Write one reading with actionId null for a monster turn. Roll only when the outcome is uncertain and failure is interesting; for a certain outcome use a none step. Set needsAdjudication true, with a rulesQuestion, when the rules are unclear or the action is inventive; then leave steps empty. When intent is unclear, set clarify to one short question and leave steps empty. Plan only the steps that are not already applied (see Already applied). When a post holds a plan, an approach and later steps, plan only the first stage: the move or approach, with a check for anyone moving hidden or over hard ground. List each later step that depends on it in followUps, one short sentence each, and plan no step for it. When a party member moves away from a hostile it stands next to, without Disengage, plan a move step for it that lists that hostile in leavesReachOf. Plan no attack for the hostile: the engine decides any reaction.",
  "On a monster turn, put the words the monster speaks this beat in say: one short line, at most 200 characters, no quote marks. Otherwise set say null. Never put speech in followUps. Write each reason as what the actor does, with no rules note such as whether a roll is needed.",
  "Write the stakes of every check before the dice: one short consequence per outcome band. Write failure as something that happens. When failure would cost nothing, use a none step instead of a check. Write cost as a price the player pays while still getting the goal, and severe as a worse turn, not only a missed goal. Write no stakes text that tells the player's character what they think or do. Write stakes.success as the concrete outcome of this attempt: what happens to the task and the world when the roll succeeds, so a success always delivers what the player declared. When a success would show one listed discoverable clue, name the thing found in stakes.success and set reveals to that clue's reference, such as ford-crossing#1; otherwise set reveals null. Set newRisk only when a failed attempt has changed the situation so that a repeat is dangerous.",
  "Keep every field short. Write one sentence per reason, at most 500 characters. Write rulesQuestion at most 500 characters. Write clarify as one short question, at most 200 characters. Write at most 6 steps per reading and at most 4 effects per list. Write source at most 100 characters and expression at most 200 characters.",
  `Example of one complete reading:\n${JSON.stringify(EXAMPLE_OUTPUT)}`,
].join("\n");

export function buildInterpretPrompt(input: {
  ctx: TurnContext;
  assembled: AssembleOutput;
  director: DirectorNodeOutput;
}): { system: string; user: string } {
  const { ctx, assembled, director } = input;
  const doctrine = capEntries(
    renderDoctrine("interpret").split("\n\n"),
    CAPS.doctrine,
    "end",
  ).join("\n\n");
  const system = [
    "You are the rules reader of a tabletop role-playing pipeline. You turn each declared action into mechanics inputs. You never decide a result.",
    agencyRule("interpret"),
    "Doctrine:",
    doctrine,
    STEP_GRAMMAR,
    OUTPUT_SHAPE,
  ].join("\n\n");

  // Resumed items keep their earlier plan; the prompt carries fresh items only.
  const resumedIds = new Set((assembled.resumed ?? []).map((r) => r.actionId));
  const freshBeat = assembled.beat.filter((b) => !resumedIds.has(b.actionId));
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
      "Recent transcript",
      transcriptEntries(assembled.transcriptTail),
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
    section("Beat items", beatEntries(freshBeat), 800, "end"),
    assembled.npcTurn
      ? `Monster turn: ${assembled.npcTurn.combatantId}${assembled.npcTurn.srdMonsterId ? ` (SRD ${assembled.npcTurn.srdMonsterId})` : ""}. Write one reading with actionId null.`
      : "",
    section("Already applied", applied, 400, "end"),
  ]);
  return { system, user };
}
