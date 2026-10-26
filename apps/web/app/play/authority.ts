import {
  type ActionAuthority,
  type ActionView,
  commitAuthority,
  type PartyMemberView,
  type SessionProjections,
  type TableMode,
  type Viewer,
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
  // The DM seat is not known from a viewer, so the DM branch stays local; the gate enforces.
  if (viewer.role === "dm") return { canCommit: true, authority: "dm" };

  // Players: TASK-0045's executable rule (specs/029-proposal-gate/contracts/policy-and-authority.md),
  // over the three projection fields it reads for a player committer.
  const decision = commitAuthority(
    {
      actions: [action],
      party,
      tableMode,
      gate: { seat: { kind: "ai" }, policyOverrides: {} },
    } as unknown as SessionProjections,
    { actor: viewer.userId },
    action.actionId,
  );
  if (decision.ok) return { canCommit: true, authority: decision.authority };
  if (decision.code === "GROUP_SIGNOFF_REQUIRED") {
    return { canCommit: false, holder: null };
  }
  return {
    canCommit: false,
    holder: tableMode.mode === "turn" ? tableMode.activeActor : action.actor,
  };
}
