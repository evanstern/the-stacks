import type { SessionProjections } from "@the-stacks/session-model";

/** Seeds list at most this many scene proposals. */
const SEED_LIMIT = 10;

/** The only proposer whose scene proposals seed the form (D-4). */
const AI_DM = "ai:dm";

export interface SceneSeedView {
  /** The proposal id, or "current". */
  key: string;
  /** Null for the current scene. */
  proposalId: string | null;
  origin: "pending" | "earlier" | "current";
  /** Null for the current scene. */
  policy: "ask" | "suggest" | null;
  /** The proposal summary, or "Current scene". */
  label: string;
  /** The proposal reason, or "" for the current scene. */
  reason: string;
  /** The seed clears the scene (`after` is null). */
  clear: boolean;
  scene: {
    sceneId: string;
    title: string;
    summary: string;
    location: string | null;
  } | null;
}

export interface SceneChangeView {
  /** Null when no scene is set. */
  current: SceneSeedView | null;
  /** Oldest first. */
  pending: SceneSeedView[];
  /** Newest first. Together with `pending`, the last ten scene proposals. */
  earlier: SceneSeedView[];
  /** The panel shows "The table stays in turn mode." */
  turnMode: boolean;
  /** No current scene and no seed: the panel shows the empty line and no form. */
  empty: boolean;
}

/**
 * The seeds the human DM's "Change scene" panel offers: the AI DM's scene proposals plus the
 * current scene. Pure and total. `pendingIds` are the proposals still open at the table.
 */
export function sceneChangeView(
  p: SessionProjections,
  pendingIds: ReadonlySet<string>,
): SceneChangeView {
  const candidates = p.proposals
    .filter((v) => v.proposal.kind === "scene" && v.proposer === AI_DM)
    .sort((a, b) => a.createdSeq - b.createdSeq)
    .slice(-SEED_LIMIT);

  const seeds: SceneSeedView[] = [];
  for (const v of candidates) {
    const proposal = v.proposal;
    if (proposal.kind !== "scene") continue;
    // The gate refuses a clear request when no scene is set.
    if (proposal.after === null && p.scene === null) continue;
    seeds.push({
      key: v.proposalId,
      proposalId: v.proposalId,
      origin: pendingIds.has(v.proposalId) ? "pending" : "earlier",
      policy: v.policy,
      label:
        proposal.summary ??
        (proposal.after ? proposal.after.title : "Clear the scene"),
      reason: proposal.reason,
      clear: proposal.after === null,
      scene: proposal.after
        ? {
            sceneId: proposal.after.sceneId,
            title: proposal.after.title,
            summary: proposal.after.summary,
            location: proposal.after.location,
          }
        : null,
    });
  }

  const pending = seeds.filter((s) => s.origin === "pending");
  const earlier = seeds.filter((s) => s.origin === "earlier").reverse();
  const current: SceneSeedView | null = p.scene
    ? {
        key: "current",
        proposalId: null,
        origin: "current",
        policy: null,
        label: "Current scene",
        reason: "",
        clear: false,
        scene: {
          sceneId: p.scene.sceneId,
          title: p.scene.title,
          summary: p.scene.summary,
          location: p.scene.location,
        },
      }
    : null;

  return {
    current,
    pending,
    earlier,
    turnMode: p.tableMode.mode === "turn",
    empty: current === null && seeds.length === 0,
  };
}
