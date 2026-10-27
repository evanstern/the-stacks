import type { SessionProjections } from "@the-stacks/session-model";
import { actorLabel } from "../play/labels.ts";
import type { DebugJob } from "./api-types.ts";
import { readTurnResult } from "./read-result.ts";
import type { DebugSnapshot } from "./snapshot.ts";

export const STUCK_AFTER_MS = 15_000;

export interface WaitingSummary {
  active: {
    id: string;
    kind: string;
    stage: string | null;
    attempts: number;
    heartbeatAgeMs: number | null;
  }[];
  uncommitted: { actionId: string; actorLabel: string; status: string }[];
  mode:
    | { kind: "free" }
    | { kind: "turn"; actorLabel: string; round: number | null };
  proposals: { proposalId: string; kind: string; policy: string }[];
  holds: {
    turnJobId: string;
    companionJobId: string | null;
    companionStatus: string | null;
  }[];
  latestFailure: {
    jobId: string;
    node: string;
    kind: string;
    message: string;
    finishedAt: string;
  } | null;
  stuck: boolean;
  showRetry: boolean;
}

type WaitingProjection = Pick<
  SessionProjections,
  "actions" | "party" | "tableMode" | "encounter" | "proposals"
>;

const ms = (iso: string | null): number | null => {
  if (iso === null) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

const isLive = (j: DebugJob) => j.status === "queued" || j.status === "running";

function companionFor(
  jobs: readonly DebugJob[],
  turnId: string,
): DebugJob | null {
  let found: DebugJob | null = null;
  for (const j of jobs) {
    if (j.kind !== "companion") continue;
    const input = j.input as { beatJobId?: unknown } | null;
    if (input && typeof input === "object" && input.beatJobId === turnId) {
      if (!found || j.createdAt > found.createdAt) found = j;
    }
  }
  return found;
}

/** Why the table is waiting. Pure over the snapshot, the DM projection and `now`. */
export function toWaitingSummary(
  snapshot: Pick<DebugSnapshot, "jobs" | "events">,
  projections: WaitingProjection,
  now: number,
): WaitingSummary {
  const jobs = [...snapshot.jobs.values()];

  const active = jobs.filter(isLive).map((j) => {
    const hb = ms(j.heartbeatAt);
    return {
      id: j.id,
      kind: j.kind,
      stage: j.stage,
      attempts: j.attempts,
      heartbeatAgeMs: hb === null ? null : Math.max(0, now - hb),
    };
  });

  const uncommitted = projections.actions
    .filter((a) => a.status === "declared" || a.status === "discussed")
    .map((a) => ({
      actionId: a.actionId,
      actorLabel: actorLabel(a.actor, projections.party, ""),
      status: a.status,
    }));

  const tm = projections.tableMode;
  const mode: WaitingSummary["mode"] =
    tm.mode === "turn"
      ? {
          kind: "turn",
          actorLabel: actorLabel(tm.activeActor, projections.party, ""),
          round: projections.encounter?.round ?? null,
        }
      : { kind: "free" };

  const proposals = projections.proposals
    .filter((p) => p.status === "pending")
    .map((p) => ({ proposalId: p.proposalId, kind: p.kind, policy: p.policy }));

  // A held turn stays listed until its companion job has succeeded.
  const holds: WaitingSummary["holds"] = [];
  for (const j of jobs) {
    if (j.kind !== "turn" || j.status !== "succeeded") continue;
    if (readTurnResult(j.result).outcome !== "held") continue;
    const c = companionFor(jobs, j.id);
    if (c?.status === "succeeded") continue;
    holds.push({
      turnJobId: j.id,
      companionJobId: c?.id ?? null,
      companionStatus: c?.status ?? null,
    });
  }

  let newestNarrationSeq = 0;
  let newestNarrationTs: number | null = null;
  let newestCommit: { seq: number; ts: number | null } | null = null;
  for (const e of snapshot.events) {
    if (e.type === "narration" && e.seq >= newestNarrationSeq) {
      newestNarrationSeq = e.seq;
      newestNarrationTs = ms(e.ts);
    } else if (e.type === "action.committed") {
      if (!newestCommit || e.seq > newestCommit.seq)
        newestCommit = { seq: e.seq, ts: ms(e.ts) };
    }
  }

  let latestFailure: WaitingSummary["latestFailure"] = null;
  let latestFailureAt = -Infinity;
  for (const j of jobs) {
    if (j.kind !== "turn" || j.status !== "failed") continue;
    const at = ms(j.finishedAt);
    if (at === null) continue;
    if (newestNarrationTs !== null && at <= newestNarrationTs) continue;
    if (at < latestFailureAt) continue;
    const f = readTurnResult(j.result).failure;
    latestFailureAt = at;
    latestFailure = {
      jobId: j.id,
      node: f?.node ?? "unknown",
      kind: f?.kind ?? "unknown",
      message: f?.message || j.error || "",
      finishedAt: j.finishedAt as string,
    };
  }

  const turnOrCompanionLive = jobs.some(
    (j) => (j.kind === "turn" || j.kind === "companion") && isLive(j),
  );
  const stuck =
    newestCommit !== null &&
    newestCommit.seq > newestNarrationSeq &&
    !turnOrCompanionLive &&
    newestCommit.ts !== null &&
    now - newestCommit.ts >= STUCK_AFTER_MS;

  return {
    active,
    uncommitted,
    mode,
    proposals,
    holds,
    latestFailure,
    stuck,
    showRetry: latestFailure !== null || stuck,
  };
}
