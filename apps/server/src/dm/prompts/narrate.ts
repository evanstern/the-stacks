/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import { renderDoctrine } from "../doctrine/doctrine.js";
import type { FactEvent, FactRoll, NarrationFacts } from "../facts.js";
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

export const PROMPT_VERSION = "dm.narrate-v5";

const RULES = [
  "You narrate the result of one beat of a tabletop role-playing session. The facts below are TRUE and already decided by the rules engine. Retell them as story.",
  "Write plain prose only: one short scene of about one hundred words, never more than one hundred fifty. No lists, no headings, no bold.",
  "Write NO digits. Do not state totals, damage numbers, hit points, armor class or difficulty. Code appends the dice lines after your prose.",
  "Never contradict a fact. A hit lands, a miss misses, a failure fails. Do not invent rolls, dice or mechanics.",
  "The party members are player characters, AI companions included. Never decide what one says, feels or chooses. You may show a party member carrying out the action they declared, in plain words, and nothing more. Never invent a companion's speech or state; companions speak for themselves.",
  "Every other character is part of the world. Give them words, moves and reactions.",
  "No rules effect means nothing was rolled. The attempt still happens; show what the world does with it. Never grant a hit, a wound, a condition, a death or a hidden discovery without a fact.",
  "When a foe's attack misses, its grab fails, or a party member succeeds on a save against it, describe only what the foe did. The party member stays unchanged and unmoved: no wound, no dodge, no twisting free. Never show a wound on a party member unless a fact records damage to them.",
  "When an intent is unclear, describe the moment, then end with one short open question in your own words that asks what that character does. Never offer options.",
  "Cover every Event line.",
  "Name a character as dead or unconscious only when a fact or the state sections say so; when a fact says so, say so.",
  "A dead, unconscious, stable or absent character does not act or speak. Count only what the state sections show.",
  "End on something that demands a response. Do not end with an either-or question.",
].join("\n");

/** The facts as capped entries, most important first. */
function rollEntry(r: FactRoll): string {
  const target = r.target ? ` target ${r.target}` : "";
  return `  roll: ${r.reason}${target} -> ${r.outcome ?? "no result"}`;
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

export function factEntries(facts: NarrationFacts): string[] {
  const out: string[] = [];
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
  }
  if (facts.npcTurn) {
    out.push(`Monster turn: ${facts.npcTurn.name}`);
    for (const r of facts.npcTurn.rolls) out.push(rollEntry(r));
    for (const c of facts.npcTurn.changes)
      out.push(`  change: ${describeChange(c)}`);
  }
  for (const st of facts.settled ?? []) {
    out.push(`Downed turn: ${st.name}`);
    for (const r of st.rolls) out.push(rollEntry(r));
    for (const c of st.changes) out.push(`  change: ${describeChange(c)}`);
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
