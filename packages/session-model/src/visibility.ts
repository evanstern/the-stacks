import { DM_ONLY, PUBLIC } from "./ids.js";

export type Viewer = { role: "dm" } | { role: "player"; userId: string };

/** The one visibility rule (session-events.md, "Visibility"). */
export function canSee(viewer: Viewer, visibility: string): boolean {
  if (viewer.role === "dm") return true;
  if (visibility === PUBLIC) return true;
  if (visibility === DM_ONLY) return false;
  return visibility === viewer.userId;
}
