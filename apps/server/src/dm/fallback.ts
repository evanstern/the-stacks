import type { FactChange, FactOutcome, NarrationFacts } from "./facts.js";

/**
 * The code-built factual summary (contracts/audit.md "The factual summary"):
 * one plain sentence per action and per NPC turn, no adjectives, no digits in
 * the prose. It passes `deterministicChecks` by construction; a property test
 * asserts it. It is never sent to `dm.audit`.
 */

const DIGIT_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

/** Names may carry digits ("Goblin 2"); prose may not. */
export function spellDigits(text: string): string {
  return text
    .replace(/[0-9]/g, (d) => ` ${DIGIT_WORDS[Number(d)]} `)
    .replace(/\s+/g, " ")
    .trim();
}

function outcomeSentence(
  name: string,
  outcomes: readonly FactOutcome[],
): string {
  const only = outcomes.length === 1 ? outcomes[0] : undefined;
  switch (only) {
    case "hit":
      return `${name} hits.`;
    case "critical-hit":
      return `${name} lands a critical hit.`;
    case "miss":
      return `${name} misses.`;
    case "success":
      return `${name} succeeds.`;
    case "failure":
      return `${name} fails.`;
    default:
      return `${name} acts.`;
  }
}

function changeSentence(c: FactChange): string | null {
  const target = spellDigits(c.target);
  switch (c.kind) {
    case "hp":
      return c.direction === "damage"
        ? `${target} is wounded.`
        : `${target} is healed.`;
    case "life-state":
      if (c.after === "dead") return `${target} is dead.`;
      if (c.after === "unconscious") return `${target} falls unconscious.`;
      return null;
    case "condition":
      if (c.condition === "unconscious") {
        return c.op === "applied"
          ? `${target} falls unconscious.`
          : `${target} wakes.`;
      }
      return c.op === "applied"
        ? `${target} is ${c.condition}.`
        : `${target} is no longer ${c.condition}.`;
  }
}

export function factualSummary(facts: NarrationFacts): string {
  const sentences: string[] = [];
  if (facts.trigger === "scene-start") sentences.push("The scene begins.");
  for (const a of facts.actions) {
    const name = a.characterName ? spellDigits(a.characterName) : "The party";
    if (a.outcome === "refused") {
      sentences.push(`${name} cannot do that.`);
    } else if (a.outcome === "no-effect") {
      sentences.push(`${name} acts, and nothing changes.`);
    } else {
      sentences.push(outcomeSentence(name, a.outcomes));
    }
    for (const c of a.changes) {
      const s = changeSentence(c);
      if (s) sentences.push(s);
    }
  }
  if (facts.npcTurn) {
    const name = spellDigits(facts.npcTurn.name);
    sentences.push(outcomeSentence(name, facts.npcTurn.outcomes));
    for (const c of facts.npcTurn.changes) {
      const s = changeSentence(c);
      if (s) sentences.push(s);
    }
  }
  if (facts.clarify.length > 0) {
    sentences.push("One action needs a clearer description.");
  }
  if (facts.modeChange) {
    sentences.push(
      facts.modeChange.to === "turn"
        ? "The party enters a fight."
        : "The fight is over.",
    );
  }
  if (facts.director.sceneEnded) sentences.push("The scene ends.");
  if (sentences.length === 0) sentences.push("Nothing happens.");
  return sentences.join(" ");
}
