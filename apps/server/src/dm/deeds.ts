import { type Intent, toText } from "@the-stacks/intent";
import type {
  SessionProjections,
  StoredEvent,
} from "@the-stacks/session-model";

/**
 * TASK-0337 (spec 111): the one deed test. A deed is a player-side act the engine settled or
 * stopped, or a ruling that settled a player's ask. Narrate names each one; the auditor reuses
 * the test. Pure: it imports nothing from `gate/` or DB code (narrate's import closure).
 */

export interface Deed {
  /** The carrier row. */
  seq: number;
  /** The answered Intent for a ruling row, else the row's own Intent. */
  intentId: string;
  /** Party name, else actor id, else "The scene". */
  name: string;
  /** `toText(intent)`, clipped to 200 characters. */
  text: string;
  batchId: string | null;
  /** The stop code. */
  stopped: string | null;
}

interface Carrier {
  intent?: Intent;
  outcome?: string;
  batchId?: string | null;
  request?: { requestId?: string } | null;
  answers?: string | null;
  stopped?: { code?: string } | null;
}

const pl = (r: StoredEvent): Carrier => r.payload as Carrier;
// Same one-line test as `appendedByJob` in enqueue.ts (not imported: it pulls DB code in).
const byJob = (r: StoredEvent): boolean => r.actor.startsWith("ai:");

/** The deed a row is, else null. `carriers` are the session's earlier `intent.recorded` rows. */
export function isDeedRow(
  row: StoredEvent,
  carriers: readonly StoredEvent[],
): { intent: Intent } | null {
  if (row.type !== "intent.recorded") return null;
  const p = pl(row);
  if (p.answers != null) {
    // Rule (a): a ruling is the deed of the player whose ask it answers.
    const asked = carriers.find(
      (c) => c.seq < row.seq && pl(c).request?.requestId === p.answers,
    );
    const intent = asked && pl(asked).intent;
    if (!asked || !intent || byJob(asked)) return null;
    const r = p.intent;
    if (r?.kind === "ruling" && r.params.decision === "reject") return null;
    return { intent };
  }
  // Rule (b): a direct act that settled engine rows or stopped.
  if (byJob(row) || !p.intent) return null;
  const direct =
    (p.outcome === "settled" && p.batchId != null) || p.stopped != null;
  return direct ? { intent: p.intent } : null;
}

/** W0/W1 of the narrate window (spec 104 plan D6): `(W0, W1]`. */
export function narrateWindow(
  prior: readonly { checkpoint: { factsThrough?: number } }[],
  lastNarrationSeq: number | null,
  throughSeq: number,
): { w0: number; w1: number } {
  const w0 =
    prior.find((t) => t.checkpoint.factsThrough !== undefined)?.checkpoint
      .factsThrough ??
    lastNarrationSeq ??
    0;
  return { w0, w1: throughSeq };
}

/** The deeds in `(w0, w1]`, in seq order. `carriers` hold every carrier through `w1`. */
export function windowDeeds(
  carriers: readonly StoredEvent[],
  projections: SessionProjections,
  window: { w0: number; w1: number },
): Deed[] {
  const out: Deed[] = [];
  const sorted = [...carriers].sort((x, y) => x.seq - y.seq);
  for (const r of sorted) {
    if (r.seq <= window.w0 || r.seq > window.w1) continue;
    if (r.visibility !== "public") continue;
    const d = isDeedRow(r, sorted);
    if (!d) continue;
    const id = "id" in d.intent.actor ? d.intent.actor.id : undefined;
    const p = pl(r);
    out.push({
      seq: r.seq,
      intentId: d.intent.id,
      name:
        projections.party.find((m) => m.characterId === id)?.name ??
        id ??
        "The scene",
      text: (toText(d.intent) || d.intent.kind).slice(0, 200),
      batchId: p.batchId ?? null,
      stopped: p.stopped?.code ?? null,
    });
  }
  return out;
}
