/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import type { SessionProjections } from "@the-stacks/session-model";
import { renderDoctrine } from "../doctrine/doctrine.js";
import type { PlayerSeedView } from "../seed/views.js";
import {
  CAPS,
  capEntries,
  joinSections,
  projectionEntries,
  rosterOf,
  section,
  transcriptEntries,
} from "./common.js";

export const PROMPT_VERSION = "dm.companion-v3";

const OUTPUT_SHAPE = [
  "Reply with ONE JSON object and nothing else:",
  '{"say":str (400 characters at most)|null,',
  ' "comment":{"actionId":id of an open action,"stance":"approve"|"object"|"comment","text":str}|null,',
  ' "act":{"text":str (what you attempt, 400 characters at most),"commit":bool}|null,',
  ' "pending":[{"actionId":id of one of YOUR open actions,"decision":"commit","text":null}]}',
  "pending holds one entry for each of your own open actions, up to 4. Decision commit puts the action to the table as declared. Leave pending empty when you have no open action. Do not declare a new act while you have an open action.",
].join("\n");

const SYSTEM = [
  "You play one AI companion in a tabletop role-playing party. You speak and act only for your own character. You never speak or act for a human player's character. You never state a dice result, a total or whether anything succeeds: the engine rolls and decides.",
  "Hold about one unprompted opinion per scene, and sometimes disagree with the party. Keep what you say short and in your voice.",
  "Doctrine:",
  "{{DOCTRINE}}",
  OUTPUT_SHAPE,
].join("\n\n");

export interface CompanionPromptInput {
  seed: PlayerSeedView;
  projections: SessionProjections;
  characterId: string;
  active: boolean;
  /** Ids of the companion's own open actions; they get their own section. */
  ownOpenActionIds?: string[];
}

export function buildCompanionPrompt(input: CompanionPromptInput): {
  system: string;
  user: string;
} {
  const { seed, projections, characterId, active } = input;
  const doctrine = capEntries(
    renderDoctrine("companion").split("\n\n"),
    CAPS.doctrine,
    "end",
  ).join("\n\n");
  const system = SYSTEM.replace("{{DOCTRINE}}", doctrine);

  const sheet = seed.characters.find((c) => c.characterId === characterId);
  const portrayal = sheet
    ? [
        `You are ${sheet.name} (${characterId}).`,
        `Voice: ${sheet.portrayal.voice}`,
        `Want: ${sheet.portrayal.want}`,
        `Detail: ${sheet.portrayal.detail}`,
        `Knows: ${sheet.knows.join(" ")}`,
        `Relationships: ${sheet.relationships.map((r) => `${r.to} (${r.kind})`).join(", ")}`,
      ]
    : [`You are ${characterId}.`];

  const scene = projections.scene
    ? [
        `${projections.scene.title}${projections.scene.location ? ` at ${projections.scene.location}` : ""}: ${projections.scene.summary}`,
      ]
    : [];
  const committed = projections.actions
    .filter((a) => a.status === "committed")
    .map((a) => `${a.actionId} by ${a.characterId ?? a.actor}: ${a.text}`);
  const ownIds = new Set(input.ownOpenActionIds ?? []);
  const openActions = projections.actions.filter(
    (a) => a.status === "declared" || a.status === "discussed",
  );
  const own = openActions
    .filter((a) => ownIds.has(a.actionId))
    .map((a) =>
      [
        `${a.actionId}: ${a.text}`,
        ...a.comments.map(
          (c) => `  ${c.actor} (${c.stance}, seq ${c.seq}): ${c.text}`,
        ),
      ].join("\n"),
    );
  const open = openActions
    .filter((a) => !ownIds.has(a.actionId))
    .map((a) => `${a.actionId} by ${a.characterId ?? a.actor}: ${a.text}`);

  const user = joinSections([
    section("Your character", portrayal, 600, "end"),
    section("Scene", scene, 400, "end"),
    section(
      "State",
      projectionEntries(projections, seed, false),
      CAPS.projections,
      "end",
    ),
    section(
      "Recent transcript",
      transcriptEntries(
        projections.transcript.slice(-CAPS.transcriptEntries),
        rosterOf(projections.party),
      ),
      CAPS.transcript,
      "start",
    ),
    section("Your open actions (decide each one in pending)", own, 600, "end"),
    section("Other open actions you may comment on", open, 400, "end"),
    section("Committed actions this beat", committed, 400, "end"),
    active
      ? "It is YOUR turn. You must act: set act with commit true."
      : "It is not your turn. You may speak, comment or declare; every field may be null.",
  ]);
  return { system, user };
}
