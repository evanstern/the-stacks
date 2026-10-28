import {
  DEATH_WORDS,
  DICE_LANGUAGE,
  NEGATIVE_WORDS,
  namePairsWith,
  POSITIVE_WORDS,
  UNCONSCIOUS_WORDS,
} from "./audit-words.js";
import { type ClaimState, checkClaims } from "./claims.js";
import type {
  FactChange,
  FactEvent,
  FactOutcome,
  FactRoll,
  NarrationFacts,
} from "./facts.js";

/**
 * The code-built factual fallback (specs/034-narration-quality
 * contracts/fallback-summary.md): deterministic, in-fiction plain prose, one
 * sentence per public change. It holds no system word and no digit, states no
 * number, and never names a tracker. It passes `deterministicChecks` by
 * construction; a property test asserts it. It is never sent to `dm.audit`.
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

/** System words the prose must not hold (character names are exempt). */
export const SYSTEM_WORDS =
  /\b(actions?|description|clarify|clearer|rolls?|rolled|dice|checks?|turns?|rounds?|initiative|scene|acts|nothing changes)\b/i;

/** "Goblin-3" becomes "Goblin three"; every digit becomes its word. */
export function spellDigits(text: string): string {
  return text
    .replace(/-(?=[0-9])/g, " ")
    .replace(/[0-9]/g, (d) => ` ${DIGIT_WORDS[Number(d)]} `)
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function outcomeSentence(name: string, outcome: FactOutcome): string {
  switch (outcome) {
    case "success":
      return `${name} pulls it off.`;
    case "failure":
      return `${name} comes up short.`;
    case "hit":
      return `${name} strikes home.`;
    case "critical-hit":
      return `${name} strikes home, hard.`;
    case "miss":
      return `${name} misses.`;
  }
}

function aliasesOf(name: string): string[] {
  const parts = name.split(/\s+/);
  return [...new Set([name, parts[0], parts[parts.length - 1]])].filter(
    (n): n is string => !!n && n.length >= 3,
  );
}

/** True when a roll reason may precede its outcome sentence. */
function reasonUsable(
  reason: string,
  subject: string,
  outcome: FactOutcome,
  state?: ClaimState,
): boolean {
  if (reason.length === 0 || reason.includes("?")) return false;
  const spoken = spellDigits(reason);
  if (/[0-9]/.test(spoken)) return false;
  if (SYSTEM_WORDS.test(spoken)) return false;
  if (DICE_LANGUAGE.test(spoken)) return false;
  if (DEATH_WORDS.test(spoken) || UNCONSCIOUS_WORDS.test(spoken)) return false;
  if (state && !checkClaims(state, spoken).pass) return false;
  const positive =
    outcome === "hit" || outcome === "critical-hit" || outcome === "success";
  const opposite = positive ? NEGATIVE_WORDS : POSITIVE_WORDS;
  const pair = `${spoken} ${outcomeSentence(subject, outcome)}`;
  return !aliasesOf(subject).some((n) => namePairsWith(pair, n, opposite));
}

function rollSentences(
  rolls: readonly FactRoll[],
  subject: string,
  state?: ClaimState,
): string[] {
  const out: string[] = [];
  for (const r of rolls) {
    if (!r.outcome) continue;
    const spoken = spellDigits(r.reason).replace(/[.!]+$/, "");
    if (reasonUsable(spoken, subject, r.outcome, state)) out.push(`${spoken}.`);
    out.push(outcomeSentence(subject, r.outcome));
  }
  return out;
}

const NUMBERED_NAME = new RegExp(
  `\\b(${DIGIT_WORDS.slice(1).join("|")})\\b`,
  "i",
);

function changeSentence(c: FactChange): string | null {
  const target = spellDigits(c.target);
  switch (c.kind) {
    case "hp":
      return c.direction === "damage"
        ? `${target} is wounded.`
        : `${target} is healed.`;
    case "life-state":
      if (c.after === "dead") {
        // "Goblin three is dead" reads to the claim checker as "three ... dead".
        return NUMBERED_NAME.test(target)
          ? `${target} dies.`
          : `${target} is dead.`;
      }
      if (c.after === "unconscious") return `${target} falls unconscious.`;
      return null;
    case "death-saves":
      return c.failed
        ? `${target} slips closer to death.`
        : `${target} holds on.`;
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

function eventSentences(e: FactEvent): string[] {
  switch (e.kind) {
    case "encounter-started": {
      const names = e.combatants.map(spellDigits);
      const out = ["A fight breaks out."];
      if (names.length > 0) {
        out.push(
          `${joinNames(names)} ${names.length === 1 ? "joins" : "join"} the fight.`,
        );
      }
      if (e.first) out.push(`${spellDigits(e.first)} moves first.`);
      return out;
    }
    case "encounter-ended":
      return [];
    case "turn-advanced":
      return [`${spellDigits(e.next)} moves next.`];
    case "combatant-joined":
      return [`${spellDigits(e.name)} joins them.`];
    case "combatant-left":
      return [`${spellDigits(e.name)} is gone.`];
    case "presence":
      return [presenceLine(e)];
  }
}

const PRESENCE_VERB: Record<string, string> = {
  arrived: "arrives",
  left: "leaves",
  fled: "flees",
  removed: "is removed",
  surrendered: "surrenders",
  conceded: "concedes",
};

function presenceLine(e: Extract<FactEvent, { kind: "presence" }>): string {
  return `${spellDigits(e.name)} ${PRESENCE_VERB[e.reason] ?? "changes place"}.`;
}

export function factualSummary(
  facts: NarrationFacts,
  state?: ClaimState,
): string {
  const out: string[] = [];
  if (facts.trigger === "scene-start" && facts.setting.openingFraming) {
    out.push(facts.setting.openingFraming);
  }

  const holdIds = new Set(facts.clarify.map((c) => c.actionId));
  for (const a of facts.actions) {
    const name = a.characterName ? spellDigits(a.characterName) : "The party";
    if (a.outcome === "refused") {
      out.push(`${name} cannot do that here.`);
    } else if (a.outcome === "no-effect" && holdIds.has(a.actionId)) {
      // On hold: a closing question stands in for this action.
    } else if (a.outcome === "no-effect") {
      out.push(`${name} goes ahead with it.`);
    } else {
      const sentences = rollSentences(a.rolls, name, state);
      if (sentences.length > 0) out.push(...sentences);
      else out.push(`${name} goes ahead with it.`);
    }
    for (const c of a.changes) {
      const s = changeSentence(c);
      if (s) out.push(s);
    }
  }

  if (facts.npcTurn) {
    const name = spellDigits(facts.npcTurn.name);
    const sentences = rollSentences(facts.npcTurn.rolls, name, state);
    if (sentences.length > 0) out.push(...sentences);
    else out.push(`${name} makes a move.`);
    for (const c of facts.npcTurn.changes) {
      const s = changeSentence(c);
      if (s) out.push(s);
    }
  }

  let stopped = false;
  const hasStart = facts.events.some((e) => e.kind === "encounter-started");
  for (const e of facts.events) {
    if (e.kind === "encounter-ended") {
      if (!stopped) out.push("The fighting stops.");
      stopped = true;
    } else out.push(...eventSentences(e));
  }
  if (facts.modeChange) {
    if (facts.modeChange.to === "free" && !stopped) {
      out.push("The fighting stops.");
    } else if (facts.modeChange.to === "turn" && !hasStart) {
      out.push("A fight breaks out.");
    }
  }

  if (facts.director.sceneEnded) {
    out.push(
      `That is the end of it at ${spellDigits(facts.setting.locationName)}.`,
    );
  }

  for (const c of facts.clarify) {
    const a = facts.actions.find((x) => x.actionId === c.actionId);
    const who = a?.characterName ? spellDigits(a.characterName) : "the party";
    out.push(`What does ${who} do?`);
  }

  if (out.length === 0) out.push("The moment holds.");
  return out.join(" ");
}
