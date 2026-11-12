import {
  isDmReadOutput,
  READ_QUIET_MS,
  RING_BLANK_MS,
  readablePosts,
  type SessionProjections,
  type Viewer,
} from "@the-stacks/session-model";

/** Thinking ends this long after the `read` marker, whatever else happens (FR-025). */
export const THINKING_MAX_MS = 30_000;
const SEGMENTS = 8;

export type ReadIndicator =
  | { kind: "hidden" }
  | { kind: "ring"; remainingS: number; segments: number }
  | { kind: "thinking" };

const HIDDEN: ReadIndicator = { kind: "hidden" };

/**
 * The ring and Thinking, from the projection and the client clock (spec 066 FR-024, FR-025;
 * FR-W2). `markerTs` is the `ts` of the latest `presence.recorded` row, which the projection
 * does not carry (`p.presence` keeps only its seq); the caller reads it from the log.
 * Hidden in turn mode, under a human seat and for a DM viewer.
 */
export function readIndicator(
  p: SessionProjections,
  viewer: Viewer,
  nowMs: number,
  markerTs: string | null = null,
): ReadIndicator {
  if (
    viewer.role === "dm" ||
    p.tableMode.mode !== "free" ||
    p.gate.seat.kind !== "ai"
  ) {
    return HIDDEN;
  }
  const posts = readablePosts(p);
  const latest = posts.at(-1);
  const latestSeq = latest?.seq ?? 0;
  const marker = p.presence?.purpose === "read" ? p.presence : null;
  const answered = (afterSeq: number) =>
    p.transcript.some(
      (e) => e.seq > afterSeq && (e.actor === "ai:dm" || isDmReadOutput(e)),
    );

  if (marker && latestSeq <= marker.seq) {
    // A read is running unless it ended: an ai:dm row, or 30 s.
    const started = markerTs === null ? Number.NaN : Date.parse(markerTs);
    const expired =
      !Number.isNaN(started) && nowMs - started >= THINKING_MAX_MS;
    return answered(marker.seq) || expired ? HIDDEN : { kind: "thinking" };
  }
  if (!latest || answered(latestSeq)) return HIDDEN;
  const elapsed = nowMs - Date.parse(latest.ts);
  if (!(elapsed >= RING_BLANK_MS)) return HIDDEN;
  const remainingS = Math.min(
    SEGMENTS,
    Math.max(0, Math.ceil((READ_QUIET_MS - elapsed) / 1000)),
  );
  return { kind: "ring", remainingS, segments: remainingS };
}
