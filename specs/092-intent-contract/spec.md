# Feature Specification: Intent contract package

**Feature Branch**: `task-0266-intent-contract`
**Created**: 2026-11-08
**Status**: Draft for checkpoint CP-4. The operator freezes `contracts/intent-schema.md` from this spec.
**Input**: TASK-0266 (N-01). Sources: target-architecture §2, §3, §6, §8; constitution 3.0.0
(II, III, V, VI, IX); ratified P-04, P-08, P-09, P-12, P-14; `research/table-ux-research.md` §2, §3, §7.

Authored by hand against `.specify/templates/spec-template.md`. The branch and card were already
claimed, so the create-feature script was not run.

## Scope

- **In**: a new package `packages/intent`. It holds the Intent envelope, commit states, the
  ActorRef, Channel and TargetRef unions, 57 kinds in 13 groups with Zod params schemas, the slash
  text form, `parse` and `toText`, refusal codes, fixtures and the versioning rule. A decision
  record freezes the contract at `INTENT_SCHEMA_VERSION = 1`. Boundary lint guards the package.
- **Out**: the planner (N-02, TASK-0267). The gate's `intent` request kind (N-03, TASK-0268). The
  `interpret` change (N-04, TASK-0269). Every surface (composer pills, action bar, sheet, board).
  Engine commands for gap kinds. This spec reserves names and codes for them; it builds none.

## Background

Today the only player write is `action.declare {text}` (`session-model/src/events/actions.ts`).
`mechanics` proposals carry `command: z.unknown()` and are DM-only. A button has nowhere to go but
a model call. Constitution II requires one typed vocabulary that every surface and both DM seats
emit. This package is that vocabulary. It is a contract only: pure data, a grammar, and tests.

## User Scenarios & Testing *(mandatory)*

Each story shows a different producer reaching the same Intent. The fixture named in each story is
the shared expected value.

### User Story 1 - A player types a slash command (Priority: P1)

Mira's player types `/attack @goblin-2 with longsword` and presses Enter in combat.

**Why this priority**: typed text is the baseline surface and the accessibility path.

**Independent Test**: `parse("/attack @goblin-2 with longsword", ctx)` returns fixture `attack.basic`.

**Acceptance Scenarios**:

1. **Given** the text `/attack @goblin-2 with longsword`, **When** it is parsed with actor
   `pc:mira`, **Then** the result is kind `attack`, target `actor:goblin-2`, `params.weapon`
   `longsword`, mode `normal`.
2. **Given** the text `/attack longsword @goblin-2` (alias order), **When** parsed, **Then** the
   result equals fixture `attack.basic`, and `toText` emits the canonical order.
3. **Given** `/atack @goblin-2`, **When** parsed, **Then** the refusal is `PARSE_UNKNOWN_VERB`.

### User Story 2 - A player clicks the action bar or the sheet (Priority: P1)

Mira's player clicks **Attack**, then the goblin. Or the player taps `+5 Longsword` on the sheet.

**Why this priority**: buttons draft Intents directly. They must not route through text or a model.

**Independent Test**: a fixture with `source: "bar"` and one with `source: "sheet"` equal
`attack.basic` in every field except `source`, and both pass `IntentSchema`.

**Acceptance Scenarios**:

1. **Given** a bar-built Intent, **When** `toText` runs, **Then** the pill shows
   `/attack @goblin-2 with longsword`.
2. **Given** the pill text edited to `+adv`, **When** parsed with the bar's context, **Then** only
   `params.mode` changes.

### User Story 3 - A player drags a token on the board (Priority: P2)

Mira's player drags her token to the ledge zone. The drop drafts a move; it does not commit.

**Independent Test**: fixture `move.zone` (`source: "map"`, `commit: "draft"`) round-trips as
`/move #ledge`. Fixture `move.path` round-trips as `/move sq:4,7 sq:5,7`.

**Acceptance Scenarios**:

1. **Given** a draft from the map, **When** the gate receives it, **Then** it is refused
   `DRAFT_NOT_ACCEPTED` (N-03 behaviour; the code is reserved here).

### User Story 4 - Players talk on each channel (Priority: P1)

Players use plain text, `@Mira hello`, `/me`, `@dm`, `((…))`, `/p` and `/w`.

**Independent Test**: one fixture per speech and meta kind round-trips, and each carries the fixed
channel from the contract.

**Acceptance Scenarios**:

1. **Given** `@mira hello there`, **When** parsed, **Then** the kind is `say_to`, channel
   `to:mira`, text `hello there`.
2. **Given** `((brb, pizza))`, **When** parsed, **Then** the kind is `ooc`, channel `party`.
3. **Given** `I lean on the bar`, **When** parsed, **Then** the kind is `say`. The grammar never
   turns plain text into a deed.

### User Story 5 - The AI DM emits Intents (Priority: P1)

The AI DM voices a goblin's attack and asks for a Dexterity save.

**Independent Test**: fixtures `ai-dm.npc-attack` (actor `npc:goblin-2`, `source: "ai"`) and
`ai-dm.request-roll` (`difficulty: "medium"`) pass. A variant with `dc: 15` from `ai:dm` fails
with `MODEL_NUMBER`.

**Acceptance Scenarios**:

1. **Given** an `ai:dm` `apply_damage` with `amount.kind = "fixed"`, **When** validated, **Then**
   it fails `MODEL_NUMBER`.
2. **Given** the same Intent from the human DM seat, **When** validated, **Then** it passes.

### User Story 6 - The human DM uses the console (Priority: P2)

The human DM types `/as @mara "You'll not pass."`, `/damage @thorin 7 slashing` and
`/rule req-12 accept dc=14`.

**Independent Test**: each line parses to the DM control fixture with `actor: dm` or `npc:mara`,
and `toText` returns the same canonical text.

### Edge Cases

- Text that starts with a sigil but means speech: `/say @home is where the heart is` parses as `say`.
  `toText` adds `/say ` whenever a body would otherwise misparse.
- A quoted weapon name with a space: `/attack @goblin-2 with "light crossbow"`.
- A body with `))` inside: `((he said "))" twice))` closes at the last `))`.
- Unclosed `((` or quote: `PARSE_UNCLOSED`.
- An empty `/w` recipient list: `PARSE_MISSING_ARGUMENT`.
- A nested `ready` inside `ready`, or `predeclare` inside `predeclare`: `INTENT_SCHEMA`.
- A 4001-character body: `INTENT_SCHEMA`.
- A kind the engine cannot serve yet (for example `dodge`): the schema accepts it. The planner
  refuses `KIND_UNSERVED` until the engine card lands. The contract does not wait on the engine.

## Requirements *(mandatory)*

### Functional Requirements

**Package**

- **FR-001**: Create `packages/intent`, published in the workspace as `@the-stacks/intent`.
- **FR-002**: The package's only runtime dependency is `zod`. It imports no app, no other workspace
  package, no `node:*` module and no clock.
- **FR-003**: Boundary lint forbids imports from `apps/**`, `@the-stacks/server`, `@the-stacks/web`,
  `@the-stacks/dnd5e-engine`, `@the-stacks/session-model` and `node:*` into `packages/intent/src`.
  A fixture per rule proves each rule fires.
- **FR-004**: The package exports the names in contract §11 and nothing else from its root.

**Schema**

- **FR-005**: `IntentSchema` validates the envelope in contract §2. It is a discriminated union on `kind`.
- **FR-006**: Every kind in contract §6 has a strict params schema, a target arity rule, a channel
  rule and a text rule.
- **FR-007**: `KIND_RULES` records, per kind: group, allowed seats, fixed channel, target arity,
  mutates, resolved-by and engine status. Tests read it; it is data, not prose.
- **FR-008**: Engine enums are copied by value. A test with a dev-only engine import fails on drift.
- **FR-009**: The schema refuses a model-chosen number from `ai:dm` with `MODEL_NUMBER` (contract §6.12).
- **FR-010**: The schema does not check seats, turns, reach or presence. Those are gate and planner
  checks. The package only reserves their refusal codes.

**Text form**

- **FR-011**: `toText` emits the canonical form in contract §8.2 for every valid Intent.
- **FR-012**: `parse` accepts canonical forms and aliases. It returns a typed refusal on failure
  and never throws.
- **FR-013**: `parse(toText(i), ctxOf(i))` deep-equals `IntentSchema.parse(i)` for every fixture.
- **FR-014**: `parse` and `toText` are pure. Name lookup goes only through the optional `ctx.resolve`.
- **FR-015**: Plain text parses to `say`. An unknown `/verb` is refused, never sent as speech.

**Commit states**

- **FR-016**: `Commit` is `draft`, `declared` or `confirmed`, with the transitions in contract §7.
  This package defines the values. The gate (N-03) enforces the transitions.

**Versioning and freeze**

- **FR-017**: Export `INTENT_SCHEMA_VERSION = 1` and `INTENT_SCHEMA_MINOR = 0`.
- **FR-018**: Record the CP-4 freeze as a Backlog decision that pins this contract file at its commit.
- **FR-019**: The package README carries the versioning rule from contract §10 and a CHANGELOG.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent drives every capability with the same 57 kinds. The AI DM
  and AI companions use the same schema and the same text form as humans.
- **CR-002** (II. One Intent vocabulary): Every kind has a text form, and `parse(toText(i))` round-trips.
  Free text is `say` until `interpret` (N-04) returns Intents; it is never a separate write path.
- **CR-003** (III/V. One state): Speech, party and whisper content carry a channel the server filters
  per viewer. The contract adds no client-side state.
- **CR-004** (VI. Engine owns the numbers): An `ai:dm` Intent carries no model-chosen number. Players
  never send a number the engine rolls; `roll` answers name a request id only.
- **CR-007** (IX. UX quality bar): Every Intent has a short text form for keyboard and screen-reader
  use. Parsing is pure and synchronous, so a slash command reaches the gate with no model call.
- CR-005, CR-006, CR-008, CR-009: not applicable. The package renders no narration, creates no codex
  content, cites no library text and ships no rulebook content.

### Key Entities

- **Intent**: the envelope in contract §2.
- **Kind**: one of 57 names, each with a params schema and a text form.
- **ActorRef, Channel, TargetRef**: the unions in contract §3 to §5.
- **ParseContext, ParseResult**: the inputs and outputs of `parse`.

## Success Criteria *(mandatory)*

- **SC-001**: 57 of 57 kinds have a params schema and at least one valid fixture.
- **SC-002**: Every fixture round-trips through `toText` then `parse`.
- **SC-003**: A property test round-trips 1000 generated Intents per kind with zero failures.
- **SC-004**: `parse` returns in under 1 ms p95 for a 200-character line on CI hardware.
- **SC-005**: The boundary check flags every new `packages/intent` fixture.
- **SC-006**: The decision record exists and names `INTENT_SCHEMA_VERSION = 1`.

## Open questions for the freeze

Each question has a recommendation. The operator rules them at CP-4.

1. **Q1 — `/help` collides.** The SRD Help action wants `/help`. Spec 091 FR-014 uses `/help` for the
   composer's inline help block. **Recommend:** `/help` is the Help action. The composer help block
   moves to `/?` (and the `?` key on an empty composer). Spec 091 is amended.
2. **Q2 — `ooc` and `party` share a channel.** Both reach players and the DM and never NPCs.
   **Recommend:** keep two kinds on one channel. `ooc` renders as "Table talk" (out of character);
   `party` renders as "Party" (in character, hidden from NPCs). The narrator sees neither.
3. **Q3 — DM numbers from the AI.** Constitution VI forbids model numbers. **Recommend:** the schema
   refuses `MODEL_NUMBER` on `ai:dm` literal DCs and fixed amounts. The AI DM uses difficulty tiers
   and stat-entry dice. A human DM may write numbers.
4. **Q4 — Gap kinds in v1.** 14 kinds have no engine path yet. **Recommend:** freeze them in v1 anyway.
   The planner refuses `KIND_UNSERVED` until each card lands. Adding them later as a minor bump is
   also legal, but freezing now lets surface lanes draw every button once.
5. **Q5 — `delay` is not in SRD 5.2.1.** **Recommend:** keep the kind, marked house rule. The planner
   refuses `KIND_UNSERVED` unless the table enables delay. Drop it only if the operator wants the
   vocabulary SRD-pure.
6. **Q6 — Target sigils.** `@` for actors, `&` entities, `$` items, `#` zones. **Recommend:** adopt
   them. Composer autocomplete hides the sigils behind names, so players rarely type them.
7. **Q7 — Version on the envelope.** **Recommend:** no version field on the Intent. The carrier (gate
   frame, stored event) records it, as `payloadVersion` does today.
8. **Q8 — `use_object` verb.** SRD 5.2.1 names the action Utilize. **Recommend:** canonical `/utilize`,
   alias `/use-object`. Keep `/use` for items (`use_item`).
9. **Q9 — Seat checks in the schema.** **Recommend:** the schema checks shape only. The gate checks
   seats with `KIND_RULES`, so one table drives both the gate and the composer's filtered action bar.

## Assumptions

- Spec 066 (TASK-0199) and spec 091 (TASK-0247) are not merged. Their amendments follow this freeze
  (plan "Downstream amendments").
- The engine's Zod enums are stable enough to copy by value; the drift test catches changes.
- No Intent is stored in the event log until N-03. This package therefore needs no upcaster yet.
