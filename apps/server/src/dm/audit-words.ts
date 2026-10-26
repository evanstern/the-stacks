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
