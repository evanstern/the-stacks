import {
  applyEvent,
  emptyProjections,
  project,
  type SessionProjections,
  type StoredEvent,
  type Viewer,
} from "@the-stacks/session-model";

export interface Folder {
  /** The projection of every event. Extends the last live fold incrementally. */
  live(events: readonly StoredEvent[]): SessionProjections;
  /** The projection of the events with seq <= `seq`. */
  through(events: readonly StoredEvent[], seq: number): SessionProjections;
}

/** Number of events with seq <= `seq` in an ascending log. */
function countThrough(events: readonly StoredEvent[], seq: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].seq <= seq) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Folds an append-only, ascending event log. Saves a projection at every
 * `every`-th event (applyEvent never mutates, so saved projections stay
 * valid), so a pin folds at most `every - 1` events past a checkpoint.
 */
export function createFolder(viewer: Viewer, every = 250): Folder {
  const checkpoints = new Map<number, SessionProjections>();
  let liveCount = 0;
  let livePro: SessionProjections | null = null;
  let firstSeq: number | null = null;

  function reset() {
    checkpoints.clear();
    liveCount = 0;
    livePro = null;
  }

  function fold(events: readonly StoredEvent[], n: number): SessionProjections {
    // The log is append-only; a different head means a new log.
    if (events.length > 0 && firstSeq !== events[0].seq) {
      reset();
      firstSeq = events[0].seq;
    }
    if (events.length < liveCount) reset();

    let start = 0;
    let p: SessionProjections = emptyProjections(viewer);
    if (livePro !== null && liveCount <= n) {
      start = liveCount;
      p = livePro;
    }
    for (let c = Math.floor(n / every) * every; c > start; c -= every) {
      const saved = checkpoints.get(c);
      if (saved) {
        start = c;
        p = saved;
        break;
      }
    }
    for (let i = start; i < n; i++) {
      p = applyEvent(p, events[i]);
      if ((i + 1) % every === 0) checkpoints.set(i + 1, p);
    }
    return p;
  }

  return {
    live(events) {
      const p = fold(events, events.length);
      liveCount = events.length;
      livePro = p;
      return p;
    },
    through(events, seq) {
      // A log that is not strictly ascending (duplicate delivery) is not
      // prefix-closed; fold the filtered rows directly, without the cache.
      for (let i = 1; i < events.length; i++) {
        if (events[i].seq <= events[i - 1].seq)
          return project(
            events.filter((e) => e.seq <= seq),
            viewer,
          );
      }
      return fold(events, countThrough(events, seq));
    },
  };
}
