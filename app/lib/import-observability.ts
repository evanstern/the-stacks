import type { ImportJob } from "~/lib/corpus/repository";

const staleAfterMs = 5 * 60 * 1000;

const terminalStatuses = new Set([
  "approved",
  "completed",
  "done",
  "failed",
  "ocr_failed",
  "ocr_succeeded",
  "rejected",
  "review_needed",
  "succeeded",
]);

const runningStatuses = new Set([
  "importing",
  "ocr_running",
  "processing",
  "running",
]);

const queuedStatuses = new Set([
  "ocr_queued",
  "pending",
  "queued",
]);

const failureStatusFragments = ["error", "fail"];
const successStatusFragments = ["approved", "complete", "done", "review", "succeed"];

export type JobObservability = {
  statusTone: "accent" | "muted" | "primary" | "secondary";
  statusLabel: string;
  progressPercent: number;
  elapsedLabel: string;
  lastUpdatedLabel: string;
  staleHint: string | null;
  latestWarning: string | null;
  latestError: string | null;
  isRunning: boolean;
};

export type DerivedImportEvent = {
  id: string;
  at: string;
  label: string;
  detail: string;
};

function dateValue(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function relativeTime(value: string | null, now = new Date()): string {
  const date = dateValue(value);
  if (!date) {
    return "—";
  }

  return `${formatDuration(now.getTime() - date.getTime())} ago`;
}

function isFailureStatus(status: string): boolean {
  return failureStatusFragments.some((fragment) => status.toLowerCase().includes(fragment));
}

function isSuccessStatus(status: string): boolean {
  return successStatusFragments.some((fragment) => status.toLowerCase().includes(fragment));
}

export function isImportJobRunning(job: ImportJob): boolean {
  const status = job.status.toLowerCase();
  if (job.finishedAt || terminalStatuses.has(status) || isFailureStatus(status)) {
    return false;
  }

  return runningStatuses.has(status) || queuedStatuses.has(status) || Boolean(job.startedAt);
}

export function getImportJobObservability(job: ImportJob, now = new Date()): JobObservability {
  const started = dateValue(job.startedAt) ?? dateValue(job.createdAt);
  const finished = dateValue(job.finishedAt);
  const updated = dateValue(job.updatedAt);
  const isRunning = isImportJobRunning(job);
  const elapsedEnd = finished ?? (isRunning ? now : updated ?? now);
  const elapsedLabel = started ? formatDuration(elapsedEnd.getTime() - started.getTime()) : "—";
  const lastUpdatedLabel = relativeTime(job.updatedAt, now);
  const staleMs = updated && isRunning ? now.getTime() - updated.getTime() : 0;
  const staleHint = staleMs > staleAfterMs ? `No persisted update for ${formatDuration(staleMs)}; job may be stalled.` : null;
  const lowerStatus = job.status.toLowerCase();
  const latestWarning = job.warnings.at(-1) ?? null;
  const latestError = job.errors.at(-1) ?? null;

  let statusTone: JobObservability["statusTone"] = "secondary";
  let progressPercent = 38;
  if (latestError || isFailureStatus(lowerStatus)) {
    statusTone = "accent";
    progressPercent = 100;
  } else if (isSuccessStatus(lowerStatus) || job.finishedAt) {
    statusTone = "primary";
    progressPercent = 100;
  } else if (runningStatuses.has(lowerStatus) || job.startedAt) {
    statusTone = "primary";
    progressPercent = 68;
  } else if (queuedStatuses.has(lowerStatus)) {
    statusTone = "muted";
    progressPercent = 18;
  }

  return {
    statusTone,
    statusLabel: job.status.replace(/_/g, " "),
    progressPercent,
    elapsedLabel,
    lastUpdatedLabel,
    staleHint,
    latestWarning,
    latestError,
    isRunning,
  };
}

export function getDerivedImportEvents(job: ImportJob): DerivedImportEvent[] {
  const events: DerivedImportEvent[] = [
    {
      id: "created",
      at: job.createdAt,
      label: "Created",
      detail: `Import job created with status ${job.status}.`,
    },
  ];

  if (job.status.toLowerCase().includes("queued") || job.startedAt) {
    events.push({
      id: "queued",
      at: job.createdAt,
      label: "Queued",
      detail: `Adapter ${job.adapter} @ ${job.adapterVersion} queued from persisted job fields.`,
    });
  }

  if (job.startedAt) {
    events.push({
      id: "started",
      at: job.startedAt,
      label: "Started",
      detail: "Job has a persisted started_at timestamp.",
    });
  }

  if (job.updatedAt !== job.createdAt && job.updatedAt !== job.startedAt && job.updatedAt !== job.finishedAt) {
    events.push({
      id: "updated",
      at: job.updatedAt,
      label: "Updated",
      detail: `Last persisted status update is ${job.status}.`,
    });
  }

  job.warnings.forEach((warning, index) => {
    events.push({
      id: `warning-${index}`,
      at: job.updatedAt,
      label: "Warning recorded",
      detail: warning,
    });
  });

  job.errors.forEach((error, index) => {
    events.push({
      id: `error-${index}`,
      at: job.updatedAt,
      label: "Error recorded",
      detail: error,
    });
  });

  if (job.finishedAt) {
    events.push({
      id: "finished",
      at: job.finishedAt,
      label: "Finished",
      detail: `Job finished with status ${job.status}.`,
    });
  }

  return events.sort((a, b) => {
    const left = dateValue(a.at)?.getTime() ?? 0;
    const right = dateValue(b.at)?.getTime() ?? 0;
    return left - right;
  });
}
