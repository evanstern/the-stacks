import type {
  ActionAuthority,
  ActionView,
  PartyMemberView,
  TableMode,
  Viewer,
} from "@the-stacks/session-model";

export type CommitAuthority =
  | { canCommit: true; authority: ActionAuthority }
  | { canCommit: false; holder: string | null };

/**
 * Who may commit an action, from the viewer's seat (decision-0016, research R6). The gate
 * enforces; this only decides what the route shows. `holder` is an actor id, or null when
 * nobody holds the control.
 */
export function commitAuthorityFor(
  action: ActionView,
  tableMode: TableMode,
  viewer: Viewer,
  party: readonly PartyMemberView[],
): CommitAuthority {
  if (action.status !== "declared" && action.status !== "discussed") {
    return { canCommit: false, holder: null };
  }
  if (viewer.role === "dm") return { canCommit: true, authority: "dm" };

  const controls = party.some(
    (m) =>
      m.controller.kind === "player" && m.controller.userId === viewer.userId,
  );
  if (action.scope === "party" && controls) {
    return { canCommit: true, authority: "group" };
  }
  if (tableMode.mode === "turn") {
    if (
      tableMode.activeActor === viewer.userId &&
      action.actor === viewer.userId
    ) {
      return { canCommit: true, authority: "active-player" };
    }
    return { canCommit: false, holder: tableMode.activeActor };
  }
  if (action.actor === viewer.userId) {
    return { canCommit: true, authority: "declarer" };
  }
  return { canCommit: false, holder: action.actor };
}
