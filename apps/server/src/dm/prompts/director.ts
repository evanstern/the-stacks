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
  seatsOf,
  section,
  seedEntries,
  srdEntries,
  transcriptEntries,
} from "./common.js";

export const PROMPT_VERSION = "dm.director-v12";

const OUTPUT_SHAPE = [
  "Reply with ONE JSON object and nothing else:",
  '{"beat":{"decision":"resolve"}|{"decision":"hold","companions":[characterId],"reason":str},',
  ' "tableMode":{"to":"stay"}|{"to":"turn","encounterId":id,"reason":str}|{"to":"free","reason":str},',
  ' "trackers":[{"trackerId":id,"advance":int -3..3 not 0,"reason":str}],',
  ' "scene":{"status":"continue"}|{"status":"end","outcome":"goal-met"|"retreat"|"failed","reason":str},',
  ' "pacing":{"tension":"low"|"rising"|"high","spotlight":characterId|null,"beatId":seed beat id|null},',
  ' "goalNote":str (a private pacing note for the narrator, 300 characters at most; it names no party member\'s act, method, skill or reaction its player did not declare; it states no count of the fallen or the remaining, no morale condition and no encounter trigger; it states no result a roll this beat could decide: no thing found, person reached or fact learned),',
  ' "companionPrompts":[characterId],',
  ' "arrivals":[id of an offstage NPC or an unseen encounter monster now on screen]}',
  "Write every top-level key. `goalNote` is its own top-level key, always written (an empty string when you have no note), never inside `pacing`.",
].join("\n");

const SYSTEM = [
  "You are the Director of a tabletop role-playing session. You decide pacing and structure for the next beat. You never roll dice and never state a result: you run before any dice are rolled.",
  agencyRule("director"),
  "Hold a beat only to give an AI companion a chance to speak first; otherwise resolve. Move to turn mode only when a seed encounter's trigger has happened. Return to free mode when an encounter is over. End the scene only when the goal's success or failure condition is met or the party retreats. Advance a tracker only when its advance-when condition happened. Decide table mode and trackers from what each beat item's first stage does; a trigger that needs a roll this beat to succeed waits for the next beat. Name in arrivals each offstage NPC or unseen encounter monster the recent transcript or the beat to resolve shows on screen: seen, heard or met. Never name one only mentioned or expected. Name an unseen monster in free mode; in turn mode name only a monster of the running fight that has not yet appeared. An encounter marked (resume) already ran: choose it when the fight breaks out again and a foe can still fight. When the beat to resolve is a search, a scan or a look that a roll decides, a reveal it would make is the roll's, not yours: code lands it only on a band that delivers it.",
  "Doctrine:",
  "{{DOCTRINE}}",
  OUTPUT_SHAPE,
].join("\n\n");

export interface DirectorPromptInput {
  ctx: TurnContext;
  assembled: AssembleOutput;
  aiCompanions: string[];
  /** Encounters the Director may start (spec 099: pending, or ended with a foe able to fight). */
  runnableEncounterIds: string[];
  /** The subset already run: starting one resumes the fight with fresh initiative. */
  resumeEncounterIds?: string[];
  offstageNpcs: string[];
  unseenMonsters: string[];
}

export function buildDirectorPrompt(input: DirectorPromptInput): {
  system: string;
  user: string;
} {
  const { ctx, assembled } = input;
  const seats = seatsOf(assembled.projections.party);
  const doctrine = capEntries(
    renderDoctrine("director").split("\n\n"),
    CAPS.doctrine,
    "end",
  ).join("\n\n");
  const system = SYSTEM.replace("{{DOCTRINE}}", doctrine);

  const encounters = ctx.seed.encounters
    .filter((e) => input.runnableEncounterIds.includes(e.id))
    .map(
      (e) =>
        `Encounter ${e.id} (${e.name})${input.resumeEncounterIds?.includes(e.id) ? " (resume)" : ""}: trigger ${e.trigger}`,
    );
  const beats = ctx.seed.beats.map(
    (b) => `Seed beat ${b.id} [${b.kind}]: ${b.summary}`,
  );

  const user = joinSections([
    `Trigger: ${ctx.job.trigger}${ctx.job.forceResolve ? " (forced: do not hold)" : ""}`,
    section("Scene seed", seedEntries(ctx.seed, assembled), CAPS.seed, "end"),
    section("Seed beats", beats, CAPS.seed, "end"),
    section("Encounters you may start", encounters, 400, "end"),
    section("Offstage NPCs", input.offstageNpcs, 300, "end"),
    section("Unseen encounter monsters", input.unseenMonsters, 300, "end"),
    dmStateSection(assembled.snapshot, ctx.seed, true),
    section("AI companions in the party", input.aiCompanions, 200, "end"),
    section(
      "Recent transcript",
      transcriptEntries(assembled.transcriptTail, undefined, seats),
      CAPS.transcript,
      "start",
    ),
    section("Beat to resolve", beatEntries(assembled.beat, seats), 800, "end"),
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
