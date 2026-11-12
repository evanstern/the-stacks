/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import type { SessionProjections } from "@the-stacks/session-model";
import { renderDoctrine } from "../doctrine/doctrine.js";
import { COMPANION_TURN_KINDS } from "../nodes/schemas.js";
import type { PlayerSeedView } from "../seed/views.js";
import { type ActorSnapshot, snapshotSection } from "../snapshot/index.js";
import { codeTriggers } from "../talk-triggers.js";
import {
  CAPS,
  capEntries,
  dmActorLabel,
  joinSections,
  rosterOf,
  seatsOf,
  section,
  transcriptEntries,
} from "./common.js";
import { INTENT_GRAMMAR } from "./interpret.js";

export const PROMPT_VERSION = "dm.companion-v9";

/** The shared grammar lines for the kinds a companion may use (spec 107 D5). */
const TURN_GRAMMAR = INTENT_GRAMMAR.split("\n")
  .filter(
    (l) =>
      l.startsWith("Target refs:") ||
      COMPANION_TURN_KINDS.some((k) => l.startsWith(`- ${k}:`)) ||
      l.startsWith("- hide, dash"),
  )
  .join(" ");

const OUTPUT_SHAPE = [
  "Reply with ONE JSON object and nothing else:",
  '{"say":str (400 characters at most)|null,',
  ' "comment":{"actionId":id of an open action,"stance":"approve"|"object"|"comment","text":str}|null,',
  ' "act":{"text":str (what you attempt, 400 characters at most),"commit":bool}|null,',
  ' "turn":[Intent body] (your own turn only: one to three actions in order, each {"kind":str,"targets":[ref],"params":{},"text":str?})|null,',
  ' "pending":[{"actionId":id of one of YOUR open actions,"decision":"commit"|"withdraw"|"revise","text":str (400 characters at most, required for revise)|null}]}',
  "pending holds one entry for each of your own open actions, up to 4. Decision commit puts the action to the table as declared. Decision withdraw closes the action: use it when a player objected and you agree. Decision revise withdraws the action and declares a new one with your text in its place. Leave text null unless the decision is revise. Leave pending empty when you have no open action. Do not declare a new act while you have an open action.",
  `On your own turn, put what you do in turn, not act. Kinds allowed in turn: ${COMPANION_TURN_KINDS.join(", ")}. Write no id, actor, DC or number: the engine decides every roll. ${TURN_GRAMMAR}`,
  "Write all five keys every time. Set `comment`, `say` or `act` to null when you have none; never leave a key out.",
].join("\n");

const SYSTEM = [
  "You play one AI companion in a tabletop role-playing party. You speak and act only for your own character. You never speak or act for a human player's character. You never state a dice result, a total or whether anything succeeds: the engine rolls and decides.",
  "Hold about one unprompted opinion per scene, and sometimes disagree with the party. Keep what you say short and in your voice.",
  "Doctrine:",
  "{{DOCTRINE}}",
  OUTPUT_SHAPE,
].join("\n\n");

/**
 * The newest public talk or declared action from someone other than this
 * companion or the DM, with the speaker's character name and whom it addressed
 * (TASK-0189: run 3 seq 31, Odo answered the NPC instead of the PC who spoke).
 */
function triggeringPost(
  projections: SessionProjections,
  snapshot: ActorSnapshot,
  characterId: string,
): string[] {
  const roster = rosterOf(projections.party);
  const post = [...projections.transcript]
    .reverse()
    .find(
      (e) =>
        e.visibility === "public" &&
        (e.kind === "talk" || e.kind === "action.declared") &&
        e.actor !== "ai:dm" &&
        e.characterId !== characterId,
    );
  if (!post || (post.kind !== "talk" && post.kind !== "action.declared"))
    return [];
  const speaker =
    roster.find((r) => r.characterId === post.characterId) ??
    roster.find((r) => r.actor === post.actor);
  if (!speaker) return [];
  const names = codeTriggers(post.text, snapshot, null)
    .filter((t) => t.kind === "addressed")
    .map((t) =>
      t.actorId === characterId
        ? "you"
        : (snapshot.actors.find((a) => a.id === t.actorId)?.name ?? t.actorId),
    );
  return [
    `[${post.seq}] ${speaker.name} (a player character, not an NPC) said: ${post.text}`,
    `Addressed to: ${names.length ? names.join(", ") : "no one by name"}.`,
    `If you answer, you answer ${speaker.name}${names.includes("you") ? "" : " only if it concerns you"}. Do not answer as if an NPC had spoken to you.`,
  ];
}

export interface CompanionPromptInput {
  seed: PlayerSeedView;
  projections: SessionProjections;
  /** The actor snapshot built from these projections and the full seed. */
  snapshot: ActorSnapshot;
  characterId: string;
  active: boolean;
  /** Ids of the companion's own open actions; they get their own section. */
  ownOpenActionIds?: string[];
}

export function buildCompanionPrompt(input: CompanionPromptInput): {
  system: string;
  user: string;
} {
  const { seed, projections, snapshot, characterId, active } = input;
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
  const seats = seatsOf(projections.party);
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
          (c) =>
            `  ${dmActorLabel(c.actor, null, seats)} (${c.stance}, seq ${c.seq}): ${c.text}`,
        ),
      ].join("\n"),
    );
  const open = openActions
    .filter((a) => !ownIds.has(a.actionId))
    .map((a) => `${a.actionId} by ${a.characterId ?? a.actor}: ${a.text}`);

  const user = joinSections([
    section("Your character", portrayal, 600, "end"),
    section("Scene", scene, 400, "end"),
    snapshotSection("State", snapshot, {
      view: "seat",
      cap: CAPS.snapshotSeat,
      self: characterId,
    }),
    section(
      "Recent transcript",
      transcriptEntries(
        projections.transcript.slice(-CAPS.transcriptEntries),
        rosterOf(projections.party),
      ),
      CAPS.transcript,
      "start",
    ),
    section(
      "Post that triggered you",
      triggeringPost(projections, snapshot, characterId),
      400,
      "end",
    ),
    section("Your open actions (decide each one in pending)", own, 600, "end"),
    section("Other open actions you may comment on", open, 400, "end"),
    section("Committed actions this beat", committed, 400, "end"),
    active
      ? "It is YOUR turn. You must act: set turn to one to three typed actions (act stays null)."
      : "It is not your turn. You may speak, comment or declare; every field may be null.",
  ]);
  return { system, user };
}
