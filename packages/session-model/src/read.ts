import { KIND_RULES } from "@the-stacks/intent";
import type {
  SessionProjections,
  TranscriptEntry,
} from "./projections/types.js";

/**
 * The AI DM's read rule (specs/066-one-chat-stream FR-006 to FR-010, FR-018). Pure and shared
 * by the server (talk triggers) and the client (ring, Thinking, confirm state).
 */

/** The quiet window before a read starts, in ms (FR-007). */
export const READ_QUIET_MS = 10_000;
/** The ring stays blank for this long after a post (FR-024). */
export const RING_BLANK_MS = 2_000;

export type ReadRule = 1 | 2 | 3 | 4;

export interface ReadablePost {
  /** The post's row seq: the `talk` row, or the carrier row of a declared Intent. */
  seq: number;
  ts: string;
  actor: string;
  rule: ReadRule;
  /** The Intent id; null for a legacy companion `talk` row (rule 4). */
  intentId: string | null;
  text: string;
}

/** True when `text` starts with `@dm` as a whole word (so `@dmx` does not). */
export function isDmQuestion(text: string): boolean {
  return /^\s*@dm(?![\p{L}\p{N}_-])/iu.test(text);
}

const isHuman = (actor: string): boolean =>
  !actor.startsWith("ai:") && actor !== "system";

const SPEECH = new Set(["say", "say_to", "emote"]);

/**
 * The posts the AI DM reads, in seq order (FR-006). Nothing under a human DM seat.
 * The D19 chain cap stays the caller's check (`capReached`).
 */
export function readablePosts(p: SessionProjections): ReadablePost[] {
  if (p.gate.seat.kind !== "ai") return [];
  const free = p.tableMode.mode === "free";
  const out: ReadablePost[] = [];
  const talkAt = (seq: number) => {
    const e = p.transcript.find((t) => t.seq === seq);
    return e?.kind === "talk" ? e : undefined;
  };

  for (const v of p.intents) {
    const kind = v.intent.kind;
    const text = v.intent.text ?? "";
    const talk = talkAt(v.seq - 1);
    const at = talk && talk.actor === v.actor ? talk : undefined;
    const post = (rule: ReadRule): ReadablePost => ({
      seq: at?.seq ?? v.seq,
      ts: at?.ts ?? v.ts,
      actor: v.actor,
      rule,
      intentId: v.id,
      text,
    });
    if (kind === "ask_dm") {
      if (isHuman(v.actor)) out.push(post(3));
    } else if (SPEECH.has(kind)) {
      if (free && (isHuman(v.actor) || v.actor.startsWith("ai:companion:"))) {
        out.push(post(1));
      }
    } else if (
      free &&
      v.status === "declared" &&
      isHuman(v.actor) &&
      !["speech", "meta", "session", "dm"].includes(KIND_RULES[kind].group) &&
      !p.actions.some((a) => v.id.startsWith(`${a.actionId}.`))
    ) {
      out.push(post(2));
    }
  }

  if (free) {
    for (const e of p.transcript) {
      if (
        e.kind === "talk" &&
        e.channel === "ic" &&
        e.visibility === "public" &&
        e.actor.startsWith("ai:companion:") &&
        !p.intents.some((v) => v.seq === e.seq + 1 && v.actor === e.actor)
      ) {
        out.push({
          seq: e.seq,
          ts: e.ts,
          actor: e.actor,
          rule: 4,
          intentId: null,
          text: e.text,
        });
      }
    }
  }
  return out.sort((a, b) => a.seq - b.seq);
}

/** The seq of the latest readable post; 0 when there is none. */
export function latestReadablePostSeq(p: SessionProjections): number {
  return readablePosts(p).reduce((max, post) => Math.max(max, post.seq), 0);
}

/** How long after `post.ts` its read may start (FR-007): 0 for `ask_dm` in turn mode. */
export function readWindowMs(
  post: ReadablePost,
  p: SessionProjections,
): number {
  return post.rule === 3 && p.tableMode.mode === "turn" ? 0 : READ_QUIET_MS;
}

/** FR-010: a row that ends a read's input: DM narration, a confirm, or an `ooc` answer. */
export function isDmReadOutput(entry: TranscriptEntry): boolean {
  if (entry.kind === "action.suggested") return true;
  if (entry.actor !== "ai:dm") return false;
  return (
    entry.kind === "narration" ||
    (entry.kind === "talk" && entry.channel === "ooc")
  );
}

export type SuggestionState = "live" | "stale" | "confirmed" | "missing";

/**
 * FR-018, for one item named by its Intent id (`<suggestionId>.i<n>`). `confirmed` once the Intent has a carrier row (whatever the staleness).
 * Stale when a later public `action.suggested`, a later public `narration` with no
 * `actionIds`, or a later public change into turn mode exists.
 */
export function suggestionState(
  p: SessionProjections,
  intentId: string,
): SuggestionState {
  const sug = p.suggestions.find((s) =>
    s.items.some((i) => i.intent.id === intentId),
  );
  if (!sug) return "missing";
  if (p.intents.some((v) => v.id === intentId)) return "confirmed";
  const supersededByRow = p.transcript.some(
    (e) =>
      e.seq > sug.seq &&
      e.visibility === "public" &&
      (e.kind === "action.suggested" ||
        (e.kind === "narration" && e.actionIds.length === 0)),
  );
  const toTurn = p.ledger.some(
    (r) =>
      r.kind === "change" &&
      r.seq > sug.seq &&
      r.visibility === "public" &&
      r.type === "table-mode.changed" &&
      (r.after as { mode?: string } | null)?.mode === "turn",
  );
  return supersededByRow || toTurn ? "stale" : "live";
}
