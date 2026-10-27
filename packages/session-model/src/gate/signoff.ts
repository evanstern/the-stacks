import type { SessionProjections } from "../projections/types.js";

export type SignoffStance = "approve" | "object" | "waiting";

export interface SignoffRow {
  /** A human who controls at least one party member. */
  userId: string;
  /** In the quorum's present set. */
  present: boolean;
  /** Latest approve/object; the declarer defaults to approve. */
  stance: SignoffStance;
}

export interface SignoffState {
  /** Every party human, sorted by userId. */
  rows: SignoffRow[];
  /** User ids of rows with present: true, sorted. */
  quorum: string[];
  /** Quorum members with stance "waiting", sorted. */
  waiting: string[];
  /** Quorum members with stance "object", sorted. */
  objecting: string[];
  /** Quorum non-empty and every quorum member approves. */
  met: boolean;
}

/**
 * Group sign-off for a party-scope action (specs/044-group-signoff/contracts/signoff.md).
 * Pure over public projection data. `present` is the present set (user ids);
 * `actingUserId`, when given, is added to it and counted as approving (FR-015, FR-016).
 * Returns null for an unknown or character-scope action.
 */
export function signoffState(
  p: SessionProjections,
  actionId: string,
  present: readonly string[],
  actingUserId?: string,
): SignoffState | null {
  const action = p.actions.find((a) => a.actionId === actionId);
  if (action?.scope !== "party") return null;

  const humans = [
    ...new Set(
      p.party.flatMap((m) =>
        m.controller.kind === "player" ? [m.controller.userId] : [],
      ),
    ),
  ].sort();
  const presentSet = new Set(present);
  if (actingUserId !== undefined) presentSet.add(actingUserId);

  const rows: SignoffRow[] = humans.map((userId) => {
    let stance: SignoffStance = userId === action.actor ? "approve" : "waiting";
    for (const c of action.comments) {
      if (c.actor !== userId) continue;
      if (c.stance === "approve" || c.stance === "object") stance = c.stance;
    }
    if (userId === actingUserId) stance = "approve";
    return { userId, present: presentSet.has(userId), stance };
  });

  const inQuorum = rows.filter((r) => r.present);
  return {
    rows,
    quorum: inQuorum.map((r) => r.userId),
    waiting: inQuorum
      .filter((r) => r.stance === "waiting")
      .map((r) => r.userId),
    objecting: inQuorum
      .filter((r) => r.stance === "object")
      .map((r) => r.userId),
    met: inQuorum.length > 0 && inQuorum.every((r) => r.stance === "approve"),
  };
}
