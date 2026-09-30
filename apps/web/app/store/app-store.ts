import type { LibraryJob } from "@the-stacks/shared";

/**
 * The app-level store (plan D8, research R7): the conversation, the
 * upload, and the jobs poll all outlive any one page. Created once per
 * signed-in user in the root's signed-in branch, keyed by `user.id`
 * (`store/provider.tsx`). Never a module-level singleton — SSR would share
 * it across requests and users.
 *
 * Phases 2-4 (ask, upload, jobs) fill in the actions this exports as
 * stubs. This phase only needs the shape and the subscribe/dispose
 * lifecycle, so the shell and the root can mount around it.
 */

export interface AppState {
  jobs: LibraryJob[] | null;
  forbidden: boolean;
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
  seedJobs(jobs: LibraryJob[]): void;
  refreshJobs(): void;
}

const INITIAL_STATE: AppState = { jobs: null, forbidden: false };

export function createAppStore(_options: AppStoreOptions): AppStore {
  let state = INITIAL_STATE;
  const listeners = new Set<() => void>();

  function setState(next: Partial<AppState>) {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
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
      listeners.clear();
    },
    // Phase 2 (T024) replaces this with the real seed + poll start.
    seedJobs(jobs) {
      setState({ jobs });
    },
    // Phase 2 (T024) replaces this with a real GET /library/jobs fetch.
    refreshJobs() {},
  };
}
