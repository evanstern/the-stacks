import type { SessionFixture } from "./build.js";
import { commitAuthority } from "./commit-authority.js";
import { dmApprovals } from "./dm-approvals.js";
import { freeModeAction } from "./free-mode-action.js";
import { groupSignoff } from "./group-signoff.js";
import { presenceMarker } from "./presence-marker.js";
import { proposalExamples } from "./proposal-examples.js";
import { secretTracker } from "./secret-tracker.js";
import { talkOnly } from "./talk-only.js";
import { turnFloor } from "./turn-floor.js";
import { turnModeCombat } from "./turn-mode-combat.js";
import { unknownAndInvalid } from "./unknown-and-invalid.js";

export type { MechanicsRecipe, SessionFixture } from "./build.js";
export { fixtureIds } from "./build.js";
export { recipes } from "./recipes.js";
export {
  commitAuthority,
  dmApprovals,
  freeModeAction,
  groupSignoff,
  presenceMarker,
  proposalExamples,
  secretTracker,
  talkOnly,
  turnFloor,
  turnModeCombat,
  unknownAndInvalid,
};

export const fixtures: readonly SessionFixture[] = [
  talkOnly,
  freeModeAction,
  turnModeCombat,
  secretTracker,
  unknownAndInvalid,
  dmApprovals,
  commitAuthority,
  groupSignoff,
  turnFloor,
];
