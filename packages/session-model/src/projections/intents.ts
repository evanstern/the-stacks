import type { Intent } from "@the-stacks/intent";
import type { RulingRequest } from "@the-stacks/planner";
import type { SessionNativeEvent } from "../catalog.js";
import type { IntentView, SessionProjections } from "./types.js";

type RecordedEvent = Extract<SessionNativeEvent, { type: "intent.recorded" }>;

/**
 * Folds one `intent.recorded` row. A later row for the same id (a confirm of a declared
 * Intent) replaces the entry; a row with `answers` closes the named request.
 */
export function recordIntent(
  intents: IntentView[],
  event: RecordedEvent,
): IntentView[] {
  const { intent, outcome, request, answers, batchId } = event.payload;
  const prior = intents.find((v) => v.id === intent.id);
  const view: IntentView = {
    id: intent.id,
    seq: prior?.seq ?? event.seq,
    actor: event.actor,
    intent: intent as Intent,
    status: outcome,
    request: request as RulingRequest | null,
    batchIds: [...(prior?.batchIds ?? []), ...(batchId ? [batchId] : [])],
    proposalId: prior?.proposalId ?? null,
  };
  const next = prior
    ? intents.map((v) => (v === prior ? view : v))
    : [...intents, view];
  return answers === null
    ? next
    : next.map((v) =>
        v.request?.requestId === answers && v.status === "needs_ruling"
          ? { ...v, status: "answered" as const }
          : v,
      );
}

/** Names the Intent a `proposal.created` row of kind `intent` carries. */
export function linkProposal(
  intents: IntentView[],
  intentId: string,
  proposalId: string,
): IntentView[] {
  return intents.map((v) => (v.id === intentId ? { ...v, proposalId } : v));
}

/** Open ruling requests by `requestId`, with the proposal row that mirrors each. */
export function openRulings(
  p: SessionProjections,
): Record<string, RulingRequest & { proposalId: string | null }> {
  const out: Record<string, RulingRequest & { proposalId: string | null }> = {};
  for (const v of p.intents) {
    if (v.status === "needs_ruling" && v.request) {
      out[v.request.requestId] = { ...v.request, proposalId: v.proposalId };
    }
  }
  return out;
}
