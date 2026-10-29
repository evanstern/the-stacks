import type { SessionProjections } from "@the-stacks/session-model";
import type { PresenceEntry } from "../ws/types.ts";

export interface DmSeatCandidate {
  userId: string;
  label: string;
}

export interface DmSeatView {
  holder: { kind: "ai" } | { kind: "human"; userId: string; label: string };
  /** Null while presence is unknown. */
  candidates: DmSeatCandidate[] | null;
  canReturn: boolean;
  /** The viewer's pending proposal count when the viewer holds the seat; else null. */
  pendingCount: number | null;
}

/** The seat holder, whom the operator may seat, and whether the seat can return to the AI. */
export function dmSeatView(
  p: Pick<SessionProjections, "gate" | "party">,
  present: readonly PresenceEntry[] | null,
  self: string,
  pending: number | null,
): DmSeatView {
  const { seat } = p.gate;
  const holderId = seat.kind === "human" ? seat.userId : null;
  const holder: DmSeatView["holder"] =
    seat.kind === "human"
      ? {
          kind: "human",
          userId: seat.userId,
          label:
            present?.find((e) => e.userId === seat.userId)?.displayName ?? "DM",
        }
      : { kind: "ai" };
  const players = new Set(
    p.party.flatMap((m) =>
      m.controller.kind === "player" ? [m.controller.userId] : [],
    ),
  );
  const seen = new Set<string>();
  const candidates = present
    ? present.flatMap((e) => {
        if (
          e.userId === holderId ||
          players.has(e.userId) ||
          seen.has(e.userId)
        )
          return [];
        seen.add(e.userId);
        return [
          {
            userId: e.userId,
            label: e.userId === self ? `${e.displayName} (you)` : e.displayName,
          },
        ];
      })
    : null;
  return {
    holder,
    candidates,
    canReturn: seat.kind === "human",
    pendingCount: pending,
  };
}
