import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyEvent,
  emptyProjections,
  type SessionProjections,
  type StoredEvent,
  StoredEventSchema,
} from "@the-stacks/session-model";
import type { ClaimState } from "../../src/dm/claims.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import { buildSnapshot, diffSnapshots } from "../../src/dm/snapshot/index.js";

/**
 * Evidence fixtures for the output claim gate (spec 051, plan D9). The
 * recorded logs are read in place; nothing is copied.
 */

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The recorded M2 demo log (session e8c848ec). */
export const M2_LOG = join(
  REPO,
  "docs/design/m2-demo/demo-session/transcript.jsonl",
);

/** The recorded run 192319Z log (spec 034 verify evidence). */
export const RUN_192319Z_LOG = join(
  REPO,
  "specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/transcript.jsonl",
);

const logCache = new Map<string, StoredEvent[]>();

/** Parses a JSONL transcript. Cached per path: the logs are read-only. */
export function loadLog(path: string): StoredEvent[] {
  const hit = logCache.get(path);
  if (hit) return hit;
  const events = readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => StoredEventSchema.parse(JSON.parse(l)));
  logCache.set(path, events);
  return events;
}

/** Folds the log; returns the projections at each requested seq. */
export function foldThrough(
  events: readonly StoredEvent[],
  seqs: readonly number[],
): { at: Map<number, SessionProjections>; final: SessionProjections } {
  let p = emptyProjections({ role: "dm" });
  const at = new Map<number, SessionProjections>();
  for (const e of events) {
    p = applyEvent(p, e);
    if (seqs.includes(e.seq)) at.set(e.seq, p);
  }
  return { at, final: p };
}

function projectionsAt(
  path: string,
  seqs: readonly number[],
): Map<number, SessionProjections> {
  const { at } = foldThrough(loadLog(path), seqs);
  for (const s of seqs) {
    if (!at.has(s)) throw new Error(`no row at seq ${s} in ${path}`);
  }
  return at;
}

const seed = () => loadSeed("greyhollow-ford");

/** S0 at `s0Seq`, S1 at `s1Seq`, and the diff between them. */
export function stateAt(
  logPath: string,
  s0Seq: number,
  s1Seq: number,
): ClaimState {
  const at = projectionsAt(logPath, [s0Seq, s1Seq]);
  const p0 = at.get(s0Seq) as SessionProjections;
  const p1 = at.get(s1Seq) as SessionProjections;
  const s0 = buildSnapshot(p0, seed());
  const s1 = buildSnapshot(p1, seed());
  return { snapshot: s1, diff: diffSnapshots(s0, s1) };
}

/**
 * The state at `seq` with each listed actor moved to `absent` by a synthetic
 * `scene-presence.changed` row (reason "fled"). The rows apply before the
 * build, so the diff holds no presence change: the actors were absent
 * before this turn.
 */
export function withPresence(
  logPath: string,
  seq: number,
  actorIds: readonly string[],
): ClaimState {
  const events = loadLog(logPath);
  const p = projectionsAt(logPath, [seq]).get(seq) as SessionProjections;
  const last = events[events.length - 1] as StoredEvent;
  let next = p;
  actorIds.forEach((actorId, i) => {
    const row: StoredEvent = {
      sessionId: last.sessionId,
      seq: last.seq + 1 + i,
      actor: "ai:dm",
      type: "scene-presence.changed",
      payload: {
        actorId,
        before: "present",
        after: "absent",
        reason: "fled",
        actionId: null,
      },
      payloadVersion: 1,
      visibility: "public",
      ts: last.ts,
    };
    next = applyEvent(next, row);
  });
  const snap = buildSnapshot(next, seed());
  return { snapshot: snap, diff: diffSnapshots(snap, snap) };
}

/** A shipped dice line carries an arrow (a roll total or an hp change). */
const DICE_LINE = /→/;

/**
 * The shipped `narration` text at `seq` with the dice lines removed. Dice
 * lines follow the prose after a blank line; a line holding "→" is one.
 */
export function narrationAt(logPath: string, seq: number): string {
  const row = loadLog(logPath).find(
    (e) => e.seq === seq && e.type === "narration",
  );
  if (!row) throw new Error(`no narration row at seq ${seq} in ${logPath}`);
  const text = (row.payload as { text: string }).text;
  return text
    .split("\n")
    .filter((l) => !DICE_LINE.test(l))
    .join("\n")
    .trim();
}

// The audit stores `proseSha256`, not prose (research R7), so the row 162
// sentences are rebuilt from the audit's quoted fragments. Source: the
// journal body at run 192319Z seq 162 and `jobs.json` job `ab5ba4ae...`,
// attempts 2 and 3.

/** Row 162 attempt 2: the fragments "hand twitches", "fingers curling". */
export const ROW162_ACTING =
  "Tamsin's hand twitches toward her sword, her fingers curling around the hilt.";

/** Row 162 attempt 3: Tamsin shown lying where she fell, as the state holds. */
export const ROW162_STATE =
  "Tamsin lies where she fell, her breath shallow against the night air.";

/** Run 192319Z seq 201 journal body: the negated form the audit flagged. */
export const SEQ201_NEGATED = "Tamsin cannot speak.";

/** `jobs.json` job `39fab4c5...` attempt 2: the false-positive prose. */
export const SEQ216_UNCONSCIOUS = "Tamsin lies unconscious in the mud.";
