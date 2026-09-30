import type { LibraryJob } from "@the-stacks/shared";
import { hasActive } from "~/library/books";
import { classifyUploadResponse, sendUpload } from "~/library/upload";

/**
 * The app-level store (plan D8, research R7): the conversation, the
 * upload, and the jobs poll all outlive any one page. Created once per
 * signed-in user in the root's signed-in branch, keyed by `user.id`
 * (`store/provider.tsx`). Never a module-level singleton — SSR would share
 * it across requests and users.
 *
 * This phase (US1) fills in the jobs poll and upload. Phases 3-4 (ask) add
 * the conversation as stubs' replacement.
 */

export interface UploadState {
  fileName: string;
  size: number;
  sent: number;
  total: number;
  error: string | null;
}

export interface AppState {
  jobs: LibraryJob[] | null;
  forbidden: boolean;
  upload: UploadState | null;
}

export interface AppStoreOptions {
  /** Called on any 401 from ask, upload, or jobs — the root's revalidate (plan D8). */
  onUnauthorized: () => void;
}

export interface AppStore {
  getState(): AppState;
  subscribe(listener: () => void): () => void;
  /** Aborts the live stream, the upload, and the poll (FR-028, CR-004). */
  dispose(): void;
  /** From a loader's `jobs()` (T026); starts the poll if any job is active. */
  seedJobs(jobs: LibraryJob[]): void;
  refreshJobs(): Promise<void>;
  /** Refuses a second upload while one is in flight (FR-012). */
  upload(file: File, book: string): void;
  cancelUpload(): void;
}

const INITIAL_STATE: AppState = { jobs: null, forbidden: false, upload: null };
const POLL_MS = 1500;

export function createAppStore({ onUnauthorized }: AppStoreOptions): AppStore {
  let state = INITIAL_STATE;
  const listeners = new Set<() => void>();
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let uploadAbort: (() => void) | null = null;
  let disposed = false;

  function setState(next: Partial<AppState>) {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  }

  function schedulePoll() {
    if (pollTimer !== null || disposed) return;
    pollTimer = setTimeout(async () => {
      pollTimer = null;
      await refreshJobs();
    }, POLL_MS);
  }

  // Chained setTimeout, never overlapping (research R11): the next poll is
  // scheduled only after this response lands, and only while a job is
  // still active.
  async function refreshJobs() {
    const res = await fetch("/library/jobs?limit=100", {
      credentials: "same-origin",
    });
    if (res.status === 401) {
      onUnauthorized();
      return;
    }
    if (res.status === 403) {
      setState({ forbidden: true });
      return;
    }
    if (!res.ok) return;
    const { jobs } = (await res.json()) as { jobs: LibraryJob[] };
    setState({ jobs });
    if (hasActive(jobs)) schedulePoll();
  }

  function seedJobs(jobs: LibraryJob[]) {
    setState({ jobs });
    if (hasActive(jobs)) schedulePoll();
  }

  function upload(file: File, book: string) {
    if (uploadAbort) return; // one at a time (FR-012)
    setState({
      upload: {
        fileName: file.name,
        size: file.size,
        sent: 0,
        total: file.size,
        error: null,
      },
    });
    const { done, abort } = sendUpload(file, book, (sent, total) => {
      if (state.upload) setState({ upload: { ...state.upload, sent, total } });
    });
    uploadAbort = abort;
    void done.then((result) => {
      uploadAbort = null;
      const outcome = classifyUploadResponse(result);
      if (outcome.kind === "accepted" || outcome.kind === "cancelled") {
        // FR-011 (202) and research R10 (cancel): refresh at once, to
        // catch the accept-then-cancel race too.
        setState({ upload: null });
        void refreshJobs();
        return;
      }
      if (outcome.kind === "unauthorized") {
        onUnauthorized();
        return;
      }
      if (outcome.kind === "forbidden") {
        setState({ upload: null, forbidden: true });
        return;
      }
      if (state.upload) {
        setState({ upload: { ...state.upload, error: outcome.message } });
      }
    });
  }

  function cancelUpload() {
    uploadAbort?.();
  }

  return {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      listeners.clear();
      if (pollTimer !== null) clearTimeout(pollTimer);
      uploadAbort?.();
    },
    seedJobs,
    refreshJobs,
    upload,
    cancelUpload,
  };
}
