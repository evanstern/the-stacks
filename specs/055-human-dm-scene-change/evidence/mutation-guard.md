# Mutation guard — spec 055

## Phase 1 (implementer, commit f14a5e35)

| Mutation | Expected | Result |
|---|---|---|
| `frames.ts`: replace the `SceneSchema.safeParse` call with an always-success stub | T002 over-long-title case fails | Failed: `not ok 17 - sceneFrame returns null for a long title, empty reason or bad sceneId` (frames.test.mjs, 17 pass, 1 fail). |
| `use-live-table.ts`: drop the `rejectFrame` send in `changeScene` | No unit test covers the live hook | Web suite stayed green (255 node tests, 107 vitest). The live close is proven by Phase 5 step 8 instead. |

Each mutation was restored with `git checkout <file>`; `git diff` was empty afterwards.
