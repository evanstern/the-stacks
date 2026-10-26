import type {
  LedgerRow,
  SessionProjections,
  StoredEvent,
} from "@the-stacks/session-model";
import type { TurnTrigger } from "./jobs.js";
import type { AdjudicateOutput } from "./nodes/adjudicate.js";
import type { BeatItem } from "./nodes/assemble.js";
import type { DirectorNodeOutput } from "./nodes/director.js";
import type { ResolveOutput } from "./nodes/resolve.js";
import type { SceneSeed } from "./seed/schema.js";

/**
 * Narration facts (contracts/nodes.md "narrate"): built by code from the
 * ledger rows the gate appended, never from a model. This module imports no
 * engine value and nothing from `gate/`: narrate's import closure includes it
 * (AC #6). The dice-line and damage-line renderer lives here too, so the
 * model never writes a number (FR-034).
 */

export type FactOutcome =
  | "hit"
  | "miss"
  | "critical-hit"
  | "success"
  | "failure";

export interface FactRoll {
  name: string;
  reason: string;
  expression: string;
  /** The natural d20 result, or the kept faces joined with "+". */
  shown: string;
  total: number | null;
  against: { kind: "AC" | "DC"; value: number } | null;
  outcome: FactOutcome | null;
  autoFail: boolean;
}

export type FactChange =
  | {
      kind: "hp";
      target: string;
      direction: "damage" | "heal";
      amount: number;
      damageType: string | null;
      before: number;
      after: number;
    }
  | {
      kind: "life-state";
      target: string;
      before: string;
      after: string;
    }
  | {
      kind: "condition";
      target: string;
      op: "applied" | "removed";
      condition: string;
    };

export interface FactAction {
  actionId: string;
  characterName: string | null;
  text: string;
  outcome: "applied" | "refused" | "no-effect";
  refusalCode: string | null;
  rolls: FactRoll[];
  outcomes: FactOutcome[];
  changes: FactChange[];
}

export interface FactNpcTurn {
  name: string;
  rolls: FactRoll[];
  outcomes: FactOutcome[];
  changes: FactChange[];
}

export interface NarrationFacts {
  trigger: TurnTrigger;
  actions: FactAction[];
  npcTurn: FactNpcTurn | null;
  director: {
    pacing: DirectorNodeOutput["pacing"];
    goalNote: string;
    sceneEnded: boolean;
  };
  modeChange: { from: "free" | "turn"; to: "free" | "turn" } | null;
  presentNpcs: {
    id: string;
    name: string;
    voice: string;
    want: string;
    detail: string;
  }[];
  rulings: { actionId: string; ruling: string; improvised: boolean }[];
  clarify: { actionId: string; question: string }[];
}

/** Removes the ` [<jobId>#<n>]` marker resolve appends to a reason. */
export function stripMarker(reason: string): string {
  return reason.replace(/\s\[[0-9a-fA-F-]+#\d+\]$/, "");
}

type NameOf = (combatantId: string | null) => string;

function shownFaces(
  terms: Extract<LedgerRow, { kind: "roll" }>["roll"]["terms"],
  natural: number | null,
): string {
  if (natural !== null) return String(natural);
  const faces: number[] = [];
  for (const t of terms) {
    if (t.kind !== "dice") continue;
    t.faces.forEach((f, i) => {
      if (t.kept[i] !== false) faces.push(f);
    });
  }
  return faces.length > 0 ? faces.join("+") : "-";
}

interface Collected {
  rolls: FactRoll[];
  outcomes: FactOutcome[];
  changes: FactChange[];
}

/** Rolls, outcomes and state changes from one action's (or turn's) ledger rows. */
export function collectFacts(
  rows: readonly LedgerRow[],
  nameOf: NameOf,
  damageTypeBySeq: ReadonlyMap<number, string> = new Map(),
): Collected {
  const out: Collected = { rolls: [], outcomes: [], changes: [] };
  const ordered = [...rows].sort((a, b) => a.seq - b.seq);
  const outcomeRows = ordered.filter(
    (r): r is Extract<LedgerRow, { kind: "outcome" }> => r.kind === "outcome",
  );
  const claimed = new Set<number>();

  for (const row of ordered) {
    if (row.kind === "roll") {
      const link = outcomeRows.find(
        (o) =>
          o.batchId === row.batchId &&
          "rollIndex" in o.outcome &&
          o.outcome.rollIndex === row.index,
      );
      if (link) claimed.add(link.seq);
      let against: FactRoll["against"] = null;
      let outcome: FactOutcome | null = null;
      if (link) {
        const o = link.outcome;
        if (o.type === "attack.resolved") {
          against = { kind: "AC", value: o.ac };
          outcome = o.outcome;
        } else if (o.type === "check.resolved") {
          against = { kind: "DC", value: o.dc };
          outcome = o.outcome;
        }
      }
      const name = nameOf(row.roll.combatantId);
      if (outcome) out.outcomes.push(outcome);
      out.rolls.push({
        name,
        reason: stripMarker(row.roll.reason),
        expression: row.roll.expression,
        shown: shownFaces(row.roll.terms, row.roll.natural),
        total: row.roll.total,
        against,
        outcome,
        autoFail: false,
      });
    }
  }
  // Check outcomes with no roll (auto-fail).
  for (const o of outcomeRows) {
    if (claimed.has(o.seq)) continue;
    if (o.outcome.type !== "check.resolved") continue;
    const e = o.outcome;
    if (e.rollIndex !== null) continue;
    out.outcomes.push(e.outcome);
    out.rolls.push({
      name: nameOf(e.combatantId),
      reason: stripMarker(e.autoFail?.reason ?? e.reason),
      expression: "auto-fail",
      shown: "-",
      total: null,
      against: { kind: "DC", value: e.dc },
      outcome: e.outcome,
      autoFail: true,
    });
  }

  for (const row of ordered) {
    if (row.kind !== "change") continue;
    const target = nameOf(row.subject);
    if (row.type === "hp.changed") {
      const b = row.before as { current: number; temp: number };
      const a = row.after as { current: number; temp: number };
      const lost = b.current + b.temp - (a.current + a.temp);
      if (lost === 0 && b.current === a.current) continue;
      out.changes.push({
        kind: "hp",
        target,
        direction: lost >= 0 ? "damage" : "heal",
        amount: Math.abs(lost),
        damageType: damageTypeBySeq.get(row.seq) ?? null,
        before: b.current,
        after: a.current,
      });
    } else if (row.type === "life-state.changed") {
      out.changes.push({
        kind: "life-state",
        target,
        before: String(row.before),
        after: String(row.after),
      });
    } else if (row.type === "condition.applied") {
      const c = row.after as { condition: string };
      out.changes.push({
        kind: "condition",
        target,
        op: "applied",
        condition: c.condition,
      });
    } else if (row.type === "condition.removed") {
      const c = row.before as { condition: string };
      out.changes.push({
        kind: "condition",
        target,
        op: "removed",
        condition: c.condition,
      });
    }
  }
  return out;
}

const OUTCOME_WORD: Record<FactOutcome, string> = {
  hit: "hit",
  miss: "miss",
  "critical-hit": "critical hit",
  success: "success",
  failure: "failure",
};

/** `<name> — <reason>: <expression> → <natural or faces> = <total> vs <AC|DC n>: <outcome>`. */
export function renderRollLine(roll: FactRoll): string {
  const vs = roll.against
    ? ` vs ${roll.against.kind} ${roll.against.value}`
    : "";
  const outcome = roll.outcome ? `: ${OUTCOME_WORD[roll.outcome]}` : "";
  if (roll.autoFail) {
    return `${roll.name} — ${roll.reason}: auto-fail${vs}${outcome}`;
  }
  return `${roll.name} — ${roll.reason}: ${roll.expression} → ${roll.shown} = ${roll.total}${vs}${outcome}`;
}

/** `<target> takes <n> <type> (<before>→<after> HP)`; healing reads "regains". */
export function renderChangeLine(change: FactChange): string | null {
  if (change.kind !== "hp") return null;
  const hp = `(${change.before}→${change.after} HP)`;
  if (change.direction === "heal") {
    return `${change.target} regains ${change.amount} HP ${hp}`;
  }
  const type = change.damageType ? ` ${change.damageType}` : "";
  return `${change.target} takes ${change.amount}${type} ${hp}`;
}

/** Every dice and damage line for the turn, in action order. Pure. */
export function renderDiceLines(facts: NarrationFacts): string[] {
  const lines: string[] = [];
  const push = (rolls: FactRoll[], changes: FactChange[]): void => {
    for (const r of rolls) lines.push(renderRollLine(r));
    for (const c of changes) {
      const l = renderChangeLine(c);
      if (l) lines.push(l);
    }
  };
  for (const a of facts.actions) push(a.rolls, a.changes);
  if (facts.npcTurn) push(facts.npcTurn.rolls, facts.npcTurn.changes);
  return lines;
}

function damageTypesBySeq(rows: readonly StoredEvent[]): Map<number, string> {
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

export interface BuildFactsInput {
  trigger: TurnTrigger;
  seed: SceneSeed;
  /** Projections read after resolve; the ledger holds prior and new rows. */
  projections: SessionProjections;
  beat: readonly BeatItem[];
  director: DirectorNodeOutput;
  adjudicate: AdjudicateOutput | null;
  resolve: ResolveOutput;
  presentNpcIds: readonly string[];
  /** Table mode before this turn's Director group. */
  modeBefore: "free" | "turn";
  /** Rows the gate appended this turn (for damage types). */
  appendedRows: readonly StoredEvent[];
  clarify: { actionId: string; question: string }[];
}

export function buildNarrationFacts(input: BuildFactsInput): NarrationFacts {
  const { projections: p, seed } = input;
  const nameOf: NameOf = (id) => {
    if (id === null) return "The scene";
    return (
      p.engine.combatants[id]?.name ??
      p.party.find((m) => m.combatantId === id)?.name ??
      id
    );
  };
  const types = damageTypesBySeq(input.appendedRows);
  const actions: FactAction[] = [];
  for (const item of input.beat) {
    const result = input.resolve.actionResults.find(
      (r) => r.actionId === item.actionId,
    );
    const view = p.actions.find((a) => a.actionId === item.actionId);
    let outcome: FactAction["outcome"];
    let refusalCode: string | null = null;
    if (result) {
      if (result.outcome === "awaiting-dm") continue;
      outcome = result.outcome;
      refusalCode = result.refusalCode;
    } else if (view?.resolved) {
      outcome = view.resolved.outcome;
      refusalCode = view.resolved.refusalCode;
    } else continue;
    const rows = p.ledger.filter((r) => r.actionId === item.actionId);
    const c = collectFacts(rows, nameOf, types);
    actions.push({
      actionId: item.actionId,
      characterName:
        item.scope === "party"
          ? null
          : (p.party.find((m) => m.characterId === item.characterId)?.name ??
            null),
      text: item.text,
      outcome,
      refusalCode,
      ...c,
    });
  }

  let npcTurn: FactNpcTurn | null = null;
  const npc = input.resolve.npcTurn;
  if (npc && !npc.awaitingDm) {
    const batches = new Set(npc.batchIds);
    const rows = p.ledger.filter((r) => r.batchId && batches.has(r.batchId));
    npcTurn = {
      name: nameOf(npc.combatantId),
      ...collectFacts(rows, nameOf, types),
    };
  }

  const beatNpcs =
    seed.beats.find((b) => b.id === input.director.pacing.beatId)?.npcIds ??
    input.presentNpcIds;
  const presentNpcs = beatNpcs.flatMap((id) => {
    const n = seed.npcs.find((x) => x.id === id);
    return n
      ? [
          {
            id: n.id,
            name: n.name,
            voice: n.portrayal.voice,
            want: n.portrayal.want,
            detail: n.portrayal.detail,
          },
        ]
      : [];
  });

  const modeAfter = p.tableMode.mode;
  return {
    trigger: input.trigger,
    actions,
    npcTurn,
    director: {
      pacing: input.director.pacing,
      goalNote: input.director.goalNote,
      sceneEnded: input.director.scene.status === "end",
    },
    modeChange:
      modeAfter !== input.modeBefore
        ? { from: input.modeBefore, to: modeAfter }
        : null,
    presentNpcs,
    rulings: (input.adjudicate?.rulings ?? []).flatMap((r) =>
      r.actionId
        ? [{ actionId: r.actionId, ruling: r.ruling, improvised: r.improvised }]
        : [],
    ),
    clarify: input.clarify,
  };
}

/** True when there is nothing for narrate to say. */
export function nothingToNarrate(facts: NarrationFacts): boolean {
  return (
    facts.trigger !== "scene-start" &&
    facts.actions.length === 0 &&
    facts.npcTurn === null &&
    facts.clarify.length === 0
  );
}
