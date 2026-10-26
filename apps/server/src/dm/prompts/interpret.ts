/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import { renderDoctrine } from "../doctrine/doctrine.js";
import type { AssembleOutput } from "../nodes/assemble.js";
import type { DirectorNodeOutput } from "../nodes/director.js";
import type { TurnContext } from "../pipeline/context.js";
import {
  beatEntries,
  CAPS,
  capEntries,
  joinSections,
  projectionEntries,
  STEP_GRAMMAR,
  section,
  seedEntries,
  srdEntries,
  transcriptEntries,
} from "./common.js";

export const PROMPT_VERSION = "dm.interpret-v1";

const OUTPUT_SHAPE = [
  "Reply with ONE JSON object and nothing else:",
  '{"readings":[{"actionId":id|null,"intent":"talk"|"move"|"check"|"save"|"attack"|"spell"|"help"|"rest"|"other","uncertain":bool,"needsAdjudication":bool,"rulesQuestion":str|null,"clarify":str|null,"steps":[step]}]}',
  "Write exactly one reading per beat item, keyed by its actionId. Write one reading with actionId null for a monster turn. Roll only when the outcome is uncertain and failure is interesting; for a certain outcome use a none step. Set needsAdjudication true, with a rulesQuestion, when the rules are unclear or the action is inventive; then leave steps empty. When intent is unclear, set clarify to one short question and leave steps empty. Plan only the steps that are not already applied (see Already applied).",
].join("\n");

export function buildInterpretPrompt(input: {
  ctx: TurnContext;
  assembled: AssembleOutput;
  director: DirectorNodeOutput;
}): { system: string; user: string } {
  const { ctx, assembled, director } = input;
  const doctrine = capEntries(
    renderDoctrine("interpret").split("\n\n"),
    CAPS.doctrine,
    "end",
  ).join("\n\n");
  const system = [
    "You are the rules reader of a tabletop role-playing pipeline. You turn each declared action into mechanics inputs. You never decide a result.",
    "Doctrine:",
    doctrine,
    STEP_GRAMMAR,
    OUTPUT_SHAPE,
  ].join("\n\n");

  const applied = Object.entries(assembled.priorSteps).map(
    ([actionId, rows]) =>
      `${actionId}: ${rows.length} ledger rows already applied (${rows
        .map((r) => r.reason)
        .slice(0, 4)
        .join(" | ")})`,
  );
  const user = joinSections([
    section("Scene seed", seedEntries(ctx.seed, assembled), CAPS.seed, "end"),
    section(
      "State",
      projectionEntries(assembled.projections, ctx.seed, false),
      CAPS.projections,
      "end",
    ),
    section(
      "Recent transcript",
      transcriptEntries(assembled.transcriptTail),
      CAPS.transcript,
      "start",
    ),
    section(
      "SRD records",
      srdEntries(assembled),
      CAPS.srdRecords * CAPS.srdPerRecord,
      "end",
    ),
    `Pacing: ${director.pacing.tension}; note: ${director.goalNote}`,
    section("Beat items", beatEntries(assembled.beat), 800, "end"),
    assembled.npcTurn
      ? `Monster turn: ${assembled.npcTurn.combatantId}${assembled.npcTurn.srdMonsterId ? ` (SRD ${assembled.npcTurn.srdMonsterId})` : ""}. Write one reading with actionId null.`
      : "",
    section("Already applied", applied, 400, "end"),
  ]);
  return { system, user };
}
