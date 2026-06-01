import { useEffect, useRef, useState, type ComponentProps } from "react";
import { CheckCircle2, FileText, Loader2, XCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getIngestionJob, getJobEvents, isApiError, uploadFile, type IngestionEvent, type IngestionJob } from "@/lib/api";
import { cn } from "@/lib/utils";

const terminalStatuses = new Set(["awaiting_embedding", "completed", "failed", "error"]);
const archiveUploadCopy = "Upload a ZIP containing one saved webpage HTML file and its asset folder.";
const supportedUploadExtensions = [".epub", ".html", ".htm", ".txt", ".md", ".markdown", ".zip"];
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

export function UploadRoute() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [job, setJob] = useState<IngestionJob | null>(null);
  const [events, setEvents] = useState<IngestionEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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

  async function handleSubmit(event: UploadSubmitEvent) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose a supported file before uploading.");
      return;
    }

    const validationError = validateUploadFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setError(null);
    setJob(null);
    setEvents([]);

    try {
      const queued = await uploadFile(selectedFile);
      const [nextJob, nextEvents] = await Promise.all([getIngestionJob(queued.job_id), getJobEvents(queued.job_id)]);
      setJob(nextJob);
      setEvents(nextEvents);
    } catch (uploadError) {
      setError(uploadError instanceof Error || isApiError(uploadError) ? uploadError.message : "Upload failed. Try again.");
    } finally {
      setIsUploading(false);
    }
  }

  const status = job?.status ?? (isUploading ? "uploading" : "waiting");

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
                {selectedFile ? selectedFile.name : "Choose .epub, .html, .txt, .md, or .zip"}
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
              accept={sourceFileAccept}
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setSelectedFile(nextFile);
                setError(nextFile ? validateUploadFile(nextFile) : null);
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
            <Button type="submit" disabled={isUploading || !selectedFile}>
              {isUploading ? "Queueing" : job?.status === "completed" ? "Upload another" : "Upload file"}
            </Button>
          </div>
        </form>
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

export function uploadFileExtension(fileName: string) {
  const normalizedName = fileName.trim().toLowerCase();
  const extensionStart = normalizedName.lastIndexOf(".");
  return extensionStart > -1 ? normalizedName.slice(extensionStart) : "";
}

export { archiveUploadCopy, sourceFileAccept };

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
