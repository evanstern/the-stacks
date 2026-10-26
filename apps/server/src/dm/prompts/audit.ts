/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import { renderDoctrine } from "../doctrine/doctrine.js";
import type { NarrationFacts } from "../facts.js";
import { CAPS, capEntries, joinSections, section } from "./common.js";
import { characterSections, factEntries } from "./narrate.js";

export const PROMPT_VERSION = "dm.audit-v2";

const OUTPUT_SHAPE = [
  "Reply with ONE JSON object and nothing else:",
  '{"verdict":"pass"|"fail","issues":[{"kind":"ledger-mismatch"|"invented-mechanics"|"player-agency"|"doctrine"|"other","detail":str (300 characters at most)}]}',
  "Use verdict fail only with at least one issue. At most eight issues.",
].join("\n");

export function buildAuditPrompt(input: {
  facts: NarrationFacts;
  prose: string;
}): { system: string; user: string } {
  const doctrine = capEntries(
    renderDoctrine("audit").split("\n\n"),
    CAPS.doctrine,
    "end",
  ).join("\n\n");
  const system = [
    "You audit a narration against the facts of one beat of a tabletop role-playing session. The facts are TRUE. The narration is on trial.",
    "Report an issue when the narration contradicts a fact, invents a roll or a mechanic, decides what a player character says, feels or does, or breaks the doctrine. Use these definitions:",
    "1. `player-agency`: the prose decides what a PARTY member says, feels or chooses beyond their declared action. Showing a party member carry out their declared action is allowed. Words, moves and feelings of every other character are the world's, never `player-agency`.",
    "2. `invented-mechanics` or `ledger-mismatch`: the prose grants a rules result no fact records — a hit, a wound, a condition, a death, a success at an uncertain task, or a hidden discovery — or contradicts a fact. No rules effect means nothing was rolled; the attempt still happens and the world may respond. That is not a mismatch.",
    "3. When the facts ask a question, ending on that open question is correct.",
    "4. Code checks length; do not report length.",
    "5. Report craft concerns as `doctrine`. They are advice and do not fail the narration.",
    "Doctrine:",
    doctrine,
    OUTPUT_SHAPE,
  ].join("\n\n");
  const user = joinSections([
    ...characterSections(input.facts),
    section("Facts", factEntries(input.facts), CAPS.facts, "end"),
    `## Narration\n${input.prose}`,
  ]);
  return { system, user };
}
