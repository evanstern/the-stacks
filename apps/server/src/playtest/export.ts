import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type LedgerRow,
  type StoredEvent,
  StoredEventSchema,
} from "@the-stacks/session-model";
import type { DbClient } from "../auth/session.js";
import type { LegacyAuditRecord as AuditRecord } from "../dm/jobs.js";
import { type DmJobRow, listDmJobs, type TurnTrigger } from "../dm/jobs.js";
import type { CheckRecord } from "../dm/nodes/check.js";
import { readFrom } from "../events/log.js";
import { toStoredEvent } from "../session/events.js";
import { loadProjections } from "../session/projections.js";
import type { RunManifest } from "./auditor/schema.js";
import { RunManifestSchema } from "./auditor/schema.js";

/**
 * Run-directory export and import (contracts/run-directory.md). Reads only:
 * `readFrom`, `loadProjections`, `listDmJobs`. Writes files atomically.
 */

const PAGE = 1000;

/** The `/dm/sessions/:id/turns` item shape (dm-api.md): no prompt text. */
export interface JobItem {
  id: string;
  kind: "turn" | "floor" | "companion" | "chronicle";
  status: string;
  stage: string | null;
  attempts: number;
  trigger: TurnTrigger | null;
  createdAt: string;
  finishedAt: string | null;
  outcome: string | null;
  /** The turn's check record (spec 103); null on rows stored before TASK-0272. */
  check: CheckRecord | null;
  /** The audit loop's record; null on rows stored after TASK-0272. */
  audit: AuditRecord | null;
  calls: { purpose: string; promptVersion: string; outcome: string }[];
  error: string | null;
  /** Spec 115: the checkpoint's `factsThrough` (spec 104 FR-018); null when absent. */
  factsThrough?: number | null;
  /** Spec 115: the narration seqs the job shipped; [] when none. */
  narrationSeqs?: number[];
}

export function toJobItem(job: DmJobRow): JobItem {
  const result = (job.result ?? {}) as {
    outcome?: { status?: string };
    check?: CheckRecord | null;
    audit?: AuditRecord | null;
    calls?: { purpose: string; promptVersion: string; outcome: string }[];
    checkpoint?: {
      factsThrough?: number;
      narration?: { seqs?: number[] } | null;
    } | null;
  };
  const input = (job.input ?? {}) as { trigger?: TurnTrigger };
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    stage: job.stage,
    attempts: job.attempts,
    trigger: job.kind === "turn" ? (input.trigger ?? null) : null,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    outcome:
      result.outcome?.status ?? (job.status === "failed" ? "failed" : null),
    check: result.check ?? null,
    audit: result.audit ?? null,
    calls: (result.calls ?? []).map((c) => ({
      purpose: c.purpose,
      promptVersion: c.promptVersion,
      outcome: c.outcome,
    })),
    error: job.error,
    factsThrough:
      job.kind === "turn" ? (result.checkpoint?.factsThrough ?? null) : null,
    narrationSeqs:
      job.kind === "turn" ? (result.checkpoint?.narration?.seqs ?? []) : [],
  };
}

export interface SessionExport {
  transcript: StoredEvent[];
  ledger: LedgerRow[];
  jobs: JobItem[];
}

export async function exportSession(
  db: DbClient,
  sessionId: string,
): Promise<SessionExport> {
  const transcript: StoredEvent[] = [];
  let afterSeq = 0;
  for (;;) {
    const rows = await readFrom(db, { sessionId, afterSeq, limit: PAGE });
    for (const row of rows) transcript.push(toStoredEvent(row));
    if (rows.length < PAGE) break;
    afterSeq = rows[rows.length - 1].seq;
  }
  const projections = await loadProjections(db, sessionId, { role: "dm" });
  const jobs = (await listDmJobs(db, sessionId, null)).map(toJobItem);
  return { transcript, ledger: projections.ledger, jobs };
}

export interface RunArtifacts {
  manifest: RunManifest;
  transcript: StoredEvent[];
  /** The readable player view; `transcript.md`. */
  transcriptMd: string;
  ledger: LedgerRow[];
  jobs: JobItem[];
  usage?: unknown;
  report?: unknown;
  reportMd?: string;
}

function writeAtomic(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

/** Writes the run directory; creates `dir`. Report files only when given. */
export function writeRunDir(dir: string, a: RunArtifacts): void {
  mkdirSync(dir, { recursive: true });
  writeAtomic(
    join(dir, "run.json"),
    `${JSON.stringify(a.manifest, null, 2)}\n`,
  );
  writeAtomic(
    join(dir, "transcript.jsonl"),
    a.transcript.map((r) => JSON.stringify(r)).join("\n") +
      (a.transcript.length > 0 ? "\n" : ""),
  );
  writeAtomic(join(dir, "transcript.md"), a.transcriptMd);
  writeAtomic(
    join(dir, "ledger.json"),
    `${JSON.stringify(a.ledger, null, 2)}\n`,
  );
  writeAtomic(join(dir, "jobs.json"), `${JSON.stringify(a.jobs, null, 2)}\n`);
  if (a.usage !== undefined) {
    writeAtomic(
      join(dir, "usage.json"),
      `${JSON.stringify(a.usage, null, 2)}\n`,
    );
  }
  if (a.report !== undefined) {
    writeAtomic(
      join(dir, "report.json"),
      `${JSON.stringify(a.report, null, 2)}\n`,
    );
  }
  if (a.reportMd !== undefined) {
    writeAtomic(join(dir, "report.md"), a.reportMd);
  }
}

/** Writes `report.json` and `report.md` into `dir`; creates `dir`. */
export function writeReportFiles(
  dir: string,
  report: unknown,
  reportMd: string,
): void {
  mkdirSync(dir, { recursive: true });
  writeAtomic(join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeAtomic(join(dir, "report.md"), reportMd);
}

export interface RunDirContents {
  manifest: RunManifest;
  transcript: StoredEvent[];
  ledger: LedgerRow[];
  jobs: JobItem[];
}

/** Reads a saved run directory with no database (`audit --dir`). */
export function readRunDir(dir: string): RunDirContents {
  const text = (name: string) => readFileSync(join(dir, name), "utf8");
  const manifest = RunManifestSchema.parse(JSON.parse(text("run.json")));
  const transcript = text("transcript.jsonl")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => StoredEventSchema.parse(JSON.parse(l)));
  const ledger = JSON.parse(text("ledger.json")) as LedgerRow[];
  const jobs = JSON.parse(text("jobs.json")) as JobItem[];
  return { manifest, transcript, ledger, jobs };
}
