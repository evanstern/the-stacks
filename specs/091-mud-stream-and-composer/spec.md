# Feature Specification: MUD stream and composer

**Feature Branch**: to be cut by the sweep for TASK-0247

**Created**: 2026-11-05

**Status**: Draft, split out of the combined spec on 2026-11-05. The direction and OQ1 to OQ4 are
ruled (`docs/design/mud-ux/decision.md`, 2026-11-04). The operator ruled both frozen-contract changes
**(a) accept** on 2026-11-05: **R1** and **R2** under "Frozen-contract items". This spec holds the half
that depends on spec 066.

**Input**: TASK-0247. Decision record: `docs/design/mud-ux/decision.md` ("the decision" below). The
first half is spec 090 (`specs/090-table-margin/`, TASK-0236): the margin, mini-strip and status strip.
Layout and states: `docs/design/mud-ux/round-1/b-margin.html`. Click-to-draft:
`docs/design/mud-ux/round-1/c-split.html`. Pattern rationale:
`docs/research/MUD-Client-UX/Analysis-Table-View-Pattern-Adoption.md` ("the analysis").

Authored against `.specify/templates/`. The spec number and branch were reserved, so the skills'
branch and directory steps were skipped. `speckit-clarify` was skipped: the decision rules every
open question.

## Amendment (2026-11, Intent contract v1.1)

Amended 2026-11-13 for TASK-0247 by the R1 sweep spec author. Operator review: C-AMD, pending.
Authored against `origin/main` `f761f1c6`. `speckit-clarify` was skipped again: the rulings below
settle the design; the remaining judgment calls are under "Open questions (amendment)".

**Sources.** decision-0030 (Intent contract v1 frozen; v1.1 text forms at C-CON 2026-11-08).
`specs/092-intent-contract/contracts/intent-schema.md` v1.1: §7 (commit states; `draft` never
leaves the client), §8 (text form, `parse`, `toText`, `ctx.resolve`), §8.3 rule 12 (an unknown
`/verb` is refused), §9 (refusal codes). Spec 092 plan "Downstream amendments (specs 066 and 091)"
and spec 092 Q1 (ruled at CP-4: `/help` is the Help action; composer help moves to `/?`). Spec 066
amendment OQ-3 (ruled 2026-11-11, "Approve all"): old AC #10 moved to TASK-0199; AC #3 narrows to
pills, Tab completion and inline `PARSE_*` wording. Spec 098 OQ-3 (ruled 2026-11-09): fact rows
render from the ledger at resolve time, not from the narration text. Constitution 3.0.0 II, V, VII
and IX.

**Merged work this amendment builds on (do not redo).**

- **TASK-0315 / spec 105 (PR #171).** One composer and one Send. `apps/web/app/play/send.ts`
  `routeSend` parses every line through `parse` (`apps/web/test/play/send.test.mjs`, including
  "a bad slash line is refused with the parser's message"). The confirm row, `KIND_LABEL`
  (`play/labels.ts`), `detailsOf` (`play/proposals.ts`), the read ring (`play/read-ring.ts`).
- **TASK-0298 / spec 108 (PR #174).** The ephemeral `narration-stream` frame. Narrate sends the
  `rows` part before the gateway call. `components/transcript.tsx` renders one "The DM is
  narrating" block, rows then prose, until the settled `narration` row lands
  (`apps/web/test/play/transcript-stream.test.tsx`).
- **TASK-0245 / spec 098.** Code renders every fact row (`apps/server/src/dm/fact-sheet.ts`
  `renderRows`, `facts.ts` `renderRollLine`). The rows still ride the narration text
  (`composeReply`). The d20 shown is the kept face only (`facts.ts` `shownFaces`). No row names the
  roll mode.
- **TASK-0199 / spec 066.** `action.suggest`, `action.accept`, served `ask_dm`, and the `intent`
  turn that narrates a direct settled Intent.

**What changes.**

- **A1 — Roll rows render from the ledger at resolve time.** A roll row is built from `p.ledger`
  `roll` and `outcome` rows at the roll's own seq, so it lands with the engine batch, before any
  narration. It names the check (skill or ability, and "save" for a saving throw), the roll mode
  (advantage or disadvantage, in words), and both d20 faces with the dropped face marked.
  FR-006 is amended; FR-026 is new.
- **A2 — The web stops showing fact rows twice.** The settled `narration` row keeps its code block
  on the log (auditor, AI context and checkpoints read it). The web hides that block's dice and
  change lines, because A1 and FR-007 already show them. The `why`, refusal and `State:` lines stay,
  rendered as rules lines after the prose. The streaming block's `rows` part gets the same filter.
  FR-027 is new.
- **A3 — The progress indicator is spec 108's streaming block.** No new indicator. One order test
  pins it: ledger rows, then the block, then the settled narration. FR-028 is new.
- **A4 — NPC dialogue renders as distinct rows.** A sentence of narration prose that holds a
  double-quoted span renders as its own dialogue row, upright and full contrast. An `npc_say` talk
  row renders as a named dialogue row. FR-029 is new.
- **A5 — The transcript column is capped at 1024 px and centred.** FR-030 is new.
- **A6 — The Intent pill.** A composer line that starts with a slash verb or a sigil shows a live
  pill above the input: `parse` of the line at commit `draft`. A parsed line shows the kind label
  and the line's targets in words. A refused line shows the refusal in plain words
  (`PARSE_*`). The pill never leaves the client. Send still runs `routeSend`. FR-031 is new.
- **A7 — `draft(text)` becomes `draft(seed)`.** `seed` is an `Intent` or a text-form stub. An
  Intent drafts `toText(intent)`; a stub drafts as typed. Either way the pill shows the parse.
  FR-019 is superseded by FR-019a.
- **A8 — The `/` dropdown lists the player verb table.** `/help` is the SRD Help action. The help
  block moves to `/?` and to the `?` key on an empty composer. An unknown `/word` is refused inline
  and never sent as speech. FR-014 is superseded by FR-014a.
- **A9 — Tab completes verbs, targets and names.** After `/` it completes a verb. After `@`, `#` or
  `&` it completes a target id. On a bare word it completes a glossary name. Send passes a
  `ctx.resolve` built from the glossary. FR-015 and FR-016 are amended.
- **A10 — The composer keeps a line until its echo lands.** A sent line stays in the input until
  its own row reaches the projection. A refusal keeps it and shows the refusal. FR-032 is new.
- **A11 — History reads the viewer's own Intents.** FR-012 is amended.
- **A12 — A way on's `draft` is a text form.** The seed loader parses each way's `draft` once and
  refuses a seed whose draft does not parse, or whose `/move` names a hidden zone. R1 is amended.
- **A13 — FR-024 is superseded.** The composer sends `intent` requests (spec 105). This spec adds
  no request kind, event type, frame or migration. The only event change is R1.
- **A14 — Kept unchanged in intent:** R1 (a) and R2 (a), filter chips, rules lines, room blocks,
  the glossary, noun expansions, screen-reader parity, the contrast bar and the no-modal rule.

**Card acceptance criteria (TASK-0247, numbering of 2026-11-13).** Old AC #10 moved to TASK-0199
(spec 066 OQ-3 (b)) and shipped there.

| Card AC | Disposition | Covered by | Evidence today / to add |
|---|---|---|---|
| #1 Spec amended so nouns, ways and Tab draft Intent pills | Met by this amendment once C-AMD approves | A6, A7, A9; FR-019a, FR-031 | this section |
| #2 A noun or way click drafts a pill at `draft`; nothing is sent | Built here | A6, A7; FR-019a, FR-020, FR-031 | to add: `table-view.test.tsx` (no command call after a click) |
| #3 Slash commands parse through the N-01 grammar, with a test | Partly met; narrowed remainder built here | A6, A8, A9; FR-014a, FR-015, FR-031 | met: `send.ts` `routeSend`, `send.test.mjs`. To add: pill, Tab and `PARSE_*` wording tests |
| #4 Roll rows: code facts before prose, check and mode named, both d20s | Built here | A1; FR-006, FR-026 | partial today: `ledger-list.tsx` strikes the dropped face in the Ledger slide-out only. To add: `stream.test.mjs` |
| #5 Progress indicator between fact rows and narration until the first token | Already met by TASK-0298; pinned here | A3; FR-028 | `transcript.tsx` "The DM is narrating" block; `transcript-stream.test.tsx`; spec 108 FR-004. To add: one order test |
| #6 The composer keeps a line's draft until its echo lands, with a test | Built here | A10; FR-032 | today `composer.tsx` clears on frame send (`if (sent) setText("")`). To add: `composer.test.tsx` |
| #7 NPC dialogue as distinct rows; column capped at 1024 px and centred | Built here | A4, A5; FR-029, FR-030 | to add: `narration-rows.test.mjs`, `table-view.test.tsx` |
| #8 Spec 091 amended against v1.1 and reviewed at C-AMD | This section and plan.md | — | the C-AMD ruling |
| #9 Fact rows render from the ledger at resolve time, not from narration | Built here | A1, A2; FR-006, FR-007, FR-027 | today rows ride the narration text (`fact-sheet.ts` `composeReply`). To add: `stream.test.mjs`, `narration-rows.test.mjs` |

**Split check.** The amended work is about 55 tasks (plan.md "Split verdict"). That is past the
runbook's 28-task trigger. **Recommend a split** (OQ-A1). This amendment stops before `tasks.md`.

### Open questions (amendment)

Each needs a ruling at C-AMD. Recommendations follow.

- **OQ-A1 — Split.** **Recommend:** split into two cards, one PR each.
  - **TASK-0247 keeps the stream:** AC #4, #5, #7, #9 and #8. Scope: R1 scene fields and seed
    ways, roll rows, rules lines, room blocks (ways as text), filter chips, the log region,
    the narration filter, dialogue rows and the 1024 px column. Spec 091 stays its spec.
  - **A new card, "Build: Intent pills in the composer (spec 091 part 2)",** takes AC #1, #2, #3
    and #6. Scope: the pill, `draft(seed)`, the verb dropdown and `/?`, Tab, the resolver,
    history, keep-until-echo, the glossary, noun expansions and way buttons. It depends on
    TASK-0247 (room blocks, R1 `cast`).
  - AC #8 stays on TASK-0247. The new card cites this amendment and needs no second review.
- **OQ-A2 — Where AC #6 goes.** The runbook groups #4–#7 as stream rows. AC #6 is composer state in
  `composer.tsx`, which the pill half rewrites. **Recommend:** AC #6 rides the pill card.
  Alternative: keep it on TASK-0247 and accept a second edit of `composer.tsx` in two PRs.
- **OQ-A3 — Hide fact rows in the web, or drop them from the narration text on the server.**
  Dropping them server-side changes `composeReply`, the check node's input, the auditor's
  `splitNarration` and `findLandedNarration`. Spec 108 OQ-1 rejected the same split for the same
  reasons. **Recommend:** hide in the web (A2). The log stays the full record. Alternative: a
  server change with a `dm.narrate` prompt bump and an auditor change; card it if the AI context
  is shown to double-count rows.
- **OQ-A4 — `why` and `State:` lines still wait on narration.** They are not ledger rows. The `why`
  facts sit on `intent.recorded.facts`, which `IntentView` does not carry, and the renderer
  (`renderWhyRows`) is server code. **Recommend:** keep them from the narration text in this card.
  Card "render `why` rows at resolve time" with trigger "the CP-7 playtest shows a ruling's why
  arriving late". Constitution VII is otherwise met by A1.
- **OQ-A5 — One roll formatter or two.** Spec 098 OQ-2 set a revisit trigger: "TASK-0247 renders
  fact rows as their own stream rows in the web; then move `FactRow` and the renderer to
  `session-model`." That trigger fires now. Moving `facts.ts` (about 1000 lines, a hotspot) is a
  refactor out of this card's scope. **Recommend:** the web formats from ledger rows in
  `play/stream.ts`, reusing `ledger-format.ts`. Card the move as a debt task with trigger "the
  web and server row wordings drift in a playtest".
- **OQ-A6 — `draft(seed: Intent | string)`.** T015 says `draft(intent)`. Some useful drafts are
  not schema-valid Intents yet: "Talk to Wenna" needs the player's words (`/to @wenna-marsh `).
  **Recommend:** accept an Intent or a text-form stub; the pill shows the parse either way.
  Alternative: Intents only, and drop "Talk to" from noun expansions.
- **OQ-A7 — The pill's `source`.** Contract `SourceSchema` has no stream source. **Recommend:**
  every pill uses `source: "composer"`, because Send goes through the composer. Adding a source is
  a C-CON minor; not needed.
- **OQ-A8 — R1 touches a frozen contract.** R1 adds optional fields to `SceneSchema`, which the
  `scene` proposal in `specs/029-proposal-gate/contracts/proposals.md` reuses (a pointer block, no
  rule change). R1 was ruled (a) on 2026-11-05, before the replan. **Recommend:** the operator
  re-confirms R1 (a) at C-AMD and the brief quotes it as the C-GATE ruling (plan.md "C-GATE").
- **OQ-A9 — TASK-0275 (combat turn UX).** Its action bar drafts Intents and edits `table-view.tsx`
  and the composer area. **Recommend:** 0275 calls this spec's `draft(seed)` and does not add a
  second draft path. It draft-holds until the pill card merges. Its pips and banner do not touch
  the stream.
- **OQ-A10 — TASK-0277 (targeting and zone chips).** Its `@` targeting list overlaps A9, and its
  zone chips draft `move` pills like ways on. **Recommend:** this spec completes targets
  alphabetically with no range data. 0277 adds range order, the HP word and the out-of-reach mark
  to the same listbox, and its zone chips call `draft(seed)`. Ways on stay: they cover exits that
  are not zones. 0277 draft-holds until the pill card merges.
- **OQ-A11 — TASK-0276 (reactions and roll requests).** Its reaction row and roll-request rows are
  new stream rows. **Recommend:** 0276 adds them as `StreamItem` kinds in category Rules, pinned
  for the addressed player (FR-010). It draft-holds until TASK-0247 merges.
- **OQ-A12 — TASK-0318 (listbox focus).** FR-016 rebuilds the mention listbox as the shared
  listbox. **Recommend:** fold TASK-0318 into the pill card. The shared listbox returns focus to
  its trigger after a keyboard pick, and the Speaker listbox adopts the same rule. One test each.
- **OQ-A13 — TASK-0325 (transcript name).** FR-011 names the stream `role="log"` "Table stream".
  **Recommend:** close TASK-0325 as covered by TASK-0247, with the FR-011 test as its evidence.
- **OQ-A14 — Nested live regions.** The stream is one polite log (FR-011). Spec 108's streaming
  block also sets `aria-live="polite"`, so a screen reader can announce prose twice.
  **Recommend:** the block keeps `aria-busy` and drops its own `aria-live`; update the spec 108
  test line. Alternative: keep both and check in the Brave accessibility read.
- **OQ-A15 — Server dice lines and both d20s.** TASK-0243's old ACs also asked the narration dice
  line and the auditor to show both faces. Under A2 the web no longer shows those lines.
  **Recommend:** no server change. Card it only if a playtest shows the model misreading a
  dropped die from the transcript.

## Scope

The decision's sequencing note splits the work. The operator split it again on 2026-11-05. Spec 090
holds the margin, mini-strip and status strip. This spec is the rest.

- **In**: R1 scene fields and seed ways; the stream (one-line roll rows, rules lines, room blocks with
  clickable ways on that draft into the composer, filter chips over one stream); the MUD input baseline
  (Up/Down history, an `@`/`/` closed-command dropdown, Tab completion of scene entities, clickable
  nouns with inline expansions); screen-reader parity; a contrast check in light and dark for these
  surfaces; the R1 contract amendments and the R2 surface additions these surfaces own.
- **Out, built by spec 090**: the margin, the mini-strip, the status strip and the turn-order move.
- **Out, a named dependency**: the slide-out interactive map. It needs map data from milestone M6:
  TASK-0070 (PixiJS table, grid, tokens) and TASK-0071 (the DM drives tokens). The map ships later
  on this layout. It opens from an **Open map** button in the margin, inside the project's one
  slide-out `Panel` (right edge on desktop, bottom sheet at 390 px). A token click calls the same
  draft path this spec builds (FR-019). This spec renders no map button.

## Prerequisites

- **TASK-0199 (spec 066, one chat stream) is merged.** This spec extends its composer (speaker chip,
  `@` mention dropdown, `((` and `/ooc`), its confirm row and its ring. A draft lands in that
  composer, and the ring → confirm → 👍 flow that follows a sent line is 066's.
- **Spec 090 (TASK-0236) is merged.** This spec edits `table-view.tsx` and reads the margin facts that
  the parity lines mirror.
- R1 (a) and R2 (a) were ruled by the operator on 2026-11-05 (see "Frozen-contract items").
- **`apps/server/src/dm/nodes/resolve.ts` lanes must be clear before the scene-fields phase (Phase 1).**
  Check the runbook for any open lane on that file before dispatch.

## Data the UI needs: where it comes from

| Datum | Source today | Status |
|---|---|---|
| Party names, HP, AC, class and level | `p.party[].combatant` (`partyRows`, `play/party.ts`) | **Exists** |
| Conditions on every combatant | `p.party[].combatant.conditions`, `p.encounter.order[].conditions` | **Exists** |
| Turn order, active and next combatant | `p.encounter`, `ModeView.order` (`view-model.ts`) | **Exists** |
| Whose turn it is | `p.tableMode`, `ModeView.activeLabel` | **Exists** |
| Structured roll rows | `p.ledger` `roll` and `outcome` rows (`dice.rolled`, `check.resolved`, `attack.resolved`), grouped by `batchId` | **Exists** (today shown only in the Ledger slide-out) |
| HP, condition, life-state and initiative changes as text | `p.ledger` `change` rows (`hp.changed`, `condition.*`, `life-state.changed`, `encounter.started`) | **Exists** |
| Stream filter category | the entry kind and `talk.channel` | **Exists** (derived; no server tag) |
| Input history | the viewer's own `talk` rows in `p.transcript` | **Exists** (derived; see gap 1) |
| Glossary: party and combatant names | `p.party`, `p.engine.combatants` | **Exists** |
| Room name | `scene.changed` `after.title`, `after.location` | **Exists** |
| Room description | `SceneSchema.summary` holds the goal statement, not a place description | **Missing → R1** |
| Ways on (label and draft text) | nowhere: not in the seed, not in any event | **Missing → R1** |
| Glossary: non-combatant NPC names and player-safe facts | nowhere on the client (066 recorded the same gap); `PlayerSeedView.npcs` on the server | **Missing → R1** |
| Action economy (action, bonus, move) for the status strip | the engine tracks reactions only (`reactionsSpent`) | **Missing; not taken** (Non-goals) |

## Frozen-contract items (ruled 2026-11-05: R1 (a), R2 (a))

**R1 — `SceneSchema` gains three optional fields; the seed location gains `ways`.**
Contracts: `specs/028-session-model/contracts/session-events.md` (`scene.changed`, `SceneSchema`),
`specs/029-proposal-gate/contracts/proposals.md` (the `scene` proposal reuses `SceneSchema`),
`specs/031-dm-runtime/contracts/scene-seed.md` (`location`), `specs/031-dm-runtime/contracts/director.md`
(the scene-start `scene` proposal).

- `SceneSchema` gains optional `description` (text, max 1000), `ways` (max 6 of `{ label, draft }`)
  and `cast` (max 20 of `{ id, name, role, appearance }`). The payload stays v1, so old rows parse.
- The seed `location` gains optional `ways` (max 6 of `{ label, draft }`). It is player-facing and
  joins `PlayerSeedView.location`.
- At scene start the Director fills `description` from the player-facing location features, `ways`
  from the seed, and `cast` from `PlayerSeedView.npcs`. No DM-only seed field is read.
- **Ruled (a), operator 2026-11-05.** Options were: **(a) accept the additive optional fields** (the spec 072 party precedent).
  (b) Reject. The fallback then ships: room blocks show the name only, with no description and no
  ways on; nouns and Tab completion cover party members and combatants only. US5 shrinks to that.

**R2 — the play-route layout adds stream surfaces.** The turn-order move belongs to spec 090.
Contracts: `specs/030-play-route/contracts/ui-surfaces.md` (Components, Accessible names).

- New surfaces here: the filter chips, room blocks, roll rows, parity lines, noun expansions and the
  command dropdown. The "Forbidden" list is unchanged.
- **Ruled (a), operator 2026-11-05.** Options were: **(a) accept**; the change is additive surfaces.
  (b) Reject.

## User Scenarios & Testing *(mandatory)*

Copy and states follow `b-margin.html` over the `greyhollow-ford-duo` seed (Kestrel and Tamsin are
human, Brother Odo is an AI companion, Wenna Marsh is a present NPC, Snag leads the goblins).


### User Story 3 - One stream, filtered and readable (Priority: P1)

The stream carries talk, narration, confirm rows, room blocks, roll rows and rules lines. Filter
chips "All", "In character", "Table talk" and "Rules" narrow the view. A roll is one line that
expands inline.

**Independent Test**: `stream-items.test.mjs` over fixtures; `filter-chips` markup.

**Acceptance Scenarios**:

1. **Given** Kestrel's Stealth check resolves, **Then** the stream shows one row "Kestrel — Stealth
   17 ✓". Activating it expands "d20 (12) + 5 = 17 vs DC 15. Success." in place. (The mockup's
   "+ 3" is wrong for this seed: Kestrel's Stealth is +5.)
2. **Given** an attack, **Then** one row reads "Kestrel — Shortbow vs Goblin lookout: hit" and
   expands to the dice, the total against AC, and the damage rolled.
3. **Given** "In character" is pressed, **Then** only narration, in-character talk and room blocks
   show. Confirm rows and the viewer's own open action stay visible under every chip.
4. **Given** "Table talk" is pressed, **Then** only out-of-character talk, `@dm` posts and DM asides
   show.
5. **Given** any chip, **Then** the log's contents are unchanged; the chip hides rows from view only.

---

### User Story 4 - The input line works like a MUD client (Priority: P1)

Up and Down walk the viewer's earlier lines. Typing `/` at the start opens a dropdown of a small
closed command set. Tab completes a scene entity's name.

**Independent Test**: `composer.test.tsx` and `history.test.mjs`.

**Acceptance Scenarios**:

1. **Given** Kestrel sent "I'll get up there and see who's hiding." and then reloads, **When** she
   presses Up in an empty composer, **Then** that line returns. A line sent twice in a row appears
   once.
2. **Given** she has typed "I look" and presses Up, then Down past the newest entry, **Then** "I
   look" returns.
3. **Given** she types `/`, **Then** a dropdown lists `/ooc` (table talk), `/help` (what you can do
   here) and `@dm` (ask the DM, out of character). Arrow keys move, Enter picks, Escape closes.
4. **Given** she picks `/help`, **Then** an inline panel under the composer lists the commands and
   keys (Up/Down, Tab, `@`, `/`). Nothing is sent or logged.

**Amended 2026-11 (A8):** scenarios 3 and 4 read with `/?` in place of `/help`. The dropdown lists
the player verbs (FR-014a); `/help` drafts the SRD Help action. Added scenarios:

7. **Given** she types `/atack @goblin-lookout`, **Then** the pill reads "Unknown command: /atack"
   and Send sends nothing.
8. **Given** she types `/attack @gob` and presses Tab, **Then** the line reads
   `/attack @goblin-lookout ` and the pill shows "Attack — Goblin lookout" once the weapon is typed.
9. **Given** she sends a line, **Then** it stays in the input until her own row lands; on a refusal
   it stays editable with the refusal shown.
5. **Given** she types "I ask Sn" and presses Tab, **Then** the line reads "I ask Snag " when Snag is
   the one match. With two matches, the dropdown lists both.
6. **Given** an empty line, or a line that ends in a space, **When** she presses Tab, **Then** focus
   moves to the next control, as the browser does.

---

### User Story 5 - Nouns and ways on (Priority: P2)

A known name in a stream line is a button. It opens an inline expansion with player-safe facts. A
room block names the place, describes it, and lists its ways on. Clicking a way on drafts a line.

**Independent Test**: `glossary.test.mjs`, `room-block` and `noun-text` markup.

**Acceptance Scenarios**:

1. **Given** narration names Snag, **When** Kestrel activates "Snag", **Then** an inline expansion
   under the line reads "Snag — goblin leader. Narrow, yellow-eyed, a notched scimitar." The button
   reports `aria-expanded`.
2. **Given** a party member's name, **Then** its expansion shows class and level, HP, AC and
   conditions. **Given** a monster's name, **Then** its expansion shows its name, conditions and
   whether it is down; it shows no HP or AC numbers.
3. **Given** the scene starts, **Then** a room block shows "Greyhollow Ford", its description, and
   "Ways on: ladder to the loft · causeway downriver · ferry".
4. **Given** Kestrel clicks "ladder to the loft", **Then** the composer reads "I climb the ladder to
   the loft", has focus, and nothing is sent. Kestrel edits or sends it; the 066 flow follows.
5. **Given** the DM viewer, or a viewer with no character, **Then** ways on render as plain text.

---

### User Story 6 - A screen reader hears what the margin shows (Priority: P1)

Every fact the margin and the status strip show also appears as text in the stream.

**Independent Test**: `stream-items.test.mjs` parity cases; a Brave accessibility-tree read.

**Acceptance Scenarios**:

1. **Given** an encounter starts, **Then** the stream gets a Rules line "Initiative: Kestrel, Snag,
   Tamsin, Goblin lookout, Brother Odo, …".
2. **Given** a condition is applied or removed, **Then** a Rules line reads "Tamsin is prone." or
   "Tamsin is no longer prone."
3. **Given** a party member's HP changes, **Then** a Rules line reads "Kestrel: HP 9 → 5 (damage)."
4. **Given** a combatant drops or dies, **Then** a Rules line reads "Goblin lookout is dead."
5. **Given** the scene starts, **Then** the room block lists the party with HP and AC as text.
6. The stream is one `role="log"` region with `aria-live="polite"`. The margin and the status strip
   are not live regions, so no fact is announced twice.

### Edge Cases

- A `dm`-visibility row never reaches a player projection (`canSee`), so it yields no roll row,
  parity line, noun or way. This holds by construction; a test pins it.
- A roll row whose batch has no outcome (a damage roll alone) shows the roll total only.
- A combatant removed from the engine keeps its name in old rows from the ledger `before` value.
- An NPC enters the glossary only after its name appears in a visible stream line or a visible
  `arrived` row names it, so completion never names an NPC the table has not met.
- A noun inside a quoted name that contains another name matches the longest name first.
- History holds at most 50 lines. Text sent before this spec ships is in the log, so it is history
  too.
- A draft into a composer that holds text replaces it. The replaced text becomes the newest history
  entry for this page, so Up brings it back.
- A scene with no `ways` shows no "Ways on" line. A scene changed by the human DM's Change scene
  panel carries no `ways`, `description` or `cast`.

## Requirements *(mandatory)*
### Functional Requirements

Requirement ids keep their numbers from the combined draft. FR-001 to FR-005 are in spec 090.

**Stream**

- **FR-006**: Each `roll` ledger row with its batch's `outcome` row renders as one stream row at the
  roll's seq: "<actor> — <skill or attack> <total> ✓/✗" for a check, "<actor> — <attack> vs
  <target>: hit/miss/critical hit" for an attack. The row is a disclosure (`<details>` or a button
  with `aria-expanded`). Its expansion shows the dice faces, modifier, total and the DC or AC, worded
  as the Ledger slide-out words them (`ledger-format.ts`).
  **Amended 2026-11 (A1, card AC #4, #9):** the row renders from the ledger at the roll's seq, never
  from narration text. A check names its skill, else its ability, and "save" for a saving throw.
  The summary carries the roll mode in words ("with advantage", "with disadvantage"). See FR-026.
- **FR-007**: Rules lines render from ledger `change` rows: initiative at `encounter.started`,
  conditions at `condition.applied` and `condition.removed`, HP for party members at `hp.changed`,
  and life state at `life-state.changed`. Wording follows US6.
- **FR-008**: A `scene.changed` row with a non-null `after` renders as a room block: heading
  `location ?? title`, then `description` and "Ways on: …" when present (R1), then the party with
  HP and AC as text.
- **FR-009**: Every stream item has one category: **In character** (narration, IC talk, room
  blocks), **Table talk** (OOC talk, `@dm` posts, DM asides), **Rules** (roll rows, rules lines,
  floor lines, confirm rows, action cards). Chips "All", "In character", "Table talk", "Rules" form
  a single-select group (`aria-pressed`). "All" is the default. The chip is page state only.
- **FR-010**: Confirm rows the viewer can answer, and the viewer's own open action, show under every
  chip.
- **FR-011**: The stream is one element with `role="log"`, `aria-live="polite"` and the name
  "Table stream".

**Input**

- **FR-012** *(amended 2026-11, A11)*: History is the viewer's own lines: `p.intents` whose
  carrier actor is the viewer, as `toText(intent)`, plus the viewer's own `talk` rows that no
  Intent carries (legacy rows). The rest of this rule stands. Original text:
  History is the viewer's own `talk` rows in this session's projection, newest last,
  consecutive duplicates removed, capped at 50. It persists across reload because the log does.
- **FR-013**: Up recalls the previous history entry when no dropdown is open. Down moves forward.
  Down past the newest restores the unsent text that was in the composer before the first Up.
- **FR-014a** *(replaces FR-014, A8)*: A `/` at the start of the line opens the verb dropdown,
  filtered as typed. It lists the verbs a player seat may send (`KIND_RULES` seats include P), each
  with its `KIND_LABEL` words, plus `/?` (help). `/help` is the SRD Help action. `/?`, and `?` typed
  into an empty composer, toggle the inline help block and send nothing. An unknown `/word` is
  refused inline with plain words for `PARSE_UNKNOWN_VERB` and is never sent as speech (contract
  §8.3 rule 12).
- **FR-014** *(superseded by FR-014a)*: A `/` at the start of the line opens the command dropdown, filtered as typed. The set is
  closed: `/ooc`, `/help`, and `@dm` listed with its description. `/ooc` keeps 066's behaviour.
  `/help` opens an inline help block under the composer and sends nothing. Unknown `/words` are
  sent as typed, like any text.
- **FR-015**: Tab with a word before the caret completes it against the glossary (FR-017),
  case-insensitively by prefix. One match replaces the word with the name and a space. Two or more
  matches open the dropdown. Tab on an empty line, after a space, or with no match is not
  intercepted (WCAG 2.1.2).
  **Amended 2026-11 (A9):** the word before the caret picks the list. `/` plus letters completes a
  verb. `@`, `#` or `&` plus letters completes a target id (actors, revealed zones, scene
  entities); the listbox shows the name beside the id. A bare word completes a glossary name. Send
  passes `ctx.resolve` built from the glossary, so a bare name in a slash line resolves to its id.
- **FR-016**: The command dropdown, the 066 `@` dropdown and the Tab dropdown are one inline listbox
  component under the input: `role="listbox"`, `aria-activedescendant`, arrow keys, Enter, Escape.
  **Amended 2026-11 (OQ-A12):** after a keyboard pick or Escape, focus returns to the input.

**Glossary, nouns and ways**

- **FR-017**: The glossary is derived on the client: each party member (character facts), each
  engine combatant that is not a party member (monster facts), and each `cast` NPC (R1) once its
  name appears in a visible stream line or a visible `arrived` row names its id. Ways on of the
  current scene join the completion list only.
- **FR-018**: In narration and talk text, each whole-word occurrence of a glossary name is a button
  (longest name first). A one-word name matches case-sensitively, so the verb "snag" stays text. A
  name of two or more words matches case-insensitively, so "the goblin lookout" links. It toggles an inline expansion after the line, with
  `aria-expanded` and `aria-controls`. Facts: a character shows class and level, HP, AC,
  conditions; a monster shows name, conditions and down or dead; an NPC shows role and appearance.
  No other field is shown.
- **FR-019a** *(replaces FR-019, A7)*: **The draft path.** `TableView` owns one function,
  `draft(seed: Intent | string)`. An Intent drafts `toText(intent)`; a string is a text-form stub
  and drafts as given. It puts the text in the composer, sets the speaker to the viewer's character
  when the speaker is out of character, focuses the input with the caret at the end, and sends
  nothing. The pill (FR-031) then shows the parse at commit `draft`. A replaced non-empty draft
  becomes the newest page-only history entry. Every click-to-draft caller uses this function: ways
  on, noun expansions, and later the map, the action bar (TASK-0275) and zone chips (TASK-0277).
- **FR-019** *(superseded by FR-019a)*: **The draft path.** `TableView` owns one function, `draft(text)`. It puts the text in
  the composer, sets the speaker to the viewer's character when the speaker is out of character,
  focuses the input with the caret at the end, and sends nothing. A replaced non-empty draft becomes
  the newest page-only history entry. Every click-to-draft caller uses this function: ways on now,
  map tokens and map ways later.
- **FR-020**: A way on renders as a button that calls `draft(way.draft)` for a viewer who controls a
  character. For any other viewer it renders as text.
  **Amended 2026-11 (A12):** `way.draft` is a contract text form. The seed loader runs `parse` on it
  with a seed-time resolver and refuses the seed when it does not parse, or when a `/move` names a
  zone the seed marks hidden. A noun expansion for an NPC or monster offers "Talk to" (stub
  `/to @<id> `) and, for a monster in an encounter, "Attack" (stub `/attack @<id> with `); both
  call `draft`.

**Constraints**

- **FR-021**: No modal. Every new surface is inline or in the existing `Panel`. The 030
  "Forbidden" list holds, including no `localStorage` or `sessionStorage`.
- **FR-022**: New colours come from Daylight tokens in `app/app.css` only. Every text and control
  pair used by a new surface meets WCAG AA (4.5:1 text, 3:1 large text and control boundaries) in
  light and dark, checked by a test that computes the ratios from the tokens.
- **FR-023**: Every surface works at 1280 px and 390 px with no sideways scroll.
- **FR-024** *(superseded 2026-11, A13)*: ~~No new gate request, event type, frame or migration.~~
  The composer sends `intent` requests (spec 105, merged). This spec adds no request kind, event
  type, frame or migration. The only event change is R1.

**Added by the 2026-11 amendment**

- **FR-026** (A1, card AC #4): A roll row with a `dice` term of two d20s and a kept mask shows both
  faces, marks the dropped face (struck through, and "dropped" in its accessible name), and names
  the mode in words. A crit damage roll shows every die. Its expansion lists faces per die as the
  Ledger slide-out does. The row reads `dice.rolled.mode`, `check.resolved.kind`, `.skill` and
  `.ability`; the client computes nothing.
- **FR-027** (A2, card AC #9): The web splits a settled `ai:dm` narration row into prose and its
  trailing code block with the auditor's rule (the last blank-line block whose every line is a
  dice, change, `why`, refusal or `State:` line). Dice and change lines are not shown, because the
  stream shows them from the ledger. `why`, refusal and `State:` lines render as rules lines after
  the prose. The same filter applies to the streaming block's `rows` part. Narration text that has
  no such block renders whole.
- **FR-028** (A3, card AC #5): The streaming block (spec 108 FR-010) is the progress indicator. A
  stream test pins the order: the batch's roll and rules rows, then the block, then the settled
  narration. The block's own `aria-live` is dropped inside the log (OQ-A14).
- **FR-029** (A4, card AC #7): In narration prose, each sentence that holds a double-quoted span
  (straight or curly quotes) renders as its own dialogue row: upright, full-contrast `foreground`,
  with the quote marks kept. The rest of the prose stays italic and muted. An `npc_say` talk row
  renders as a dialogue row headed by the NPC name. No narration schema change.
- **FR-030** (A5, card AC #7): The stream column and the composer are capped at 1024 px
  (`max-w-5xl`) and centred, beside the spec 090 margin. At 390 px the column is full width.
- **FR-031** (A6, card AC #1–#3): **The Intent pill.** When the line starts with `/` or a sigil
  (`@ & $ # * " ((`), a pill above the input shows `parse(line, ctx)` at commit `draft`, with the
  FR-015 resolver. A parsed line shows `KIND_LABEL` words and each target's name. A refused line
  shows plain words for the `PARSE_*` code (one label per code, contract §9) and the parser
  message as detail. The pill is a `role="status"` region, polite. It is page state only and never
  sent. Plain prose shows no pill. Send runs `routeSend` unchanged.
- **FR-032** (A10, card AC #6): After Send, the line stays in the input, read-only, until the
  viewer's own row for it reaches the projection (the Intent id, or the declared action id). Then
  the input clears. A refusal for that request re-enables the input with the line kept and shows
  the refusal. A reconnect resolves the wait from the replayed log.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): No capability here is human-only. A draft is a UI step before the
  existing `talk` request, which an agent sends directly. An agent authors `ways`, `description` and
  `cast` through the existing `scene` proposal (R1).
- **CR-004** (VI. 5e engine boundary): Roll rows and rules lines only render engine events from the
  log. No client code rolls or computes a number beyond formatting.
- **CR-005** (VIII. Operator-owned content): Seed `ways` are original text in the shipped seeds. No
  library content reaches the table.

### Key Entities

- **Stream item**: one rendered row with a seq, a category and a kind (talk, narration, confirm,
  action, floor, room, roll, rules line). Derived; never stored.
- **Glossary entry**: `{ name, kind: character | monster | npc, facts }`. Derived per render.
- **Way on**: `{ label, draft }` on the scene (R1).
- **Draft**: text placed in the composer by a click. It is page state until the player sends it.

## Decision gaps settled here

The decision lists the baseline and its constraints. These readings fill what it leaves open.

1. **History storage.** The task asks for history "persisted per browser". The 030 "Forbidden" list
   bans `localStorage` and `sessionStorage`, and cookies cannot hold 50 lines. Settled: history is
   derived from the viewer's own logged lines (FR-012). It survives reload with no storage, and it
   follows the account across browsers. A refused line is not in history; TASK-0162 owns refused
   drafts. Per-browser storage would be a third red item, not taken.
2. **`/roll` is not in the command set.** The mockup lists it, but players have no roll request (the
   engine rolls only through DM `mechanics`). Adding one is a gate change outside this layout spec.
3. **Monster facts show no HP or AC.** The analysis says "player-safe facts only". The margin shows
   party HP only, so a noun expansion does not reveal monster numbers.
4. **Room blocks render on `scene.changed` only.** The mockup's reed-camp block sits at encounter
   start, but encounter terrain is not player-facing seed text. No block at encounter start.
5. **Way drafts are authored.** A template ("I take the <label>") reads badly for labels like "back
   along the causeway", so each way carries its own `draft`.
6. **Confirm rows sit under "Rules".** The mockup tags them so. FR-010 keeps an answerable confirm
   visible under every chip, so a filter never hides a pending decision.
7. **The cast payload names every player-facing NPC.** `PlayerSeedView` is player-facing by contract,
   so no DM-only text leaves the server. The client gates completion and nouns by mention (FR-017).
   A player reading raw frames can see a name early; that is the accepted reach of R1 (a).

## Non-goals

- The slide-out map, tokens, positions and the "Open map" button (TASK-0070, TASK-0071).
- The margin, the mini-strip and the status strip (spec 090).
- Action economy in the status strip (action, bonus, move). The engine tracks reactions only. The
  orchestrator should card it as engine work if wanted.
- A per-player rules-detail setting (OQ3: per-row expansion first).
- Player-written aliases, triggers, gags, macros and draggable layouts (rejected in the decision).
- `ways`, `description` and `cast` fields in the human DM's Change scene panel.
- Notifications when the tab is unfocused.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-002**: For each fact the margin or the status strip shows in the combat fixture, a test finds
  the same fact as stream text: 100% parity.

- **SC-003**: Every text and control pair on the new surfaces measures at least 4.5:1 (3:1 for
  control boundaries) in both themes.
- **SC-004**: 0 sends happen from a draft click; the event log is unchanged after any number of
  draft clicks.
- **SC-005**: A player recalls her last line after a reload with 1 key press.
- **SC-006**: A player view never renders a fact from a `dm`-visibility row, an NPC field outside
  `PlayerSeedView`, or a monster HP or AC number in a noun expansion.

- **SC-007**: 0 `<dialog>`, `aria-modal` or `fixed inset-0` under `app/play/`.


SC-001 (margin and status strip visible at both widths) is in spec 090.

## Assumptions

- Spec 066 lands its composer, mention dropdown and confirm row as planned. If it changes, the
  composer phase rebases onto what merged.
- Seeds ship authored `ways` for the Greyhollow Ford location only.
- The Ledger slide-out stays as the full record. Roll rows are a second view of the same rows.
