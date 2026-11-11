import { toText } from "@the-stacks/intent";
import type { openRulings } from "@the-stacks/session-model";

type RulingRequest = ReturnType<typeof openRulings>[string];

export const PROMPT_VERSION = "dm.ruling-v1";

const OUTPUT_SHAPE = [
  "Reply with ONE JSON object and nothing else:",
  '{"decision":"accept"|"reject","difficulty":"very-easy"|"easy"|"medium"|"hard"|"very-hard"|"nearly-impossible" (only when asked for a difficulty),"reason":str (one short line)}',
  "Never write a number: no DC, no damage, no roll result. The engine rolls and decides every number.",
].join("\n");

/** Spec 102 FR-023: the prompt for one open ruling request. */
export function buildRulingPrompt(request: RulingRequest): {
  system: string;
  user: string;
} {
  const ask =
    request.ask === "difficulty"
      ? "How hard is this attempt? Accept with a difficulty tier, or reject it as impossible."
      : "May this attempt succeed without a roll? Accept to let it succeed as described, or reject.";
  const stakes =
    request.stakes === "self"
      ? "The risk falls on the actor alone."
      : "The result affects someone else.";
  const user = [
    `A player's action needs a ruling.`,
    `Action: ${toText(request.intent) || request.intent.kind}`,
    request.rule ? `Rule: ${request.rule}` : "",
    stakes,
    ask,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    system: [
      "You are the dungeon master ruling on one player action in a tabletop role-playing game. Decide whether the action works and, when asked, how hard it is.",
      OUTPUT_SHAPE,
    ].join("\n\n"),
    user,
  };
}
