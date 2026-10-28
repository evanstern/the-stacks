# Mutation guard — spec 055

## Phase 1 (implementer, commit f14a5e35)

| Mutation | Expected | Result |
|---|---|---|
| `frames.ts`: replace the `SceneSchema.safeParse` call with an always-success stub | T002 over-long-title case fails | Failed: `not ok 17 - sceneFrame returns null for a long title, empty reason or bad sceneId` (frames.test.mjs, 17 pass, 1 fail). |
| `use-live-table.ts`: drop the `rejectFrame` send in `changeScene` | No unit test covers the live hook | Web suite stayed green (255 node tests, 107 vitest). The live close is proven by Phase 5 step 8 instead. |

Each mutation was restored with `git checkout <file>`; `git diff` was empty afterwards.

## Phase 2 (implementer)

| Mutation | Expected | Result |
|---|---|---|
| `scene-seeds.ts`: remove the `ai:dm` proposer filter | Non-`ai:dm` case fails | Failed: `not ok 5 - a scene proposal from a non-ai:dm proposer is not a seed` (scene-seeds.test.mjs, 8 pass, 1 fail). |
| `scene-seeds.ts`: remove the ten-item cap (`.slice(-SEED_LIMIT)`) | Twelve-proposal case fails | Failed: `not ok 6 - with twelve scene proposals only the last ten appear` (8 pass, 1 fail). |

The file was restored from a copy; the restored file is byte-identical and the suite is 9 pass, 0 fail.
`scene-seeds.ts` was untracked when mutated, so an empty `git diff` does not apply; `diff` against the copy was empty.

## Phase 3 (implementer)

| Mutation | Expected | Result |
|---|---|---|
| `scene-panel.tsx` `applyInput`: `sceneId` becomes a slug of the title | T014 `applyInput` case fails | Failed: `applyInput keeps the seed's sceneId and closes only a pending seed` (scene-panel.test.tsx, 8 pass, 1 fail). |
| `scene-panel.tsx` `applyInput`: `closeProposalId` always the seed's id | the `earlier` case fails | Failed: same test, at the `earlier` seed's `closeProposalId` null assertion (8 pass, 1 fail). |

`scene-panel.tsx` was untracked when mutated, so an empty `git diff` does not apply; the file was restored from a copy, `diff` against the copy was empty and the suite is 9 pass, 0 fail.
