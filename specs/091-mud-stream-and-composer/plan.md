# Implementation Plan: MUD stream and composer

**Branch**: to be cut by the sweep for TASK-0247 | **Date**: 2026-11-05 |
**Spec**: [spec.md](spec.md)

**Input**: `specs/091-mud-stream-and-composer/spec.md`, `docs/design/mud-ux/decision.md`
(accepted 2026-11-04). This plan assumes R1 (a) and R2 (a). Each phase that needs one says so and
names its fallback. Research and design are small, so they live here, as in spec 085: no separate
research.md, data-model.md, contracts/ or quickstart.md. The margin half is `specs/090-table-margin/`.

## Summary

Turn the transcript into a derived stream of items: today's talk, narration, confirm and action rows,
plus roll rows, rules lines and room blocks built from ledger rows the projection already holds. Add
filter chips. Give the 066 composer history, a command dropdown, Tab completion and one `draft(text)`
entry point. Add an optional `description`, `ways` and `cast` to `SceneSchema` (R1), filled at scene
start from the player-facing seed view, so room blocks, ways on and NPC nouns have data.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: React 19, React Router 8, Tailwind 4, Zod, Vitest, `node:test`. **No new
dependency.**
**Storage**: Postgres event log. **No migration.** One additive event-shape change (R1).
**Testing**: `node:test` pure-module tests and Vitest markup tests under `apps/web/test/play/`;
Vitest in `packages/session-model` and `apps/server/test/dm/`; `apps/web/test/contrast.test.mjs`.
No DB needed for any new test. No paid model run.
**Target Platform**: `apps/web/app/play/` (most of the work); `packages/session-model/src/events/scene.ts`;
`apps/server/src/dm/seed/`, `apps/server/src/dm/nodes/resolve.ts`, `apps/server/seeds/`.
**Constraints**: no modals; Daylight tokens; AA; 1280 and 390 px; `canSee` filters every row before
the client folds it. Serial hotspots: `play/table-view.tsx`, `play/view-model.ts`,
`play/components/composer.tsx`, `play/components/transcript.tsx` — the same files spec 066 edits.
**Scale/Scope**: about 8 new web modules and components, 5 edited files, 2 server files, 4 seeds,
about 9 test files, 4 R1 contract amendments and one R2 amendment.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: a draft is a UI step before the existing `talk` request. An agent sends
      the request directly. Scene `ways`, `description` and `cast` ride the existing `scene` proposal.
- [x] **II. Content contract**: no codex entity. Seed `ways` are a location field in the seed, which
      stands in for codex content (decision-0009). N/A.
- [x] **III. Data planes**: session plane only. Every client datum derives from the projection.
- [x] **IV. Event sourcing**: one additive v1 field set on `scene.changed`. The stream, glossary and
      history are projections; `canSee` filters before the fold.
- [x] **V. Citations**: no rules claim. N/A.
- [x] **VI. 5e engine boundary**: roll rows format engine events; the client computes nothing.
- [x] **VII. Structured first**: `ways` and `cast` are Zod-validated; stream items are typed data
      before they render.
- [x] **VIII. Operator-owned content**: seed `ways` are original text; no library content on the table.
- [x] **IX. Self-hostable**: no new service, dependency or config.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Binding constraints check (the decision, "Constraints the implementation must keep")

| Constraint | How this plan holds it |
|---|---|
| No modals | Margin, strips, chips, dropdowns, help and noun expansions are inline. `apps/web/test/no-dialog.test.mjs` and `play-surfaces.test.mjs` cover every new file under `app/play/`. |
| Daylight tokens, AA in light and dark | New surfaces use existing tokens only. D9 adds every new pair to `contrast.test.mjs`. |
| Chat is a view over the log | `stream.ts`, `glossary.ts` and `history.ts` are pure functions of `SessionProjections`. Nothing new is stored. |
| TASK-0188 rules | The draft never sends (D6). The 066 ring, confirm row and `@dm` are untouched; history and Tab live beside them. `ai:dm` writes no player action: nothing here writes at all. |
| Screen-reader parity | Every margin and status-strip fact has a stream item (D3). A test asserts it (SC-002). |
| DM-only text never reaches a player | Rows are `canSee`-filtered before the fold. `cast` is built from `PlayerSeedView.npcs` only (D8), and a server test pins that its text holds no `dmOnlySeedText` string. |
| 1280 and 390 px | `narrow:` CSS only, no `matchMedia` (030 rule). Brave shots at both widths (D10). |
| Map ships later on this layout | `draft(text)` is the one entry point (D6). The margin reserves no button; the map spec adds **Open map** and a `Panel`. |

## Research

- **R1 — The ledger already carries every roll.** `p.ledger` holds `roll` (`dice.rolled`) and
  `outcome` (`check.resolved`, `attack.resolved`) rows with `batchId`, `index`, `actionId` and
  `visibility`. `toLedgerItems` (`play/ledger-format.ts`) words them for the Ledger slide-out.
  `rollIndex: 0` on an outcome points at the batch's first roll. A roll row is a pure grouping of
  existing rows by `batchId`; no server change.
- **R2 — Parity data exists too.** `hp.changed`, `condition.applied`, `condition.removed`,
  `life-state.changed` and `encounter.started` reach the ledger as `change` rows with `subject`
  (combatant id) and `before`/`after`. Names come from `p.engine.combatants` or, after removal, the
  row's own `before`.
- **R3 — The scene has no place text.** `scene.changed.after` carries `title`, `summary` (the goal
  statement, director.md row 1) and `location` (the place name). The seed's `location.identity.features`
  and `portrayal` are player-facing (`PlayerSeedView.location`), but no event carries them. Ways on
  exist nowhere. Hence R1.
- **R4 — The client knows no NPC that is not a combatant.** Spec 066 recorded this gap for `@`.
  `PlayerSeedView.npcs` holds `name`, `role`, `appearance` and three portrayal fields, all
  player-facing by contract (034 `player-facing-context.md`). Hence `cast` in R1, limited to `id`,
  `name`, `role` and `appearance`.
- **R5 — History without storage.** The 030 "Forbidden" list bans `localStorage` and
  `sessionStorage`; chat-ui's cookie rule covers small UI preferences only. The viewer's own `talk`
  rows are already in the projection after any reload (`actor === source.actor`). Spec gap 1.
- **R7 — Live region today.** Nothing under `app/play/` sets `role="log"` or `aria-live`. The
  transcript `<ol>` becomes the log region.
- **R8 — The 066 composer.** It owns the speaker chip, the `@` listbox, the `((`/`/ooc` flip and a
  forwarded input ref. This plan adds to it and must not fork a second listbox (FR-016).

## Design

### D1 — Scene fields (`packages/session-model/src/events/scene.ts`) — needs R1

```ts
export const WaySchema = z.object({ label: z.string().min(1).max(60), draft: z.string().min(1).max(200) });
export const CastEntrySchema = z.object({
  id: RefIdSchema, name: z.string().min(1).max(100),
  role: z.string().min(1).max(100), appearance: z.string().max(300),
});
export const SceneSchema = z.object({
  sceneId, title, summary, location,                      // unchanged
  description: z.string().max(1000).optional(),
  ways: z.array(WaySchema).max(6).optional(),
  cast: z.array(CastEntrySchema).max(20).optional(),
});
```

Payload version stays 1. Old rows parse. The `scene` proposal reuses `SceneSchema`, so the gate needs
no change. Export the two schemas and types from `index.ts`.

### D2 — Seed and scene start (`apps/server/src/dm/seed/`, `nodes/resolve.ts`, `apps/server/seeds/`) — needs R1

- `seed/schema.ts`: `location` gains `ways: z.array(WaySchema).max(6).default([])`.
- `seed/views.ts`: `PlayerSeedView.location` gains `ways`.
- `seed/views.ts`: new pure `openingScene(view: PlayerSeedView): Scene` returns `{ sceneId:
  view.seedId, title, summary: view.goalStatement, location: view.location.name, description:
  view.location.features.join(" ")` cut to 1000, `ways` when not empty, `cast: view.npcs` mapped to
  `{ id, name, role, appearance } }`. It takes the player-facing view, so it cannot read a DM-only
  field.
- `nodes/resolve.ts` `directorOpening`, scene-start branch: `after: openingScene(playerFacingSeed(seed))`
  replaces the inline object. No other line in `resolve.ts` changes.
- The four `greyhollow-ford*.json` seeds gain these ways (copy from `b-margin.html`):
  `ladder to the loft` → "I climb the ladder to the loft"; `causeway downriver` → "We follow the
  causeway downriver"; `ferry` → "We take the ferry".
- Fallback under R1 (b): skip D1 and D2. `stream.ts` renders room blocks with the heading only, and
  the glossary has no NPC entries.

### D3 — Stream items (`apps/web/app/play/stream.ts`, new, pure)

`streamItems(model, p, viewer): StreamItem[]`, sorted by seq. It wraps today's `TranscriptItem`s and
adds:

```ts
type Category = "ic" | "table" | "rules";
type StreamItem = { seq: number; category: Category; pinned: boolean } & (
  | { kind: "transcript"; item: TranscriptItem }            // talk, narration, confirm, aside, action, floor
  | { kind: "room"; heading: string; description: string | null; ways: Way[]; party: string }
  | { kind: "roll"; summary: string; detail: string[] }
  | { kind: "rules"; text: string }
);
```

- **Category** (FR-009): narration, IC talk and rooms are `ic`; OOC talk, `@dm` posts and asides are
  `table`; the rest are `rules`. `pinned` (FR-010) is true for a confirm with an open line the viewer
  can accept and for the viewer's own open action.
- **Roll** (FR-006): group ledger `roll` and `outcome` rows by `batchId`. One item per outcome, at
  the outcome's seq, using the roll at the batch's `rollIndex`. A roll with no outcome in its batch
  becomes its own item ("<name> — <purpose> <total>"). Actor name from the event's
  `combatantId`/`attackerId` via `p.engine.combatants`. Check summary: "Kestrel — Stealth 17 ✓"
  (✗ on failure; the band label when it carries one). Attack summary: "Kestrel — Shortbow vs Goblin
  lookout: hit". `detail` reuses `ledger-format.ts`'s dice and outcome wording; export the helpers it
  needs rather than copying them. A damage roll in the same batch joins the attack's `detail`.
- **Rules lines** (FR-007): from ledger `change` rows. `encounter.started`: "Initiative: " plus the
  order's names. `condition.applied`: "<name> is <condition>." `condition.removed`: "<name> is no
  longer <condition>." `hp.changed` for a party combatant only: "<name>: HP <before> → <after>
  (<cause>)." `life-state.changed`: "<name> is <after>." (unconscious, stable, dead; "conscious"
  reads "is back on their feet").
- **Room** (FR-008): one per `scene.changed` change row with a non-null `after`. Heading
  `after.location ?? after.title`; `description` and `ways` from `after` (D1); `party` = "Party:
  Kestrel HP 9/9 AC 14, Tamsin …" from `p.party` at render time.
- `ponytail:` rows render at their own seq, so a batch's roll and its rules lines sit together. A
  per-batch merge is the upgrade if playtests find the stream noisy.

### D5 — Stream rendering and chips (`components/transcript.tsx`, `filter-chips.tsx` new)

- `transcript.tsx` renders `StreamItem[]`. The `<ol>` gains `role="log" aria-live="polite"
  aria-label="Table stream"` (FR-011). `transcript` items keep today's (and 066's) rendering. New
  renderers: `room-block.tsx`, `roll-row.tsx` (`<details><summary>`), and a rules line as a muted
  `<p>`.
- `filter-chips.tsx`: four buttons in a `role="group"` named "Filter the stream", `aria-pressed`.
  `TableView` holds the chip in `useState` and passes `items.filter(i => chip === "all" ||
  i.category === chip || i.pinned)`.
- `noun-text.tsx`: `NounText({ text, glossary })` splits text by D7's matcher and renders each match
  as `<button aria-expanded aria-controls>`; the open expansion renders after the line. Used for
  narration and talk text only.

### D6 — Composer: history, commands, Tab, draft (`components/composer.tsx`, `history.ts` new, `commands.ts` new)

- `history.ts` (pure): `historyOf(p, actor)` → the actor's `talk` texts, oldest first, consecutive
  duplicates dropped, last 50. `step(state, dir)` is the Up/Down walk with the saved unsent line
  (FR-013). A `node:test` file covers both.
- `commands.ts`: `COMMANDS = [{ token: "/ooc", hint: "table talk" }, { token: "/help", hint: "what
  you can do here" }, { token: "@dm", hint: "ask the DM, out of character" }]`. Closed; no registry.
- `composer.tsx` (066 version): one listbox state `{ source: "command" | "mention" | "entity";
  options; active }`, rendered by the 066 listbox markup (FR-016). Key handling in one `onKeyDown`:
  Up/Down walk history when no listbox is open; `/` at position 0 opens commands; Tab with a word
  before the caret completes (`completions(word, glossary)` from D7) or opens the entity listbox, and
  is not prevented otherwise. `/help` toggles an inline `<section aria-label="Help">` under the form.
- **Draft path** (FR-019): the composer takes a `ref` handle exposing `draft(text)`. `TableView`
  creates `const draft = (t: string) => composerRef.current?.draft(t)` and passes `draft` to every
  click-to-draft caller. `draft` sets the text, switches an OOC speaker to the viewer's first
  character, pushes a replaced non-empty draft to a page-local history entry, focuses the input and
  puts the caret at the end. It never calls a command. The map spec passes the same `draft` to its
  token and way handlers.
- `ponytail:` history is the log, so a refused line is not recalled; TASK-0162 adds that.

### D7 — Glossary (`apps/web/app/play/glossary.ts`, new, pure)

`glossaryOf(p): GlossaryEntry[]`:

- each `p.party` member → `{ name, kind: "character", facts: [classLevel, "HP a/b", "AC n",
  "Conditions: …"] }`;
- each `p.engine.combatants` entry with no party member → `{ kind: "monster", facts: [conditions,
  "down"/"dead" when not conscious] }`. No HP or AC (spec gap 3);
- each current-scene `cast` entry whose name occurs in a visible narration or talk text, or whose id
  a visible `scene-presence.changed` row with reason `arrived` names → `{ kind: "npc", facts: [role,
  appearance] }`.

`matchNouns(text, glossary)` returns spans, longest name first, whole words, case rule per FR-018.
`completions(prefix, glossary, ways)` returns names (and way labels) starting with the prefix,
case-insensitive. Tests cover the case rule ("snag" as a verb stays text), the longest-first rule
("Goblin lookout" before "Goblin"), the mention gate for NPCs, and the no-HP rule for monsters.

### D8 — Server pins (`apps/server/test/dm/`) — needs R1

- Extend `seed.test.ts`: `ways` parses, defaults to `[]`, and is in `PlayerSeedView`.
- Extend `duo-views.test.ts`: `openingScene(playerFacingSeed(duo))` parses with `SceneSchema`;
  `title`, `summary` and `location` equal today's values; `ways` has the three duo ways; `cast` has
  each seed NPC's four fields only; no string in the result contains any `dmOnlySeedText(duo)` entry.
### D9 — Contrast (`apps/web/test/contrast.test.mjs`)

Add every new pair the stream, composer and noun surfaces use to `TEXT_PAIRS` / `NON_TEXT_PAIRS`.
Expected new pairs: chip pressed `primary-foreground` on `primary`, chip `foreground` on `secondary`,
noun button `primary` on `background` and on `card`, roll ✓ `ok` on `card`, ✗ `destructive` on `card`,
chip and listbox boundary `border` or `input` on `background`. Any pair below the bar gets a token
change in `app.css` in both dark blocks, kept byte-identical. The implementer lists the final pairs in
the phase commit.

### D10 — Live check (orchestrator)

Script mode (`DM_FAKE_SCRIPT=greyhollow-live` or the 066 script) on a worktree stack, two Brave
windows (Kestrel, Tamsin). Record at 1280 and 390 px, light and dark: a room block with ways on, a way
click drafting into the composer (no send), Up after reload, `/` and Tab dropdowns, a noun expansion,
a roll row expanded, and each chip. Read the accessibility tree once for the `role="log"` region and
the parity lines. Shots go in `specs/091-mud-stream-and-composer/evidence/`.

## Files

| File | Change | Phase |
|---|---|---|
| `packages/session-model/src/events/scene.ts`, `index.ts` | D1 | 1 |
| `packages/session-model/test/` (scene parse case in an existing schema test) | D1 | 1 |
| `apps/server/src/dm/seed/schema.ts`, `seed/views.ts` | D2 | 1 |
| `apps/server/src/dm/nodes/resolve.ts` (scene-start `after` only) | D2 | 1 |
| `apps/server/seeds/greyhollow-ford*.json` (4) | D2 `ways` | 1 |
| `apps/server/test/dm/seed.test.ts`, `duo-views.test.ts` | D8 | 1 |
| `apps/web/app/play/table-view.tsx` | D5 chips; D6 draft | 2, 3 |
| `apps/web/app/play/stream.ts`, `ledger-format.ts` (export helpers) | D3 | 2 |
| `apps/web/app/play/components/transcript.tsx`, `room-block.tsx`, `roll-row.tsx`, `filter-chips.tsx` | D5 | 2 |
| `apps/web/app/play/glossary.ts`, `components/noun-text.tsx` | D7, D5 nouns | 3 |
| `apps/web/app/play/history.ts`, `commands.ts`, `components/composer.tsx` | D6 | 3 |
| `apps/web/test/play/` new: `stream`, `filter-chips`, `roll-row`, `room-block`, `glossary`, `noun-text`, `history`; extended: `composer`, `table-view` | tests | 2, 3 |
| `apps/web/test/contrast.test.mjs` | D9 | 4 |
| contract files in "Contract amendments" | amendment blocks | 4 |
| `docs/wiki/play-route.md`, `session-model.md`, `dm-runtime.md`, `seed-npc-presence.md`, `CAPSULES.md`, `INDEX.md` | re-ground | 4 |

**Migrations**: none. **New runtime dependencies**: none.

## Contract amendments

Each block is headed "**Amendment (TASK-0247).**" and cites the decision and the R1 or R2 ruling.
Existing text is not rewritten.

| File | Ruling | What the block changes |
|---|---|---|
| `specs/028-session-model/contracts/session-events.md` | R1 | `SceneSchema` optional `description`, `ways`, `cast`; payload stays v1 |
| `specs/029-proposal-gate/contracts/proposals.md` | R1 | pointer: the `scene` proposal's `after` takes the widened `SceneSchema`; no rule change |
| `specs/031-dm-runtime/contracts/scene-seed.md` | R1 | `location.ways`; `PlayerSeedView.location.ways` |
| `specs/031-dm-runtime/contracts/director.md` | R1 | scene-start `scene` row: `description`, `ways`, `cast` from the player-facing view |
| `specs/030-play-route/contracts/ui-surfaces.md` | R2 | new stream components (filter chips, room blocks, roll rows, parity lines, noun expansions, command dropdown); accessible names ("Table stream", "Filter the stream", "Help"). Spec 090 owns the margin and strip entries in the same file |

`ws-protocol.md`, the gate request kinds, `TalkV1` and `table-source.md`: unchanged.

## Phases

1. Scene fields and seed `ways` (R1) — server and session model (sonnet).
2. Stream items, roll rows, rules lines, room blocks, chips — web (sonnet).
3. Composer history, commands, Tab, glossary, nouns, the draft path — web (sonnet).
4. Contrast, contract amendments, wiki re-ground (sonnet).
5. Verification: Brave live check and shots **[orchestrator]**.

## Overlap

- Spec 066 (TASK-0199) must merge first, and spec 090 (TASK-0236) must merge first. Phases 2 and 3
  edit the files they rewrite. Before Phase 1, merge `origin/main` and re-read `composer.tsx`,
  `transcript.tsx`, `table-view.tsx` and `view-model.ts` as merged.
- Phase 1 touches `nodes/resolve.ts` in the scene-start branch only. Check the runbook for any open
  lane on `resolve.ts` before dispatch. The lane must be clear.
