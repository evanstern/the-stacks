import type { LibraryJob } from "@the-stacks/shared";

/**
 * Pure library/book-derivation helpers (plan D12, spec Resolved open
 * question 1). No runtime imports — import type only, erasable TypeScript
 * only (research R8).
 */

export const STAGES = ["extract", "parse", "store", "embed"] as const;

/** The server's one-active-job-per-book grouping key. */
export function bookKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Ready / Ingesting · <stage> / Failed / Search-only, per Resolved open question 1. */
export function pill(job: LibraryJob): string {
  if (job.status === "queued") return "Ingesting · queued";
  if (job.status === "running") {
    return job.stage ? `Ingesting · ${job.stage}` : "Ingesting";
  }
  if (job.status === "failed") return "Failed";
  return job.result?.embedding.status === "embedded" ? "Ready" : "Search-only";
}

/**
 * Index into `STAGES` for the stepper: -1 (none reached), 0-3 (current
 * stage), `STAGES.length` (all done). `stage` is non-null only while
 * running (http-ingest.md), so queued and failed jobs always land at -1.
 */
export function stageIndex(job: LibraryJob): number {
  if (job.stage) return STAGES.indexOf(job.stage);
  return job.status === "succeeded" ? STAGES.length : -1;
}

/** A one-line detail for a job row: failure reason, or ingest stats. */
export function jobDetail(job: LibraryJob): string {
  if (job.status === "failed") {
    const reason = job.error ?? "Failed";
    return job.attempts > 1 ? `${reason} · attempts ${job.attempts}` : reason;
  }
  if (job.status === "succeeded" && job.result) {
    const { pages, chunkCount, embedding } = job.result;
    const base = `${pages} pages · ${chunkCount} chunks`;
    return embedding.status === "embedded"
      ? `${base} · embedded ${embedding.count} (${embedding.model})`
      : `${base} · ${embedding.reason}`;
  }
  return "";
}

export interface Book {
  name: string;
  pill: string;
  detail: string;
}

/** One entry per book, decided by its newest job (Resolved open question 1). */
export function deriveBooks(jobs: LibraryJob[]): Book[] {
  const newest = new Map<string, LibraryJob>();
  for (const job of jobs) {
    const key = bookKey(job.book);
    const current = newest.get(key);
    if (!current || job.createdAt > current.createdAt) newest.set(key, job);
  }
  return [...newest.values()]
    .sort((a, b) => a.book.localeCompare(b.book))
    .map((job) => ({
      name: job.book.trim(),
      pill: pill(job),
      detail: jobDetail(job),
    }));
}

export function hasActive(jobs: LibraryJob[]): boolean {
  return jobs.some(
    (job) => job.status === "queued" || job.status === "running",
  );
}
