import type { LibraryJob } from "@the-stacks/shared";

/**
 * Upload (plan D12, research R10): XHR for progress, `fetch` exposes none
 * (http-ingest.md). Import-type only, erasable TypeScript only (research R8)
 * — `sendUpload` uses only browser globals, no module imports.
 */

export interface UploadResponse {
  status: number;
  body: unknown;
}

export type UploadResult = UploadResponse | "network" | "aborted";

/**
 * `FormData` with `book` before `file` (FR-009, http-ingest.md). `abort()`
 * creates no job (http-ingest.md guarantee 2).
 */
export function sendUpload(
  file: File,
  book: string,
  onProgress: (sent: number, total: number) => void,
): { done: Promise<UploadResult>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const form = new FormData();
  form.append("book", book);
  form.append("file", file, file.name);

  const done = new Promise<UploadResult>((resolve) => {
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => resolve("network");
    xhr.onabort = () => resolve("aborted");
    xhr.open("POST", "/library/uploads");
    xhr.send(form);
  });

  return { done, abort: () => xhr.abort() };
}

export type UploadOutcome =
  | { kind: "accepted"; job: LibraryJob }
  | { kind: "error"; message: string }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "cancelled" };

/** Pure: classifies a `sendUpload` result (plan D12). */
export function classifyUploadResponse(result: UploadResult): UploadOutcome {
  if (result === "network") {
    return {
      kind: "error",
      message: "Upload failed. Check your connection and try again.",
    };
  }
  if (result === "aborted") return { kind: "cancelled" };

  const { status, body } = result;
  if (status === 202) {
    return { kind: "accepted", job: (body as { job: LibraryJob }).job };
  }
  if (status === 401) return { kind: "unauthorized" };
  if (status === 403) return { kind: "forbidden" };
  if (status === 400 || status === 409 || status === 413) {
    const message =
      (body as { error?: { message?: string } } | null)?.error?.message ??
      "Upload failed.";
    return { kind: "error", message };
  }
  return { kind: "error", message: "Upload failed." };
}
