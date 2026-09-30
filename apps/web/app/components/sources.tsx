import { useState } from "react";
import { Link } from "react-router";
import {
  ChevronIcon,
  CloseIcon,
  StackIcon,
  UploadIcon,
} from "~/components/icons";
import { Panel } from "~/components/panel";
import { deriveBooks } from "~/library/books";
import { useAppStore, useAppStoreHandle } from "~/store/provider";

function titleFromFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function pillClass(text: string): string {
  const base = "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold";
  if (text === "Ready") return `${base} bg-ok-surface text-ok`;
  if (text === "Failed")
    return `${base} bg-destructive-surface text-destructive`;
  if (text === "Search-only")
    return `${base} border border-border bg-muted text-muted-foreground`;
  return `${base} bg-proc-surface text-proc`;
}

/**
 * The Ask header's Sources button and its slide-out panel body (plan D12,
 * FR-016-FR-018): a library-wide view of every derived book, plus an inline
 * Add-a-book dropzone at the bottom running the same `store.upload`.
 */
export function Sources() {
  const [open, setOpen] = useState(false);
  const store = useAppStoreHandle();
  const jobs = useAppStore((state) => state.jobs);
  const upload = useAppStore((state) => state.upload);
  const books = deriveBooks(jobs ?? []);
  const progress = upload?.total
    ? Math.round((upload.sent / upload.total) * 100)
    : 0;

  function handleFile(file: File | null) {
    if (file) store.upload(file, titleFromFilename(file.name));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls="sources-panel"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent aria-expanded:bg-accent"
      >
        <StackIcon />
        <span>Sources · {books.length}</span>
        <ChevronIcon
          className={
            open ? "rotate-90 transition-transform" : "transition-transform"
          }
        />
      </button>

      <Panel
        id="sources-panel"
        open={open}
        onOpenChange={setOpen}
        title="Sources"
        description="Every book in your library, and its status."
      >
        {upload && (
          <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-secondary p-3">
            <UploadIcon className="size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {upload.fileName}
              </p>
              {upload.error ? (
                <p role="alert" className="text-xs text-destructive">
                  {upload.error}
                </p>
              ) : (
                <div
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
            {!upload.error && (
              <button
                type="button"
                aria-label="Cancel upload"
                onClick={() => store.cancelUpload()}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        )}

        <ul className="flex flex-col gap-1">
          {books.map((book) => (
            <li
              key={book.name}
              className="flex items-center gap-2 rounded-md p-2 hover:bg-accent"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {book.name}
              </span>
              <span className={pillClass(book.pill)}>{book.pill}</span>
              <Link
                to="/books"
                className="shrink-0 text-xs text-primary underline-offset-4 hover:underline"
              >
                Open in Library
              </Link>
            </li>
          ))}
        </ul>

        <label className="mt-3 flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted p-4 text-center text-xs text-muted-foreground">
          <UploadIcon className="text-primary" />
          <strong className="text-foreground">Add a book</strong>
          <span>Drop a file or click to browse</span>
          <input
            type="file"
            accept=".zip,.html,.htm,.md,.markdown"
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
        </label>
      </Panel>
    </>
  );
}
