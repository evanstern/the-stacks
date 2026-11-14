/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */

import { agencyRule, renderDoctrine } from "../doctrine/doctrine.js";
import type { FactSheet } from "../fact-sheet.js";
import {
  type FactEvent,
  type FactRoll,
  type NarrationFacts,
  outcomeWord,
} from "../facts.js";
import type { AssembleOutput } from "../nodes/assemble.js";
import type { PlayerSeedView } from "../seed/views.js";
import {
  type ActorSnapshot,
  renderSnapshot,
  SnapshotOverflowError,
  visibleActors,
} from "../snapshot/index.js";
import {
  CAPS,
  capEntries,
  joinSections,
  type RosterEntry,
  section,
  transcriptEntries,
} from "./common.js";

export const PROMPT_VERSION = "dm.narrate-v26";

/** One turn rule, shared by the narrate and audit prompts (TASK-0214). */
export const TURN_RULE =
  "Only the actors on the Turn line, the Action lines and the roll lines act in this beat. The actor on the Next line has not acted: never show them move, speak or strike. A character on the Off turn line may speak, look, flinch or brace, but never strikes, shoots, casts, throws or charges in this beat.";

const RULES = [
  "You narrate the result of one beat of a tabletop role-playing session. The facts below are TRUE and already decided by the rules engine. Retell them as story.",
  'Write tagged slots. Write each tag in square brackets at the start of a line, with no colon after it: [restate], [describe], [ask]. Never write a bare label such as restate: or describe:. and only the slots listed under Slots. [restate] one sentence that repeats the character\'s intention, with no outcome and no digit. [describe] plain prose of about one hundred words, never more than one hundred fifty, with no lists, no headings and no bold. [ask] only when listed; one open question, never an either-or and never "What do you do?".',
  "Never write a State line or a dice line. Code appends the rows and the State line. When a Settled question line is listed, code asks it: never ask a question yourself.",
  "Write NO digits. Do not state totals, damage numbers, hit points, armor class or difficulty. Code appends the dice lines after your prose.",
  "Never contradict a fact. A hit lands, a miss misses, a failure fails. Do not invent rolls, dice or mechanics.",
  agencyRule("narrate"),
  "Every other character is part of the world. Give NPCs and monsters words, looks and feelings.",
  "No rules effect means nothing was rolled. The attempt still happens; show what the world does with it. Never grant a hit, a wound, a condition, a death or a hidden discovery without a fact.",
  "A refused action did not happen: no roll and no result. Never show it succeed, fail or land, and never show anyone react to its result.",
  "When a foe's attack misses a party member, its grab fails, or a party member succeeds on a save against it, tell it from the foe's side: the blow goes wide, glances off armour, finds only air. On a miss listed under Reflex, the party member may flinch. The flinch never causes the miss. Never show the party member choosing a defence: no dodge, no duck, no twist that times the blow, no step aside. Never show a wound unless a fact records damage.",
  "A roll's band and outcome are settled. A success means the attempted task happens. Deliver the outcome and any learned fact plainly in the prose; invent no other. A success at a cost succeeds and the consequence lands. A severe failure fails worse than a plain failure. A free retry with no roll succeeds.",
  "When an intent is unclear, describe the moment and stop. Code asks the question.",
  "Cover every Event line.",
  "Describe every Direct action line, in order. Each is a separate deed.",
  TURN_RULE,
  "When the Monster turn has a says: line, the monster speaks those words in this beat.",
  "Name a character as dead or unconscious only when a fact or the state sections say so; when a fact says so, say so.",
  "A dead, unconscious, stable or absent character does not act or speak. Count only what the state sections show.",
  "A not-yet-attempted step has not happened, in this beat or an earlier one. Stop before it; never show it start or done.",
  'Never end on "What do you do?" or an either-or question.',
].join("\n");

/** The facts as capped entries, most important first. */
function rollEntry(r: FactRoll): string {
  if (r.reaction) {
    return `  reaction: ${r.name} strikes at ${r.target ?? "them"} as they pull away -> ${r.outcome ?? "no result"}`;
  }
  const target = r.target ? ` target ${r.target}` : "";
  const dealt = r.damage?.dealt;
  const word = r.damage
    ? dealt
      ? `damage dealt: ${dealt.amount}${dealt.type ? ` ${dealt.type}` : ""} to ${dealt.target}`
      : "damage rolled; no hit points lost"
    : (outcomeWord(r) ?? "no result");
  const noRoll = r.autoSuccess ? " (no roll needed; a free retry)" : "";
  const outcome = r.consequence ? `; outcome (settled): ${r.consequence}` : "";
  const learned = r.revealed ? `\n  learned (settled): ${r.revealed}` : "";
  return `  roll: ${r.reason}${target} -> ${word}${noRoll}${outcome}${learned}`;
}

function eventEntry(e: FactEvent): string {
  switch (e.kind) {
    case "encounter-started":
      return `Event: a fight starts (${e.combatants.join(", ")})${e.first ? `; ${e.first} acts first` : ""}`;
    case "encounter-ended":
      return "Event: the fight ends";
    case "turn-advanced":
      return `Event: ${e.next} acts next`;
    case "combatant-joined":
      return `Event: ${e.name} joins`;
    case "combatant-left":
      return `Event: ${e.name} leaves`;
    case "presence":
      return `Event: ${e.name} is now ${e.presence} (${e.reason})`;
  }
}

const REFLEX_PHRASE: Record<
  NonNullable<NarrationFacts["involuntary"]>[number]["trigger"],
  string
> = {
  stagger: "stagger",
  "heavy-hit": "reel from a heavy hit",
  flinch: "flinch",
  avoid: "flinch as it misses",
};

export function factEntries(facts: NarrationFacts): string[] {
  const out: string[] = [];
  if (facts.turn) {
    out.push(`Turn: ${facts.turn.actor} acts in this beat.`);
    if (facts.turn.next) {
      out.push(
        `Next: ${facts.turn.next} acts after this beat and has not acted yet.`,
      );
    }
    if (facts.turn.offTurn?.length) {
      out.push(
        `Off turn: ${facts.turn.offTurn.join(", ")} (may speak, look or flinch; no strike, shot, cast, throw or charge).`,
      );
    }
  }
  for (const h of facts.held ?? []) {
    out.push(
      `Waiting: "${h.text}" waits for ${h.name}'s turn; nothing has happened yet.`,
    );
  }
  for (const a of facts.actions) {
    const head = `Action ${a.actionId} by ${a.characterName ?? "the party"}: "${a.text}" -> `;
    const onHold = facts.clarify.some((c) => c.actionId === a.actionId);
    if (a.outcome === "refused") {
      out.push(
        `${head}refused${a.refusalCode ? ` (refused: ${a.refusalCode})` : ""}: it did not happen; nothing was rolled and nothing changed`,
      );
    } else if (onHold) {
      out.push(`${head}on hold (the intent is unclear; nothing happened yet)`);
    } else if (a.outcome === "no-effect") {
      out.push(
        `${head}no rules effect (nothing rolled, no game state changed; the attempt still happens in the story)`,
      );
    } else {
      out.push(`${head}applied`);
    }
    for (const r of a.rolls) out.push(rollEntry(r));
    for (const c of a.changes) out.push(`  change: ${describeChange(c)}`);
    for (const f of a.followUps) out.push(`  not yet attempted: ${f}`);
  }
  for (const f of facts.openFollowUps ?? []) {
    out.push(`Earlier beat, not yet attempted: ${f.name}: ${f.text}`);
  }
  if (facts.npcTurn) {
    out.push(`Monster turn: ${facts.npcTurn.name}`);
    const plan = facts.npcTurn.plan;
    if (plan && plan.reasons.length > 0) {
      out.push(`  planned: ${[plan.intent, ...plan.reasons].join("; ")}`);
    }
    if (plan?.say && !plan.held) out.push(`  says: ${plan.say}`);
    if (plan?.held) out.push("  held: the plan did not go ahead");
    if (facts.npcTurn.rolls.length === 0) {
      out.push(
        `  no rules effect (nothing rolled; ${facts.npcTurn.name} still acts in the story)`,
      );
    }
    for (const r of facts.npcTurn.rolls) out.push(rollEntry(r));
    for (const c of facts.npcTurn.changes)
      out.push(`  change: ${describeChange(c)}`);
  }
  for (const st of facts.pulled ?? []) {
    out.push(`Joined the fight: ${st.name}`);
    for (const r of st.rolls) out.push(rollEntry(r));
  }
  for (const st of facts.settled ?? []) {
    out.push(`Downed turn: ${st.name}`);
    for (const r of st.rolls) out.push(rollEntry(r));
    for (const c of st.changes) out.push(`  change: ${describeChange(c)}`);
  }
  for (const st of facts.direct ?? []) {
    out.push(`Direct action: ${st.name}: ${st.deed?.text ?? ""}`);
    for (const r of st.rolls) out.push(rollEntry(r));
    for (const c of st.changes) out.push(`  change: ${describeChange(c)}`);
  }
  for (const i of facts.involuntary ?? []) {
    out.push(`Reflex: ${i.name} may ${REFLEX_PHRASE[i.trigger]} (${i.detail})`);
  }
  for (const e of facts.events) out.push(eventEntry(e));
  if (facts.modeChange) {
    out.push(
      `Table mode changed from ${facts.modeChange.from} to ${facts.modeChange.to}`,
    );
  }
  for (const c of facts.clarify) {
    out.push(`Waiting on an answer for ${c.actionId}`);
  }
  if (facts.director.sceneEnded) out.push("The scene ends with this beat.");
  return out;
}

function describeChange(
  c: NarrationFacts["actions"][number]["changes"][number],
): string {
  switch (c.kind) {
    case "hp":
      return c.direction === "damage"
        ? `${c.target} loses ${c.amount} hit points${c.damageType ? ` (${c.damageType})` : ""}, now ${c.after}`
        : `${c.target} regains ${c.amount} hit points, now ${c.after}`;
    case "life-state":
      return `${c.target} is now ${c.after}`;
    case "condition":
      return `${c.target} ${c.op === "applied" ? "gains" : "loses"} ${c.condition}`;
    case "spell-slot":
      return `${c.target} spends a level ${c.level} spell slot`;
    case "assist":
      return c.assist === "attack"
        ? `${c.helper} distracts ${c.target}`
        : `${c.helper} helps ${c.target}`;
    case "death-saves":
      return c.failed
        ? `${c.target} fails a death saving throw`
        : `${c.target} succeeds on a death saving throw`;
  }
}

/**
 * The scene, party and world sections, shared by the narrate and audit
 * prompts: the snapshot S1 in the `fiction` view, rendered once under
 * `CAPS.snapshotFiction` and split by actor kind. Throws SnapshotOverflowError
 * when the state does not fit.
 */
export function characterSections(snapshot: ActorSnapshot): string[] {
  const r = renderSnapshot(snapshot, {
    view: "fiction",
    cap: CAPS.snapshotFiction,
  });
  if (!r.ok) throw new SnapshotOverflowError(r.detail);
  // One line per visible actor follows the stage lines, in snapshot order.
  const actors = visibleActors(snapshot, "fiction");
  const stage = r.lines.slice(0, r.lines.length - actors.length);
  const actorLines = r.lines.slice(stage.length);
  const party = actorLines.filter((_, i) => actors[i]?.kind === "party");
  const world = actorLines.filter((_, i) => actors[i]?.kind !== "party");
  const label = (name: string, lines: string[]): string =>
    lines.length > 0 ? `## ${name}\n${lines.join("\n")}` : "";
  return [
    label("Scene state", stage),
    label("Party (player characters)", party),
    label("Other characters (the world)", world),
  ];
}

/**
 * The scene-start opening section (spec 076): place, premise, goal, framing,
 * each party character and each NPC present at the first beat. It names
 * characters only: no player, no controller. Empty for every other trigger.
 */
export function openingSection(
  seed: PlayerSeedView,
  facts: NarrationFacts,
): string {
  if (facts.trigger !== "scene-start") return "";
  const loc = seed.location;
  const party = facts.party.map((m) => {
    const c = seed.characters.find((x) => x.characterId === m.characterId);
    return c
      ? `- ${m.name}, ${c.identity.class}. Looks: ${c.portrayal.appearance}`
      : `- ${m.name}`;
  });
  const present = facts.presentNpcs.map((n) => {
    const v = seed.npcs.find((x) => x.id === n.id);
    return v ? `- ${n.name}, ${v.role}. Looks: ${v.appearance}` : `- ${n.name}`;
  });
  return [
    "## Opening",
    "Open the scene. This is the first narration the players see.",
    `Location: ${loc.name}. ${loc.features.join(" ")} Mood: ${loc.mood} ${loc.senses.join(" ")}`,
    `Why the party is here: ${seed.openingPremise}`,
    `Goal: ${seed.goalStatement}`,
    `Framing: ${seed.openingFraming}`,
    ...(party.length > 0 ? ["Party:", ...party] : []),
    ...(present.length > 0 ? ["Present at the start:", ...present] : []),
    "Introduce the place, why the party is here and what they are there to do. Name every party member and every character present listed above before you ask anything. A present character may be heard, glimpsed or expected rather than seen.",
    "Name the characters only. Never say who plays a character or how it is played.",
    "The opening shows the place and what the party finds. It never moves, leads or voices a party member.",
    "This opening may run to about one hundred sixty words, never more than one hundred eighty.",
    'End on one short open question to the party, in your own words. Never end with "What do you do?".',
  ].join("\n");
}

export interface NarratePromptInput {
  seed: PlayerSeedView;
  roster: readonly RosterEntry[];
  assembled: AssembleOutput;
  /** S1: the actor snapshot after resolve. */
  snapshot: ActorSnapshot;
  facts: NarrationFacts;
  /** Spec 098: the fact sheet; absent only in tests that read the facts alone. */
  sheet?: FactSheet;
}

/** The Slots, Restate, Speakers and Settled question sections (spec 098 D4). */
export function sheetSections(sheet: FactSheet): string[] {
  return [
    section("Slots", sheet.slots, 100, "end"),
    section(
      "Restate",
      sheet.restate.map((t) => `${t.subject}: "${t.text}" (${t.resolution})`),
      600,
      "end",
    ),
    section(
      "Speakers",
      sheet.speakers.map((s) => (s.say ? `${s.name} says: ${s.say}` : s.name)),
      400,
      "end",
    ),
    section(
      "Why (settled by the rules; weave in words, no digits)",
      sheet.rows.filter((r) => r.kind === "why").map((r) => r.text),
      400,
      "end",
    ),
    sheet.ask ? "## Settled question\nCode asks this; do not ask it." : "",
  ];
}

export function buildNarratePrompt(input: NarratePromptInput): {
  system: string;
  user: string;
} {
  const { seed, facts } = input;
  const doctrine = capEntries(
    renderDoctrine("narrate").split("\n\n"),
    CAPS.doctrine,
    "end",
  ).join("\n\n");
  const system = [RULES, "Doctrine:", doctrine].join("\n\n");

  const npcs = facts.presentNpcs.map(
    (n) => `${n.name}: voice ${n.voice}; wants ${n.want}; detail ${n.detail}`,
  );
  const user = joinSections([
    openingSection(seed, facts),
    ...characterSections(input.snapshot),
    section("Facts", factEntries(facts), CAPS.facts, "end"),
    ...(input.sheet ? sheetSections(input.sheet) : []),
    `Pacing: ${facts.director.pacing.tension}. Private note: ${facts.director.goalNote}`,
    section("Present characters", npcs, 400, "end"),
    section(
      "Recent transcript",
      transcriptEntries(input.assembled.transcriptTail, input.roster),
      CAPS.transcript,
      "start",
    ),
  ]);
  return { system, user };
}
