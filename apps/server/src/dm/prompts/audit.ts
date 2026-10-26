/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import { renderDoctrine } from "../doctrine/doctrine.js";
import type { NarrationFacts } from "../facts.js";
import { CAPS, capEntries, joinSections, section } from "./common.js";
import { factEntries } from "./narrate.js";

export const PROMPT_VERSION = "dm.audit-v1";

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
    "Fail the narration when it contradicts a fact, invents a roll or a mechanic, decides what a player character says, feels or does, or breaks the doctrine.",
    "Doctrine:",
    doctrine,
    OUTPUT_SHAPE,
  ].join("\n\n");
  const user = joinSections([
    section("Facts", factEntries(input.facts), CAPS.facts, "end"),
    `## Narration\n${input.prose}`,
  ]);
  return { system, user };
}
