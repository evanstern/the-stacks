# Mutation guard (T015)

**Date**: 2026-10-28, at the T013 record commit. Each mutation was restored; `git status` and
`git diff` were empty afterwards.

## (a) Odo's seat back to `companion` in `greyhollow-ford-trio.json`

`seed.test.ts` and `trio-views.test.ts`: 6 of 41 fail:
- loads the three-player trio seed
- the fiction view calls all three human players, never a companion
- the dm view lists three players and no companion
- has no AI companion ids
- the director prompt has no AI companions section
- overrides a hold naming a human character and empties companionPrompts

## (b) The Start scene form renders `seed.humans.slice(0, 2)`

`start-scene-panel.test.tsx`: 1 of 15 fails: "the trio form renders three seat selects, each
offering all three users, and no companion note". The other trio cases (Start disabled or enabled,
`startBody`) test the seat map, not the rendered selects, so they stay green.

## (c) `greyhollow-ford-trio.json` deleted

`seed.test.ts`: 2 of 36 fail: "loads the three-player trio seed" and "lists the shipped seeds
sorted by id".
