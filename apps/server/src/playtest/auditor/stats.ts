import {
  type LedgerRow,
  project,
  type StoredEvent,
} from "@the-stacks/session-model";
import type { FightStats } from "./schema.js";

/**
 * Fight statistics for TASK-0055 (contracts/auditor.md "Fight statistics").
 * Code only, from the ledger and the transcript. `null` when turn mode never
 * began. Sides: the party's combatants are `players` (companions included);
 * every other combatant is `npcs`. Damage dealt by a side is the damage the
 * other side took.
 */

type Side = "players" | "npcs";
const zero = () => ({ players: 0, npcs: 0 });

export function fightStats(
  transcript: readonly StoredEvent[],
  ledger: readonly LedgerRow[],
): FightStats | null {
  const modeRows = transcript.filter((r) => r.type === "table-mode.changed");
  const modeOf = (r: StoredEvent): string | undefined =>
    (r.payload as { after?: { mode?: string } } | null)?.after?.mode;
  if (!modeRows.some((r) => modeOf(r) === "turn")) return null;

  const party = new Set(
    project(transcript, { role: "dm" })
      .party.map((m) => m.combatantId)
      .filter((id): id is string => typeof id === "string"),
  );
  const sideOf = (id: string | null): Side =>
    id !== null && party.has(id) ? "players" : "npcs";
  const other = (s: Side): Side => (s === "players" ? "npcs" : "players");

  const turns = zero();
  const attackRolls = zero();
  const hits = zero();
  const damageDealt = zero();
  const damageTaken = zero();
  const reducedToZero: string[] = [];
  let deathSaveRolls = 0;
  let rounds = 0;

  const rollOf = new Map<string, Extract<LedgerRow, { kind: "roll" }>>();
  for (const r of ledger) {
    if (r.kind === "roll") rollOf.set(`${r.batchId}#${r.index}`, r);
  }

  const nameOf = (id: string | null) => {
    const p = project(transcript, { role: "dm" });
    return (
      p.engine.combatants[id ?? ""]?.name ??
      p.party.find((m) => m.combatantId === id)?.name ??
      String(id)
    );
  };

  for (const r of ledger) {
    if (r.kind === "roll" && /death sav/i.test(r.reason)) deathSaveRolls += 1;
    if (r.kind === "outcome" && r.outcome.type === "attack.resolved") {
      const o = r.outcome as {
        rollIndex?: number;
        outcome: string;
      };
      const roll = rollOf.get(`${r.batchId}#${o.rollIndex}`);
      const side = sideOf(roll?.roll.combatantId ?? null);
      attackRolls[side] += 1;
      if (o.outcome === "hit" || o.outcome === "critical-hit") hits[side] += 1;
    }
    if (r.kind === "change" && r.type === "turn.advanced") {
      const b = r.before as { combatantId?: string } | null;
      turns[sideOf(b?.combatantId ?? null)] += 1;
      const a = r.after as { round?: number } | null;
      rounds = Math.max(rounds, a?.round ?? 0);
    }
    if (r.kind === "change" && r.type === "encounter.started") {
      rounds = Math.max(rounds, 1);
    }
    if (r.kind === "change" && r.type === "hp.changed") {
      const b = r.before as { current: number; temp: number };
      const a = r.after as { current: number; temp: number };
      const lost = b.current + b.temp - (a.current + a.temp);
      const side = sideOf(r.subject);
      if (lost > 0) {
        damageTaken[side] += lost;
        damageDealt[other(side)] += lost;
      }
      if (a.current === 0 && b.current > 0 && side === "players") {
        reducedToZero.push(nameOf(r.subject));
      }
    }
  }

  let inTurn = false;
  let turnModeNarrations = 0;
  for (const r of [...transcript].sort((a, b) => a.seq - b.seq)) {
    if (r.type === "table-mode.changed") inTurn = modeOf(r) === "turn";
    if (inTurn && r.type === "narration" && r.actor === "ai:dm") {
      turnModeNarrations += 1;
    }
  }

  return {
    rounds,
    turns,
    attackRolls,
    hits,
    damageDealt,
    damageTaken,
    reducedToZero,
    deathSaveRolls,
    fledOrBargained: null,
    turnModeNarrations,
  };
}
