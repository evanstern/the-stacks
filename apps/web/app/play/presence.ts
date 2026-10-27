import type { SessionProjections } from "@the-stacks/session-model";
import type { PresenceEntry } from "../ws/types.ts";

export type PresenceRole = "dm" | "player" | "observer";

export interface PresenceRow {
  /** A user id, or "ai:dm" for the AI DM. One row per key. */
  key: string;
  label: string;
  role: PresenceRole;
  present: boolean;
}

/** What the rows read from the viewer's own projection. */
export type PresenceProjections = Pick<SessionProjections, "gate" | "party">;

const AI_DM_KEY = "ai:dm";

/**
 * The strip's rows (FR-006). The AI DM is present whenever the seat is AI. A human DM seat
 * holder is always listed and marked absent when not in `present`. A present user who holds
 * the seat is `dm`, one who controls a party member is `player`, any other is `observer`.
 * `null` (presence unknown) yields no player rows, only the DM row.
 */
export function presenceRows(
  present: readonly PresenceEntry[] | null,
  projections: PresenceProjections,
): PresenceRow[] {
  const { seat } = projections.gate;
  const rows = new Map<string, PresenceRow>();
  const controllers = new Map<string, string>();
  for (const m of projections.party) {
    if (m.controller.kind === "player") {
      controllers.set(m.controller.userId, m.name);
    }
  }

  if (seat.kind === "ai") {
    rows.set(AI_DM_KEY, {
      key: AI_DM_KEY,
      label: "AI DM",
      role: "dm",
      present: true,
    });
  }
  for (const entry of present ?? []) {
    if (rows.has(entry.userId)) continue;
    const isDm = seat.kind === "human" && seat.userId === entry.userId;
    rows.set(entry.userId, {
      key: entry.userId,
      label: entry.displayName,
      role: isDm ? "dm" : controllers.has(entry.userId) ? "player" : "observer",
      present: true,
    });
  }
  if (seat.kind === "human" && !rows.has(seat.userId)) {
    rows.set(seat.userId, {
      key: seat.userId,
      label: controllers.get(seat.userId) ?? "DM",
      role: "dm",
      present: false,
    });
  }
  return [...rows.values()];
}
