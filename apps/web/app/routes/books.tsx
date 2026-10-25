import type { LibraryJob } from "@the-stacks/shared";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, UploadIcon } from "~/components/icons";
import { stacksContext } from "~/context";
import { jobDetail, pill, STAGES, stageIndex } from "~/library/books";
import { OperatorOnly } from "~/shell/operator-only";
import { useAppStore, useAppStoreHandle } from "~/store/provider";
import type { Route } from "./+types/books";

/**
 * The Library page (plan D3, D4, D12; FR-006-FR-015). Lives at `/books`
 * because `/library` is a reserved API prefix (research R3).
 */
export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context.get(stacksContext);
  const user = await ctx.identity();
  if (user?.role !== "operator") {
    return { forbidden: true as const, jobs: null };
  }
  return { forbidden: false as const, jobs: await ctx.jobs() };
}

function titleFromFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(1)} ${units[unit]}`;
}

function formatStarted(iso: string): string {
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function pillClass(job: LibraryJob): string {
  const base = "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold";
  if (job.status === "failed")
    return `${base} bg-destructive-surface text-destructive`;
  if (job.status === "succeeded") {
    return job.result?.embedding.status === "embedded"
      ? `${base} bg-ok-surface text-ok`
      : `${base} border border-border bg-muted text-muted-foreground`;
  }
  return `${base} bg-proc-surface text-proc`;
}

function stageClass(current: number, index: number): string {
  const base = "rounded-full px-2 py-0.5 capitalize";
  if (current === STAGES.length || index < current)
    return `${base} bg-ok-surface text-ok`;
  if (index === current)
    return `${base} bg-primary font-semibold text-primary-foreground`;
  return `${base} bg-queued-surface text-muted-foreground`;
}

export default function Books({ loaderData }: Route.ComponentProps) {
  const store = useAppStoreHandle();
  const storeJobs = useAppStore((state) => state.jobs);
  const storeForbidden = useAppStore((state) => state.forbidden);
  const upload = useAppStore((state) => state.upload);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: seed once from this request's loader data — store is a stable handle, not reactive state.
  useEffect(() => {
    if (!loaderData.forbidden) store.seedJobs(loaderData.jobs ?? []);
  }, [loaderData]);

  if (loaderData.forbidden || storeForbidden) {
    return (
      <OperatorOnly message="The library is available to the operator only." />
    );
  }

  // Falls back to loader data before hydration seeds the store, so SSR and
  // the first client paint render the same list (plan D4).
  const jobs = storeJobs ?? loaderData.jobs ?? [];

  function chooseFile(next: File | null) {
    setFile(next);
    if (next) setTitle((current) => current || titleFromFilename(next.name));
  }

  function handleUpload() {
    const book = title.trim();
    if (!file || !book) return;
    store.upload(file, book);
    setFile(null);
    setTitle("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const progress = upload?.total
    ? Math.round((upload.sent / upload.total) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Library</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Rulebooks you&rsquo;ve imported. Only you can see them.
      </p>

      <label
        className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          chooseFile(event.dataTransfer.files[0] ?? null);
        }}
      >
        <UploadIcon className="text-primary" />
        <strong className="text-foreground">
          Drop a D&amp;D Beyond export (.zip), HTML or Markdown file, or click
          to browse
        </strong>
        <span className="flex w-full justify-between text-xs">
          <span>Accepts .zip, .html, .md</span>
          <span>Max 1 GB</span>
        </span>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.html,.htm,.md,.markdown"
          className="sr-only"
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
        />
      </label>

      <div className="mt-4 flex max-w-sm flex-col gap-2">
        <label htmlFor="book-title" className="text-sm font-medium">
          Book title
        </label>
        <input
          id="book-title"
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Basic Rules"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
        />
        {file && !title.trim() && (
          <p className="text-sm text-destructive">Enter a book title.</p>
        )}
      </div>

      <button
        type="button"
        onClick={handleUpload}
        disabled={!mounted || !file || !title.trim() || upload !== null}
        className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Upload
      </button>

      {upload && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <UploadIcon className="size-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{upload.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(upload.size)}
            </p>
            {upload.error ? (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {upload.error}
              </p>
            ) : (
              <>
                <div
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {progress}%
                </p>
              </>
            )}
          </div>
          {!upload.error && (
            <button
              type="button"
              aria-label="Cancel upload"
              onClick={() => store.cancelUpload()}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      )}

      {jobs.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Your library is empty. Upload your first book to start asking
          questions.
        </p>
      ) : (
        <>
          <h2 className="mt-8 text-lg font-semibold">Recent imports</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{job.book}</span>
                  <span className={pillClass(job)}>{pill(job)}</span>
                </div>
                <ol
                  aria-label="Ingestion stage"
                  className="mt-2 flex gap-1 text-xs"
                >
                  {STAGES.map((stage, index) => (
                    <li
                      key={stage}
                      className={stageClass(stageIndex(job), index)}
                    >
                      {stage}
                    </li>
                  ))}
                </ol>
                {jobDetail(job) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {jobDetail(job)}
                  </p>
                )}
                <time
                  dateTime={job.createdAt}
                  className="mt-1 block text-xs text-muted-foreground"
                  suppressHydrationWarning
                >
                  {mounted ? formatStarted(job.createdAt) : ""}
                </time>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
