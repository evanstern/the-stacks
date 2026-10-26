import type { SessionFixture } from "./build.js";
import { freeModeAction } from "./free-mode-action.js";
import { secretTracker } from "./secret-tracker.js";
import { talkOnly } from "./talk-only.js";
import { turnModeCombat } from "./turn-mode-combat.js";
import { unknownAndInvalid } from "./unknown-and-invalid.js";

export type { MechanicsRecipe, SessionFixture } from "./build.js";
export { fixtureIds } from "./build.js";
export { recipes } from "./recipes.js";
export {
  freeModeAction,
  secretTracker,
  talkOnly,
  turnModeCombat,
  unknownAndInvalid,
};

export const fixtures: readonly SessionFixture[] = [
  talkOnly,
  freeModeAction,
  turnModeCombat,
  secretTracker,
  unknownAndInvalid,
];
