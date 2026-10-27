import type { DebugSnapshot } from "./snapshot.ts";

export const ACTIVE_WINDOW_MS = 30_000;
export const ACTIVE_DELAY_MS = 2_000;
export const IDLE_DELAY_MS = 10_000;

/**
 * Active = a job queued or running, a new event received within 30 s, or a
 * retry sent within 30 s. Times are page-clock ms (receipt time), so server
 * clock skew cannot matter.
 */
export function isActive(
  snapshot: Pick<DebugSnapshot, "jobs" | "lastEventAt">,
  now: number,
  lastRetryAt: number | null = null,
): boolean {
  for (const j of snapshot.jobs.values()) {
    if (j.status === "queued" || j.status === "running") return true;
  }
  if (
    snapshot.lastEventAt !== null &&
    now - snapshot.lastEventAt < ACTIVE_WINDOW_MS
  )
    return true;
  if (lastRetryAt !== null && now - lastRetryAt < ACTIVE_WINDOW_MS) return true;
  return false;
}

export function nextDelayMs(active: boolean): number {
  return active ? ACTIVE_DELAY_MS : IDLE_DELAY_MS;
}
