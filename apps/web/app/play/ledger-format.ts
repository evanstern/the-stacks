import type { LedgerRow } from "@the-stacks/session-model";

export interface ChangedField {
  path: string;
  before: string;
  after: string;
}

export type LedgerItem =
  | {
      kind: "roll";
      seq: number;
      reason: string;
      expression: string;
      dice: { sides: number; faces: number[]; kept: boolean[] }[];
      modifier: number;
      total: number;
      natural: number | null;
      hidden: boolean;
    }
  | {
      kind: "outcome";
      seq: number;
      reason: string;
      summary: string;
      hidden: boolean;
    }
  | {
      kind: "change";
      seq: number;
      reason: string;
      type: string;
      subject: string | null;
      fields: ChangedField[];
      hidden: boolean;
    };

const MAX_DEPTH = 3;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function display(v: unknown): string {
  if (v === null || v === undefined) return "none";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function walk(
  before: unknown,
  after: unknown,
  path: string[],
  out: ChangedField[],
): void {
  const bothAbsentOrObject =
    (before == null || isRecord(before)) && (after == null || isRecord(after));
  const bothNull = before == null && after == null;
  if (bothAbsentOrObject && !bothNull && path.length < MAX_DEPTH) {
    const b = isRecord(before) ? before : {};
    const a = isRecord(after) ? after : {};
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
    for (const key of keys) walk(b[key], a[key], [...path, key], out);
    return;
  }
  if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) return;
  out.push({
    path: path.length === 0 ? "value" : path.join("."),
    before: display(before),
    after: display(after),
  });
}

/**
 * The leaves that differ between two state values: objects walk to depth 3, arrays and
 * deeper values compare as whole JSON, a null side renders "none" (research R7).
 */
export function changedFields(before: unknown, after: unknown): ChangedField[] {
  const out: ChangedField[] = [];
  walk(before, after, [], out);
  return out;
}

function outcomeSummary(row: Extract<LedgerRow, { kind: "outcome" }>): string {
  const o = row.outcome;
  switch (o.type) {
    case "attack.resolved": {
      const prefix = o.reaction === true ? "Reaction: " : "";
      return o.outcome === "critical-hit"
        ? `${prefix}Critical hit (${o.total} vs AC ${o.ac})`
        : `${prefix}${o.outcome === "hit" ? "Hit" : "Miss"} (${o.total} vs AC ${o.ac})`;
    }
    case "check.resolved": {
      // Spec 070: a band label when the row carries one; old rows read by outcome.
      const result =
        o.band === "success-at-cost"
          ? "Success at a cost"
          : o.band === "severe-failure"
            ? "Severe failure"
            : o.outcome === "success"
              ? "Success"
              : "Failure";
      if (o.total === null && o.autoFail === null && o.outcome === "success") {
        return `${result} (no roll)`;
      }
      return o.total === null
        ? `${result} (DC ${o.dc})`
        : `${result} (${o.total} vs DC ${o.dc})`;
    }
    case "rest.completed":
      return `${o.kind === "short" ? "Short" : "Long"} rest completed`;
  }
}

/** Ledger rows as display items, in the order given (newest last). */
export function toLedgerItems(rows: readonly LedgerRow[]): LedgerItem[] {
  return rows.map((row): LedgerItem => {
    const hidden = row.visibility === "dm";
    if (row.kind === "roll") {
      const dice: { sides: number; faces: number[]; kept: boolean[] }[] = [];
      let modifier = 0;
      for (const term of row.roll.terms) {
        if (term.kind === "dice") {
          dice.push({
            sides: term.sides,
            faces: [...term.faces],
            kept: [...term.kept],
          });
        } else {
          modifier += term.value;
        }
      }
      return {
        kind: "roll",
        seq: row.seq,
        reason: row.reason,
        expression: row.roll.expression,
        dice,
        modifier,
        total: row.roll.total,
        natural: row.roll.natural ?? null,
        hidden,
      };
    }
    if (row.kind === "outcome") {
      return {
        kind: "outcome",
        seq: row.seq,
        reason: row.reason,
        summary: outcomeSummary(row),
        hidden,
      };
    }
    return {
      kind: "change",
      seq: row.seq,
      reason: row.reason,
      type: row.type,
      subject: row.subject,
      fields: changedFields(row.before, row.after),
      hidden,
    };
  });
}
