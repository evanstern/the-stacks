import type { LibraryJob } from "@the-stacks/shared";
import { createSseParser } from "~/ask/sse";
import type { Turn } from "~/ask/turns";
import {
  applyEvent,
  createTurn,
  endWithoutTerminal,
  stopTurn,
} from "~/ask/turns";
import { hasActive } from "~/library/books";
import { classifyUploadResponse, sendUpload } from "~/library/upload";

/**
 * The app-level store (plan D8, research R7): the conversation, the
 * upload, and the jobs poll all outlive any one page. Created once per
 * signed-in user in the root's signed-in branch, keyed by `user.id`
 * (`store/provider.tsx`). Never a module-level singleton — SSR would share
 * it across requests and users.
 *
 * This phase (US2) fills in `ask`/`stop`/`retry` (plan D10). Phase 4 adds
 * `openCitation`.
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
  turns: Turn[];
  /** FR-027: set on an empty question or a 400 from /library/ask. */
  askError: string | null;
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
  /** Empty → askError, no request (FR-027). One stream at a time (plan D10). */
  ask(question: string): void;
  /** Aborts the live stream; the turn becomes "stopped" (FR-023). */
  stop(): void;
  /** Re-asks a turn's question, replacing it in place (FR-029). */
  retry(turnId: string): void;
}

const INITIAL_STATE: AppState = {
  jobs: null,
  forbidden: false,
  upload: null,
  turns: [],
  askError: null,
};
const POLL_MS = 1500;

export function createAppStore({ onUnauthorized }: AppStoreOptions): AppStore {
  let state = INITIAL_STATE;
  const listeners = new Set<() => void>();
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let uploadAbort: (() => void) | null = null;
  let askController: AbortController | null = null;
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

  function updateTurn(id: string, updater: (turn: Turn) => Turn) {
    setState({
      turns: state.turns.map((turn) => (turn.id === id ? updater(turn) : turn)),
    });
  }

  // The fetch, the reader loop, and every terminal branch live here, not
  // in a component (plan D10 Navigation) — leaving Ask unmounts only the
  // view, so the loop keeps writing to the store (FR-028).
  async function runAsk(id: string, question: string) {
    const controller = new AbortController();
    askController = controller;

    let res: Response;
    try {
      res = await fetch("/library/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        credentials: "same-origin",
        signal: controller.signal,
      });
    } catch {
      askController = null;
      updateTurn(id, controller.signal.aborted ? stopTurn : endWithoutTerminal);
      return;
    }

    if (res.status === 400) {
      askController = null;
      const body = await res.json().catch(() => null);
      setState({
        turns: state.turns.filter((turn) => turn.id !== id),
        askError: body?.error?.message ?? "Enter a question.",
      });
      return;
    }
    if (res.status === 401) {
      askController = null;
      setState({ turns: state.turns.filter((turn) => turn.id !== id) });
      onUnauthorized();
      return;
    }
    if (res.status === 403) {
      askController = null;
      setState({
        turns: state.turns.filter((turn) => turn.id !== id),
        forbidden: true,
      });
      return;
    }
    if (!res.ok || !res.body) {
      askController = null;
      updateTurn(id, endWithoutTerminal);
      return;
    }

    const parser = createSseParser();
    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let terminal = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const msg of parser.push(
          decoder.decode(value, { stream: true }),
        )) {
          const data = JSON.parse(msg.data);
          updateTurn(id, (turn) =>
            applyEvent(turn, { event: msg.event, data }),
          );
          if (
            msg.event === "done" ||
            msg.event === "refusal" ||
            msg.event === "error"
          ) {
            terminal = true;
          }
        }
      }
    } catch {
      askController = null;
      updateTurn(id, controller.signal.aborted ? stopTurn : endWithoutTerminal);
      return;
    }
    askController = null;
    if (!terminal) updateTurn(id, endWithoutTerminal); // edge case: stream ended with no terminal event
  }

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed) {
      setState({ askError: "Enter a question." });
      return;
    }
    if (askController) return; // one stream at a time
    const turn = createTurn(crypto.randomUUID(), trimmed);
    setState({ askError: null, turns: [...state.turns, turn] });
    void runAsk(turn.id, trimmed);
  }

  function stop() {
    askController?.abort();
  }

  function retry(turnId: string) {
    if (askController) return;
    const turn = state.turns.find((t) => t.id === turnId);
    if (!turn) return;
    setState({
      turns: state.turns.map((t) =>
        t.id === turnId ? createTurn(t.id, t.question) : t,
      ),
    });
    void runAsk(turnId, turn.question);
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
      askController?.abort();
    },
    seedJobs,
    refreshJobs,
    upload,
    cancelUpload,
    ask,
    stop,
    retry,
  };
}
