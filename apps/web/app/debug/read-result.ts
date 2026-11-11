import type { DebugJob } from "./api-types.ts";

/**
 * Tolerant readers over `DebugJob.input` / `result` (`unknown` on the wire).
 * Old rows lack fields; every reader returns a value for any input and never
 * throws. An absent usage field reads as `null` ("usage not recorded"); an
 * absent `seqs` reads as `undefined` ("link not recorded").
 */

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const seqList = (v: unknown): number[] | undefined =>
  Array.isArray(v)
    ? v.filter((x): x is number => typeof x === "number")
    : undefined;

export interface ReadUsage {
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
}

export interface ReadCall {
  purpose: string;
  promptVersion: string;
  attempt: number;
  outcome: string;
  errorKind: string | null;
  /** `null` = usage not recorded. */
  usage: ReadUsage | null;
}

export interface ReadSubmission {
  stepRef: string;
  key: string;
  kind: string;
  result: string;
  refusalCode: string | null;
  batchId: string | null;
  proposalId: string | null;
  seqs: number[] | undefined;
}

export interface ReadIssue {
  kind: string;
  detail: string;
}

export interface ReadAttempt {
  words: number | null;
  blocking: ReadIssue[];
  advisory: ReadIssue[];
  proseHash: string | null;
}

export interface ReadCheckIssue {
  kind: string;
  matched: string;
  detail: string;
}

/** The turn's check record (spec 103); absent on rows stored before TASK-0272. */
export interface ReadCheck {
  leak: ReadCheckIssue[];
  contradiction: ReadCheckIssue[];
  corrected: boolean;
  narrateError: string | null;
}

export interface ReadExcerpt {
  attempt: number | null;
  chars: number | null;
  issues: string;
  excerpt: string;
}

export interface ReadFailure {
  node: string;
  kind: string;
  message: string;
  excerpts: ReadExcerpt[];
}

export interface ReadCheckpoint {
  beat: string[] | null;
  npcTurn: unknown;
  director: unknown;
  interpret: unknown;
  adjudicate: unknown;
  submissions: ReadSubmission[];
  narration: {
    /** Legacy audit-loop attempts; empty on a row with a `check`. */
    attempts: ReadAttempt[];
    check: ReadCheck | null;
    shipped: boolean;
    seqs: number[] | undefined;
  } | null;
}

export interface ReadTurn {
  checkpoint: ReadCheckpoint | null;
  outcome: string | null;
  /** Legacy audit record of rows stored before TASK-0272. */
  audit: unknown;
  check: ReadCheck | null;
  calls: ReadCall[];
  failure: ReadFailure | null;
}

export interface ReadCompanionSubmission {
  kind: string;
  ok: boolean;
  code: string | null;
  seqs: number[] | undefined;
}

export interface ReadCompanionResult {
  plays: { companion: string; submissions: ReadCompanionSubmission[] }[];
  calls: ReadCall[];
}

export interface ReadChronicleResult {
  entries: number;
  seqs: number[] | undefined;
  calls: ReadCall[];
}

function readUsage(c: Rec): ReadUsage | null {
  const usage: ReadUsage = {
    provider: str(c.provider),
    model: str(c.model),
    inputTokens: num(c.inputTokens),
    outputTokens: num(c.outputTokens),
    costUsd: num(c.costUsd),
    durationMs: num(c.durationMs),
  };
  const any = Object.values(usage).some((v) => v !== null);
  return any ? usage : null;
}

function readCalls(v: unknown): ReadCall[] {
  return arr(v)
    .filter(isRec)
    .map((c) => ({
      purpose: str(c.purpose) ?? "unknown",
      promptVersion: str(c.promptVersion) ?? "",
      attempt: num(c.attempt) ?? 1,
      outcome: str(c.outcome) ?? "unknown",
      errorKind: str(c.errorKind),
      usage: readUsage(c),
    }));
}

function readSubmission(v: Rec): ReadSubmission {
  const refusal = isRec(v.refusal) ? v.refusal : null;
  return {
    stepRef: str(v.stepRef) ?? "",
    key: str(v.key) ?? "",
    kind: str(v.kind) ?? "",
    result: str(v.result) ?? "unknown",
    refusalCode: refusal
      ? (str(refusal.code) ?? str(refusal.reason) ?? "refused")
      : null,
    batchId: str(v.batchId),
    proposalId: str(v.proposalId),
    seqs: seqList(v.seqs),
  };
}

function readIssues(v: unknown): ReadIssue[] {
  return arr(v)
    .filter(isRec)
    .map((i) => ({
      kind: str(i.kind) ?? "unknown",
      detail: str(i.detail) ?? "",
      blocking: i.blocking === true,
    }));
}

function readAttempt(v: Rec): ReadAttempt {
  const det = isRec(v.deterministic) ? readIssues(v.deterministic.issues) : [];
  const llm = isRec(v.llm) ? readIssues(v.llm.issues) : [];
  const all = [...det, ...llm] as (ReadIssue & { blocking: boolean })[];
  const strip = ({ kind, detail }: ReadIssue): ReadIssue => ({ kind, detail });
  return {
    words: num(v.words),
    blocking: all.filter((i) => i.blocking).map(strip),
    advisory: all.filter((i) => !i.blocking).map(strip),
    proseHash: str(v.proseSha256),
  };
}

function readCheckIssues(v: unknown): ReadCheckIssue[] {
  return arr(v)
    .filter(isRec)
    .map((i) => ({
      kind: str(i.kind) ?? "unknown",
      matched: str(i.matched) ?? "",
      detail: str(i.detail) ?? "",
    }));
}

function readCheck(v: unknown): ReadCheck | null {
  if (!isRec(v)) return null;
  return {
    leak: readCheckIssues(v.leak),
    contradiction: readCheckIssues(v.contradiction),
    corrected: v.corrected === true,
    narrateError: str(v.narrateError),
  };
}

function readCheckpoint(v: unknown): ReadCheckpoint | null {
  if (!isRec(v)) return null;
  const nar = isRec(v.narration) ? v.narration : null;
  return {
    beat: Array.isArray(v.beat)
      ? v.beat.filter((x): x is string => typeof x === "string")
      : null,
    npcTurn: v.npcTurn ?? null,
    director: v.director ?? null,
    interpret: v.interpret ?? null,
    adjudicate: v.adjudicate ?? null,
    submissions: arr(v.submissions).filter(isRec).map(readSubmission),
    narration: nar
      ? {
          attempts: arr(nar.attempts).filter(isRec).map(readAttempt),
          check: readCheck(nar.check),
          shipped: nar.shipped === true,
          seqs: seqList(nar.seqs),
        }
      : null,
  };
}

function readFailure(v: unknown): ReadFailure | null {
  if (!isRec(v)) return null;
  const detail = isRec(v.detail) ? v.detail : null;
  const excerpts = detail
    ? arr(detail.attempts)
        .filter(isRec)
        .map((a) => ({
          attempt: num(a.attempt),
          chars: num(a.chars),
          issues: str(a.issues) ?? "",
          excerpt: str(a.excerpt) ?? "",
        }))
    : [];
  return {
    node: str(v.node) ?? "unknown",
    kind: str(v.kind) ?? "unknown",
    message: str(v.message) ?? "",
    excerpts,
  };
}

export function readTurnResult(result: unknown): ReadTurn {
  const r = isRec(result) ? result : {};
  const outcome = isRec(r.outcome) ? str(r.outcome.status) : null;
  return {
    checkpoint: readCheckpoint(r.checkpoint),
    outcome,
    audit: r.audit ?? null,
    check: readCheck(r.check),
    calls: readCalls(r.calls),
    failure: readFailure(r.failure),
  };
}

export function readCompanionResult(result: unknown): ReadCompanionResult {
  const r = isRec(result) ? result : {};
  return {
    plays: arr(r.plays)
      .filter(isRec)
      .map((p) => ({
        companion: str(p.companionId) ?? "unknown",
        submissions: arr(p.submissions)
          .filter(isRec)
          .map((s) => ({
            kind: str(s.kind) ?? "",
            ok: s.ok === true,
            code: str(s.code),
            seqs: seqList(s.seqs),
          })),
      })),
    calls: readCalls(r.calls),
  };
}

export function readChronicleResult(result: unknown): ReadChronicleResult {
  const r = isRec(result) ? result : {};
  return {
    entries: num(r.entries) ?? 0,
    seqs: seqList(r.seqs),
    calls: readCalls(r.calls),
  };
}

/** The turn trigger, the companion reason, or "chronicle". */
export function readTrigger(job: Pick<DebugJob, "kind" | "input">): string {
  if (job.kind === "chronicle") return "chronicle";
  const input = isRec(job.input) ? job.input : {};
  const key = job.kind === "turn" ? "trigger" : "reason";
  return str(input[key]) ?? "unknown";
}
