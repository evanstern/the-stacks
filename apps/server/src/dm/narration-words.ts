/**
Word lists for the deterministic narration checks. Pure
 * data and small matchers; tested through test/dm/narration-check.test.ts.
 */

/** Prose that names dice, rolls or a d-expression. */
export const DICE_LANGUAGE =
  /\b(dice|die|d\d+|\d*d\d+|rolls?\s+(?:a|an|the|for)\b|rolled|natural\s+(?:twenty|one|\w+))\b/i;

/** Prose that says a character died. */
export const DEATH_WORDS = /\b(dies|died|killed|slain|is dead|lies dead)\b/i;
/** Prose that says a character is out cold. */
export const UNCONSCIOUS_WORDS =
  /\b(unconscious|knocked out|passes out|blacks out)\b/i;
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

/** A closing "A or B?" question. */
export const EITHER_OR_END = /[^.!?\n]*\bor\b[^.!?\n]*\?\s*$/;

/** The literal stock ending "What do you do?" at the end of prose (TASK-0204, TASK-0214). */
export const STOCK_ENDING =
  /\bwhat do you(?: all| two)? do\?["'\u201d\u2019]*$/i;

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

/** True when `text` states a count of the fallen or the remaining (TASK-0214). */
export function hasCountClaim(text: string): boolean {
  return [
    COUNT_PATTERNS.numberDown,
    COUNT_PATTERNS.noneLeft,
    COUNT_PATTERNS.allDown,
  ].some((src) => new RegExp(src, "iu").test(text));
}
