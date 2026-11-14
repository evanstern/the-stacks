/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import type { TranscriptEntry } from "@the-stacks/session-model";
import { renderDoctrine } from "../doctrine/doctrine.js";
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
export const PROMPT_VERSION = "dm.react-v5";

export const CAP_LINE =
  "This reaction reaches the chain cap. Prompt no companion: leave companionPrompts empty, and end on a beat that hands the scene to the player characters.";

export const RULES = [
  "You are the world of a tabletop role-playing session. A player character or companion just spoke in character. Decide whether the world reacts, and write that reaction.",
  "Choose exactly one outcome. none: nothing in the world reacts (text is empty). reply: one present non-player character answers (set speaker to that character's id). scene: the world reacts without one clear speaker. escalate: the talk turns violent or fast; name an encounter id only from the list of unstarted encounters. confirm: a player describes a deed whose outcome is uncertain (text is empty; fill confirm).",
  "A confirm holds one item for each human character who acts, at most four. Each item names that character's id (characterId, null only for a party attempt), your wording of the deed in one short sentence (text), and an Intent body: kind, targets, params, optional text. Never write an item for a companion, a non-player character or an absent or downed character. Speech alone is a reply or a scene, never a confirm.",
  "Answer only a post marked ask_dm: set answer to a short out-of-character reply drawn from what the characters can see, or null. An answer changes no game state.",
  "Voice only characters listed under Present characters. A dead, unconscious or absent character does not speak.",
  "Write plain prose of about sixty words, never more than one hundred fifty. No lists, no headings, no bold. Write NO digits.",
  "State nothing outside the player view. If asked about something the character would hide or not know, answer in character without stating it. The substance needs a declared action from the player.",
  "Never roll dice or mention dice, checks or totals. Talk changes no game state. When a request carries stakes or persuasion, reply in character and invite the player to declare an action.",
  "The party members are player characters, AI companions included. Never decide what one says, feels or chooses.",
  "End on something that invites a response. Do not end with an either-or question.",
].join("\n");

const OUTPUT_SHAPE = [
  "Reply with ONE JSON object and nothing else:",
  '{"outcome":"none"|"reply"|"scene"|"escalate"|"confirm",',
  ' "triggers":[{"kind":"addressed"|"mentioned"|"overheard"|"narrator"|"hostile","actorId":id|null}] (8 at most),',
  ' "speaker":id of the replying character|null (required for reply),',
  ' "text":str (1200 characters at most; empty for none),',
  ' "encounterId":id|null (required for escalate),',
  ' "companionPrompts":[id of a companion who should answer next] (2 at most),',
  ' "confirm":[{"characterId":id|null,"text":str (500 at most),"body":{"kind":str,"targets":[],"params":{},"text":str (optional)}}] (4 at most; empty unless outcome is confirm),',
  ' "answer":str (1200 characters at most)|null (only for an ask_dm post),',
  ' "reason":str (300 characters at most)}',
].join("\n");

export interface ReactPromptInput {
  /** The player-facing view; never the full seed. */
  seed: PlayerSeedView;
  roster: readonly RosterEntry[];
  snapshot: ActorSnapshot;
  /** The read posts, oldest first. `rule` 3 is an `ask_dm` question. */
  posts: readonly {
    seq: number;
    speaker: string;
    text: string;
    rule: number;
  }[];
  /** The human-controlled characters a confirm item may name. */
  humans: readonly { id: string; name: string }[];
  triggers: readonly CodeTrigger[];
  transcriptTail: readonly TranscriptEntry[];
  presentNpcIds: readonly string[];
  /** Unstarted seed encounters the reaction may escalate into. */
  encounterIds: readonly string[];
  /** True when this reaction reaches the chain cap (FR-012). */
  reachesCap: boolean;
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
  const npcs = input.seed.npcs
    .filter((n) => input.presentNpcIds.includes(n.id))
    .map(
      (n) =>
        `${n.id} (${n.name}, ${n.role}): voice ${n.voice}; wants ${n.want}; detail ${n.detail}`,
    );
  const posts = input.posts.map(
    (p) =>
      `[${p.seq}] ${p.speaker}${p.rule === 3 ? " (ask_dm)" : ""}: ${p.text}`,
  );
  const humans = input.humans.map((h) => `${h.id} (${h.name})`);
  const triggers = input.triggers.map(
    (t) => `${t.kind}: ${nameOf(t.actorId)} (${t.actorId})`,
  );
  const user = joinSections([
    `Location: ${input.seed.location.name}. Mood: ${input.seed.location.mood}`,
    ...characterSections(input.snapshot),
    section("Posts to react to", posts, 800, "start"),
    section("Human characters (confirm only these)", humans, 300, "end"),
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
  ]);
  return { system, user };
}
