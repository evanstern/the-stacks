import type { SrdKind } from "@the-stacks/srd";
import { isRelevant } from "../../library/answer.js";
import { locateQuote } from "../../library/cite.js";
import type { RetrievedPassage } from "../../library/retrieve.js";
import { callJson } from "../pipeline/call.js";
import type { ModelCallRecord, Node } from "../pipeline/context.js";
import {
  buildAdjudicatePrompt,
  PROMPT_VERSION,
} from "../prompts/adjudicate.js";
import { PURPOSE_OF } from "../purposes.js";
import { AdjudicateModelOutput, type Step } from "./schemas.js";

/**
 * The adjudicate node (contracts/nodes.md "adjudicate"). One `retrieve` per
 * adjudicated action, relevant passages numbered into the prompt, citations
 * verified in code (`locateQuote` for the library, a record lookup for the
 * SRD). A ruling with no verified citation is marked `improvised` (FR-072).
 * The model supplies mechanics inputs only; the engine owns every number.
 */

export type VerifiedCitation =
  | {
      source: "library";
      chunkId: string;
      book: string;
      path: string[];
      quote: string;
      span: { start: number; end: number };
    }
  | {
      source: "srd";
      kind: SrdKind;
      id: string;
      name: string;
      page: number;
    };

export interface Ruling {
  /** Null for a monster turn. */
  actionId: string | null;
  ruling: string;
  /** True when no citation verified. */
  improvised: boolean;
  citations: VerifiedCitation[];
  /** Citations that failed verification. */
  dropped: number;
  steps: Step[];
}

export interface AdjudicateOutput {
  rulings: Ruling[];
}

function verifyLibrary(
  passages: RetrievedPassage[],
  p: number,
  quote: string,
): VerifiedCitation | null {
  const passage = passages[p - 1];
  if (!passage) return null;
  const match = locateQuote(passage.text, quote);
  if (!match) return null;
  return {
    source: "library",
    chunkId: passage.chunkId,
    book: passage.anchor.book,
    path: passage.anchor.path,
    quote: passage.text.slice(match.start, match.end),
    span: {
      start: passage.anchor.start + match.start,
      end: passage.anchor.start + match.end,
    },
  };
}

export const adjudicate: Node<"adjudicate"> = async (ctx) => {
  const assembled = ctx.results.assemble;
  const interpret = ctx.results.interpret;
  if (!assembled || !interpret) {
    return {
      ok: false,
      node: "adjudicate",
      calls: [],
      error: {
        kind: "internal",
        message: "adjudicate ran before assemble and interpret",
      },
    };
  }
  const calls: ModelCallRecord[] = [];
  const rulings: Ruling[] = [];
  const resumedIds = new Set((assembled.resumed ?? []).map((r) => r.actionId));

  for (const reading of interpret.readings) {
    if (!reading.needsAdjudication || reading.rulesQuestion === null) continue;
    // A resumed reading keeps the ruling its paused turn made (specs/057).
    if (reading.actionId !== null && resumedIds.has(reading.actionId)) continue;

    let relevant: RetrievedPassage[] = [];
    try {
      const retrieved = await ctx.deps.retrieve({
        question: reading.rulesQuestion,
        signal: ctx.signal,
      });
      relevant = retrieved.passages.filter((p) =>
        isRelevant(p, ctx.deps.minSimilarity),
      );
    } catch (error) {
      if (ctx.signal.aborted) {
        return {
          ok: false,
          node: "adjudicate",
          calls,
          error: { kind: "aborted", message: "the turn was aborted" },
        };
      }
      // Retrieval failure leaves the ruling uncited; it ships improvised.
      ctx.deps.log({
        event: "dm.adjudicate.retrieval-failed",
        jobId: ctx.job.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const action = assembled.beat.find((b) => b.actionId === reading.actionId);
    const prompt = buildAdjudicatePrompt({
      seed: ctx.seed,
      assembled,
      reading,
      actionText: action?.text ?? "A monster takes its turn.",
      passages: relevant,
    });
    const result = await callJson(ctx.deps, {
      purpose: PURPOSE_OF.adjudicate,
      promptVersion: PROMPT_VERSION,
      system: prompt.system,
      user: prompt.user,
      schema: AdjudicateModelOutput,
      signal: ctx.signal,
    });
    calls.push(...result.calls);
    if (!result.ok) {
      return { ok: false, node: "adjudicate", error: result.error, calls };
    }

    const citations: VerifiedCitation[] = [];
    let dropped = 0;
    for (const c of result.value.citations) {
      if (c.source === "library") {
        const verified = verifyLibrary(prompt.passages, c.p, c.quote);
        if (verified) citations.push(verified);
        else dropped += 1;
        continue;
      }
      const record = ctx.deps.srd.getById(c.kind, c.id) as
        | { name: string; source: { page: number } }
        | undefined;
      if (record) {
        citations.push({
          source: "srd",
          kind: c.kind,
          id: c.id,
          name: record.name,
          page: record.source.page,
        });
      } else {
        dropped += 1;
      }
    }
    rulings.push({
      actionId: reading.actionId,
      ruling: result.value.ruling,
      improvised: citations.length === 0,
      citations,
      dropped,
      steps: result.value.steps,
    });
  }
  for (const plan of assembled.resumed ?? []) {
    if (plan.ruling) rulings.push(plan.ruling);
  }
  return { ok: true, node: "adjudicate", output: { rulings }, calls };
};
