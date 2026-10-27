/**
 * Settle-then-schedule poller: ticks never overlap. Delay follows `delayMs()`
 * after each tick; `kick()` ticks at once; hidden pages schedule nothing.
 * No React import.
 */

export interface PollerTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface PollerVisibility {
  isVisible(): boolean;
}

/** A tick resolves to `"stop"` to end polling (an auth error). */
// biome-ignore lint/suspicious/noConfusingVoidType: a tick body may return nothing.
export type TickResult = "stop" | void;

export interface PollerOptions {
  tick: () => Promise<TickResult>;
  delayMs: () => number;
  timers?: PollerTimers;
  visibility?: PollerVisibility;
}

export interface Poller {
  start(): void;
  stop(): void;
  kick(): void;
  /** Call on `visibilitychange`. Visible → immediate tick; hidden → cancel the wait. */
  visibilityChanged(): void;
}

export function createPoller(opts: PollerOptions): Poller {
  const timers: PollerTimers = opts.timers ?? {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
  const visible = () => opts.visibility?.isVisible() ?? true;
  let handle: unknown = null;
  let stopped = true;
  let running = false;
  let kickPending = false;

  const cancelWait = () => {
    if (handle !== null) {
      timers.clearTimeout(handle);
      handle = null;
    }
  };

  const schedule = () => {
    cancelWait();
    if (stopped || !visible()) return;
    handle = timers.setTimeout(() => {
      handle = null;
      void run();
    }, opts.delayMs());
  };

  async function run(): Promise<void> {
    if (stopped || running) {
      if (running) kickPending = true;
      return;
    }
    cancelWait();
    running = true;
    let result: TickResult;
    try {
      result = await opts.tick();
    } catch {
      result = undefined;
    }
    running = false;
    if (result === "stop") {
      stopped = true;
      cancelWait();
      return;
    }
    if (stopped) return;
    if (kickPending) {
      kickPending = false;
      void run();
      return;
    }
    schedule();
  }

  return {
    start() {
      stopped = false;
      if (visible()) void run();
    },
    stop() {
      stopped = true;
      cancelWait();
    },
    kick() {
      if (stopped) return;
      void run();
    },
    visibilityChanged() {
      if (stopped) return;
      if (visible()) void run();
      else cancelWait();
    },
  };
}
