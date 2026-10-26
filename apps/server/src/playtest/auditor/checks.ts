import {
  type LedgerRow,
  PUBLIC,
  project,
  type StoredEvent,
} from "@the-stacks/session-model";
import {
  DEATH_WORDS,
  DICE_LANGUAGE,
  UNCONSCIOUS_WORDS,
} from "../../dm/audit-words.js";
import {
  collectFacts,
  type FactChange,
  renderChangeLine,
  renderRollLine,
} from "../../dm/facts.js";
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

/** Splits narration text at its first blank line: prose, then dice lines. */
export function splitNarration(text: string): {
  prose: string;
  diceLines: string[];
} {
  const i = text.search(/\n\s*\n/);
  if (i === -1) return { prose: text, diceLines: [] };
  const rest = text.slice(i).replace(/^\s+/, "");
  return {
    prose: text.slice(0, i),
    diceLines: rest.split("\n").filter((l) => l.trim() !== ""),
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

/** Hidden strings: location and NPC secrets, and secret tracker names. */
export function hiddenStrings(seed: SceneSeed): string[] {
  return [
    ...seed.location.hooks.secrets,
    ...seed.npcs.flatMap((n) => n.hooks.secrets),
    ...seed.trackers.map((t) => t.name),
  ].filter((s) => s.trim() !== "");
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
    }
  }
  return results;
}
