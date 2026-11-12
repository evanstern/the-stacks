# Feature Specification: One composer, one Send, Enter commits in combat (web)

**Feature Branch**: `task-0315-one-composer`
**Spec dir**: `specs/105-one-composer-web`
**Created**: 2026-11-12
**Status**: Draft, written against a settled design
**Card**: TASK-0315 (split from TASK-0199 by the operator's C-AMD ruling, 2026-11-11, "Approve all")

**Input**: the web half of spec 066 (`specs/066-one-chat-stream/`). Design: spec 066 spec.md
"Split out to TASK-0315", plan.md D4, and the original tasks.md Phase 4 (in git at `5d9c8153^`).
**Upstream**: TASK-0199 merged in PR #170 as `3fe09541`. This spec is authored against
`origin/main` `468069b8`, which carries `3fe09541`.

`speckit-specify` ran as authoring guidance only: the branch and spec number were already claimed.
`speckit-clarify` was skipped: spec 066, its amendment and the 2026-11-11 rulings settle every
design question. The remaining gaps are under "Open questions", each with a recommendation.

## Scope

This card builds the web client against the server half that `3fe09541` shipped. It takes, as
written in spec 066:

- **FR-001 to FR-005**: one composer, the speaker chip, the `@` mention dropdown, `parse()` on
  Send, "Table talk", the DM aside, and the removed controls.
- **FR-015, FR-017**: the confirm row's **👍 Yes**, **Not quite** and "Waiting on <name>".
- **FR-019, client half**: the human DM's **Confirm as action…** editor, **Confirm** on a
  declared Intent, the `ask_dm` highlight, and the DM's Commit and Withdraw.
- **FR-022 to FR-026**: combat Enter-commit, no player Commit control, the ring, Thinking, and the
  interrupt strip.
- **SC-005, SC-008**: the absent names and the two-browser Brave live check.

**Out of scope (owned elsewhere):**

- **TASK-0275 (CP-5 F2):** the combat banner, turn pips, the legal-action bar and the worded
  off-turn reason. This card shows the generic `NOT_YOUR_TURN` label only.
- **TASK-0247 (spec 091, narrowed by spec 066 OQ-3a):** slash pills, Tab completion and inline
  `PARSE_*` refusal wording. This card's Send parses every slash verb and shows the parser's own
  refusal message.
- Every server rule. `readablePosts`, `suggestionState`, the gate kinds and the DM runtime shipped
  in `3fe09541`. The web imports them; it re-implements none.

## Frozen contracts this card builds against

No contract changes. The web reads these blocks as merged in `3fe09541`:

- **C-6**, `specs/030-play-route/contracts/proposal-seam.md`: `ConfirmView` lines are
  `{ text, kindLabel }` over an Intent item; `commitsOnOwnTurn` leaves `ActionCardView`.
- **C-7**, `specs/030-play-route/contracts/{table-source,live-frames,ui-surfaces}.md`: the composer
  sends `intent` requests (`declared` in free mode, `confirmed` in turn mode); the active player's
  prose goes as `action.declare` then `action.commit`; `accept` and `suggest` stay. **Confirmed:**
  the ui-surfaces block says the "Speaker" chip leaves the `The party` entry. The speaker listbox
  holds the viewer's characters and "You (out of character)" only.
- **C-9**, `specs/049-turn-floor/contracts/ui-floor.md`: the composer's Enter replaces the active
  player's Commit on the action card.

## User Scenarios & Testing

Seed `greyhollow-ford-duo`: Tamsin and Kestrel are human; Brother Odo is an AI companion.

### User Story 1 - One composer for every line (Priority: P1)

Kestrel types in one box and presses Send. A plain line is said in character. `((` or `/ooc`
makes it table talk. `@dm` asks the DM. `/do` and other slash verbs send their Intent.

**Independent Test**: render the composer and route each line form through the pure send router.

**Acceptance Scenarios**:

1. **Given** the play route, **When** a player views it, **Then** it holds one composer with one
   Send button and none of the SC-005 names.
2. **Given** free mode, **When** Kestrel sends "I'll get up there.", **Then** one `intent` request
   leaves with a `say` Intent at commit `declared`.
3. **Given** a draft starting `((`, **When** it is typed, **Then** the Speaker chip reads "You (out
   of character)" and Send sends an `ooc` Intent.
4. **Given** a slash line that fails to parse, **When** Send is pressed, **Then** the parser's
   refusal shows under the composer and nothing is sent.
5. **Given** the Speaker chip opens, **Then** its listbox holds no "The party" entry (C-7).

### User Story 2 - Confirm the deed the DM read (Priority: P1)

After the ring, the DM's confirm row asks Kestrel about her climb. She presses 👍 Yes. Tamsin sees
"Waiting on Kestrel".

**Acceptance Scenarios**:

1. **Given** a live suggestion item for Kestrel's character, **When** Kestrel views it, **Then** she
   sees **👍 Yes** and **Not quite**; Tamsin sees "Waiting on Kestrel".
2. **When** Kestrel presses 👍 Yes, **Then** one `action.accept { suggestionId, itemId }` leaves.
3. **When** Kestrel presses Not quite, **Then** focus moves to the composer and nothing is sent.
4. **Given** the item's Intent has an `intent.recorded` row, **Then** the line reads "Confirmed";
   a stale item reads "Superseded".

### User Story 3 - The ring and Thinking (Priority: P2)

Under an AI seat in free mode, a ring counts down after a readable post. Thinking shows while the
read runs. Sending a character line during Thinking asks "Interrupt the DM?" inline.

**Acceptance Scenarios**:

1. **Given** a readable post 5 s old, **Then** the ring shows 5 of 8 segments and the caption "The
   DM reads the table in 5 s. Keep talking to wait."
2. **Given** a `read` marker and no later `ai:dm` row, **Then** "The DM is reading the table…"
   shows, until a later `ai:dm` row, a later readable post or 30 s.
3. **Given** Thinking and a character speaker, **Then** Send reads "Send — interrupts the DM", and
   its first press opens the inline group "Interrupt the DM?" with **I'm sure** and **Wait**.

### User Story 4 - Enter commits in combat (Priority: P1, card AC #1)

In turn mode no ring runs. The active player's Enter commits the line. A non-active player's prose
is speech.

**Acceptance Scenarios**:

1. **Given** turn mode, **Then** the ring and Thinking never show.
2. **Given** Kestrel is active, **When** she enters "I shoot the goblin", **Then** `action.declare`
   (scope `character`) then `action.commit` leave, in that order.
3. **Given** Kestrel is active, **When** she enters `/do climb the wall`, **Then** one `intent`
   request leaves at commit `confirmed`.
4. **Given** Tamsin is not active, **When** she enters prose, **Then** a `say` Intent leaves at
   commit `confirmed`; a slash Intent leaves at commit `confirmed` and its `NOT_YOUR_TURN` refusal
   shows the generic label.
5. **Given** turn mode, **Then** no action card shows the active player a Commit button.

### User Story 5 - The human DM confirms (Priority: P2)

Under a human DM seat, no ring or Thinking shows. The DM turns a `say` line into a suggestion, or
confirms a declared Intent.

**Acceptance Scenarios**:

1. **Given** a `say` line, **When** the DM opens **Confirm as action…**, **Then** an inline editor
   opens in the transcript; its Send sends one `action.suggest` with one `attempt` item, or the
   parsed Intent when the wording starts with `/`.
2. **Given** a `declared` Intent line, **When** the DM presses **Confirm**, **Then** that Intent is
   sent again at commit `confirmed` with the same id and body.
3. `ask_dm` posts are highlighted. Every action card keeps the DM's Commit and Withdraw.

### Edge Cases

- Send while disconnected or empty: disabled, as today.
- The ring's remaining time above the window is clamped (FR-024).
- A party suggestion item: any human party member sees 👍; others see "Waiting on the party".
- The first `action.declare` of an active-player commit is refused: the `action.commit` is refused
  `ACTION_NOT_FOUND` too, and the composer shows the first refusal (OQ-3).

## Requirements

Spec 066 FR-001 to FR-005, FR-015, FR-017, FR-019 (client half) and FR-022 to FR-026 are this
card's functional requirements, verbatim. Two web-only requirements are added:

- **FR-W1**: `detailsOf` in `apps/web/app/play/proposals.ts` MUST render `action.suggest` as one
  detail row per item (`<text> — <kindLabel>`, plus the item's `toText` form) and its read seq, and
  `action.accept` as the suggestion id and the item id. The two `ponytail:` comments leave.
- **FR-W2**: the client MUST add no state store. The ring, Thinking and confirm state derive from
  the projection plus the client clock (constitution V).

## Card acceptance criteria

| Card AC | Proven by |
|---|---|
| **#1** In combat, no quiet ring runs; the active player's Enter commits the Intent, with a test. | `apps/web/test/play/read-ring.test.mjs` (turn mode → hidden) and `apps/web/test/play/send.test.mjs` (active prose → declare then commit; active slash → `confirmed`; non-active prose → `say`) |
| **#2** The play route has one composer and one Send button, verified live in Brave. | `composer.test.tsx` and `table-view.test.tsx` (SC-005 names absent, one Send); the [orchestrator] Brave live check (SC-008) |

## Success Criteria

Spec 066 **SC-005** and **SC-008**, verbatim. In SC-008, "the `intent.recorded` row after 👍"
reads as the line turning "Confirmed".

## Open questions

Each carries a recommendation. None blocks the first dispatch unless noted.

- **OQ-1 — Fixture mode and the planner.** Constitution II forbids a surface calling the planner.
  The fixture source has no gate. **Recommend:** `localIntentEvents` and `localAcceptEvents`
  append the carrier `intent.recorded` row (plus the `talk` row for speech and `ooc`) only, with
  no engine rows. Mark it with a `ponytail:` comment: fixtures show no mechanical result; upgrade
  path is a fixture gate. Blocks Phase 1.
- **OQ-2 — The active player's hint.** FR-022 changes what Enter does with no visible cue, and
  constitution IX says every action is announced. **Recommend:** one line under the composer, "Enter
  commits your turn", tied by `aria-describedby`, shown only to the active player. TASK-0275's
  banner may replace it. No contract names Send's label, so the button stays "Send".
- **OQ-3 — A refused declare before its commit.** The two requests go back to back. **Recommend:**
  send both; the source keeps the first refusal notice. No client-side wait for an ack.
- **OQ-4 — The human DM editor's `readSeq`.** The gate's stale check binds `ai:dm` only.
  **Recommend:** `readSeq` = the `say` line's seq.
- **OQ-5 — The accessibility tool.** The repo has no axe or pa11y dependency; `contrast.test.mjs`
  checks tokens only. **Recommend:** the orchestrator runs the browser accessibility-tree read
  (`read_page`) plus a keyboard-only pass in Brave, and records it in `evidence/live-check.md`. Do
  not add a runtime or dev dependency.
- **OQ-6 — `kindLabel` wording.** The `intent` package has no display labels. **Recommend:** a
  `KIND_LABEL` map in `labels.ts` (for example `attempt` → "Action", `hide` → "Hide"), falling
  back to the kind id.
