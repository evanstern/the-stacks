import { toText } from "@the-stacks/intent";
import {
  type LedgerRow,
  PUBLIC,
  project,
  type StoredEvent,
} from "@the-stacks/session-model";
import { isDeedRow } from "../../dm/deeds.js";
import {
  collectFacts,
  type FactChange,
  renderChangeLine,
  renderRollLine,
} from "../../dm/facts.js";
import {
  DEATH_WORDS,
  DICE_LANGUAGE,
  UNCONSCIOUS_WORDS,
} from "../../dm/narration-words.js";
import type { SceneSeed } from "../../dm/seed/schema.js";
import type { FindingKind } from "./schema.js";
import type { Segment } from "./segments.js";

/**
 * The six deterministic checks (specs/032-playtest-harness contracts/auditor.md
 * "Code checks"). Pure functions over one segment plus the seed.
 */

export const CHECK_IDS = [
  "prose-digits",
  "dice-lines",
  "life-states",
  "roll-reasons",
  "hidden-info",
  "dice-language",
  "deeds-narrated",
] as const;
export type CheckId = (typeof CHECK_IDS)[number];

export interface CheckFinding {
  kind: FindingKind;
  seqs: number[];
  detail: string;
}

export interface CheckResult {
  id: CheckId;
  pass: boolean;
  findings: CheckFinding[];
}

export interface CheckContext {
  /** The whole DM-view transcript, seq order (for names at the segment's end). */
  transcript: readonly StoredEvent[];
  seed: SceneSeed | null;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * A code-written row (spec 098 contract §3): roll lines `… expr → shown = total`,
 * hp lines `(before→after HP)`, life-state `a → b`, auto-fail rolls, conditions,
 * death saves, spell slots, assists and refusal rows. Prose carries none of them.
 */
const DICE_LINE =
  /→|: auto-fail| death saves: \d|: \S.* (?:applied|removed)$| spends a level \d+ spell slot$| helps .+ \((?:attack|ability check)\)$|: refused, .+ \([A-Z_]+\)$/;
/**
 * A `why` row (spec 098 contract §6, from the planner's facts on `intent.recorded`): rule, DC,
 * difficulty, opposition, reach, pull-in, reaction, ruling, no-roll and ignored-field lines. Code
 * writes them; they have no ledger counterpart, so they are accepted but not returned.
 */
const WHY_LINE =
  /^(?:Rule: |DC \d+|Difficulty: |Opposed by |Reach: |DM ruling: |No roll needed$|The DM sets the )|(?: joins the fight| may react as the mover leaves)$/;
/** The State line closes the code block; it has no ledger counterpart. */
/** A `Deed:` row (spec 111): the code-written line naming a direct act; no ledger counterpart. */
const DEED_LINE = /^Deed: /;
const STATE_LINE = /^State: /;
/** A refusal row comes from `action.resolved`, not a ledger row the check replays. */
const REFUSAL_ROW = /: refused, .+ \([A-Z_]+\)$/;

/**
 * Splits narration text into prose and dice lines. The DM runtime appends the
 * rows and the State line as the final blank-line-separated block, but prose
 * paragraphs are separated by blank lines too, so only the last block counts,
 * and only when every line of it looks like a code-written row. The State line
 * and refusal rows are accepted but not returned: the dice-lines check
 * compares ledger-derived rows only.
 */
export function splitNarration(text: string): {
  prose: string;
  diceLines: string[];
} {
  const trimmed = text.replace(/\s+$/, "");
  const i = trimmed.search(/\n\s*\n(?![\s\S]*\n\s*\n)/);
  if (i === -1) return { prose: text, diceLines: [] };
  const lines = trimmed
    .slice(i)
    .replace(/^\s+/, "")
    .split("\n")
    .filter((l) => l.trim() !== "");
  if (
    lines.length === 0 ||
    !lines.every(
      (l) =>
        STATE_LINE.test(l) ||
        WHY_LINE.test(l) ||
        DEED_LINE.test(l) ||
        DICE_LINE.test(l),
    )
  ) {
    return { prose: text, diceLines: [] };
  }
  return {
    prose: trimmed.slice(0, i),
    diceLines: lines.filter(
      (l) =>
        !STATE_LINE.test(l) &&
        !WHY_LINE.test(l) &&
        !DEED_LINE.test(l) &&
        !REFUSAL_ROW.test(l),
    ),
  };
}

function narrationOf(seg: Segment): StoredEvent | null {
  if (seg.narrationSeq === null) return null;
  return seg.rows.find((r) => r.seq === seg.narrationSeq) ?? null;
}

function damageTypes(rows: readonly StoredEvent[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const r of rows) {
    if (r.type !== "hp.changed") continue;
    const ev = (r.payload as { event?: { components?: unknown } }).event;
    const comps = ev?.components as
      | { damageType: string; applied: number }[]
      | null
      | undefined;
    const first = comps?.find((c) => c.applied > 0) ?? comps?.[0];
    if (first) out.set(r.seq, first.damageType);
  }
  return out;
}

/** Combatant names as the DM runtime sees them at the segment's last seq. */
function nameResolver(ctx: CheckContext, seg: Segment) {
  const p = project(
    ctx.transcript.filter((r) => r.seq <= seg.toSeq),
    { role: "dm" },
  );
  return {
    nameOf: (id: string | null): string => {
      if (id === null) return "The scene";
      return (
        p.engine.combatants[id]?.name ??
        p.party.find((m) => m.combatantId === id)?.name ??
        id
      );
    },
    names: [
      ...Object.values(p.engine.combatants).map((c) => c.name),
      ...p.party.map((m) => m.name),
    ],
  };
}

/**
 * The dice and damage lines the DM runtime would write for these ledger rows.
 * Rows that belong to an action group by `actionId`; null-action rows from a
 * batch that is not an encounter start (initiative) form the NPC turn, last.
 */
export function expectedDiceLines(
  seg: Segment,
  ctx: CheckContext,
): { lines: string[]; nameOf: (id: string | null) => string; names: string[] } {
  const { nameOf, names } = nameResolver(ctx, seg);
  const types = damageTypes(seg.rows);
  const startBatches = new Set(
    seg.ledger
      .filter((l) => l.kind === "change" && l.type === "encounter.started")
      .map((l) => l.batchId),
  );
  const groups = new Map<string, LedgerRow[]>();
  const npc: LedgerRow[] = [];
  for (const l of seg.ledger) {
    if (l.kind === "change" && !DICE_RELEVANT.has(l.type)) continue;
    if (l.actionId) {
      const g = groups.get(l.actionId) ?? [];
      g.push(l);
      groups.set(l.actionId, g);
    } else if (l.batchId && !startBatches.has(l.batchId)) {
      npc.push(l);
    }
  }
  const lines: string[] = [];
  for (const rows of [...groups.values(), npc]) {
    if (rows.length === 0) continue;
    const facts = collectFacts(rows, nameOf, types);
    lines.push(...facts.rolls.map(renderRollLine));
    for (const c of facts.changes) {
      const l = renderChangeLine(c);
      if (l) lines.push(l);
    }
  }
  return { lines, nameOf, names };
}

const DICE_RELEVANT = new Set([
  "hp.changed",
  "life-state.changed",
  "condition.applied",
  "condition.removed",
  "death-saves.changed",
  "spell-slots.changed",
  "assist.granted",
]);

function aliases(name: string): string[] {
  const parts = name.split(/\s+/);
  return [...new Set([name, parts[0], parts[parts.length - 1]])].filter(
    (n): n is string => !!n && n.length >= 3,
  );
}

const mentions = (text: string, name: string): boolean =>
  aliases(name).some((a) =>
    new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
      text,
    ),
  );

type LifeClaim = "dead" | "unconscious";

function lifeChanges(
  seg: Segment,
  nameOf: (id: string | null) => string,
): { name: string; state: LifeClaim; seq: number }[] {
  const out: { name: string; state: LifeClaim; seq: number }[] = [];
  const facts = (c: FactChange, seq: number) => {
    if (c.kind === "life-state") {
      if (c.after === "dead") out.push({ name: c.target, state: "dead", seq });
      else if (c.after === "unconscious") {
        out.push({ name: c.target, state: "unconscious", seq });
      }
    } else if (
      c.kind === "condition" &&
      c.condition === "unconscious" &&
      c.op === "applied"
    ) {
      out.push({ name: c.target, state: "unconscious", seq });
    }
  };
  for (const l of seg.ledger) {
    if (l.kind !== "change") continue;
    const c = collectFacts([l], nameOf).changes[0];
    if (c) facts(c, l.seq);
  }
  return out;
}

function checkLifeStates(
  seg: Segment,
  ctx: CheckContext,
  prose: string,
): CheckFinding[] {
  const { nameOf, names } = nameResolver(ctx, seg);
  const recorded = lifeChanges(seg, nameOf);
  const findings: CheckFinding[] = [];
  const seq = seg.narrationSeq as number;
  const sentences = prose.split(/(?<=[.!?])\s+/);
  const claimed = new Set<string>();
  for (const sentence of sentences) {
    const states: LifeClaim[] = [];
    if (DEATH_WORDS.test(sentence)) states.push("dead");
    if (UNCONSCIOUS_WORDS.test(sentence)) states.push("unconscious");
    if (states.length === 0) continue;
    for (const name of new Set(names)) {
      if (!mentions(sentence, name)) continue;
      for (const state of states) {
        const key = `${name}|${state}`;
        if (claimed.has(key)) continue;
        claimed.add(key);
        const ok = recorded.some(
          (r) =>
            r.state === state &&
            (mentions(r.name, name) || mentions(name, r.name)),
        );
        if (!ok) {
          findings.push({
            kind: "ledger-contradiction",
            seqs: [seq],
            detail: `The prose says ${name} is ${state === "dead" ? "dead" : "unconscious"}, and the ledger records no such change.`,
          });
        }
      }
    }
  }
  for (const r of recorded) {
    if (!mentions(prose, r.name)) {
      findings.push({
        kind: "ledger-contradiction",
        seqs: [r.seq, seq],
        detail: `The ledger records ${r.name} as ${r.state}, and the prose does not name ${r.name}.`,
      });
    }
  }
  return findings;
}

function textOf(row: StoredEvent): string {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  if (row.type === "narration" || row.type === "talk") return str(p.text);
  if (row.type === "journal.entry.added") {
    return `${str(p.title)}\n${str(p.body)}`;
  }
  return "";
}

/**
 * Hidden strings: every seed field marked secret (location and NPC
 * `hooks.secrets`). A tracker's display name is NOT hidden text: when a
 * tracker fills, the narration may describe that outcome in similar words.
 */
export function hiddenStrings(seed: SceneSeed): string[] {
  return [
    ...seed.location.hooks.secrets,
    ...seed.npcs.flatMap((n) => n.hooks.secrets),
  ].filter((s) => s.trim() !== "");
}

const NUMBER_WORD =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";
const FRACTION = new RegExp(
  `\\b(\\d+|${NUMBER_WORD})\\s*(?:of|out of|/)\\s*(\\d+|${NUMBER_WORD})\\b`,
  "gi",
);
const WORD_VALUE: Record<string, number> = Object.fromEntries(
  NUMBER_WORD.split("|").map((w, i) => [w, i + 1]),
);
const numeric = (t: string): number =>
  /^\d+$/.test(t) ? Number(t) : (WORD_VALUE[t.toLowerCase()] ?? Number.NaN);

const escapeRe = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Sentences in `text` that disclose a secret tracker's state: a segment
 * count or fraction ("3 of 4", "2/3") tied to a tracker, the tracker's id
 * beside the words tracker/clock, or the words tracker/clock/segment next to
 * a tracker's name. A bare tracker name is allowed (the outcome may be told).
 */
export function trackerStateDisclosures(
  text: string,
  seed: SceneSeed,
): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const lower = sentence.toLowerCase();
    if (lower.trim() === "") continue;
    const hasMeter = /\b(tracker|trackers|clock|clocks)\b/.test(lower);
    const hasSegment = /\bsegments?\b/.test(lower);
    const named = seed.trackers.some(
      (t) =>
        lower.includes(t.name.toLowerCase()) ||
        (hasMeter &&
          new RegExp(
            `(?<![a-z])${escapeRe(t.trackerId.toLowerCase())}(?![a-z])`,
          ).test(lower)),
    );
    const nameOnly = seed.trackers.some((t) =>
      lower.includes(t.name.toLowerCase()),
    );
    const sizes = new Set(seed.trackers.map((t) => t.segments));
    const fraction = [...lower.matchAll(FRACTION)].some(
      (m) =>
        sizes.has(numeric(m[2] as string)) &&
        numeric(m[1] as string) <= numeric(m[2] as string),
    );
    if (
      (fraction && (named || hasMeter)) ||
      (hasMeter && named) ||
      (hasSegment && nameOnly)
    ) {
      out.push(sentence.trim());
    }
  }
  return out;
}

/** Runs the six checks over one segment, in the contract's order. */
export function runChecks(seg: Segment, ctx: CheckContext): CheckResult[] {
  const narration = narrationOf(seg);
  const results: CheckResult[] = CHECK_IDS.map((id) => ({
    id,
    pass: true,
    findings: [],
  }));
  const by = (id: CheckId) => results.find((r) => r.id === id) as CheckResult;
  const add = (id: CheckId, f: CheckFinding) => {
    const r = by(id);
    r.findings.push(f);
    r.pass = false;
  };

  if (narration) {
    const seq = narration.seq;
    const { prose, diceLines } = splitNarration(
      str((narration.payload as { text?: unknown }).text),
    );
    if (/[0-9]/.test(prose)) {
      add("prose-digits", {
        kind: "ledger-contradiction",
        seqs: [seq],
        detail: "The prose contains digits; numbers live on the dice lines.",
      });
    }
    const expected = expectedDiceLines(seg, ctx).lines;
    if (
      expected.length !== diceLines.length ||
      expected.some((l, i) => l !== diceLines[i])
    ) {
      const firstBad = expected.findIndex((l, i) => l !== diceLines[i]);
      add("dice-lines", {
        kind: "ledger-contradiction",
        seqs: [seq],
        detail: `The dice lines differ from the ledger (expected ${expected.length}, found ${diceLines.length}${firstBad >= 0 ? `; first difference at line ${firstBad + 1}` : ""}).`,
      });
    }
    for (const f of checkLifeStates(seg, ctx, prose)) add("life-states", f);
    const hasRoll = seg.ledger.some((l) => l.kind === "roll");
    if (!hasRoll && DICE_LANGUAGE.test(prose)) {
      add("dice-language", {
        kind: "invented-mechanics",
        seqs: [seq],
        detail: "The prose names dice or a roll, and the segment has no roll.",
      });
    }
  }

  for (const l of seg.ledger) {
    if (l.kind === "roll" && (l.roll.reason ?? l.reason ?? "").trim() === "") {
      add("roll-reasons", {
        kind: "roll-without-reason",
        seqs: [l.seq],
        detail: "A ledger roll has an empty reason.",
      });
    }
  }

  if (ctx.seed) {
    const hidden = hiddenStrings(ctx.seed);
    for (const row of seg.rows) {
      if (row.visibility !== PUBLIC) continue;
      const text = textOf(row).toLowerCase();
      if (text === "") continue;
      for (const h of hidden) {
        if (text.includes(h.toLowerCase())) {
          add("hidden-info", {
            kind: "hidden-info-leak",
            seqs: [row.seq],
            detail: `A public ${row.type} row repeats hidden text: "${h.slice(0, 80)}".`,
          });
        }
      }
      for (const sentence of trackerStateDisclosures(textOf(row), ctx.seed)) {
        add("hidden-info", {
          kind: "hidden-info-leak",
          seqs: [row.seq],
          detail: `A public ${row.type} row discloses secret tracker state: "${sentence.slice(0, 80)}".`,
        });
      }
    }
  }
  for (const f of checkDeedsNarrated(seg, ctx)) add("deeds-narrated", f);
  return results;
}

/** The `Deed:` rows of a narration text. */
export function deedLines(text: string): string[] {
  return text.split("\n").filter((l) => DEED_LINE.test(l));
}

/** TASK-0337: every deed in the transcript is told by its segment's narration. */
export function checkDeedsNarrated(
  seg: Segment,
  ctx: CheckContext,
): CheckFinding[] {
  const carriers = ctx.transcript.filter((r) => r.type === "intent.recorded");
  const narration = narrationOf(seg);
  const lines = narration
    ? deedLines(str((narration.payload as { text?: unknown }).text))
    : [];
  const out: CheckFinding[] = [];
  for (const row of seg.rows) {
    const d = isDeedRow(row, carriers);
    if (!d) continue;
    const text = (toText(d.intent) || d.intent.kind).slice(0, 200);
    const told = lines.some(
      (l) => l.endsWith(`: ${text}`) || l.includes(`: ${text} (stopped`),
    );
    if (told) continue;
    out.push({
      kind: "unnarrated-deed",
      seqs: [row.seq],
      detail: `The deed "${text.slice(0, 120)}" (seq ${row.seq}) has no narration row.`,
    });
  }
  return out;
}
