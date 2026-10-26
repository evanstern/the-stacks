import { estimateTokens } from "@the-stacks/srd";
import type { RetrievedPassage } from "../../library/retrieve.js";
import type { AssembleOutput } from "../nodes/assemble.js";
import type { InterpretReading } from "../nodes/schemas.js";
import type { SceneSeed } from "../seed/schema.js";
import {
  CAPS,
  joinSections,
  projectionEntries,
  STEP_GRAMMAR,
  section,
  srdEntries,
} from "./common.js";

export const PROMPT_VERSION = "dm.adjudicate-v1";

const OUTPUT_SHAPE = [
  "Reply with ONE JSON object and nothing else:",
  '{"ruling":str (one line),"citations":[{"source":"library","p":N,"quote":"exact words copied from passage N"}|{"source":"srd","kind":"monster"|"spell"|"class"|"equipment"|"condition","id":str}],"steps":[step] (1 to 6)}',
  "Cite only what supports the ruling. A library quote must be copied verbatim from the numbered passage. An SRD citation names a record from the SRD records given. If nothing given supports a ruling, return no citations and rule from common sense: that ruling will be marked improvised.",
].join("\n");

/** At most 5 passages, 2,500 tokens: best-ranked kept, lowest-ranked cut first. */
export function selectPassages(
  passages: RetrievedPassage[],
): RetrievedPassage[] {
  const kept = passages.slice(0, CAPS.passageCount);
  const cost = (p: RetrievedPassage) => estimateTokens(p.text) + 20;
  let total = kept.reduce((n, p) => n + cost(p), 0);
  while (kept.length > 1 && total > CAPS.passages) {
    const last = kept.pop() as RetrievedPassage;
    total -= cost(last);
  }
  return kept;
}

export function buildAdjudicatePrompt(input: {
  seed: SceneSeed;
  assembled: AssembleOutput;
  reading: InterpretReading;
  actionText: string;
  passages: RetrievedPassage[];
}): { system: string; user: string; passages: RetrievedPassage[] } {
  const passages = selectPassages(input.passages);
  const system = [
    "You are the rules judge of a tabletop role-playing pipeline. You answer one rules question for the action in front of you, citing the rules text you were given, and state the mechanics inputs that follow. You never decide a result: the engine rolls and decides every number.",
    STEP_GRAMMAR,
    OUTPUT_SHAPE,
  ].join("\n\n");

  const passageBlocks = passages.map(
    (p, i) =>
      `<passage p="${i + 1}" book="${p.anchor.book}" section="${p.anchor.path.join(" › ")}">${p.text}</passage>`,
  );
  const user = joinSections([
    `Action ${input.reading.actionId ?? "(monster turn)"}: ${input.actionText}`,
    `Rules question: ${input.reading.rulesQuestion ?? ""}`,
    section(
      "State",
      projectionEntries(input.assembled.projections, input.seed, false),
      CAPS.projections,
      "end",
    ),
    section(
      "SRD records",
      srdEntries(input.assembled),
      CAPS.srdRecords * CAPS.srdPerRecord,
      "end",
    ),
    passageBlocks.length > 0
      ? `## Library passages\n${passageBlocks.join("\n\n")}`
      : "## Library passages\n(none relevant)",
  ]);
  return { system, user, passages };
}
