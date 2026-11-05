# Implementation Plan: Table margin and status strip

**Branch**: `task-0236-mud-ux` (the sweep cuts the implementation branch) | **Date**: 2026-11-05 |
**Spec**: [spec.md](spec.md)

**Input**: `specs/090-table-margin/spec.md`, `docs/design/mud-ux/decision.md`
(accepted 2026-11-04). This plan assumes R2 (a). Research and design are small, so they live here, as in
spec 085: no separate research.md, data-model.md, contracts/ or quickstart.md. The 066-dependent half
moved to `specs/091-mud-stream-and-composer/`.

## Summary

Split `TableView` into a stream column and a right margin. Move the party, turn order and conditions
into the margin, with a mini-strip and a status strip above the composer. The stream, composer and
scene-field work moved to spec 091.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: React 19, React Router 8, Tailwind 4, Vitest, `node:test`. **No new
dependency.**
**Storage**: none. **No migration. No event change.**
**Testing**: Vitest markup tests under `apps/web/test/play/`; `apps/web/test/contrast.test.mjs`.
No DB needed for any new test. No paid model run.
**Target Platform**: `apps/web/app/play/`.
**Constraints**: no modals; Daylight tokens; AA; 1280 and 390 px. Serial hotspot: `play/table-view.tsx`,
which spec 066 (TASK-0199) also edits.
**Scale/Scope**: about 4 new web modules and components, 3 edited files, about 4 test files, 2 contract
amendments.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **III. Data planes**: session plane only. Every client datum derives from the projection.
- [x] **VI. 5e engine boundary**: the client computes nothing.
- [x] **IX. Self-hostable**: no new service, dependency or config.
- Principles I, II, IV, V, VII and VIII: N/A here; no event, content or proposal change.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Binding constraints check (the decision, "Constraints the implementation must keep")

| Constraint | How this plan holds it |
|---|---|
| No modals | Margin, strips, chips, dropdowns, help and noun expansions are inline. `apps/web/test/no-dialog.test.mjs` and `play-surfaces.test.mjs` cover every new file under `app/play/`. |
| Daylight tokens, AA in light and dark | New surfaces use existing tokens only. D9 adds every new pair to `contrast.test.mjs`. |
| 1280 and 390 px | `narrow:` CSS only, no `matchMedia` (030 rule). Brave shots at both widths (D10). |
| Map ships later on this layout | The margin reserves no button; the map spec adds **Open map** and a `Panel`. Spec 091 builds `draft(text)`. |
| Screen-reader parity | The margin and the status strip are not live regions. Spec 091 adds the stream lines that carry the same facts. |

## Research

- **R6 — Breakpoint.** `narrow:` is `width <= 700px` (`app.css` line 138). The margin hides at
  `narrow:`; the mini-strip shows only at `narrow:`.

## Design

### D4 — Margin, mini-strip, status strip (`apps/web/app/play/components/`, new)

- `margin.tsx` — `Margin({ party, mode, conditions })`: an `<aside aria-label="Table state">`,
  `hidden narrow:hidden` → `flex` above `narrow:`, width `w-60`, own scroll. Sections: "Party"
  (`partyRows` from `party.ts`, one line per member, same `vitals` wording as `party-panel.tsx`;
  move `vitals` to `party.ts` and import it in both), "Turn order" (`<TurnOrder order label="Turn
  order">`, reused) or "Not in combat.", then "Conditions: …" per combatant with any.
- `mini-strip.tsx` — `MiniStrip`: `narrow:flex` only. "Tamsin Vale 13/13 · Brother Odo 10/10"
  (each other party member, full name) and, in turn mode, "Order: A › B › C…". A text line, not a list.
- `status-strip.tsx` — `StatusStrip`: one line, all widths, directly above the composer (FR-003).
- `conditions.ts` (new, pure): `conditionText(conditions)` → "none" or "prone, poisoned".
  Shared by the margin, strips, nouns and rules lines.
- `table-view.tsx`: wrap the stream column and `Margin` in a `flex` row. Remove the `TurnOrder` strip
  under the header (R2). Render `MiniStrip` and `StatusStrip` between the stream and the composer.
  Fallback under R2 (b): keep the strip under the header and leave "Turn order" out of the margin.

### D9 — Contrast (`apps/web/test/contrast.test.mjs`)

Add every new pair the margin, mini-strip and status strip use to `TEXT_PAIRS` / `NON_TEXT_PAIRS`.
Expected new pair: margin `muted-foreground` on `card`, plus any control boundary the strips use.
Any pair below the bar gets a token change in `app.css` in both dark blocks, kept byte-identical.
The implementer lists the final pairs in the phase commit.

### D10 — Live check (orchestrator)

Script mode (`DM_FAKE_SCRIPT=greyhollow-live`) on a worktree stack, two Brave windows (Kestrel,
Tamsin). Record at 1280 and 390 px, light and dark: the margin, the mini-strip and the status strip in
free play and in an encounter. Shots go in `specs/090-table-margin/evidence/`.

## Files

| File | Change | Phase |
|---|---|---|
| `apps/web/app/play/conditions.ts`, `party.ts` (`vitals` moved) | D4 | 1 |
| `apps/web/app/play/components/margin.tsx`, `mini-strip.tsx`, `status-strip.tsx` | D4 | 1 |
| `apps/web/app/play/components/party-panel.tsx` | import `vitals` | 1 |
| `apps/web/app/play/table-view.tsx` | D4 layout | 1 |
| `apps/web/test/play/` new: `conditions`, `margin`, `status-strip`; extended: `table-view`, `turn-order`, `party-panel` | tests | 1 |
| `apps/web/test/contrast.test.mjs` | D9 | 2 |
| contract files in "Contract amendments" | amendment blocks | 2 |
| `docs/wiki/play-route.md`, `party-panel.md`, `turn-floor.md`, `CAPSULES.md`, `INDEX.md` | re-ground | 2 |

**Migrations**: none. **New runtime dependencies**: none.

## Contract amendments

Each block is headed "**Amendment (TASK-0236).**" and cites the decision and the R2 ruling.
Existing text is not rewritten.

| File | Ruling | What the block changes |
|---|---|---|
| `specs/030-play-route/contracts/ui-surfaces.md` | R2 | layout diagram with the margin and strips; new components; accessible names ("Table state", "Turn order") |
| `specs/049-turn-floor/contracts/ui-floor.md` | R2 | the turn-order strip renders in the margin and the mini-strip, not under the header |

Spec 091 appends its own R2 surface additions and the four R1 blocks.

## Phases

1. Margin, mini-strip, status strip (R2) — web (sonnet).
2. Contrast, no-dialog scan, contract amendments, wiki re-ground (sonnet).
3. Verification: Brave live check and shots **[orchestrator]**.

## Overlap

- Spec 066 (TASK-0199) also edits `table-view.tsx`. Whichever merges second merges `origin/main` into
  its branch and resolves that file.
