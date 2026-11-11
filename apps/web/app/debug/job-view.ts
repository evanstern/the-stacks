import type { DebugCall, DebugJob } from "./api-types.ts";
import { TURN_NODES, type TurnNode } from "./labels.ts";
import {
  type ReadCall,
  type ReadChronicleResult,
  type ReadCompanionResult,
  type ReadTurn,
  readChronicleResult,
  readCompanionResult,
  readTrigger,
  readTurnResult,
} from "./read-result.ts";

export type JobBadge =
  | "queued"
  | "running"
  | "failed"
  | "shipped"
  | "fallback"
  | "held"
  | "empty";

export interface JobSection {
  node: TurnNode;
  ran: boolean;
  data: unknown;
  calls: ReadCall[];
}

export interface JobTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  unpricedCalls: number;
}

export type JobRead =
  | { kind: "turn"; turn: ReadTurn }
  | { kind: "companion"; companion: ReadCompanionResult }
  | { kind: "chronicle"; chronicle: ReadChronicleResult };

export interface JobView {
  id: string;
  kind: DebugJob["kind"];
  status: DebugJob["status"];
  stage: string | null;
  attempts: number;
  trigger: string;
  createdAt: string;
  badge: JobBadge;
  durationMs: number | null;
  totals: JobTotals;
  /** Turn jobs: the seven nodes in order. Other kinds: empty. */
  sections: JobSection[];
  read: JobRead;
  wroteSeqs: ReadonlySet<number>;
  linkUnknown: boolean;
  /** For a held turn: the companion job whose `input.beatJobId` names it. */
  heldBy: DebugJob | null;
}

const PURPOSE_NODE: Record<string, TurnNode> = {
  "dm.director": "director",
  "dm.interpret": "interpret",
  "dm.adjudicate": "adjudicate",
  "dm.narrate": "narrate-check",
  // Rows stored before TASK-0272 still list `dm.audit` calls.
  "dm.audit": "narrate-check",
};

const ms = (iso: string | null): number | null => {
  if (iso === null) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

function totalsFor(job: DebugJob, ledger: readonly DebugCall[]): JobTotals {
  const t: JobTotals = {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    unpricedCalls: 0,
  };
  for (const c of ledger) {
    if (c.jobId !== job.id) continue;
    t.calls += 1;
    t.inputTokens += c.inputTokens ?? 0;
    t.outputTokens += c.outputTokens ?? 0;
    if (c.costUsd === null) t.unpricedCalls += 1;
    else t.costUsd += c.costUsd;
  }
  return t;
}

const missing = (seqs: number[] | undefined) =>
  seqs === undefined || seqs.length === 0;

function turnBadge(turn: ReadTurn): JobBadge {
  const audit = turn.audit as { final?: unknown } | null;
  if (turn.outcome === "held") return "held";
  if (turn.outcome === "empty-beat") return "empty";
  if (audit && typeof audit === "object" && audit.final === "fallback")
    return "fallback";
  return "shipped";
}

function turnSections(turn: ReadTurn): JobSection[] {
  const cp = turn.checkpoint;
  const callsFor = (node: TurnNode) =>
    turn.calls.filter((c) => PURPOSE_NODE[c.purpose] === node);
  const section = (
    node: TurnNode,
    ran: boolean,
    data: unknown,
  ): JobSection => ({ node, ran, data, calls: callsFor(node) });
  const byNode: Record<TurnNode, JobSection> = {
    assemble: section(
      "assemble",
      cp !== null && (cp.beat !== null || cp.npcTurn !== null),
      cp ? { beat: cp.beat, npcTurn: cp.npcTurn } : null,
    ),
    director: section("director", cp?.director != null, cp?.director ?? null),
    interpret: section(
      "interpret",
      cp?.interpret != null,
      cp?.interpret ?? null,
    ),
    adjudicate: section(
      "adjudicate",
      cp?.adjudicate != null,
      cp?.adjudicate ?? null,
    ),
    resolve: section(
      "resolve",
      (cp?.submissions.length ?? 0) > 0,
      cp?.submissions ?? [],
    ),
    "narrate-check": section(
      "narrate-check",
      cp?.narration != null,
      cp?.narration
        ? { narration: cp.narration, check: turn.check ?? turn.audit }
        : null,
    ),
    failure: section("failure", turn.failure !== null, turn.failure),
  };
  return TURN_NODES.map((n) => byNode[n]);
}

/** Everything a job card shows, derived from one job, the ledger, and `now`. */
export function toJobView(
  job: DebugJob,
  ledger: readonly DebugCall[],
  now: number,
  allJobs: Iterable<DebugJob> = [],
): JobView {
  const wrote = new Set<number>();
  const add = (seqs: number[] | undefined) => {
    for (const s of seqs ?? []) wrote.add(s);
  };
  let linkUnknown = job.attempts > 1;
  let badge: JobBadge;
  let sections: JobSection[] = [];
  let read: JobRead;
  let heldBy: DebugJob | null = null;

  if (job.kind === "turn") {
    const turn = readTurnResult(job.result);
    read = { kind: "turn", turn };
    sections = turnSections(turn);
    const cp = turn.checkpoint;
    for (const s of cp?.submissions ?? []) {
      add(s.seqs);
      if (s.result !== "refused" && s.refusalCode === null && missing(s.seqs))
        linkUnknown = true;
    }
    if (cp?.narration) {
      add(cp.narration.seqs);
      if (cp.narration.shipped && cp.narration.seqs === undefined)
        linkUnknown = true;
    }
    if (job.status === "succeeded") badge = turnBadge(turn);
    else badge = job.status;
    if (turn.outcome === "held" && badge === "held") {
      for (const j of allJobs) {
        const input = j.input as { beatJobId?: unknown } | null;
        if (
          j.kind === "companion" &&
          input &&
          typeof input === "object" &&
          input.beatJobId === job.id
        )
          heldBy = j;
      }
    }
  } else if (job.kind === "companion") {
    const companion = readCompanionResult(job.result);
    read = { kind: "companion", companion };
    for (const p of companion.plays)
      for (const s of p.submissions) {
        add(s.seqs);
        if (s.ok && missing(s.seqs)) linkUnknown = true;
      }
    badge = job.status === "succeeded" ? "shipped" : job.status;
  } else {
    const chronicle = readChronicleResult(job.result);
    read = { kind: "chronicle", chronicle };
    add(chronicle.seqs);
    if (chronicle.entries > 0 && chronicle.seqs === undefined)
      linkUnknown = true;
    badge = job.status === "succeeded" ? "shipped" : job.status;
  }

  const start = ms(job.startedAt);
  const end = ms(job.finishedAt);
  const durationMs =
    start === null
      ? null
      : end !== null
        ? end - start
        : job.status === "running"
          ? Math.max(0, now - start)
          : null;

  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    stage: job.stage,
    attempts: job.attempts,
    trigger: readTrigger(job),
    createdAt: job.createdAt,
    badge,
    durationMs,
    totals: totalsFor(job, ledger),
    sections,
    read,
    wroteSeqs: wrote,
    linkUnknown,
    heldBy,
  };
}
