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

function outcomeSentence(
  name: string,
  outcome: FactOutcome,
  band?: FactRoll["band"],
): string {
  if (band === "success-at-cost") return `${name} pulls it off, at a cost.`;
  if (band === "severe-failure") return `${name} fails badly.`;
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

/** True when a reason may be voiced at all (no digit, system, dice or death word, no refuted claim). */
function reasonSpeakable(reason: string, state?: ClaimState): boolean {
  if (reason.length === 0 || reason.includes("?")) return false;
  const spoken = spellDigits(reason);
  if (/[0-9]/.test(spoken)) return false;
  if (SYSTEM_WORDS.test(spoken)) return false;
  if (DICE_LANGUAGE.test(spoken)) return false;
  if (DEATH_WORDS.test(spoken) || UNCONSCIOUS_WORDS.test(spoken)) return false;
  if (state && !checkClaims(state, spoken).pass) return false;
  return true;
}

/** True when a roll reason may precede its outcome sentence. */
function reasonUsable(
  reason: string,
  subject: string,
  outcome: FactOutcome,
  state?: ClaimState,
): boolean {
  if (!reasonSpeakable(reason, state)) return false;
  const spoken = spellDigits(reason);
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
    // The roller is the subject: a reaction attack is not the mover's (spec 079).
    const who =
      r.name && r.name !== "The scene" ? spellDigits(r.name) : subject;
    const spoken = spellDigits(r.reason).replace(/[.!]+$/, "");
    if (reasonUsable(spoken, who, r.outcome, state)) out.push(`${spoken}.`);
    out.push(outcomeSentence(who, r.outcome, r.band));
    // Spec 070: the declared consequence is voiced only when it passes the claim check.
    if (r.consequence) {
      const said = spellDigits(r.consequence).replace(/[.!]+$/, "");
      if (reasonSpeakable(said, state)) out.push(`${said}.`);
    }
    // Spec 080: the learned fact ships too, under the same claim check.
    if (r.revealed) {
      const learned = spellDigits(r.revealed).replace(/[.!]+$/, "");
      if (reasonSpeakable(learned, state)) out.push(`${learned}.`);
    }
  }
  return out;
}

const NUMBERED_NAME = new RegExp(
  `\\b(${DIGIT_WORDS.slice(1).join("|")})\\b`,
  "i",
);

// A drop to unconscious emits life-state and an hp-zero condition on the same
// target; the condition is the same fact, so it is voiced once (via life-state).
function changeSentences(changes: FactChange[]): string[] {
  const fell = new Set(
    changes
      .filter((c) => c.kind === "life-state" && c.after === "unconscious")
      .map((c) => c.target),
  );
  return changes.flatMap((c) => {
    if (
      c.kind === "condition" &&
      c.op === "applied" &&
      c.condition === "unconscious" &&
      fell.has(c.target)
    )
      return [];
    const s = changeSentence(c);
    return s ? [s] : [];
  });
}

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
    case "spell-slot":
      return null;
    case "assist":
      return c.assist === "attack"
        ? `${c.helper} distracts ${target}.`
        : `${c.helper} lends ${target} a hand.`;
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

/** A monster turn with no rolled outcome: the planned reason, else the intent, else the hold (spec 071). */
function plannedSentence(
  npc: NonNullable<NarrationFacts["npcTurn"]>,
  name: string,
  state?: ClaimState,
): string {
  const plan = npc.plan;
  if (plan && !plan.held) {
    const said = spellDigits((plan.say ?? "").replace(/["\u201c\u201d]/g, ""))
      .replace(/[.!]+$/, "")
      .trim();
    const line = `${name} calls out, "${said}."`;
    if (
      said &&
      reasonSpeakable(said, state) &&
      (!state || checkClaims(state, line).pass)
    )
      return line;
    for (const r of plan.reasons) {
      const spoken = spellDigits(r).replace(/[.!]+$/, "");
      if (reasonSpeakable(spoken, state)) return `${spoken}.`;
    }
    if (plan.intent === "talk") return `${name} speaks up.`;
    if (plan.intent === "move") return `${name} shifts ground.`;
    if (plan.intent === "help") return `${name} lends a hand.`;
  }
  return `${name} holds back, watching.`;
}

export function factualSummary(
  facts: NarrationFacts,
  state?: ClaimState,
): string {
  const out: string[] = [];
  if (facts.trigger === "scene-start" && facts.setting.openingFraming) {
    out.push(facts.setting.openingFraming);
    // spec 076 OQ-2 (a): name everyone the opening must name.
    const list = (xs: { name: string }[]): string => {
      const n = xs.map((x) => spellDigits(x.name));
      return n.length > 1
        ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`
        : (n[0] ?? "");
    };
    if (facts.party.length > 0) {
      out.push(
        `${list(facts.party)} ${facts.party.length > 1 ? "are" : "is"} here.`,
      );
    }
    if (facts.presentNpcs.length > 0) {
      out.push(
        `${list(facts.presentNpcs)} ${facts.presentNpcs.length > 1 ? "are" : "is"} here too.`,
      );
    }
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
    if (a.outcome !== "refused") out.push(...changeSentences(a.changes));
  }

  if (facts.npcTurn) {
    const name = spellDigits(facts.npcTurn.name);
    const sentences = rollSentences(facts.npcTurn.rolls, name, state);
    if (sentences.length > 0) out.push(...sentences);
    else out.push(plannedSentence(facts.npcTurn, name, state));
    out.push(...changeSentences(facts.npcTurn.changes));
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
    // Voice the question when it is speakable (specs/073); else the stock line.
    const body = spellDigits(c.question.trim().replace(/\?+$/, ""));
    out.push(
      reasonSpeakable(body, state) ? `${body}?` : `What does ${who} do?`,
    );
  }

  if (out.length === 0) out.push("The moment holds.");
  return out.join(" ");
}
