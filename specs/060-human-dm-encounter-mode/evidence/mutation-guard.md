# Mutation guard (T026)

**Date**: 2026-10-28, at 93955186. Each mutation was restored with `git checkout`; `git diff` was
empty afterwards.

## (1) `endEncounter` skips the free-mode follow-up

Mutation: `use-fixture-table.ts` `planEncounterEnd` returns the end rows without the free row;
`use-live-table.ts` never sends the follow-up (`if (false)`).

Result: `use-fixture-table.test.mjs` fails 1 of 10: "planEncounterEnd with thenFree gives the end
row then the free row". The guard holds.

## (2) `tableModeView` offers `turnAfter` with no encounter

Mutation: `table-mode.ts` sets `turnAfter` whenever the mode is free (the `enc !== null` check
removed).

Result: `table-mode.test.mjs` fails 1 of 3: "after the encounter ends in free mode nothing is
offered". `table-mode-panel.test.tsx` stays green (4 passed): its no-encounter case renders a view
built by hand (`turnAfter: null`), not one from `tableModeView`. The guard holds through
`table-mode.test.mjs`. The panel test proves the panel renders only what the view offers.

## (3) The header shows "Table mode" for any viewer

Two layers keep the trigger off a player's header: `TableView` passes `onMode` only when
`model.tableMode` is set (null for a player), and `TableHeader` renders it only when `model.isDm`.

- Dropping the `isDm` check alone: `table-view.test.tsx` stays green (17 passed). The view model
  still withholds `onMode` from a player.
- Dropping both (`onMode` always passed, no `isDm` check): `table-view.test.tsx` fails 1 of 17:
  "the turn-mode-combat DM renders a Table mode trigger; a player renders none". The guard holds.
