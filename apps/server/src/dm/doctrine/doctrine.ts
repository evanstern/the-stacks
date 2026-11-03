/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 *
 * The pairs below are adapted (reworded and re-targeted at a pipeline of
 * nodes), not copied, from tabletop-dm skills/tabletop-dm/SKILL.md and
 * reference/dm-style.md. Contract: specs/031-dm-runtime/contracts/doctrine.md.
 */

export const DOCTRINE_NOTICE =
  "DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, " +
  "commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. " +
  "See apps/server/src/dm/doctrine/NOTICE.md.";

export type DoctrineNode =
  | "director"
  | "narrate"
  | "audit"
  | "interpret"
  | "companion"
  | "chronicle";

export interface DoctrinePair {
  id: string;
  topic: string;
  rule: string;
  wrong: string;
  right: string;
  nodes: DoctrineNode[];
}

export const DOCTRINE: readonly DoctrinePair[] = [
  {
    id: "short-turns",
    topic: "Pacing",
    rule: "Keep each turn near one hundred words; never past one hundred fifty.",
    wrong: "A long block that narrates three things at once.",
    right: "One clear moment, trimmed.",
    nodes: ["narrate", "audit"],
  },
  {
    id: "end-on-demand",
    topic: "Endings",
    rule: "End on something that demands a response.",
    wrong: '"The hall is quiet. What do you do?"',
    right: '"Above you, the rope creaks \u2014 someone is climbing down."',
    nodes: ["narrate", "audit"],
  },
  {
    id: "no-menus",
    topic: "Choices",
    rule: "Never hand the player a list or an either-or.",
    wrong: '"Do you fight, or flee?"',
    right: "Leave the choice unwritten; let the player phrase it.",
    nodes: ["narrate", "audit", "companion"],
  },
  {
    id: "stop-at-choice",
    topic: "Choices",
    rule: "Stop where the player must decide.",
    wrong: "Narrating the hero through the door and into the room.",
    right: "Describe what the door reveals, then stop.",
    nodes: ["narrate", "audit"],
  },
  {
    id: "plain-prose",
    topic: "Format",
    rule: "Keep the story in plain prose; numbers live on their own lines.",
    wrong: "Headings, bullets or bold inside the story.",
    right: "Prose, then the dice lines the code writes.",
    nodes: ["narrate", "audit"],
  },
  {
    id: "hero-is-theirs",
    topic: "Agency",
    rule: "Never decide the hero's words, choices or chosen feelings; the dice may decide a reflex.",
    wrong: '"You nod and step back, afraid."',
    right: '"The club catches you square; you stagger back a step."',
    nodes: ["narrate", "audit", "companion"],
  },
  {
    id: "world-not-hero",
    topic: "Agency",
    rule: "Narrate what the world did to the attempt, not the hero's inner state.",
    wrong: '"You panic and lose your grip."',
    right: '"A link in the chain gives, and the floor rushes up."',
    nodes: ["narrate", "audit"],
  },
  {
    id: "blame-the-situation",
    topic: "Failure",
    rule: "A failed roll is the world's doing, not the hero's incompetence.",
    wrong: '"You fumble like a fool."',
    right: '"The ledge crumbles under your boot."',
    nodes: ["narrate"],
  },
  {
    id: "roll-when-uncertain",
    topic: "Rolls",
    rule: "Roll only when the outcome is uncertain and failure is interesting.",
    wrong: "Calling for a check to open an unlocked door.",
    right: "Narrate the certain outcome; save rolls for risk.",
    nodes: ["interpret", "director"],
  },
  {
    id: "fail-forward",
    topic: "Failure",
    rule: "A failure creates a new problem; it never stalls the scene.",
    wrong: '"You fail. Nothing happens."',
    right: '"The lock holds, and the guard\'s lantern swings your way."',
    nodes: ["narrate", "interpret"],
  },
  {
    id: "trying-costs",
    topic: "Rolls",
    rule: "Trying costs something: time, noise, a tracker segment.",
    wrong: "Free retries until success.",
    right: "Each retry advances a clock.",
    nodes: ["director", "interpret"],
  },
  {
    id: "ask-when-unclear",
    topic: "Intent",
    rule: "When intent is unclear, ask one short question.",
    wrong: "Guessing and running with it.",
    right: '"Over the wall, or through the gate?" \u2014 then stop.',
    nodes: ["interpret"],
  },
  {
    id: "yes-and",
    topic: "Intent",
    rule: "Treat a creative plan as an opportunity; set a DC rather than refuse.",
    wrong: 'A flat "no".',
    right: '"Possible \u2014 Strength (Athletics), and the rope is wet."',
    nodes: ["interpret", "director"],
  },
  {
    id: "npc-voice",
    topic: "Characters",
    rule: "Every named NPC has a voice, a want and one concrete detail.",
    wrong: "Interchangeable townsfolk.",
    right: "A ferry keeper who counts everything in threes.",
    nodes: ["narrate", "companion"],
  },
  {
    id: "companion-opinions",
    topic: "Characters",
    rule: "Companions hold opinions and sometimes disagree, about once per scene.",
    wrong: "Companions who only hand out hints.",
    right: '"We should not trust her, and I\'ll say it twice."',
    nodes: ["companion"],
  },
  {
    id: "villains-believe",
    topic: "Characters",
    rule: "Antagonists have reasons and believe them.",
    wrong: "Evil for its own sake.",
    right:
      "The bandits hold the bridge because the lord's toll would starve their village.",
    nodes: ["director", "narrate"],
  },
  {
    id: "one-sense",
    topic: "Texture",
    rule: "Give one vivid detail beyond sight per scene.",
    wrong: "Piled-on adjectives.",
    right: "The tang of wet iron.",
    nodes: ["narrate"],
  },
  {
    id: "world-moves",
    topic: "Pacing",
    rule: "The world moves on its own; show consequences.",
    wrong: "A frozen world between beats.",
    right: "Dusk thickens; the river rises a hand's width.",
    nodes: ["director"],
  },
  {
    id: "dice-stand",
    topic: "Fairness",
    rule: "Never change a result; soften hard outcomes through the story, at a cost.",
    wrong: "A stranger appears to save the hero for free.",
    right: "An existing thread offers rescue, with a price.",
    nodes: ["director", "narrate"],
  },
  {
    id: "warn-before-lethal",
    topic: "Fairness",
    rule: "Signal danger before a deadly choice.",
    wrong: "Sudden death from nowhere.",
    right: "Bones and a warning carved in the post.",
    nodes: ["director", "narrate"],
  },
  {
    id: "numbers-from-state",
    topic: "Facts",
    rule: "Every number comes from the game state, never from memory.",
    wrong: "Recalling HP from earlier chat.",
    right: "Read the facts; write no digits in prose.",
    nodes: ["narrate", "audit"],
  },
  {
    id: "one-clue",
    topic: "Mystery",
    rule: "Reveal the hidden truth slowly.",
    wrong: "Explaining the whole mystery at once.",
    right: "At most one real clue per beat.",
    nodes: ["director"],
  },
  {
    id: "content-pg13",
    topic: "Content",
    rule: "Default content level: adventure violence, brief gore, no sexual content, no detailed cruelty.",
    wrong: "Lingering on gore or cruelty.",
    right: "Keep injury brief and move on.",
    nodes: ["narrate", "audit", "companion"],
  },
  {
    id: "brief-rulings",
    topic: "Rules",
    rule: "Rule in one line, then return to the scene.",
    wrong: "A rules lecture inside the story.",
    right: "One-line ruling in the journal; the story continues.",
    nodes: ["narrate", "interpret"],
  },
];

/** The pairs that apply to one node, in table order. */
export function doctrineFor(node: DoctrineNode): DoctrinePair[] {
  return DOCTRINE.filter((p) => p.nodes.includes(node));
}

/** Renders a node's pairs as Rule / Wrong / Right lines. */
export function renderDoctrine(node: DoctrineNode): string {
  return doctrineFor(node)
    .map((p) => `Rule: ${p.rule}\nWrong: ${p.wrong}\nRight: ${p.right}`)
    .join("\n\n");
}

/** The one agency rule every node renders (specs/074-player-agency). Never capped. */
export const AGENCY_RULE: readonly string[] = [
  "Party members are player characters, AI companions included. Each one's player decides its volitional acts: intent, speech, purposeful movement, choices, chosen emotions, and the method or skill it uses.",
  "Never state, plan or narrate a volitional act, method, skill or reaction for a party member that its player did not declare.",
  "The dice may decide a reflex: an effect listed under Reflex in the facts (a stagger on a critical hit, a heavy-hit reaction, a flinch on a failed save). A small displacement inside a reflex is colour; a position change that matters needs a fact.",
  "A condition limits what a character can do; it never decides what the character chooses. Only a recorded fact naming a control effect compels a party member.",
];

export type AgencyNode =
  | "director"
  | "interpret"
  | "narrate"
  | "audit"
  | "auditor";

const NODE_LINE: Record<AgencyNode, string> = {
  director:
    "Your goal note is pacing advice. It never names a party member's act, method, skill or reaction that its player did not declare; leave those to the player and the engine.",
  interpret:
    "Plan for a party member only what its player declared. Add no method, skill, move, reaction or speech they did not state; when the method matters and is not stated, ask (clarify). A monster's reaction is never a step of a party member's action.",
  narrate:
    "Show a party member carrying out the action they declared, in plain words, and any listed reflex. Nothing more.",
  audit:
    "A volitional act, speech or chosen feeling of a party member beyond its declared action is `player-agency`. A listed reflex shown as a reflex is not.",
  auditor:
    "`hero-is-theirs` covers every party member, AI companions included. A companion's own talk rows and declared actions are its own choices, never `player-agency`.",
};

/** The shared rule lines plus one node line, newline-joined. */
export function agencyRule(node: AgencyNode): string {
  return [...AGENCY_RULE, NODE_LINE[node]].join("\n");
}
