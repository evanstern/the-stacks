/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import { agencyRule, renderDoctrine } from "../doctrine/doctrine.js";
import {
  type FactEvent,
  type FactRoll,
  type NarrationFacts,
  outcomeWord,
} from "../facts.js";
import type { AssembleOutput } from "../nodes/assemble.js";
import type { AuditIssue } from "../nodes/audit.js";
import type { PlayerSeedView } from "../seed/views.js";
import {
  type ActorSnapshot,
  renderSnapshot,
  SnapshotOverflowError,
} from "../snapshot/index.js";
import {
  CAPS,
  capEntries,
  joinSections,
  type RosterEntry,
  section,
  transcriptEntries,
} from "./common.js";

export const PROMPT_VERSION = "dm.narrate-v11";

const RULES = [
  "You narrate the result of one beat of a tabletop role-playing session. The facts below are TRUE and already decided by the rules engine. Retell them as story.",
  "Write plain prose only: one short scene of about one hundred words, never more than one hundred fifty. No lists, no headings, no bold.",
  "Write NO digits. Do not state totals, damage numbers, hit points, armor class or difficulty. Code appends the dice lines after your prose.",
  "Never contradict a fact. A hit lands, a miss misses, a failure fails. Do not invent rolls, dice or mechanics.",
  agencyRule("narrate"),
  "Every other character is part of the world. Give them words, moves and reactions.",
  "No rules effect means nothing was rolled. The attempt still happens; show what the world does with it. Never grant a hit, a wound, a condition, a death or a hidden discovery without a fact.",
  "When a foe's attack misses a party member, its grab fails, or a party member succeeds on a save against it, tell it from the foe's side: the blow goes wide, glances off armour, finds only air. On a miss listed under Reflex, the party member may flinch. The flinch never causes the miss. Never show the party member choosing a defence: no dodge, no duck, no twist that times the blow, no step aside. Never show a wound unless a fact records damage.",
  "A roll's band and consequence are decided. Tell that consequence; invent no other. A success at a cost succeeds and the consequence lands. A severe failure fails worse than a plain failure. A free retry with no roll succeeds.",
  "When an intent is unclear, describe the moment, then end with the Unclear intent question exactly as written.",
  "Cover every Event line.",
  "Only the actor named on the Turn line acts in this beat. The actor on the Next line has not acted: never show them move, speak or strike.",
  "Name a character as dead or unconscious only when a fact or the state sections say so; when a fact says so, say so.",
  "A dead, unconscious, stable or absent character does not act or speak. Count only what the state sections show.",
  "A not-yet-attempted step has not happened, in this beat or an earlier one. Stop before it; never show it start or done.",
  "End on something that demands a response. Do not end with an either-or question, except the Unclear intent question.",
].join("\n");

/** The facts as capped entries, most important first. */
function rollEntry(r: FactRoll): string {
  if (r.reaction) {
    return `  reaction: ${r.name} strikes at ${r.target ?? "them"} as they pull away -> ${r.outcome ?? "no result"}`;
  }
  const target = r.target ? ` target ${r.target}` : "";
  const word = outcomeWord(r) ?? "no result";
  const noRoll = r.autoSuccess ? " (no roll needed; a free retry)" : "";
  const consequence = r.consequence ? `; consequence: ${r.consequence}` : "";
  return `  roll: ${r.reason}${target} -> ${word}${noRoll}${consequence}`;
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
  }
  for (const a of facts.actions) {
    const head = `Action ${a.actionId} by ${a.characterName ?? "the party"}: "${a.text}" -> `;
    const onHold = facts.clarify.some((c) => c.actionId === a.actionId);
    if (a.outcome === "refused") {
      out.push(
        `${head}refused${a.refusalCode ? ` (refused: ${a.refusalCode})` : ""}`,
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
  for (const st of facts.settled ?? []) {
    out.push(`Downed turn: ${st.name}`);
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
  for (const r of facts.rulings) {
    out.push(
      `Ruling for ${r.actionId}: ${r.ruling}${r.improvised ? " (improvised)" : ""}`,
    );
  }
  for (const c of facts.clarify) {
    out.push(`Unclear intent for ${c.actionId}: ${c.question}`);
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
  // One line per actor follows the stage lines, in snapshot order.
  const stage = r.lines.slice(0, r.lines.length - snapshot.actors.length);
  const actorLines = r.lines.slice(stage.length);
  const party = actorLines.filter(
    (_, i) => snapshot.actors[i]?.kind === "party",
  );
  const world = actorLines.filter(
    (_, i) => snapshot.actors[i]?.kind !== "party",
  );
  const label = (name: string, lines: string[]): string =>
    lines.length > 0 ? `## ${name}\n${lines.join("\n")}` : "";
  return [
    label("Scene state", stage),
    label("Party (player characters)", party),
    label("Other characters (the world)", world),
  ];
}

export interface NarratePromptInput {
  seed: PlayerSeedView;
  roster: readonly RosterEntry[];
  assembled: AssembleOutput;
  /** S1: the actor snapshot after resolve. */
  snapshot: ActorSnapshot;
  facts: NarrationFacts;
  prior: { prose: string; issues: AuditIssue[] } | null;
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
  const scene =
    facts.trigger === "scene-start"
      ? [
          `Open the scene. Framing: ${seed.openingFraming}`,
          "The opening shows the place and what the party finds. It never moves, leads or voices a party member.",
          `Location: ${seed.location.name}. Mood: ${seed.location.mood}`,
        ]
      : [];
  const prior = input.prior
    ? [
        "Your previous text was rejected. Write it again and fix every issue.",
        `Previous text: ${input.prior.prose}`,
        ...input.prior.issues.map((i) => `Issue (${i.kind}): ${i.detail}`),
      ]
    : [];
  const user = joinSections([
    scene.join("\n"),
    ...characterSections(input.snapshot),
    section("Facts", factEntries(facts), CAPS.facts, "end"),
    `Pacing: ${facts.director.pacing.tension}. Private note: ${facts.director.goalNote}`,
    section("Present characters", npcs, 400, "end"),
    section(
      "Recent transcript",
      transcriptEntries(input.assembled.transcriptTail, input.roster),
      CAPS.transcript,
      "start",
    ),
    prior.join("\n"),
  ]);
  return { system, user };
}
