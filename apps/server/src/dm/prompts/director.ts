/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import { agencyRule, renderDoctrine } from "../doctrine/doctrine.js";
import type { AssembleOutput } from "../nodes/assemble.js";
import type { TurnContext } from "../pipeline/context.js";
import {
  beatEntries,
  CAPS,
  capEntries,
  dmStateSection,
  joinSections,
  section,
  seedEntries,
  srdEntries,
  transcriptEntries,
} from "./common.js";

export const PROMPT_VERSION = "dm.director-v7";

const OUTPUT_SHAPE = [
  "Reply with ONE JSON object and nothing else:",
  '{"beat":{"decision":"resolve"}|{"decision":"hold","companions":[characterId],"reason":str},',
  ' "tableMode":{"to":"stay"}|{"to":"turn","encounterId":id,"reason":str}|{"to":"free","reason":str},',
  ' "trackers":[{"trackerId":id,"advance":int -3..3 not 0,"reason":str}],',
  ' "scene":{"status":"continue"}|{"status":"end","outcome":"goal-met"|"retreat"|"failed","reason":str},',
  ' "pacing":{"tension":"low"|"rising"|"high","spotlight":characterId|null,"beatId":seed beat id|null},',
  ' "goalNote":str (a private pacing note for the narrator, 300 characters at most; it names no party member\'s act, method, skill or reaction its player did not declare; it states no count of the fallen or the remaining, no morale condition and no encounter trigger),',
  ' "companionPrompts":[characterId],',
  ' "arrivals":[seed NPC id of an offstage NPC now on screen]}',
].join("\n");

const SYSTEM = [
  "You are the Director of a tabletop role-playing session. You decide pacing and structure for the next beat. You never roll dice and never state a result: you run before any dice are rolled.",
  agencyRule("director"),
  "Hold a beat only to give an AI companion a chance to speak first; otherwise resolve. Move to turn mode only when a seed encounter's trigger has happened. Return to free mode when an encounter is over. End the scene only when the goal's success or failure condition is met or the party retreats. Advance a tracker only when its advance-when condition happened. Decide table mode and trackers from what each beat item's first stage does; a trigger that needs a roll this beat to succeed waits for the next beat. Name in arrivals each offstage NPC the recent transcript or the beat to resolve shows on screen: seen, heard or met. Never name one only mentioned or expected.",
  "Doctrine:",
  "{{DOCTRINE}}",
  OUTPUT_SHAPE,
].join("\n\n");

export interface DirectorPromptInput {
  ctx: TurnContext;
  assembled: AssembleOutput;
  aiCompanions: string[];
  runnableEncounterIds: string[];
  offstageNpcs: string[];
}

export function buildDirectorPrompt(input: DirectorPromptInput): {
  system: string;
  user: string;
} {
  const { ctx, assembled } = input;
  const doctrine = capEntries(
    renderDoctrine("director").split("\n\n"),
    CAPS.doctrine,
    "end",
  ).join("\n\n");
  const system = SYSTEM.replace("{{DOCTRINE}}", doctrine);

  const encounters = ctx.seed.encounters
    .filter((e) => input.runnableEncounterIds.includes(e.id))
    .map((e) => `Encounter ${e.id} (${e.name}): trigger ${e.trigger}`);
  const beats = ctx.seed.beats.map(
    (b) => `Seed beat ${b.id} [${b.kind}]: ${b.summary}`,
  );

  const user = joinSections([
    `Trigger: ${ctx.job.trigger}${ctx.job.forceResolve ? " (forced: do not hold)" : ""}`,
    section("Scene seed", seedEntries(ctx.seed, assembled), CAPS.seed, "end"),
    section("Seed beats", beats, CAPS.seed, "end"),
    section("Encounters you may start", encounters, 400, "end"),
    section("Offstage NPCs", input.offstageNpcs, 300, "end"),
    dmStateSection(assembled.snapshot, ctx.seed, true),
    section("AI companions in the party", input.aiCompanions, 200, "end"),
    section(
      "Recent transcript",
      transcriptEntries(assembled.transcriptTail),
      CAPS.transcript,
      "start",
    ),
    section("Beat to resolve", beatEntries(assembled.beat), 800, "end"),
    section(
      "SRD records",
      srdEntries(assembled),
      CAPS.srdRecords * CAPS.srdPerRecord,
      "end",
    ),
    assembled.npcTurn
      ? `A monster acts this turn: ${assembled.npcTurn.combatantId}.`
      : "",
  ]);
  return { system, user };
}
