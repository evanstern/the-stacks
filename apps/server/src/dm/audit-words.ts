/**
 * Word lists for the deterministic audit checks (contracts/audit.md). Pure
 * data and small matchers; tested on their own in test/dm/audit.test.ts.
 */

/** Prose that names dice, rolls or a d-expression. */
export const DICE_LANGUAGE =
  /\b(dice|die|d\d+|\d*d\d+|rolls?\s+(?:a|an|the|for)\b|rolled|natural\s+(?:twenty|one|\w+))\b/i;

/** Prose that says a character died. */
export const DEATH_WORDS = /\b(dies|died|killed|slain|is dead|lies dead)\b/i;
/** Prose that says a character is out cold. */
export const UNCONSCIOUS_WORDS =
  /\b(unconscious|knocked out|passes out|blacks out)\b/i;
/** Any wording that records a death. */
export const DEATH_RECORDED = /\b(dies|died|dead|killed|slain|lifeless)\b/i;
/** Any wording that records a character dropping. */
export const UNCONSCIOUS_RECORDED =
  /\b(unconscious|knocked out|collapses|falls|drops|crumples|slumps|dying|passes out)\b/i;

/** Words that contradict a positive result (hit, success). */
export const NEGATIVE_WORDS = [
  "misses",
  "miss",
  "missed",
  "fails",
  "fail",
  "failed",
  "falters",
  "whiffs",
];
/** Words that contradict a negative result (miss, failure). */
export const POSITIVE_WORDS = [
  "hits",
  "hit",
  "strikes",
  "connects",
  "succeeds",
  "succeed",
  "succeeded",
  "lands",
  "wounds",
];

const escapeRe = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when `name` is followed within two words by one of `words`. */
export function namePairsWith(
  prose: string,
  name: string,
  words: readonly string[],
): boolean {
  const re = new RegExp(
    `\\b${escapeRe(name)}\\b(?:\\W+\\w+){0,2}?\\W+(?:${words.map(escapeRe).join("|")})\\b`,
    "i",
  );
  return re.test(prose);
}

/** A line that starts with a bullet or a number. */
export const LIST_LINE = /^\s*(?:[-*•]|\d+[.)])\s+/m;
/** A closing "A or B?" question. */
export const EITHER_OR_END = /[^.!?\n]*\bor\b[^.!?\n]*\?\s*$/;

export const MAX_WORDS = 220;

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Claim-gate lexicons (specs/051-output-claim-gate/data-model.md, FR-014).
// Verb lists hold lemmas; `verbForms` expands the inflected forms. The bare
// lemma is never matched: after a singular subject a bare form is mostly a
// noun ("the fire", "a wave").

/** Voluntary acts. "laugh" and "sob" sit here: they are sounds, not speech. */
export const ACT_VERBS: readonly string[] = [
  "attack",
  "swing",
  "strike",
  "slash",
  "lunge",
  "grip",
  "grab",
  "seize",
  "draw",
  "raise",
  "lift",
  "reach",
  "curl",
  "stand",
  "rise",
  "climb",
  "run",
  "charge",
  "rally",
  "step",
  "walk",
  "wade",
  "move",
  "turn",
  "look",
  "watch",
  "nod",
  "smile",
  "grin",
  "aim",
  "nock",
  "fire",
  "shoot",
  "throw",
  "cast",
  "point",
  "wave",
  "pull",
  "push",
  "shove",
  "flee",
  "bolt",
  "laugh",
  "sob",
];

/** Verbs of utterance. */
export const SPEECH_VERBS: readonly string[] = [
  "say",
  "speak",
  "shout",
  "shriek",
  "call",
  "cry",
  "whisper",
  "mutter",
  "snarl",
  "growl",
  "answer",
  "reply",
  "ask",
  "beg",
  "plead",
  "yell",
];

/** Verbs that describe a downed body without an act. Disjoint from the two lists above. */
export const INVOLUNTARY_VERBS: readonly string[] = [
  "lie",
  "breathe",
  "bleed",
  "slump",
  "sprawl",
  "twitch",
  "shiver",
  "stay",
  "remain",
  "rest",
];

/** An act verb counts only when one of these words follows it. */
export const ACT_VERB_PARTICLES: Readonly<Record<string, readonly string[]>> = {
  curl: ["around"],
  look: [
    "at",
    "toward",
    "towards",
    "up",
    "down",
    "around",
    "over",
    "to",
    "back",
    "away",
    "through",
    "past",
  ],
  turn: [
    "toward",
    "towards",
    "to",
    "away",
    "back",
    "around",
    "over",
    "on",
    "and",
  ],
};

const IRREGULAR_FORMS: Readonly<Record<string, readonly string[]>> = {
  stand: ["stood"],
  rise: ["rose", "risen"],
  draw: ["drew", "drawn"],
  run: ["ran"],
  shoot: ["shot"],
  throw: ["threw", "thrown"],
  flee: ["fled"],
  speak: ["spoke", "spoken"],
  say: ["said"],
  swing: ["swung"],
  strike: ["struck"],
  lie: ["lay", "lain", "lying"],
  bleed: ["bled"],
  sob: ["sobbed", "sobbing"],
};

/** Inflected forms of a lemma (-s, -ed, -ing, irregulars). Never the bare lemma. */
export function verbForms(lemma: string): string[] {
  const out = new Set<string>();
  const e = lemma.endsWith("e");
  const y = /[^aeiou]y$/.test(lemma);
  out.add(
    /(s|x|z|ch|sh|o)$/.test(lemma)
      ? `${lemma}es`
      : y
        ? `${lemma.slice(0, -1)}ies`
        : `${lemma}s`,
  );
  out.add(e ? `${lemma}d` : y ? `${lemma.slice(0, -1)}ied` : `${lemma}ed`);
  out.add(
    e && !lemma.endsWith("ee") ? `${lemma.slice(0, -1)}ing` : `${lemma}ing`,
  );
  if (/[^aeiou][aeiou][bdgmnprt]$/.test(lemma)) {
    const last = lemma.slice(-1);
    out.add(`${lemma}${last}ed`);
    out.add(`${lemma}${last}ing`);
  }
  for (const f of IRREGULAR_FORMS[lemma] ?? []) out.add(f);
  return [...out];
}

/** Phrases that turn an act into a state. */
export const NEGATIONS: readonly string[] = [
  "cannot",
  "can't",
  "can not",
  "could not",
  "couldn't",
  "does not",
  "doesn't",
  "did not",
  "didn't",
  "will not",
  "won't",
  "no longer",
  "fails to",
  "failed to",
  "too weak to",
  "unable to",
  "never",
];

/** A death word that may be attributed to an actor. */
export const DEATH_ATTRIBUTION = /\b(dies|died|dead|killed|slain)\b/gi;
/** A down word that may be attributed to an actor. */
export const DOWN_ATTRIBUTION =
  /\b(unconscious|knocked out|passes out|blacks out|collapses|crumples|goes down)\b/gi;
/** Attributed forms that need a passive auxiliary: "was killed", not "killed Snag". */
export const PASSIVE_ONLY = /^(killed|slain|knocked out)$/i;

export const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  both: 2,
};

/** Turn-action verb lemmas an off-turn actor may not be shown doing (TASK-0214). */
export const TURN_ACT_VERBS: readonly string[] = [
  "attack",
  "swing",
  "strike",
  "slash",
  "stab",
  "lunge",
  "charge",
  "fire",
  "shoot",
  "loose",
  "throw",
  "hurl",
  "cast",
];

/** The literal stock ending "What do you do?" at the end of prose (TASK-0204, TASK-0214). */
export const STOCK_ENDING =
  /\bwhat do you(?: all| two)? do\?["'\u201d\u2019]*$/i;

/** "<term> acts next" and "<term> moves next" (turn order, FR-004a). */
export const TURN_ORDER_PHRASE = /^\s*(?:acts|moves)\s+next\b/i;

const NUM_ALT = Object.keys(NUMBER_WORDS).join("|");
/** Count claim shapes (FR-007). Each is global; build a fresh copy per scan. */
export const COUNT_PATTERNS = {
  /** "<number> [up to three words] down|dead|fallen|dropped" */
  numberDown: `\\b(${NUM_ALT})\\b((?:\\s+[\\p{L}'’-]+){0,3}?)\\s+(down|dead|fallen|dropped)\\b`,
  /** "no|none|not one [of the] <noun> left|remain" */
  noneLeft: `\\b(no|none|not one)\\s+(?:of\\s+(?:the\\s+)?)?(?:[\\p{L}-]+\\s+)??([\\p{L}'’-]+)\\s+(?:left|remain|remains|remaining)\\b`,
  /** "last|only|lone <noun>" */
  lastOnly: `\\b(last|only|lone)\\s+(?:([\\p{L}'’-]+)\\s+)?([\\p{L}'’-]+)`,
  /** "all [of] [the] <noun> [are] down|dead" */
  allDown: `\\ball\\s+(?:of\\s+)?(?:the\\s+)?([\\p{L}'’-]+)\\s+(?:(?:are|were|lie|lay)\\s+)?(down|dead)\\b`,
} as const;

/** A possessive on a name attributes an act to the name only before one of these. */
export const BODY_PARTS: ReadonlySet<string> = new Set([
  "hand",
  "hands",
  "finger",
  "fingers",
  "arm",
  "arms",
  "eye",
  "eyes",
  "head",
  "face",
  "lip",
  "lips",
  "mouth",
  "voice",
  "breath",
  "chest",
  "leg",
  "legs",
  "foot",
  "feet",
  "shoulder",
  "shoulders",
  "fist",
  "fists",
  "jaw",
  "body",
  "grin",
  "claw",
  "claws",
]);

/** Words between a name and a death or down word that keep the word on the name. */
export const ATTRIBUTION_GAP: ReadonlySet<string> = new Set([
  "is",
  "was",
  "were",
  "be",
  "been",
  "being",
  "lies",
  "lay",
  "falls",
  "fell",
  "fallen",
  "now",
  "already",
  "finally",
  "just",
  "then",
  "quite",
  "very",
  "still",
  "stone",
  "cold",
  "really",
  "truly",
  "nearly",
  "almost",
  "has",
  "had",
  "gets",
  "got",
  "goes",
  "went",
  "limp",
  "also",
  "too",
  "at",
  "last",
]);

/** Auxiliaries that make "killed", "slain" and "knocked out" passive. */
export const PASSIVE_AUX: ReadonlySet<string> = new Set([
  "is",
  "was",
  "were",
  "be",
  "been",
  "being",
  "gets",
  "got",
]);

/** A name after one of these is an object, not a subject. */
export const OBJECT_CUES: ReadonlySet<string> = new Set([
  "at",
  "toward",
  "towards",
  "to",
  "from",
  "over",
  "beside",
  "past",
  "with",
  "upon",
  "on",
  "of",
  "by",
  "against",
  "around",
  "behind",
  "beneath",
  "for",
  "near",
  "beyond",
  "into",
  "onto",
  "under",
  "between",
  "among",
  "like",
  "than",
  "about",
  "after",
]);

// ---------------------------------------------------------------------------
// Player-agency lexicons (specs/074-player-agency/plan.md R5). Lemmas; expand
// with `verbForms`. The claim gate reads ACT_VERBS and INVOLUNTARY_VERBS, so
// these are separate lists.

/** A chosen defence on a recorded miss: always a breach. */
export const DEFENCE_VERBS: readonly string[] = [
  "dodge",
  "duck",
  "sidestep",
  "swerve",
  "weave",
  "evade",
  "parry",
  "deflect",
  "leap",
  "jump",
  "roll",
  "spin",
  "wrench",
  "lean",
];

/** A flinch the dice allow on a miss (OQ-1 ruling); a breach only with an intent marker. */
export const REFLEX_VERBS: readonly string[] = [
  "flinch",
  "recoil",
  "wince",
  "jerk",
  "twist",
  "tense",
  "stiffen",
];

/** Words that turn a reflex verb into a chosen defence when within three words after it. */
export const INTENT_MARKERS: readonly string[] = [
  "just enough",
  "in time",
  "aside",
  "clear",
  "free",
  "out of the way",
  "under",
  "beneath",
];

/** A party member moved or voiced at scene start: act and speech verbs plus these. */
export const SCENE_START_VERBS: readonly string[] = [
  ...ACT_VERBS,
  ...SPEECH_VERBS,
  "lead",
  "follow",
  "head",
  "stride",
  "enter",
  "approach",
  "kneel",
  "crouch",
  "study",
  "scan",
  "weigh",
  "listen",
];

/** True when `name` is followed within two words by a reflex verb, then an intent marker within three words. */
export function namePairsWithIntentReflex(
  prose: string,
  name: string,
  verbs: readonly string[],
): string | null {
  const re = new RegExp(
    `\\b${escapeRe(name)}\\b(?:\\W+\\w+){0,2}?\\W+(?:${verbs.map(escapeRe).join("|")})\\b((?:\\W+\\w+){0,3}?)\\W+(?:${INTENT_MARKERS.map(escapeRe).join("|")})\\b`,
    "i",
  );
  return re.exec(prose)?.[0] ?? null;
}

/** The matched text of `name` paired with one of `words`, or null. */
export function namePairMatch(
  prose: string,
  name: string,
  words: readonly string[],
): string | null {
  const re = new RegExp(
    `\\b${escapeRe(name)}\\b(?:\\W+\\w+){0,2}?\\W+(?:${words.map(escapeRe).join("|")})\\b`,
    "i",
  );
  return re.exec(prose)?.[0] ?? null;
}

/** True when `text` states a count of the fallen or the remaining (TASK-0214). */
export function hasCountClaim(text: string): boolean {
  return [
    COUNT_PATTERNS.numberDown,
    COUNT_PATTERNS.noneLeft,
    COUNT_PATTERNS.allDown,
  ].some((src) => new RegExp(src, "iu").test(text));
}
