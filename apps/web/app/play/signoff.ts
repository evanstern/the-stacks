import {
  type ActionView,
  type PartyMemberView,
  type SessionProjections,
  signoffState,
  type Viewer,
} from "@the-stacks/session-model";

export type SignoffRowState = "approved" | "objects" | "waiting" | "absent";

export interface SignoffRowView {
  userId: string;
  label: string;
  state: SignoffRowState;
  /** True on the viewer's own row, which carries Approve and Object. */
  isViewer: boolean;
}

/**
 * Per-player sign-off rows for a party-scope action (specs/044-group-signoff, FR-010),
 * from the same `signoffState` rule the gate uses. `present === null` means presence is not
 * known yet: every party human counts as present (plan D9) and the gate decides. Returns
 * null for a character-scope action or a party with fewer than two humans.
 */
export function signoffRows(
  action: ActionView,
  party: readonly PartyMemberView[],
  present: readonly string[] | null,
  viewer: Viewer,
  label: (userId: string) => string,
): SignoffRowView[] | null {
  if (action.scope !== "party") return null;
  const humans = [
    ...new Set(
      party.flatMap((m) =>
        m.controller.kind === "player" ? [m.controller.userId] : [],
      ),
    ),
  ];
  if (humans.length < 2) return null;
  const state = signoffState(
    { actions: [action], party } as unknown as SessionProjections,
    action.actionId,
    present ?? humans,
  );
  if (!state) return null;
  return state.rows.map((row) => ({
    userId: row.userId,
    label: label(row.userId),
    state: !row.present
      ? "absent"
      : row.stance === "approve"
        ? "approved"
        : row.stance === "object"
          ? "objects"
          : "waiting",
    isViewer: viewer.role === "player" && viewer.userId === row.userId,
  }));
}
