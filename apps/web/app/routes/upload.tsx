import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { CheckCircle2, FileArchive, FileText, Loader2, XCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getIngestionJob,
  getJobEvents,
  getUploadBatch,
  isApiError,
  uploadFiles,
  type IngestionEvent,
  type IngestionJob,
  type UploadBatchChildError,
  type UploadBatchStatus,
  type UploadBatchStatusItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const terminalStatuses = new Set(["awaiting_embedding", "completed", "failed", "error"]);
const batchTerminalStatuses = new Set(["completed", "partial_failed", "failed"]);
const archiveUploadCopy = "Upload a ZIP containing one saved webpage HTML file and its asset folder.";
const supportedUploadExtensions = [".epub", ".html", ".htm", ".txt", ".md", ".markdown", ".zip"];
const unsafeDiagnosticPattern = /traceback|\/srv\/|\/tmp\/|\\tmp\\|[A-Z]:\\/i;
const unknownBatchMessage = "Upload batch not found. Check the link and try again.";
const sourceFileAccept = [
  ".epub",
  ".html",
  ".htm",
  ".txt",
  ".md",
  ".markdown",
  ".zip",
  "text/html",
  "text/plain",
  "text/markdown",
  "application/epub+zip",
  "application/zip",
  "application/x-zip-compressed",
].join(",");

type UploadSubmitEvent = Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0];

export type BatchQueueRow = {
  filename: string;
  status: string;
  category: string | null;
  message: string | null;
  uploadId: string;
  jobId: string;
};

export function UploadRoute() {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [job, setJob] = useState<IngestionJob | null>(null);
  const [events, setEvents] = useState<IngestionEvent[]>([]);
  const [batch, setBatch] = useState<UploadBatchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const batchId = batchIdFromSearch(searchParams);

  useEffect(() => {
    if (!job || terminalStatuses.has(job.status)) {
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      const [nextJob, nextEvents] = await Promise.all([getIngestionJob(job.id), getJobEvents(job.id)]);
      if (!cancelled) {
        setJob(nextJob);
        setEvents(nextEvents);
      }
    };
    const interval = window.setInterval(() => {
      void refresh().catch((refreshError) => {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : "Could not refresh job state.");
        }
      });
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [job]);

  useEffect(() => {
    if (!batchId) {
      setBatch(null);
      return;
    }

    let cancelled = false;
    let latestStatus: string | null = null;

    const refreshBatch = async () => {
      const nextBatch = await getUploadBatch(batchId);
      if (!cancelled) {
        latestStatus = nextBatch.status;
        setBatch(nextBatch);
        setError(null);
      }
    };

    void refreshBatch().catch((refreshError) => {
      if (!cancelled) {
        setError(uploadBatchLoadErrorCopy(refreshError));
      }
    });

    const interval = window.setInterval(() => {
      if (cancelled || (latestStatus !== null && batchTerminalStatuses.has(latestStatus))) {
        return;
      }

      void refreshBatch().catch((refreshError) => {
        if (!cancelled) {
          setError(uploadBatchLoadErrorCopy(refreshError));
        }
      });
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [batchId]);

  async function handleSubmit(event: UploadSubmitEvent) {
    event.preventDefault();
    if (!selectedFiles.length) {
      setError("Choose a supported file before uploading.");
      return;
    }

    const validationError = validateUploadFiles(selectedFiles);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setError(null);
    setJob(null);
    setEvents([]);
    setBatch(null);

    try {
      const queued = await uploadFiles(selectedFiles);
      if ("batch_id" in queued) {
        const canonicalUrl = canonicalUploadBatchUrl(queued.batch_id);
        await navigate(canonicalUrl, { replace: false });
        const nextBatch = await getUploadBatch(queued.batch_id);
        setBatch(nextBatch);
        return;
      }

      const [nextJob, nextEvents] = await Promise.all([getIngestionJob(queued.job_id), getJobEvents(queued.job_id)]);
      setJob(nextJob);
      setEvents(nextEvents);
    } catch (uploadError) {
      setError(uploadError instanceof Error || isApiError(uploadError) ? uploadError.message : "Upload failed. Try again.");
    } finally {
      setIsUploading(false);
    }
  }

  const status = batch?.status ?? job?.status ?? (isUploading ? "uploading" : "waiting");
  const selectedLabel = selectedFiles.length > 1 ? `${selectedFiles.length} ZIP files selected` : selectedFiles[0]?.name;
  const queueRows = batch ? normalizeBatchQueueRows(batch) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="rounded-[2rem] border border-border bg-card p-5 shadow-soft sm:p-7">
        <div className="border-b border-border pb-6">
          <p className="micro-label text-clay-dark">Corpus intake</p>
          <h1 className="mt-2 font-serif text-4xl tracking-[-0.05em] text-foreground">Upload a source file.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
            Supported types: EPUB, HTML, TXT, MD, and archived webpage ZIP. Files are persisted, queued for ingestion, then reflected in Records.
          </p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="block rounded-[1.5rem] border border-dashed border-border bg-cream p-6" htmlFor="source-file">
            <span className="micro-label text-muted">Source file</span>
            <span className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-3 text-sm text-foreground">
                <span className="grid size-10 place-items-center rounded-full border border-border bg-card text-clay-dark">
                  <FileText className="size-4" aria-hidden="true" />
                </span>
                {selectedLabel ?? "Choose .epub, .html, .txt, .md, or .zip"}
              </span>
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                Browse
              </Button>
            </span>
            <span className="mt-3 block text-xs leading-5 text-muted">
              {archiveUploadCopy}
            </span>
            <input
              ref={inputRef}
              id="source-file"
              className="sr-only"
              name="file"
              type="file"
              multiple
              accept={sourceFileAccept}
              onChange={(event) => {
                const nextFiles = Array.from(event.target.files ?? []);
                setSelectedFiles(nextFiles);
                setError(nextFiles.length ? validateUploadFiles(nextFiles) : null);
              }}
            />
          </label>

          {error ? (
            <p className="rounded-2xl border border-clay bg-cream px-4 py-3 text-sm text-clay-dark" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <StatusPill status={status} />
            <Button type="submit" disabled={isUploading || !selectedFiles.length}>
              {isUploading ? "Queueing" : job?.status === "completed" || batchTerminalStatuses.has(batch?.status ?? "") ? "Upload another" : selectedFiles.length > 1 ? "Upload ZIP batch" : "Upload file"}
            </Button>
          </div>
        </form>

        {batch ? <BatchQueue batch={batch} rows={queueRows} /> : null}
      </section>

      <aside className="space-y-4">
        <Card className="p-5">
          <p className="micro-label text-muted">Job state</p>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-muted">Status</dt>
              <dd className="font-mono text-xs uppercase tracking-[0.16em] text-foreground">{status}</dd>
            </div>
            {job ? (
              <>
                <div>
                  <dt className="text-muted">Job</dt>
                  <dd className="break-all font-mono text-xs text-foreground">{job.id}</dd>
                </div>
                <div>
                  <dt className="text-muted">Upload</dt>
                  <dd className="break-all font-mono text-xs text-foreground">{job.upload_id}</dd>
                </div>
              </>
            ) : null}
            {batch ? (
              <>
                <div>
                  <dt className="text-muted">Batch</dt>
                  <dd className="break-all font-mono text-xs text-foreground">{batch.batch_id}</dd>
                </div>
                <div>
                  <dt className="text-muted">Files</dt>
                  <dd className="font-mono text-xs uppercase tracking-[0.16em] text-foreground">{batch.file_count}</dd>
                </div>
              </>
            ) : null}
          </dl>
        </Card>
        <Card className="p-5">
          <p className="micro-label text-muted">Events</p>
          <div className="mt-4 space-y-3">
            {events.length ? (
              events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-border bg-cream p-3">
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-clay-dark">{event.event_type}</p>
                  <p className="mt-1 text-sm text-muted">{event.message ?? "No message"}</p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">Events appear after the worker claims the queued job.</p>
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}

export function validateUploadFile(file: Pick<File, "name">) {
  const extension = uploadFileExtension(file.name);
  if (extension && supportedUploadExtensions.includes(extension)) {
    return null;
  }

  const displayedType = extension || "unknown file type";
  return `Unsupported file type ${displayedType}. Choose .epub, .html, .txt, .md, or .zip.`;
}

export function validateUploadFiles(files: Pick<File, "name">[]) {
  if (files.length < 2) {
    return files[0] ? validateUploadFile(files[0]) : null;
  }

  const invalidFile = files.find((file) => uploadFileExtension(file.name) !== ".zip");
  if (invalidFile) {
    return `Batch upload accepts ZIP files only. ${invalidFile.name} is not a ZIP archive.`;
  }

  return null;
}

export function uploadFileExtension(fileName: string) {
  const normalizedName = fileName.trim().toLowerCase();
  const extensionStart = normalizedName.lastIndexOf(".");
  return extensionStart > -1 ? normalizedName.slice(extensionStart) : "";
}

export function canonicalUploadBatchUrl(batchId: string) {
  return `/upload?batch_id=${encodeURIComponent(batchId)}`;
}

export function batchIdFromSearch(searchParams: Pick<URLSearchParams, "get">) {
  const batchId = searchParams.get("batch_id")?.trim();
  return batchId || null;
}

export function normalizeBatchQueueRows(batch: Pick<UploadBatchStatus, "items">): BatchQueueRow[] {
  return batch.items.map((item) => normalizeBatchQueueRow(item));
}

export function shouldPollUploadBatch(status: string | null) {
  return status === null || !batchTerminalStatuses.has(status);
}

export function uploadBatchLoadErrorCopy(error: unknown) {
  if ((isApiError(error) || hasApiStatus(error)) && error.status === 404) {
    return unknownBatchMessage;
  }

  const message = error instanceof Error ? error.message : "Could not load upload batch.";
  return unsafeDiagnosticPattern.test(message) ? "Could not load upload batch. Check server logs for details." : message;
}

export function safeBatchErrorCopy(error: UploadBatchChildError | null) {
  if (!error) {
    return null;
  }

  return {
    category: error.category,
    message: unsafeDiagnosticPattern.test(error.message) ? "The worker reported a private diagnostic. Check server logs for details." : error.message,
  };
}

export { archiveUploadCopy, sourceFileAccept, unknownBatchMessage };

function normalizeBatchQueueRow(item: UploadBatchStatusItem): BatchQueueRow {
  const error = safeBatchErrorCopy(item.error);
  return {
    filename: item.filename,
    status: item.status,
    category: error?.category ?? null,
    message: error?.message ?? null,
    uploadId: item.upload_id,
    jobId: item.job_id,
  };
}

function hasApiStatus(error: unknown): error is { status: number } {
  return typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: unknown }).status === "number";
}

function BatchQueue({ batch, rows }: { batch: UploadBatchStatus; rows: BatchQueueRow[] }) {
  return (
    <section className="mt-6 rounded-[1.5rem] border border-border bg-cream p-4" aria-labelledby="upload-queue-heading">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="micro-label text-clay-dark">Batch queue</p>
          <h2 id="upload-queue-heading" className="mt-1 font-serif text-2xl tracking-[-0.04em] text-foreground">
            {batch.file_count} archived webpages in motion.
          </h2>
        </div>
        <p className="break-all font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">
          {canonicalUploadBatchUrl(batch.batch_id)}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <QueueRow key={`${row.uploadId}-${row.jobId}`} row={row} />
        ))}
      </div>
    </section>
  );
}

function QueueRow({ row }: { row: BatchQueueRow }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-inset">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-border bg-cream text-clay-dark">
            <FileArchive className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold text-foreground">{row.filename}</h3>
            <p className="mt-1 break-all font-mono text-[0.68rem] text-muted">job {row.jobId}</p>
          </div>
        </div>
        <StatusPill status={row.status} />
      </div>
      {row.category || row.message ? (
        <div className="mt-3 rounded-2xl border border-clay bg-cream px-3 py-2" role="status">
          {row.category ? <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-clay-dark">{row.category}</p> : null}
          {row.message ? <p className="mt-1 text-sm leading-6 text-muted">{row.message}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  const isComplete = status === "completed";
  const isError = status === "failed" || status === "error";
  const Icon = isComplete ? CheckCircle2 : isError ? XCircle : Loader2;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-cream px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] text-muted",
        isComplete && "border-clay text-clay-dark",
        isError && "border-clay text-clay-dark",
      )}
    >
      <Icon className={cn("size-3.5", !isComplete && !isError && "animate-spin")} aria-hidden="true" />
      {status}
    </span>
  );
}
