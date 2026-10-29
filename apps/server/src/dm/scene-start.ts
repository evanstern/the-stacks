import type { SessionProjections } from "@the-stacks/session-model";

/**
 * TASK-0167 (spec 059, contracts/scene-start-state.md): the one predicate that
 * decides whether a session may start a scene. The start route's 409 and the
 * play header both read it. Pure: no I/O.
 */
export type SceneStartState = "none" | "queued" | "pending" | "started";

/** The 409 message for every state that refuses a start. */
export const START_CONFLICT_MESSAGE: Record<
  Exclude<SceneStartState, "none">,
  string
> = {
  started: "The session already has a scene.",
  queued: "A scene start is already queued.",
  pending: "A scene start is waiting for the DM.",
};

/** Rules in order; the first that holds wins. */
export function sceneStartState(
  projections: SessionProjections,
  turnJobs: readonly { status: string; input: unknown }[],
): SceneStartState {
  if (projections.scene !== null) return "started";
  const queued = turnJobs.some(
    (j) =>
      (j.status === "queued" || j.status === "running") &&
      (j.input as { trigger?: string } | null)?.trigger === "scene-start",
  );
  if (queued) return "queued";
  const pending = projections.proposals.some(
    (p) =>
      p.kind === "scene" &&
      p.status === "pending" &&
      p.proposer === "ai:dm" &&
      (p.proposal as { after?: unknown }).after != null,
  );
  if (pending) return "pending";
  return "none";
}
