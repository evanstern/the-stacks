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
import type { PlayerSeedView } from "./seed/views.js";

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

/** Reserved for TASK-0127 (spec 070 R10); this card never sets it. */
export type FactBand =
  | "success"
  | "success-at-cost"
  | "failure"
  | "severe-failure";

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
  /** Attack target name, from attack.resolved.targetId. */
  target: string | null;
  band?: FactBand | null;
}

/** A reflex the dice allow the narrator to show (spec 074 D3). Never a choice. */
export interface FactInvoluntary {
  /** The party member. */
  name: string;
  trigger: "stagger" | "heavy-hit" | "flinch" | "avoid";
  detail: string;
}

export type FactEvent =
  | { kind: "encounter-started"; combatants: string[]; first: string | null }
  | { kind: "encounter-ended" }
  | { kind: "turn-advanced"; next: string }
  | { kind: "combatant-joined"; name: string }
  | { kind: "combatant-left"; name: string }
  | {
      kind: "presence";
      name: string;
      presence: "present" | "yielded" | "absent";
      reason: string;
    };

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
    }
  | {
      kind: "death-saves";
      target: string;
      /** The tally after the save. */
      successes: number;
      failures: number;
      /** True when the save added a failure; false when it added a success. */
      failed: boolean;
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
  /** Later plan steps the first-stage cut held back (specs/064). */
  followUps: string[];
}

/** What the monster planned this beat (spec 071). `held`: no step ran or the plan gate refused it. */
export interface FactNpcPlan {
  intent: string;
  reasons: string[];
  held: boolean;
}

export interface FactNpcTurn {
  name: string;
  /** Always set by `buildNarrationFacts`; optional so existing literals compile. */
  plan?: FactNpcPlan;
  rolls: FactRoll[];
  outcomes: FactOutcome[];
  changes: FactChange[];
}

/** One combatant the turn passed over, with the death save settling rolled for it. */
export interface FactSettled {
  name: string;
  rolls: FactRoll[];
  outcomes: FactOutcome[];
  changes: FactChange[];
}

export interface NarrationFacts {
  trigger: TurnTrigger;
  actions: FactAction[];
  npcTurn: FactNpcTurn | null;
  /** Whose beat this is and who acts after it; set only in turn mode (spec 071). */
  turn?: { actor: string; next: string | null };
  /** Settled death-save turns (TASK-0112); omitted when settling rolled nothing. */
  settled?: FactSettled[];
  /** Reflexes derived from this turn's rows (spec 074); always set by `buildNarrationFacts`. */
  involuntary?: FactInvoluntary[];
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
  party: {
    characterId: string;
    name: string;
    controller: "human" | "ai-companion";
  }[];
  /** Public ledger changes this turn, in seq order. */
  events: FactEvent[];
  setting: { locationName: string; openingFraming: string };
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
      let target: string | null = null;
      if (link) {
        const o = link.outcome;
        if (o.type === "attack.resolved") {
          against = { kind: "AC", value: o.ac };
          outcome = o.outcome;
          target = nameOf(o.targetId);
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
        target,
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
      target: null,
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
    } else if (row.type === "death-saves.changed") {
      const b = row.before as { successes: number; failures: number };
      const a = row.after as { successes: number; failures: number };
      out.changes.push({
        kind: "death-saves",
        target,
        successes: a.successes,
        failures: a.failures,
        failed: a.failures > b.failures,
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
  if (change.kind === "death-saves") {
    const successes = change.successes === 1 ? "success" : "successes";
    const failures = change.failures === 1 ? "failure" : "failures";
    return `${change.target} death saves: ${change.successes} ${successes}, ${change.failures} ${failures}`;
  }
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
  for (const s of facts.settled ?? []) push(s.rolls, s.changes);
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

/** Public ledger changes from the rows appended this turn. Never from trackers. */
function buildEvents(
  rows: readonly StoredEvent[],
  nameOf: NameOf,
  presenceNameOf: NameOf = nameOf,
): FactEvent[] {
  const pub = rows
    .filter((r) => r.visibility === "public")
    .sort((a, b) => a.seq - b.seq);
  const evOf = (r: StoredEvent): Record<string, unknown> =>
    ((r.payload as { event?: Record<string, unknown> } | null)?.event ??
      {}) as Record<string, unknown>;
  const nameIn = (o: unknown): string | null => {
    const n = (o as { name?: unknown } | null | undefined)?.name;
    return typeof n === "string" ? n : null;
  };
  const added: string[] = [];
  for (const r of pub) {
    if (r.type !== "combatant.added") continue;
    const n = nameIn(evOf(r).after);
    if (n) added.push(n);
  }
  const hasStart = pub.some((r) => r.type === "encounter.started");
  const endSeq = Math.max(
    -1,
    ...pub.filter((r) => r.type === "encounter.ended").map((r) => r.seq),
  );
  const out: FactEvent[] = [];
  for (const r of pub) {
    const ev = evOf(r);
    if (r.type === "encounter.started") {
      const order =
        (ev.after as { order?: { combatantId: string }[] } | null)?.order ?? [];
      const names = order.map((o) => nameOf(o.combatantId));
      out.push({
        kind: "encounter-started",
        combatants: added.length > 0 ? [...added] : names,
        first: names[0] ?? null,
      });
    } else if (r.type === "encounter.ended") {
      out.push({ kind: "encounter-ended" });
    } else if (r.type === "turn.advanced") {
      if (endSeq > r.seq) continue;
      const id = (ev.after as { combatantId?: string } | null)?.combatantId;
      if (id) out.push({ kind: "turn-advanced", next: nameOf(id) });
    } else if (r.type === "combatant.added") {
      if (hasStart) continue;
      const n = nameIn(ev.after);
      if (n) out.push({ kind: "combatant-joined", name: n });
    } else if (r.type === "scene-presence.changed") {
      const pl = r.payload as {
        actorId?: string;
        after?: "present" | "yielded" | "absent";
        reason?: string;
      } | null;
      if (pl?.actorId && pl.after && pl.reason) {
        out.push({
          kind: "presence",
          name: presenceNameOf(pl.actorId),
          presence: pl.after,
          reason: pl.reason,
        });
      }
    } else if (r.type === "combatant.removed") {
      const n = nameIn(ev.before);
      if (n) out.push({ kind: "combatant-left", name: n });
    }
  }
  return out;
}

export interface BuildFactsInput {
  trigger: TurnTrigger;
  seed: PlayerSeedView;
  /** NPC ids present in the current beat; the caller reads them from the full seed. */
  beatNpcIds: readonly string[];
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
  /** Follow-ups per action id, from the ruling when one exists, else the reading. */
  followUps?: Record<string, string[]>;
  /** The monster's reading (ruling steps replace the reading's); null when none. */
  npcPlan?: { intent: string; steps: { reason: string }[] } | null;
  /** The combatant active at the start of the beat; set only when the table was in turn mode. */
  turnActorId?: string | null;
}

/**
 * Pure. Reflex triggers from ledger rows, in seq order, deduped by
 * `name|trigger` (spec 074 D3). Party targets only; death saves emit no
 * `check.resolved`, so they never yield a flinch.
 */
export function deriveInvoluntary(
  rows: readonly LedgerRow[],
  party: ReadonlySet<string>,
  maxHpOf: (combatantId: string) => number | null,
  nameOf: NameOf,
): FactInvoluntary[] {
  const out: FactInvoluntary[] = [];
  const seen = new Set<string>();
  const add = (i: FactInvoluntary): void => {
    const key = `${i.name}|${i.trigger}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(i);
  };
  for (const row of [...rows].sort((a, b) => a.seq - b.seq)) {
    if (row.kind === "outcome") {
      const o = row.outcome;
      if (o.type === "attack.resolved" && party.has(o.targetId)) {
        if (o.outcome === "critical-hit") {
          add({
            name: nameOf(o.targetId),
            trigger: "stagger",
            detail: `critical hit by ${nameOf(o.attackerId)}`,
          });
        } else if (o.outcome === "miss") {
          add({
            name: nameOf(o.targetId),
            trigger: "avoid",
            detail: `missed by ${nameOf(o.attackerId)}`,
          });
        }
      } else if (
        o.type === "check.resolved" &&
        o.kind === "saving-throw" &&
        o.outcome === "failure" &&
        o.combatantId &&
        party.has(o.combatantId)
      ) {
        add({
          name: nameOf(o.combatantId),
          trigger: "flinch",
          detail: `failed ${o.ability} save`,
        });
      }
    } else if (
      row.kind === "change" &&
      row.type === "hp.changed" &&
      row.subject &&
      party.has(row.subject)
    ) {
      const b = row.before as { current: number; temp: number };
      const a = row.after as { current: number; temp: number };
      const lost = b.current + b.temp - (a.current + a.temp);
      const max = maxHpOf(row.subject);
      if (lost > 0 && max && lost * 2 >= max) {
        add({
          name: nameOf(row.subject),
          trigger: "heavy-hit",
          detail: "heavy damage",
        });
      }
    }
  }
  return out;
}

const PLAN_MAX_REASONS = 4;
const PLAN_MAX_CHARS = 200;

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
      followUps: input.followUps?.[item.actionId] ?? [],
    });
  }

  let npcTurn: FactNpcTurn | null = null;
  const npc = input.resolve.npcTurn;
  if (npc && !npc.awaitingDm) {
    const batches = new Set(npc.batchIds);
    const rows = p.ledger.filter((r) => r.batchId && batches.has(r.batchId));
    const steps = input.npcPlan?.steps ?? [];
    const refused = (input.resolve.planGate ?? []).some(
      (v) => v.actionId === null && !v.ok,
    );
    npcTurn = {
      name: nameOf(npc.combatantId),
      plan: {
        intent: input.npcPlan?.intent ?? "other",
        reasons: steps
          .slice(0, PLAN_MAX_REASONS)
          .map((s) => stripMarker(s.reason).slice(0, PLAN_MAX_CHARS)),
        held: refused || steps.length === 0,
      },
      ...collectFacts(rows, nameOf, types),
    };
  }

  let turn: NarrationFacts["turn"];
  if (npcTurn || input.turnActorId) {
    const next = [...buildEvents(input.appendedRows, nameOf)]
      .reverse()
      .find((e) => e.kind === "turn-advanced");
    turn = {
      actor: npcTurn?.name ?? nameOf(input.turnActorId ?? null),
      next: next?.kind === "turn-advanced" ? next.next : null,
    };
  }

  // Settling (TASK-0112): the death saves rolled for combatants the turn passed.
  const settleBatches = new Set(
    input.resolve.submissions.flatMap((s) =>
      s.key.startsWith("settle:") && s.key.endsWith(":save") && s.batchId
        ? [s.batchId]
        : [],
    ),
  );
  const settled: FactSettled[] = [];
  for (const batchId of settleBatches) {
    const rows = p.ledger.filter((r) => r.batchId === batchId);
    const first = rows.find((r) => r.kind === "roll");
    const subject =
      first && first.kind === "roll" ? first.roll.combatantId : null;
    settled.push({
      name: nameOf(subject),
      ...collectFacts(rows, nameOf, types),
    });
  }

  const partyIds = new Set(
    p.party.flatMap((m) => (m.combatantId ? [m.combatantId] : [])),
  );
  const involuntary = deriveInvoluntary(
    [
      ...actions.flatMap((a) =>
        p.ledger.filter((r) => r.actionId === a.actionId),
      ),
      ...(input.resolve.npcTurn && !input.resolve.npcTurn.awaitingDm
        ? p.ledger.filter(
            (r) =>
              r.batchId && input.resolve.npcTurn?.batchIds.includes(r.batchId),
          )
        : []),
      ...p.ledger.filter((r) => r.batchId && settleBatches.has(r.batchId)),
    ],
    partyIds,
    (id) => p.engine.combatants[id]?.hp.max ?? null,
    nameOf,
  );

  const beatNpcs = input.beatNpcIds;
  const presentNpcs = beatNpcs.flatMap((id) => {
    const n = seed.npcs.find((x) => x.id === id);
    return n
      ? [
          {
            id: n.id,
            name: n.name,
            voice: n.voice,
            want: n.want,
            detail: n.detail,
          },
        ]
      : [];
  });

  const modeAfter = p.tableMode.mode;
  return {
    trigger: input.trigger,
    actions,
    npcTurn,
    ...(turn ? { turn } : {}),
    ...(settled.length > 0 ? { settled } : {}),
    involuntary,
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
    party: p.party.map((m) => ({
      characterId: m.characterId,
      name: m.name,
      controller: m.controller.kind === "player" ? "human" : "ai-companion",
    })),
    events: buildEvents(input.appendedRows, nameOf, (id) => {
      const known = nameOf(id);
      return known !== id
        ? known
        : (seed.npcs.find((n) => n.id === id)?.name ?? id);
    }),
    setting: {
      locationName: seed.location.name,
      openingFraming: seed.openingFraming,
    },
  };
}

/** True when there is nothing for narrate to say. */
export function nothingToNarrate(facts: NarrationFacts): boolean {
  return (
    facts.trigger !== "scene-start" &&
    facts.actions.length === 0 &&
    facts.npcTurn === null &&
    (facts.settled?.length ?? 0) === 0 &&
    facts.clarify.length === 0
  );
}
