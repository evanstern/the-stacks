import type {
  ProposalView,
  SessionProjections,
} from "@the-stacks/session-model";
import type { TurnCheckpoint } from "./jobs.js";
import type { Ruling } from "./nodes/adjudicate.js";
import type { Submission } from "./nodes/resolve.js";
import {
  type AnyInterpretReading,
  InterpretReadingSchema,
  LegacyInterpretReadingSchema,
  StepSchema,
} from "./nodes/schemas.js";

/**
 * Resume classification (specs/057-human-dm-roll-resume contracts/turn-resume.md).
 * Pure functions over the projections and earlier turn checkpoints: no model,
 * no write. A turn that follows a human DM's approval reuses the paused turn's
 * plan for an action instead of interpreting it again.
 */

export interface ResumedPlan {
  actionId: string;
  /** The job whose checkpoint holds the plan. */
  fromJobId: string;
  reading: AnyInterpretReading;
  ruling: Ruling | null;
  /** That job's submissions whose key starts `act:<actionId>:`. */
  submissions: Submission[];
}

/** One earlier turn job's checkpoint; lists are newest first. */
export interface PriorTurn {
  jobId: string;
  checkpoint: TurnCheckpoint;
}

const AI_DM = "ai:dm";

/** The action id a proposal of a resume-relevant kind names, else null. */
function namedAction(p: ProposalView): string | null {
  const proposal = p.proposal;
  switch (proposal.kind) {
    case "mechanics":
    case "scene-presence":
      return proposal.actionId ?? null;
    case "action.resolve":
      return proposal.resolution.actionId;
    case "intent":
      // Spec 104 D3: a stage's Intent id is `<actionId>.<n>`; the monster turn's has no action.
      return proposal.intent.id.startsWith("npc.")
        ? null
        : proposal.intent.id.replace(/\.\d+$/, "");
    default:
      return null;
  }
}

/** Candidates a pending `ai:dm` proposal names: the human DM has not ruled yet. */
export function awaitingActionIds(
  p: SessionProjections,
  candidates: readonly string[],
): Set<string> {
  const wanted = new Set(candidates);
  const out = new Set<string>();
  for (const v of p.proposals) {
    if (v.status !== "pending" || v.proposer !== AI_DM) continue;
    const id = namedAction(v);
    if (id !== null && wanted.has(id)) out.add(id);
  }
  return out;
}

/** True when any `ai:dm` proposal names a candidate: only then is an earlier turn worth reading. */
export function needsPriorTurns(
  p: SessionProjections,
  candidates: readonly string[],
): boolean {
  const wanted = new Set(candidates);
  return p.proposals.some((v) => {
    if (v.proposer !== AI_DM) return false;
    const id = namedAction(v);
    return id !== null && wanted.has(id);
  });
}

const keyPrefix = (actionId: string) => `act:${actionId}:`;

export function findResumedPlans(
  p: SessionProjections,
  candidates: readonly string[],
  prior: readonly PriorTurn[],
): ResumedPlan[] {
  const plans: ResumedPlan[] = [];
  for (const actionId of candidates) {
    const turn = prior.find((t) =>
      t.checkpoint.submissions.some((s) =>
        s.key.startsWith(keyPrefix(actionId)),
      ),
    );
    if (!turn) continue;
    const submissions = turn.checkpoint.submissions.filter((s) =>
      s.key.startsWith(keyPrefix(actionId)),
    );
    const last = submissions[submissions.length - 1];
    if (!last || (last.result !== "pending" && last.result !== "suggested")) {
      continue;
    }
    const proposal = p.proposals.find((v) => v.proposalId === last.proposalId);
    if (last.proposalId === null || proposal?.status !== "approved") continue;
    const reading = turn.checkpoint.interpret?.readings.find(
      (r) => r.actionId === actionId,
    );
    if (!reading) continue;
    const ruling =
      turn.checkpoint.adjudicate?.rulings.find(
        (r) => r.actionId === actionId,
      ) ?? null;
    // Spec 082 D10: a checkpoint written before the step contract changed is
    // dropped, so the action is interpreted again.
    if (
      !(
        InterpretReadingSchema.safeParse(reading).success ||
        LegacyInterpretReadingSchema.safeParse(reading).success
      ) ||
      (ruling !== null && !StepSchema.array().safeParse(ruling.steps).success)
    ) {
      continue;
    }
    plans.push({
      actionId,
      fromJobId: turn.jobId,
      reading,
      ruling,
      submissions,
    });
  }
  return plans;
}

/** Rewrites an approved paused submission as applied, from the gate's own rows. */
export function refreshSubmission(
  p: SessionProjections,
  s: Submission,
): Submission {
  if (s.result !== "pending" || s.proposalId === null) return s;
  const view = p.proposals.find((v) => v.proposalId === s.proposalId);
  if (view?.status !== "approved") return s;
  const batchId = view.decided?.batchId ?? null;
  let outcome: string | null = null;
  let band: string | null = null;
  if (batchId !== null) {
    for (const r of p.ledger) {
      if (
        r.kind === "outcome" &&
        r.batchId === batchId &&
        "outcome" in r.outcome &&
        (r.outcome.type === "check.resolved" ||
          r.outcome.type === "attack.resolved")
      ) {
        outcome = r.outcome.outcome;
        band = "band" in r.outcome ? (r.outcome.band ?? null) : null;
      }
    }
  }
  return { ...s, result: "applied", batchId, outcome, band, seqs: [] };
}
