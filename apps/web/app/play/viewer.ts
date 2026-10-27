import type { SessionProjections, Viewer } from "@the-stacks/session-model";

/** The signed-in user as the root loader supplies it. */
export interface LiveUser {
  id: string;
  role: string;
}

/** What the viewer decision reads from a session's projections. */
export type ViewerProjections = Pick<SessionProjections, "gate">;

/**
 * Who the signed-in user is at this table. The client mirrors `apps/server/src/ws/registry.ts`
 * `viewerFor` (TASK-0045): the DM viewer goes only to the user holding the human DM seat.
 * Every other user gets a player viewer with their own id. The account role does not decide
 * the viewer (TASK-0118): an unseated user, operator included, is a spectator player. An
 * operator reads DM-only data in the debug view, not on /play.
 * Pure, so it re-derives whenever the seat events change.
 */
export function viewerFor(
  user: LiveUser,
  projections: ViewerProjections,
): Viewer {
  const { seat } = projections.gate;
  if (seat.kind === "human" && seat.userId === user.id) return { role: "dm" };
  return { role: "player", userId: user.id };
}
