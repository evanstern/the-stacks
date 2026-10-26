/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import { renderDoctrine } from "../doctrine/doctrine.js";
import type { NarrationFacts } from "../facts.js";
import type { AssembleOutput } from "../nodes/assemble.js";
import type { AuditIssue } from "../nodes/audit.js";
import type { PlayerSeedView } from "../seed/views.js";
import {
  CAPS,
  capEntries,
  joinSections,
  type RosterEntry,
  section,
  transcriptEntries,
} from "./common.js";

export const PROMPT_VERSION = "dm.narrate-v1";

const RULES = [
  "You narrate the result of one beat of a tabletop role-playing session. The facts below are TRUE and already decided by the rules engine. Retell them as story.",
  "Write plain prose only: one short scene of about one hundred words, never more than one hundred fifty. No lists, no headings, no bold.",
  "Write NO digits. Do not state totals, damage numbers, hit points, armor class or difficulty. Code appends the dice lines after your prose.",
  "Never contradict a fact. A hit lands, a miss misses, a failure fails. Do not invent rolls, dice or mechanics.",
  "Never decide what a player character says, feels or does. Narrate what the world did.",
  "Name a character as dead or unconscious only when a fact says so; when a fact says so, say so.",
  "End on something that demands a response. Do not end with an either-or question.",
].join("\n");

/** The facts as capped entries, most important first. */
export function factEntries(facts: NarrationFacts): string[] {
  const out: string[] = [];
  for (const a of facts.actions) {
    out.push(
      `Action ${a.actionId} by ${a.characterName ?? "the party"}: "${a.text}" -> ${a.outcome}${a.refusalCode ? ` (refused: ${a.refusalCode})` : ""}`,
    );
    if (a.outcomes.length > 0) out.push(`  results: ${a.outcomes.join(", ")}`);
    for (const c of a.changes) out.push(`  change: ${describeChange(c)}`);
  }
  if (facts.npcTurn) {
    out.push(`Monster turn: ${facts.npcTurn.name}`);
    if (facts.npcTurn.outcomes.length > 0) {
      out.push(`  results: ${facts.npcTurn.outcomes.join(", ")}`);
    }
    for (const c of facts.npcTurn.changes)
      out.push(`  change: ${describeChange(c)}`);
  }
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
    out.push(
      `Ask the player of ${c.actionId} one short question: ${c.question}`,
    );
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
  }
}

export interface NarratePromptInput {
  seed: PlayerSeedView;
  roster: readonly RosterEntry[];
  assembled: AssembleOutput;
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
