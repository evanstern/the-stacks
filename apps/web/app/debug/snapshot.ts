import type { StoredEvent } from "@the-stacks/session-model";
import type {
  CallsPage,
  DebugCall,
  DebugJob,
  SeedResult,
} from "./api-types.ts";

export interface DebugSnapshot {
  events: readonly StoredEvent[];
  eventsAfter: number;
  headSeq: number;
  /** Page-clock ms when a new seq last arrived. */
  lastEventAt: number | null;
  jobs: ReadonlyMap<string, DebugJob>;
  /** `undefined` until the first page; `null` when no older jobs exist. */
  olderJobsBefore: string | null | undefined;
  calls: readonly DebugCall[];
  callsAfter: number;
  totals: CallsPage["totals"] | null;
  seed: SeedResult | null;
  seedFor: string | null;
  notice: string | null;
}

export function emptySnapshot(): DebugSnapshot {
  return {
    events: [],
    eventsAfter: 0,
    headSeq: 0,
    lastEventAt: null,
    jobs: new Map(),
    olderJobsBefore: undefined,
    calls: [],
    callsAfter: 0,
    totals: null,
    seed: null,
    seedFor: null,
    notice: null,
  };
}

export function mergeEvents(
  s: DebugSnapshot,
  page: { events: readonly StoredEvent[]; nextAfter: number; headSeq: number },
  now: number,
): DebugSnapshot {
  const known = new Set(s.events.map((e) => e.seq));
  const fresh = page.events.filter((e) => !known.has(e.seq));
  const events =
    fresh.length === 0
      ? s.events
      : [...s.events, ...fresh].sort((a, b) => a.seq - b.seq);
  return {
    ...s,
    events,
    eventsAfter: Math.max(s.eventsAfter, page.nextAfter),
    headSeq: page.headSeq,
    lastEventAt: fresh.length > 0 ? now : s.lastEventAt,
  };
}

/** Replaces by id. The first page also sets `olderJobsBefore` when still unset. */
export function mergeJobs(
  s: DebugSnapshot,
  page: { jobs: readonly DebugJob[]; nextBefore: string | null },
): DebugSnapshot {
  const jobs = new Map(s.jobs);
  for (const j of page.jobs) jobs.set(j.id, j);
  return {
    ...s,
    jobs,
    olderJobsBefore:
      s.olderJobsBefore === undefined ? page.nextBefore : s.olderJobsBefore,
  };
}

/** Adds older jobs without replacing newer copies; moves the older cursor. */
export function mergeOlderJobs(
  s: DebugSnapshot,
  page: { jobs: readonly DebugJob[]; nextBefore: string | null },
): DebugSnapshot {
  const jobs = new Map(s.jobs);
  for (const j of page.jobs) if (!jobs.has(j.id)) jobs.set(j.id, j);
  return { ...s, jobs, olderJobsBefore: page.nextBefore };
}

export function mergeCalls(
  s: DebugSnapshot,
  page: Pick<CallsPage, "calls" | "nextAfter" | "totals">,
): DebugSnapshot {
  const known = new Set(s.calls.map((c) => c.id));
  const fresh = page.calls.filter((c) => !known.has(c.id));
  const calls =
    fresh.length === 0
      ? s.calls
      : [...s.calls, ...fresh].sort((a, b) => a.id - b.id);
  return {
    ...s,
    calls,
    callsAfter: Math.max(s.callsAfter, page.nextAfter),
    totals: page.totals,
  };
}

export function setSeed(
  s: DebugSnapshot,
  seed: SeedResult,
  seedFor: string | null,
): DebugSnapshot {
  return { ...s, seed, seedFor };
}

export function setNotice(
  s: DebugSnapshot,
  notice: string | null,
): DebugSnapshot {
  return { ...s, notice };
}
