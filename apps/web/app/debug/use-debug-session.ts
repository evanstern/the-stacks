import type { SessionProjections, Viewer } from "@the-stacks/session-model";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isActive, nextDelayMs } from "./activity.ts";
import { createDebugClient, type FetchLike } from "./client.ts";
import { createPoller, type Poller } from "./poller.ts";
import { createFolder } from "./scrub.ts";
import {
  type DebugSnapshot,
  emptySnapshot,
  mergeCalls,
  mergeEvents,
  mergeJobs,
  mergeOlderJobs,
  setNotice,
  setSeed,
} from "./snapshot.ts";

const DM: Viewer = { role: "dm" };
const JOBS_LIMIT = 50;

export interface RetryState {
  inFlight: boolean;
  jobId: string | null;
  refusal: string | null;
}

export interface DebugSession {
  snapshot: DebugSnapshot;
  /** The DM projection of every event received. */
  projections: SessionProjections;
  /** Page-clock ms, updated each second. */
  now: number;
  loaded: boolean;
  retry: RetryState;
  onRetry(): void;
  loadOlderJobs(): void;
}

const browserFetch: FetchLike = (input, init) => fetch(input, init);

/**
 * Polls the debug API for one session (TASK-0116 contract). All state is
 * memory only. Auth errors stop polling and set a notice.
 */
export function useDebugSession(
  sessionId: string,
  fetchImpl: FetchLike = browserFetch,
): DebugSession {
  const [snapshot, setSnapshot] = useState<DebugSnapshot>(emptySnapshot);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [retry, setRetry] = useState<RetryState>({
    inFlight: false,
    jobId: null,
    refusal: null,
  });
  const snapRef = useRef(snapshot);
  const lastRetryAt = useRef<number | null>(null);
  const pollerRef = useRef<Poller | null>(null);
  const folder = useMemo(() => createFolder(DM), []);

  const commit = useCallback((next: DebugSnapshot) => {
    snapRef.current = next;
    setSnapshot(next);
  }, []);

  const client = useMemo(
    () => createDebugClient(sessionId, fetchImpl),
    [sessionId, fetchImpl],
  );

  useEffect(() => {
    let alive = true;
    const authFail = (): "stop" => {
      commit(
        setNotice(
          snapRef.current,
          "The debug view is available to the operator only.",
        ),
      );
      return "stop";
    };

    async function refreshSeed(s: DebugSnapshot, sceneId: string | null) {
      const seed = await client.seed();
      if (!alive) return s;
      if (!seed.ok) return s;
      return setSeed(s, seed.value, sceneId);
    }

    async function firstLoad(): Promise<"stop" | undefined> {
      let s = snapRef.current;
      const events = await client.loadAllEvents(0);
      if (!events.ok)
        return events.error.kind === "auth" ? authFail() : undefined;
      s = mergeEvents(s, events.value, Date.now());
      const jobs = await client.jobs(JOBS_LIMIT);
      if (!jobs.ok) return jobs.error.kind === "auth" ? authFail() : undefined;
      s = mergeJobs(s, jobs.value);
      const calls = await client.loadAllCalls(0);
      if (!calls.ok)
        return calls.error.kind === "auth" ? authFail() : undefined;
      s = mergeCalls(s, calls.value);
      const sceneId = folder.live(s.events).scene?.sceneId ?? null;
      s = await refreshSeed(s, sceneId);
      if (!alive) return "stop";
      commit(s);
      setLoaded(true);
      return undefined;
    }

    async function pollOnce(): Promise<"stop" | undefined> {
      let s = snapRef.current;
      const [events, jobs, calls] = await Promise.all([
        client.events(s.eventsAfter, 1000),
        client.jobs(JOBS_LIMIT),
        client.calls(s.callsAfter, 1000),
      ]);
      if (!alive) return "stop";
      for (const r of [events, jobs, calls]) {
        if (!r.ok && r.error.kind === "auth") return authFail();
      }
      if (events.ok) s = mergeEvents(s, events.value, Date.now());
      if (jobs.ok) s = mergeJobs(s, jobs.value);
      if (calls.ok) s = mergeCalls(s, calls.value);
      const sceneId = folder.live(s.events).scene?.sceneId ?? null;
      if (sceneId !== s.seedFor || s.seed === null) {
        s = await refreshSeed(s, sceneId);
        if (!alive) return "stop";
      }
      commit(s);
      return undefined;
    }

    let first = true;
    const poller = createPoller({
      tick: async () => {
        if (first) {
          first = false;
          return firstLoad();
        }
        return pollOnce();
      },
      delayMs: () =>
        nextDelayMs(isActive(snapRef.current, Date.now(), lastRetryAt.current)),
      visibility: { isVisible: () => document.visibilityState !== "hidden" },
    });
    pollerRef.current = poller;
    const onVisibility = () => poller.visibilityChanged();
    document.addEventListener("visibilitychange", onVisibility);
    poller.start();
    return () => {
      alive = false;
      poller.stop();
      pollerRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [client, commit, folder]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const onRetry = useCallback(() => {
    setRetry({ inFlight: true, jobId: null, refusal: null });
    void client.retry().then((r) => {
      if (r.ok) {
        lastRetryAt.current = Date.now();
        setRetry({ inFlight: false, jobId: r.value.jobId, refusal: null });
        pollerRef.current?.kick();
        return;
      }
      const e = r.error;
      const refusal =
        e.kind === "auth"
          ? "Not allowed: the operator only."
          : e.kind === "http"
            ? (e.message ?? `Refused (${e.status}).`)
            : "Network error. Try again.";
      setRetry({ inFlight: false, jobId: null, refusal });
    });
  }, [client]);

  const loadOlderJobs = useCallback(() => {
    const before = snapRef.current.olderJobsBefore;
    if (typeof before !== "string") return;
    void client.jobs(JOBS_LIMIT, before).then((r) => {
      if (r.ok) commit(mergeOlderJobs(snapRef.current, r.value));
    });
  }, [client, commit]);

  const projections = useMemo(
    () => folder.live(snapshot.events),
    [folder, snapshot.events],
  );

  return { snapshot, projections, now, loaded, retry, onRetry, loadOlderJobs };
}
