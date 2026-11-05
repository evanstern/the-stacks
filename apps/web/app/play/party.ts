import type { SessionProjections } from "@the-stacks/session-model";
import type { PresenceEntry } from "../ws/types.ts";

export interface PartyRow {
  characterId: string;
  name: string;
  /** "You" | display name | "Player (away)" | "Player" | "AI companion". */
  controller: string;
  isAi: boolean;
  isOwn: boolean;
  /** "Cleric 1"; null when either field is absent. */
  classLevel: string | null;
  hp: { current: number; max: number; temp: number } | null;
  ac: number | null;
}

/**
 * One row per party member, party order kept (specs/072-party-slideout, FR-007 to FR-009).
 * `present` is the live presence list, or null when presence is unknown.
 */
export function partyRows(
  p: Pick<SessionProjections, "party" | "viewer">,
  present: readonly PresenceEntry[] | null,
): PartyRow[] {
  const viewerId = p.viewer.role === "player" ? p.viewer.userId : null;
  return p.party.map((m) => {
    const c = m.controller;
    const isAi = c.kind === "ai-companion";
    const isOwn = c.kind === "player" && c.userId === viewerId;
    let controller = "AI companion";
    if (c.kind === "player") {
      const entry = present?.find((e) => e.userId === c.userId);
      controller = isOwn
        ? "You"
        : entry
          ? entry.displayName
          : present
            ? "Player (away)"
            : "Player";
    }
    return {
      characterId: m.characterId,
      name: m.name,
      controller,
      isAi,
      isOwn,
      classLevel:
        m.class !== undefined && m.level !== undefined
          ? `${m.class} ${m.level}`
          : null,
      hp: m.combatant?.hp ?? null,
      ac: m.combatant?.ac ?? null,
    };
  });
}

/** "Cleric 1 · HP 9/9 · AC 14": the one vitals wording for the Party panel and the margin. */
export function vitals(row: PartyRow): string {
  const hp = row.hp
    ? `HP ${row.hp.current}/${row.hp.max}${row.hp.temp > 0 ? ` (+${row.hp.temp})` : ""}`
    : "HP —";
  const ac = row.ac !== null ? `AC ${row.ac}` : "AC —";
  return `${row.classLevel ?? "Class and level not recorded"} · ${hp} · ${ac}`;
}
