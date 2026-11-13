import {
  defaultRestate,
  dropDigitSentences,
  dropStockEnding,
  type FactSheet,
  type NarrationSlots,
  type SlotName,
  TAG,
} from "./fact-sheet.js";
import {
  type CheckInput,
  checkNarration,
  dropSentences,
  sentencesOf,
} from "./narration-check.js";
import { stripThink } from "./pipeline/call.js";

/**
 * The narration stream parser (spec 108 plan D2). Pure. It turns model deltas into slot parts that
 * a finished `checkNarration` would also ship: a sentence streams only after it is complete, has
 * passed the `parseSlots` digit drop and the check's leak and digit rules, and a successor sentence
 * exists (the last sentence of a slot is always held). Constitution III: nothing the check drops
 * ever streams. When a candidate cannot extend what was already sent, the slot holds (fails closed).
 */

export interface StreamPart {
  slot: SlotName;
  /** A describe part after the first starts with a space, so concatenating parts yields the slot text. */
  text: string;
}

export interface NarrationStreamInput extends Omit<CheckInput, "slots"> {
  sheet: FactSheet;
}

export interface NarrationStream {
  push(delta: string): StreamPart[];
  /** `settled` is the check node's kept slots. Emits what streaming has not sent, only when it extends it. */
  finish(settled: NarrationSlots): StreamPart[];
}

/**
 * Describe streams only while the slot is at most this long. `clipProse` cuts a longer slot at a
 * sentence end, which could land before a sentence already sent. ponytail: above this the rest
 * ships at `finish`; raise it when a playtest shows long describe slots that wait.
 */
export const STREAM_DESCRIBE_CAP = 600;

/** Index of the first opening quote with no closing partner, else -1 (mirrors `maskQuotes`). */
function unclosedQuote(text: string): number {
  const re = /(["“])([^"“”]*)(["”])/g;
  const spans: [number, number][] = [];
  for (const m of text.matchAll(re)) {
    spans.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  }
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '"' && text[i] !== "“") continue;
    if (!spans.some(([a, b]) => i >= a && i < b)) return i;
  }
  return -1;
}

/** The model text with leading think blocks removed; "" while a block is open or half-typed. */
function visibleOf(raw: string): string {
  const s = stripThink(raw);
  const head = s.trimStart();
  if (/^<think>/.test(head)) return "";
  if (head.length < 7 && "<think>".startsWith(head)) return "";
  return s;
}

export function createNarrationStream(
  input: NarrationStreamInput,
): NarrationStream {
  const { sheet, ...checkInput } = input;
  let raw = "";
  let sentDescribe = "";
  let sentRestate: string | null = null;
  let lastKey: string | null = null;

  const slotTexts = (
    text: string,
  ): {
    texts: Record<SlotName, string>;
    tagged: boolean;
    current: SlotName;
  } => {
    const segs: Record<SlotName, string[]> = {
      restate: [],
      describe: [],
      ask: [],
    };
    let current: SlotName = "describe";
    let last = 0;
    let tagged = false;
    for (const m of text.matchAll(TAG)) {
      segs[current].push(text.slice(last, m.index));
      current = (m[1] ?? m[2] ?? (m[3] as string)).toLowerCase() as SlotName;
      last = (m.index ?? 0) + m[0].length;
      tagged = true;
    }
    segs[current].push(text.slice(last));
    const join = (n: SlotName): string =>
      sheet.slots.includes(n)
        ? segs[n]
            .map((s) => s.trim())
            .filter(Boolean)
            .join(" ")
        : "";
    return {
      texts: {
        restate: join("restate"),
        describe: join("describe"),
        ask: join("ask"),
      },
      tagged,
      current,
    };
  };

  /** The describe text the check would keep, from the complete sentences only. Null to hold. */
  const describeKept = (slotText: string): string | null => {
    const d = dropDigitSentences(slotText);
    if (d.length > STREAM_DESCRIBE_CAP) return null;
    const q = unclosedQuote(d);
    const sents = sentencesOf(q < 0 ? d : d.slice(0, q));
    const complete = sents.slice(0, -1).map((s) => s.raw);
    if (complete.length === 0) return "";
    const key = complete.join(" ");
    if (key === lastKey) return null;
    lastKey = key;
    const cand = dropStockEnding(key);
    const drop = checkNarration({
      ...checkInput,
      slots: { restate: "", describe: cand, ask: "" },
    })
      .filter((i) => i.check === "leak" || i.kind === "digit")
      .map((i) => i.sentence);
    return dropSentences(cand, drop);
  };

  const restateOf = (text: string): string => {
    let r = text;
    if (!r || /[0-9]/.test(r)) r = defaultRestate(sheet);
    return r;
  };

  return {
    push(delta) {
      raw += delta;
      const text = visibleOf(raw);
      if (!text) return [];
      const { texts, tagged, current } = slotTexts(text);
      const out: StreamPart[] = [];
      if (
        sheet.slots.includes("restate") &&
        sentRestate === null &&
        tagged &&
        current !== "restate" &&
        texts.restate
      ) {
        sentRestate = restateOf(texts.restate);
        if (sentRestate) out.push({ slot: "restate", text: sentRestate });
      }
      if (sheet.slots.includes("describe") && texts.describe) {
        const kept = describeKept(texts.describe);
        if (
          kept?.startsWith(sentDescribe) &&
          kept.length > sentDescribe.length
        ) {
          const rest = kept.slice(sentDescribe.length);
          sentDescribe = kept;
          out.push({ slot: "describe", text: rest });
        }
      }
      return out;
    },
    finish(settled) {
      const out: StreamPart[] = [];
      if (sentRestate === null && settled.restate) {
        sentRestate = settled.restate;
        out.push({ slot: "restate", text: settled.restate });
      }
      if (
        settled.describe.startsWith(sentDescribe) &&
        settled.describe.length > sentDescribe.length
      ) {
        out.push({
          slot: "describe",
          text: settled.describe.slice(sentDescribe.length),
        });
        sentDescribe = settled.describe;
      }
      if (settled.ask) out.push({ slot: "ask", text: settled.ask });
      return out;
    },
  };
}
