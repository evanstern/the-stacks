import type { SessionProjections, Viewer } from "@the-stacks/session-model";

/** The signed-in user as the root loader supplies it. */
export interface LiveUser {
  id: string;
  role: string;
}

/** What the viewer decision reads from a session's projections. */
export type ViewerProjections = Pick<SessionProjections, "party" | "gate">;

/**
 * Who the signed-in user is at this table. The session's projections decide, not the account
 * role alone (spec 030 research R4, amended TASK-0048):
 *  1. the user holds the human DM seat -> the DM viewer;
 *  2. else the user controls at least one party character -> a player viewer;
 *  3. else (unseated) -> the account-role fallback: an operator views as the DM, anyone
 *     else as a player. An unseated operator has no character to play, so the DM view is
 *     the useful one (it is also the pre-TASK-0048 behaviour).
 * Pure, so it re-derives whenever the seat or party events change.
 */
export function viewerFor(
  user: LiveUser,
  projections: ViewerProjections,
): Viewer {
  const { seat } = projections.gate;
  if (seat.kind === "human" && seat.userId === user.id) return { role: "dm" };
  const controlsCharacter = projections.party.some(
    (m) => m.controller.kind === "player" && m.controller.userId === user.id,
  );
  if (controlsCharacter) return { role: "player", userId: user.id };
  return user.role === "operator"
    ? { role: "dm" }
    : { role: "player", userId: user.id };
}
