import type {
  LedgerRow,
  SessionProjections,
  Viewer,
  Way,
} from "@the-stacks/session-model";
import {
  type DiceView,
  diceText,
  outcomeSummary,
  rollDice,
} from "./ledger-format.ts";
import type { TableViewModel, TranscriptItem } from "./view-model.ts";

export type Category = "ic" | "table" | "rules";

/** Spec 091 D3: the table's one stream, sorted by seq. */
export type StreamItem = {
  seq: number;
  category: Category;
  pinned: boolean;
} & (
  | { kind: "transcript"; item: TranscriptItem }
  | {
      kind: "room";
      heading: string;
      description: string | null;
      ways: Way[];
      party: string;
    }
  | {
      kind: "roll";
      summary: string;
      /** The expansion: dice, modifier and total against the DC or AC, the outcome, damage. */
      detail: string[];
      /** Every die with its kept mask, so a dropped d20 face can be struck (FR-026). */
      dice: DiceView[];
      total: number;
    }
  | { kind: "rules"; text: string }
);

type Roll = Extract<LedgerRow, { kind: "roll" }>;
type Outcome = Extract<LedgerRow, { kind: "outcome" }>;
type Change = Extract<LedgerRow, { kind: "change" }>;

const ABILITY: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};
const MODE_WORDS: Record<string, string> = {
  advantage: " with advantage",
  disadvantage: " with disadvantage",
};
const BAND_WORDS: Record<string, string> = {
  "success-at-cost": "success at a cost",
  "severe-failure": "severe failure",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function rollItem(
  roll: Roll,
  outcome: Outcome | null,
  damage: Roll[],
  name: (id: string | null) => string,
): StreamItem {
  const { dice, modifier } = rollDice(roll.roll);
  const mode = MODE_WORDS[roll.roll.mode] ?? "";
  const sum = `${dice.map(diceText).join(" + ")}${
    modifier === 0 ? "" : ` ${modifier > 0 ? "+" : "−"} ${Math.abs(modifier)}`
  } = ${roll.roll.total}`;
  const base = { seq: roll.seq, category: "rules" as const, pinned: false };
  if (!outcome) {
    return {
      ...base,
      kind: "roll",
      summary: `${name(roll.roll.combatantId)} — ${roll.roll.purpose}${mode} ${roll.roll.total}`,
      detail: [sum],
      dice,
      total: roll.roll.total,
    };
  }
  const o = outcome.outcome;
  const detail = [`${sum}${against(o)}`, outcomeSummary(outcome)];
  for (const d of damage) {
    const dd = rollDice(d.roll);
    detail.push(
      `Damage: ${dd.dice.map(diceText).join(" + ")} = ${d.roll.total}`,
    );
  }
  let summary: string;
  if (o.type === "attack.resolved") {
    const verb = o.outcome === "critical-hit" ? "critical hit" : o.outcome;
    summary = `${name(o.attackerId)} — ${o.attack ?? "Attack"} vs ${name(o.targetId)}${mode}: ${verb}`;
  } else if (o.type === "check.resolved") {
    const what = o.skill
      ? cap(o.skill)
      : `${ABILITY[o.ability] ?? o.ability}${o.kind === "saving-throw" ? " save" : ""}`;
    const word =
      (o.band && BAND_WORDS[o.band]) ??
      (o.outcome === "success" ? "success" : "failure");
    const total = o.total === null ? "" : ` ${o.total}`;
    summary = `${name(o.combatantId)} — ${what}${mode}${total} ${o.outcome === "success" ? "✓" : "✗"} ${word}`;
  } else {
    summary = `${name(roll.roll.combatantId)} — ${roll.reason}`;
  }
  return {
    ...base,
    kind: "roll",
    summary,
    detail,
    dice,
    total: roll.roll.total,
  };
}

function against(o: Outcome["outcome"]): string {
  if (o.type === "attack.resolved") return ` vs AC ${o.ac}`;
  if (o.type === "check.resolved") return ` vs DC ${o.dc}`;
  return "";
}

type HpPair = { current: number; temp: number };

/** Spec 091 FR-007 wording; `null` for a change that has no rules line. */
function rulesLine(
  row: Change,
  name: (id: string | null) => string,
  isParty: (id: string | null) => boolean,
): string | null {
  const who = name(row.subject);
  const before = row.before as Record<string, unknown> | null;
  const after = row.after as Record<string, unknown> | null;
  switch (row.type) {
    case "encounter.started": {
      const order = (after?.order ?? []) as { combatantId: string }[];
      return `Initiative: ${order.map((o) => name(o.combatantId)).join(", ")}`;
    }
    case "condition.applied":
      return `${who} is ${String(after?.condition)}.`;
    case "condition.removed":
      return `${who} is no longer ${String(before?.condition)}.`;
    case "hp.changed": {
      if (!isParty(row.subject)) return null;
      const b = before as unknown as HpPair;
      const a = after as unknown as HpPair;
      // The ledger row keeps no `cause`; read it off the change.
      const cause =
        a.current < b.current
          ? "damage"
          : a.current > b.current
            ? "healing"
            : a.temp > b.temp
              ? "temp HP"
              : "damage";
      return `${who}: HP ${b.current} → ${a.current} (${cause}).`;
    }
    case "life-state.changed":
      return after === null || String(after) === "conscious"
        ? `${who} is back on their feet.`
        : `${who} is ${String(after)}.`;
    default:
      return null;
  }
}

function category(item: TranscriptItem): Category {
  switch (item.kind) {
    case "narration":
    case "narration-stream":
      return "ic";
    case "talk":
      return item.channel === "ic" && !item.askDm ? "ic" : "table";
    case "aside":
      return "table";
    default:
      return "rules";
  }
}

/**
 * The stream: today's transcript items plus roll rows, rules lines and room blocks from the
 * ledger, sorted by seq (plan D3, DA1). Pure.
 * ponytail: roll rows format ledger rows in the web (spec 091 OQ-A5), mirroring `facts.ts`
 * `renderRollLine`; one shared formatter is TASK-0331.
 */
export function streamItems(
  model: Pick<TableViewModel, "transcript">,
  p: SessionProjections,
  viewer: Viewer,
): StreamItem[] {
  const partyByCombatant = new Map(
    p.party.flatMap((m) => (m.combatantId ? [[m.combatantId, m]] : [])),
  );
  const name = (id: string | null): string =>
    id === null
      ? "Someone"
      : (p.engine.combatants[id]?.name ?? partyByCombatant.get(id)?.name ?? id);
  const isParty = (id: string | null) =>
    id !== null && partyByCombatant.has(id);
  const ownActionIds = new Set(
    p.actions
      .filter((a) => viewer.role === "player" && a.actor === viewer.userId)
      .map((a) => a.actionId),
  );

  const out: StreamItem[] = model.transcript.map((item) => ({
    seq: item.seq,
    kind: "transcript",
    category: category(item),
    pinned:
      (item.kind === "confirm" &&
        item.confirm.lines.some((l) => l.canAccept)) ||
      (item.kind === "action" &&
        item.card.open &&
        ownActionIds.has(item.card.actionId)),
    item,
  }));

  const rolls = new Map<string, Roll[]>();
  for (const row of p.ledger) {
    if (row.kind === "roll")
      rolls.set(row.batchId, [...(rolls.get(row.batchId) ?? []), row]);
  }
  const used = new Set<Roll>();
  for (const row of p.ledger) {
    if (row.kind !== "outcome" || row.outcome.type === "rest.completed")
      continue;
    const batch = rolls.get(row.batchId) ?? [];
    const idx = row.outcome.rollIndex;
    const roll = idx === null ? undefined : (batch[idx] ?? batch[0]);
    if (!roll) continue;
    const damage =
      row.outcome.type === "attack.resolved"
        ? batch.filter((r) => r.roll.purpose === "damage" && !used.has(r))
        : [];
    used.add(roll);
    for (const d of damage) used.add(d);
    out.push(rollItem(roll, row, damage, name));
  }
  // A roll with no outcome in its batch shows its total only.
  for (const rs of rolls.values())
    for (const r of rs) if (!used.has(r)) out.push(rollItem(r, null, [], name));

  for (const row of p.ledger) {
    if (row.kind !== "change") continue;
    if (row.type === "scene.changed") {
      const after = row.after as {
        title: string;
        location: string | null;
        description?: string;
        ways?: Way[];
      } | null;
      if (!after) continue;
      out.push({
        seq: row.seq,
        kind: "room",
        category: "ic",
        pinned: false,
        heading: after.location ?? after.title,
        description: after.description ?? null,
        ways: after.ways ?? [],
        party: `Party: ${p.party
          .map((m) =>
            m.combatant
              ? `${m.name} HP ${m.combatant.hp.current}/${m.combatant.hp.max}${
                  m.combatant.ac === null ? "" : ` AC ${m.combatant.ac}`
                }`
              : m.name,
          )
          .join(", ")}`,
      });
      continue;
    }
    const text = rulesLine(row, name, isParty);
    if (text) {
      out.push({
        seq: row.seq,
        kind: "rules",
        category: "rules",
        pinned: false,
        text,
      });
    }
  }
  // Stable: a roll row and a transcript row never share a seq, so ties are a same-row pair.
  return out.sort((a, b) => a.seq - b.seq);
}
