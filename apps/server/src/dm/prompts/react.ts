/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import type { TranscriptEntry } from "@the-stacks/session-model";
import { renderDoctrine } from "../doctrine/doctrine.js";
import type { AuditIssue } from "../nodes/audit.js";
import type { PlayerSeedView } from "../seed/views.js";
import type { ActorSnapshot } from "../snapshot/index.js";
import type { CodeTrigger } from "../talk-triggers.js";
import {
  CAPS,
  capEntries,
  joinSections,
  type RosterEntry,
  section,
  transcriptEntries,
} from "./common.js";
import { characterSections } from "./narrate.js";

/** The talk-turn react prompt (specs/065-talk-triggers plan D4). Purpose `dm.narrate`. */
export const PROMPT_VERSION = "dm.react-v1";

export const CAP_LINE =
  "This reaction reaches the chain cap. Prompt no companion: leave companionPrompts empty, and end on a beat that hands the scene to the player characters.";

export const RULES = [
  "You are the world of a tabletop role-playing session. A player character or companion just spoke in character. Decide whether the world reacts, and write that reaction.",
  "Choose exactly one outcome. none: nothing in the world reacts (text is empty). reply: one present non-player character answers (set speaker to that character's id). scene: the world reacts without one clear speaker. escalate: the talk turns violent or fast; name an encounter id only from the list of unstarted encounters.",
  "Voice only characters listed under Present characters. A dead, unconscious or absent character does not speak.",
  "Write plain prose of about sixty words, never more than one hundred fifty. No lists, no headings, no bold. Write NO digits.",
  "State nothing outside the player view. If asked about something the character would hide or not know, answer in character without stating it. The substance needs a declared action from the player.",
  "Never roll dice or mention dice, checks or totals. Talk changes no game state. When a request carries stakes or persuasion, reply in character and invite the player to declare an action.",
  "The party members are player characters, AI companions included. Never decide what one says, feels or chooses.",
  "End on something that invites a response. Do not end with an either-or question.",
].join("\n");

const OUTPUT_SHAPE = [
  "Reply with ONE JSON object and nothing else:",
  '{"outcome":"none"|"reply"|"scene"|"escalate",',
  ' "triggers":[{"kind":"addressed"|"mentioned"|"overheard"|"narrator"|"hostile","actorId":id|null}] (8 at most),',
  ' "speaker":id of the replying character|null (required for reply),',
  ' "text":str (1200 characters at most; empty for none),',
  ' "encounterId":id|null (required for escalate),',
  ' "companionPrompts":[id of a companion who should answer next] (2 at most),',
  ' "reason":str (300 characters at most)}',
].join("\n");

export interface ReactPromptInput {
  /** The player-facing view; never the full seed. */
  seed: PlayerSeedView;
  roster: readonly RosterEntry[];
  snapshot: ActorSnapshot;
  /** The read posts, oldest first. */
  posts: readonly Extract<TranscriptEntry, { kind: "talk" }>[];
  triggers: readonly CodeTrigger[];
  transcriptTail: readonly TranscriptEntry[];
  presentNpcIds: readonly string[];
  /** Unstarted seed encounters the reaction may escalate into. */
  encounterIds: readonly string[];
  /** True when this reaction reaches the chain cap (FR-012). */
  reachesCap: boolean;
  prior: { text: string; issues: AuditIssue[] } | null;
}

export function buildReactPrompt(input: ReactPromptInput): {
  system: string;
  user: string;
} {
  const doctrine = capEntries(
    renderDoctrine("narrate").split("\n\n"),
    CAPS.doctrine,
    "end",
  ).join("\n\n");
  const system = [RULES, "Doctrine:", doctrine, OUTPUT_SHAPE].join("\n\n");

  const nameOf = (id: string): string =>
    input.snapshot.actors.find((a) => a.id === id)?.name ?? id;
  const speakerOf = (e: { actor: string; characterId: string | null }) =>
    input.roster.find((r) => r.characterId === e.characterId)?.name ??
    (e.actor.startsWith("ai:companion:")
      ? nameOf(e.actor.slice("ai:companion:".length))
      : "a player");
  const npcs = input.seed.npcs
    .filter((n) => input.presentNpcIds.includes(n.id))
    .map(
      (n) =>
        `${n.id} (${n.name}, ${n.role}): voice ${n.voice}; wants ${n.want}; detail ${n.detail}`,
    );
  const posts = input.posts
    .filter((p) => p.visibility === "public")
    .map((p) => `[${p.seq}] ${speakerOf(p)}: ${p.text}`);
  const triggers = input.triggers.map(
    (t) => `${t.kind}: ${nameOf(t.actorId)} (${t.actorId})`,
  );
  const prior = input.prior
    ? [
        "Your previous reaction was rejected. Write it again and fix every issue.",
        `Previous text: ${input.prior.text}`,
        ...input.prior.issues.map((i) => `Issue (${i.kind}): ${i.detail}`),
      ]
    : [];
  const user = joinSections([
    `Location: ${input.seed.location.name}. Mood: ${input.seed.location.mood}`,
    ...characterSections(input.snapshot),
    section("Posts to react to", posts, 800, "start"),
    section("Code triggers", triggers, 400, "end"),
    section("Present characters", npcs, 800, "end"),
    section(
      "Unstarted encounters (escalate only into these)",
      [...input.encounterIds],
      200,
      "end",
    ),
    section(
      "Recent transcript",
      transcriptEntries(input.transcriptTail, input.roster),
      CAPS.transcript,
      "start",
    ),
    input.reachesCap ? CAP_LINE : "",
    prior.join("\n"),
  ]);
  return { system, user };
}
