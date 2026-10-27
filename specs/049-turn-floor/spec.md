# Feature Specification: Turn-mode floor passing between players

**Feature Branch**: `task-0050-turn-floor`

**Spec dir**: `specs/049-turn-floor`

**Created**: 2026-10-27

**Status**: Ruled. The operator accepted every recommended default on 2026-10-27 (see
"Operator rulings" below), including the frozen-contract amendments to specs 029, 031 and 044
and the one jobs migration. `plan.md` and `tasks.md` follow from these rulings.

**Input**: Board card TASK-0050. "In turn mode, the floor passes between human players in
initiative order. Only the active player commits for their turn. Everyone else talks and
suggests." Scope addition from TASK-0049 ruling Q5 (operator, 2026-10-27): the AI DM's
override of a stalled party sign-off.

**Board task**: TASK-0050 (milestone m-3; depends on TASK-0048; merges after TASK-0049 per
runbook lane A5).

**Grounding**: `docs/wiki/proposal-gate.md`, `docs/wiki/session-model.md`,
`docs/wiki/play-route.md`, `docs/wiki/presence.md`, `docs/wiki/dm-turn-jobs.md`;
decision-0016 (D8, the turn-mode and "Always" rows of the commit-authority table),
decision-0024 (D16, presence; the reserved `floor` marker purpose and "the Director must not
wait on an absent player"), decision-0025 (D17, code gates over tracked actors);
`specs/044-group-signoff/` (`signoffState`, `PlanContext.present`, the quorum, ruling Q5);
`specs/045-encounter-end-resolves/` (the six resolve groups); `specs/046-downed-hero-gate/`
(settling downed combatants at turn advance); `specs/047-suggest-no-approve/` (`policy` on
the proposal view); `specs/048-scene-presence/` (PR #73, merged; in this branch's base at `5cc34fb`). Frozen: `specs/029-proposal-gate/contracts/`,
`specs/030-play-route/contracts/proposal-seam.md`, `specs/031-dm-runtime/contracts/`.
Code read at `46872a1`: `packages/session-model/src/gate/{authority,permissions,plan,refusals}.ts`,
`src/events/table-mode.ts`, `apps/server/src/dm/nodes/{resolve,settle}.ts`,
`apps/server/src/dm/{jobs,worker}.ts`, `apps/server/src/schema/jobs.ts`,
`apps/web/app/play/{view-model,authority}.ts`, `components/{mode-badge,table-header,action-card}.tsx`.

**Clarify step**: `speckit-clarify` was not run. The open choices were one-way doors on frozen
contracts and a UI interaction model, so they went to the operator as rulings (below), as
spec 044 did.

## Background

### What already exists

Most of turn mode already works for one human. This feature closes the gaps that several
humans expose.

| Need | Already present | Where |
|---|---|---|
| Turn ownership | `table-mode.changed` with `{ mode: "turn", activeActor, activeCharacterId }` | `events/table-mode.ts` |
| Only the active player commits | `commitAuthority`: in turn mode a character action commits only for `activeActor` (and `activeCharacterId`), authority `active-player` | `gate/authority.ts` |
| Comments from everyone | `action.comment` is permitted to any party member and the DM; the action card has a comment form | `gate/permissions.ts`, `action-card.tsx` |
| Floor passes after an action | resolve's turn-advance group runs `turn.advance`, settles downed combatants (spec 046), and writes the `table-mode` row for the next actor (`activeActorFor`) | `dm/nodes/resolve.ts`, `settle.ts` |
| Floor to an AI | resolve's `nextJob` queues an `npc-turn` turn for `ai:dm`, or a companion `turn` job | `resolve.ts`, `worker.ts` |
| Whose turn | `ModeBadge`: "Turn mode · Ana's turn" or "Your turn" | `mode-badge.tsx`, `view-model.ts` |
| DM commits anything | `commitAuthority` returns `dm` for the seated human DM and `ai:dm` | `gate/authority.ts` |
| A reserved marker | `presence.recorded` purpose `floor` is catalogued and reserved for this task | `events/presence.ts`, decision-0024 §4 |
| Present set | `PresenceReader.presentUsers`; `PlanContext.present` in the planner | `apps/server/src/presence/`, spec 044 FT-2 |

### The gap

1. **A human cannot end a turn without acting.** A turn ends only when the active character's
   committed action resolves. A player who wants to pass, or has finished, has no control.
2. **The DM cannot pass or reclaim the floor cleanly.** A seated human DM could send a
   `mechanics` `turn.advance` and then a `table-mode` row by hand. That takes two requests, is
   not atomic, skips settling, and has no UI. The AI DM has no trigger at all.
3. **The Director never waits on a human, and never stops waiting.** When the floor sits with
   an absent human, the table stalls (decision-0024: "TASK-0050 adds its first wait on a
   human"). `AssembleOutput.presence.absent` is computed but unused ("TASK-0050 decides how").
4. **A stalled party sign-off stalls forever under an AI DM** (TASK-0049 ruling Q5). The AI DM
   can commit (spec 044 FR-008), but nothing decides when.
5. **A double advance is possible.** If the turn is ended while a turn job is resolving the
   active character's action, resolve advances again. Resolve does not check that the turn it
   froze at assemble is still the current turn.
6. **The view is thin for several humans.** The badge names the active actor. It shows no
   initiative order, no "you are next", and no transcript line when the floor moves. A
   non-active player's own action card reads "Waiting for <active> to commit", which is wrong:
   it commits on the owner's own turn.

### Relation to spec 048 (TASK-0141, merged in PR #73)

Spec 048 is about **scene presence** (a character is `present`, `yielded` or `absent` in the
fiction). This spec is about **connection presence** (decision-0024: is the human at the
table). They are different facts; spec 048 says so in its terms. This feature does not read
scene presence and does not need `initiative.leave`.

049 has **no functional dependency** on 048. It has a **textual dependency**: both change the
turn-advance group of `apps/server/src/dm/nodes/resolve.ts`. 048 FR-016 makes resolve skip its
own `turn.advance` when the active combatant left the order. This spec's FR-012 makes resolve
skip it when the turn moved since assemble. Both are "the turn already moved" guards.
**Sequencing (ruling Q6 A)**: `plan.md` is written against `main` after PR #73 merged, so the
two guards become one rule ("the turn moved since assemble") in `resolve.ts`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Only the active player commits; the others suggest (Priority: P1)

Combat is on. The order is Ana (human), Bram (human), Pip (AI companion), then a goblin. It
is Ana's turn. Ana declares "I swing at the goblin" and Bram comments "Shove it into the pit
instead". Ana commits. Bram declares his own action ahead of his turn. His commit is refused
until his turn comes; his card says it commits on his turn.

**Why this priority**: Card AC #1 and #2. It is decision-0016's turn-mode row, now with
several humans.

**Independent Test**: Pure tests over a two-human turn-mode projection: Ana commits with
`active-player`; Bram's commit on his own declared action is refused `COMMIT_NOT_ALLOWED`;
Bram's comment on Ana's action lands. A component test asserts Bram's card shows the
"commits on your turn" line and no commit control.

**Acceptance Scenarios**:

1. **Given** turn mode with Ana active, **When** Ana commits her character action, **Then** it
   commits with authority `active-player`.
2. **Given** turn mode with Ana active, **When** Bram commits a character action of his own,
   **Then** the gate refuses `COMMIT_NOT_ALLOWED` and writes nothing.
3. **Given** Ana's open action, **When** Bram comments with text, **Then** every viewer sees
   the comment on Ana's card, labelled as a suggestion.
4. **Given** Bram declared ahead of his turn, **When** the floor reaches Bram, **Then** his
   open action shows a commit control and commits with `active-player`.

---

### User Story 2 - Ending a turn passes the floor in initiative order (Priority: P1)

Ana decides to hold back. She presses End turn. The floor passes to Bram at once, and
everyone sees "Bram's turn". Bram commits an attack; when it resolves, the floor passes to
Pip, the AI companion, who acts. Then the goblin acts, and the floor returns to Ana for
round 2.

**Why this priority**: Card AC #3 and #6. Without an explicit end, a human cannot pass.

**Independent Test**: A database test on the task's own stack with two human seats and one
AI companion, through the gate and the DM worker on the fake gateway. It plays one full
round: one handoff by End turn, one by commit and resolve, one companion turn, one monster
turn. The log's `table-mode.changed` rows name Ana, Bram, Pip, `ai:dm`, then Ana, and the
encounter round becomes 2.

**Acceptance Scenarios**:

1. **Given** Ana is active, **When** Ana ends her turn, **Then** one atomic batch advances the
   engine turn and sets the table mode to Bram, and nothing else changes.
2. **Given** Bram is active, **When** Bram's committed action resolves, **Then** the floor
   passes to the next actor (existing behaviour, now covered with two humans).
3. **Given** the next actor is an AI companion or a monster, **When** the floor reaches it,
   **Then** the matching AI job is queued (companion `turn` job, or `npc-turn` turn job).
4. **Given** the next combatant is downed, **When** the floor passes, **Then** it settles as
   spec 046 settles it (death save or pass) before the table mode names who acts.
5. **Given** Bram is not active, **When** Bram sends End turn, **Then** the gate refuses and
   writes nothing.
6. **Given** a turn job is resolving Ana's committed action, **When** Ana also ends her turn,
   **Then** the turn advances exactly once.

---

### User Story 3 - The DM passes or reclaims the floor at any time (Priority: P1)

Bram has stepped away mid-turn. The seated human DM presses Pass, and the floor moves to Pip.
Later the DM presses Take floor to describe a cave-in; no player can commit a character
action while the DM holds the floor. The DM presses Return floor, and the turn that was
interrupted resumes with the same combatant.

**Why this priority**: Card AC #5, decision-0016's "Always" row.

**Independent Test**: Two human seats and a seated human DM. Pass moves the floor to the
next actor. Take floor sets the table mode to the DM; a player's commit is refused. Return
floor restores the encounter's active combatant; the engine round and turn index are
unchanged across take and return.

**Acceptance Scenarios**:

1. **Given** any turn, **When** the seated DM passes, **Then** the floor moves to the next
   actor in order in one atomic batch, with settling.
2. **Given** any turn, **When** the seated DM takes the floor, **Then** the table mode names
   the DM, no player commits a character action, and the engine's encounter is unchanged.
3. **Given** the DM holds the floor, **When** the DM returns it, **Then** the table mode names
   the actor of the encounter's active combatant again.
4. **Given** a player, **When** they send Pass, Take floor or Return floor, **Then** the gate
   refuses and writes nothing.

---

### User Story 4 - The AI DM does not wait forever (Priority: P2)

With the AI in the DM seat, Bram's connection drops during his turn. After the grace window
and a short wait, the AI DM passes his turn; the log records who was present when it decided.
Separately, the party has an open party action "We long rest". Ana and Bram are present;
Bram never answers. After the stall window the AI DM commits it. If Bram had objected, the AI
DM would not commit it.

**Why this priority**: decision-0024 ("the Director must not wait on an absent player") and
TASK-0049 ruling Q5. The table runs without a human DM only if stalls end.

**Independent Test**: Database tests with injected clocks and an injected presence reader.
An absent active human is passed after the wait, with a `floor` marker in the batch. A silent
present quorum member's party action is committed by `ai:dm` after the stall window, with a
`signoff` marker. An objection blocks the AI DM's override.

**Acceptance Scenarios**:

1. **Given** an AI seat and the floor on an absent human, **When** the absence wait passes and
   the human has not returned, **Then** `ai:dm` passes the floor and the batch holds a
   `presence.recorded` row with purpose `floor` and the present set it read.
2. **Given** the human returns before the wait passes, **When** the wait ends, **Then** nothing
   is written.
3. **Given** a present active human, **When** any time passes, **Then** the AI DM does not
   pass their turn (ruling Q4 A).
4. **Given** an AI seat and an open party action whose present quorum is unmet with no
   objection, **When** the stall window passes with no stance change, **Then** `ai:dm` commits
   it with authority `dm` and the batch holds a `signoff` marker.
5. **Given** a quorum member's latest stance is `object`, **When** the stall window passes,
   **Then** the AI DM does not commit (ruling Q5 A).
6. **Given** a human DM seat, **When** any stall occurs, **Then** the AI DM overrides nothing.

---

### User Story 5 - Every viewer sees whose turn it is (Priority: P2)

Every viewer, player or DM, sees the badge ("Bram's turn" or "Your turn"), the initiative
order with the active entry marked and the next entry flagged, and a transcript line each
time the floor moves ("Bram's turn", "The DM has the floor"). The active player sees End
turn; the DM sees Pass, Take floor and Return floor. No modal opens.

**Why this priority**: Card AC #4. The gate works without it, but players cannot follow the
handoff.

**Independent Test**: The operator-only fixture route renders a new `turn-floor` fixture.
Component tests assert the badge text for an active and a non-active viewer, the order strip,
the transcript line, and that End turn sends the floor request.

**Acceptance Scenarios**:

1. **Given** turn mode, **When** any viewer opens the table, **Then** they see whose turn it
   is and the initiative order.
2. **Given** the floor moves, **When** the row arrives, **Then** every viewer's transcript
   shows one line naming the new holder.
3. **Given** the viewer is the active player, **When** they press End turn, **Then** the client
   sends the floor request; no confirmation dialog opens.
4. **Given** free mode, **When** the table renders, **Then** no order strip and no floor
   controls appear.

### Edge Cases

- **One player controls two characters.** Each character has its own turn. `activeCharacterId`
  names which; End turn ends that character's turn only.
- **The active player is also the seated DM.** The DM path wins for commits (authority `dm`).
  End turn and Pass both pass their own turn.
- **The active player commits, then presses End turn before resolve finishes.** The turn
  advances once (FR-012). The committed action still resolves in the next beat; nothing is
  cancelled (decision-0016, "nothing is cancelled").
- **A declared but uncommitted action when the turn ends.** It stays open. It may commit on
  its owner's next turn, or be withdrawn.
- **Party-scope actions in turn mode.** Unaffected: party scope ignores the active actor
  (decision-0016, spec 044). The stall override (US 4) applies in any mode.
- **The DM holds the floor and a turn job runs.** Resolve does not advance a turn the DM holds
  (FR-012 and the existing `done` check). Return floor restores the order.
- **The encounter ends while the DM holds the floor.** The closing moves set free mode as
  today; the held floor ends with turn mode.
- **The floor reaches an absent human whose character is downed.** Settling runs first; a
  downed character's turn passes without waiting on presence.
- **An absent human returns after the AI DM passed.** Their next turn comes in order. Nothing
  is replayed.
- **Every human is absent.** The AI DM passes each human turn after the wait. Companions and
  monsters still act. Q4 bounds the loop: at most one pass per human turn.
- **A burst of floor requests.** The gate's `expectedLastSeq` guard serialises them. A request
  that names a turn that already moved is refused (FR-005).
- **Scene-absent combatants (spec 048).** If 048 merges first, a combatant that left the order
  is never reached by a pass. This spec adds no scene-presence rule.

## Requirements *(mandatory)*

### Functional Requirements

**Commit authority in turn mode (AC #1)**

- **FR-001** (AC #1): In turn mode, a character-scope action MUST commit only when the committer
  is the active actor for that character (`active-player`), or the DM (`dm`). This is the
  existing rule in `commitAuthority`; it MUST NOT change, and it MUST be covered with two
  human players.
- **FR-002** (AC #1): While the DM holds the floor (FR-008), no player MUST be able to commit a
  character-scope action. This follows from FR-001, because the active actor is the DM.

**Comments and suggestions (AC #2)**

- **FR-003** (AC #2): Any party member MUST be able to comment on the active player's open
  action, with text, in turn mode (existing permission). The play route MUST label a
  non-active player's comment input on the active player's card as a suggestion (ruling Q2 A:
  no new stance).
- **FR-004** (AC #2): A non-active player's own open character action MUST show that it
  commits on its owner's turn, not "Waiting for <active> to commit".

**Ending a turn (AC #3)**

- **FR-005** (AC #3): The active actor MUST be able to end their own turn with one gate request
  (ruling FT-1 A: proposal kind `floor`). The gate MUST refuse it from any other non-DM proposer, refuse it outside turn mode or
  without an active encounter, and refuse it when the request names a turn that is no longer
  current (ruling FT-2: `TURN_MOVED`). A refusal writes nothing.
- **FR-006** (AC #3): Ending a turn MUST plan one atomic batch: the engine's `turn.advance`,
  then settling of any downed combatants the turn reaches (spec 046 rules), then one
  `table-mode.changed` row naming the actor of the new active combatant. The next actor is
  chosen by the same pure rule resolve uses (`activeActorFor`), in one place.
- **FR-007** (AC #3): When the new active actor is `ai:dm` or an AI companion, the matching job
  MUST be queued: an `npc-turn` turn job, or a companion `turn` job (ruling FT-3). A floor that lands
  on a human queues nothing, except the absence check (FR-013).

**DM pass and reclaim (AC #5)**

- **FR-008** (AC #5): The seated human DM MUST be able, at any time in turn mode, to pass the
  floor (the same batch as FR-006, for whoever holds the turn), to take the floor (a
  `table-mode` row naming the DM, with `activeCharacterId` null; the engine encounter
  unchanged), and to return it (a `table-mode` row naming the actor of the encounter's active
  combatant). Players MUST be refused all three.
- **FR-009** (AC #5): `ai:dm` MUST be able to pass the floor through the same request, only
  for an active human who is absent from the present set (Q4). `ai:dm` MUST NOT take or return
  the floor (ruling Q3 A).
- **FR-010** (AC #5): With a human DM seat, `ai:dm` floor requests MUST route by policy like
  every other AI DM kind (ruling FT-2: default `ask`); with an AI seat they are `auto`.

**Turn integrity**

- **FR-011**: A floor batch MUST pass the gate's `expectedLastSeq` guard, like every write.
- **FR-012**: Resolve's turn-advance group MUST advance only when the encounter's active
  combatant and round still equal those frozen at assemble, and the table mode is not held by
  the DM. A turn already moved (by End turn, Pass, or spec 048's order leave) MUST NOT advance
  again.

**The AI DM's waits (decision-0024; TASK-0049 Q5)**

- **FR-013**: With an AI seat, when the floor sits with a human who is absent, the AI DM MUST
  pass the floor once the human has been absent for the absence wait (ruling Q4 A: 30 s after
  the 5 s grace window), unless they return first. The decision MUST be code, not a model call.
- **FR-014**: The AI DM's floor pass under FR-013 MUST append a `presence.recorded` row with
  purpose `floor` and the present set it read, in the same batch as the pass (decision-0024 §4
  and §5). A pass by a human, or by `ai:dm` for any other reason, writes no `floor` marker.
- **FR-015**: With an AI seat, when an open party-scope action has an unmet quorum, no quorum
  member's latest stance is `object`, and no stance on it has changed for the stall window
  (ruling Q5 A: 120 s), the AI DM MUST commit it through `gate.submit` as `ai:dm` (authority
  `dm`). The decision MUST be code, not a model call.
- **FR-016**: The commit under FR-015 MUST append a `presence.recorded` row with purpose
  `signoff`, the `actionId` and the present set it read, in the commit batch (ruling FT-5). The commit proposal carries `override: "stall"`. Other `dm`
  commits stay unchanged and write no marker (spec 044 FR-008).
- **FR-017**: With a human seat, the AI DM MUST NOT pass the floor or commit a party action on
  its own (FR-013, FR-015 do not apply). The human DM decides.
- **FR-018**: The waits MUST be durable across a server restart: a pending wait is a queued job
  or is re-armed by reconcile (ruling FT-3 A: a `floor` job kind). Each wait re-reads the projection and presence when it
  fires and writes nothing when the stall has ended.

**The view (AC #4)**

- **FR-019** (AC #4): Every viewer MUST see whose turn it is: the badge (existing), an
  initiative order strip with the active entry marked and the next entry flagged, and "DM has
  the floor" while the DM holds it.
- **FR-020** (AC #4): Every `table-mode.changed` row in turn mode MUST add one transcript line
  for every viewer naming the new holder. The line is derived in the view model; no new event.
- **FR-021** (AC #3, #5): The active player MUST see an End turn control; the DM MUST see Pass,
  Take floor and Return floor controls (ruling Q1 A: inline in the header). The UI MUST NOT use a modal or a
  confirmation dialog. Controls live inline in the table header.
- **FR-022**: The order strip and controls MUST be derived by pure functions from the
  projection, testable without a browser.

**Tests (AC #6)**

- **FR-023** (AC #6): Pure tests MUST cover FR-001 to FR-012 over projections with two humans
  and one AI companion. A new session-model fixture `turn-floor` (two humans, one companion,
  one monster; End turn, commit and resolve, DM take and return, an AI DM absence pass) MUST
  feed the replay check and the play route's fixture route (ruling FT-4).
- **FR-024** (AC #6): A database integration test on the task's own stack MUST play one full
  round with two human seats and one AI companion through the gate and the DM worker on the
  fake gateway (runbook merge condition for TASK-0050). It MUST include one End turn handoff,
  one commit-and-resolve handoff, one companion turn and one monster turn.
- **FR-025** (Q5 scope): Database tests MUST cover FR-013 to FR-017 with injected clocks and an
  injected presence reader.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST be able to end a turn, pass, take and return
  the floor through the same gate request a human sends. The AI DM's waits submit through
  `gate.submit` as `ai:dm`.
- **CR-002** (IV. Event-sourced play, server authority): The floor MUST be a projection of the
  log: `table-mode.changed` rows and the engine's encounter events. Every input to an AI DM
  wait decision MUST be in the log after the fact (the `floor` or `signoff` marker for the
  present set; stance rows for the stall). The server decides; the client's controls are a
  display. A refusal appends nothing.
- **CR-003** (VI. 5e engine boundary): The turn order MUST change only through engine commands
  (`turn.advance`, the spec 046 settling commands). Death saves are engine rolls. No model
  decides a pass or an override.

### Key Entities

- **Floor**: who may commit a character action now. In turn mode, the table mode's
  `activeActor` and `activeCharacterId`.
- **Turn**: the encounter's active combatant and round, held by the engine.
- **Floor request**: a gate request to end a turn, pass, take or return the floor (FT-1).
- **Held floor**: a turn-mode table mode whose active actor is the DM while the encounter's
  active combatant is unchanged.
- **Absence wait**: the time the AI DM waits on an absent active human before passing.
- **Stall window**: the time without stance change after which the AI DM commits an unmet,
  unopposed party action.
- **Floor marker**: `presence.recorded` with purpose `floor`, in the batch of an AI DM pass.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a round with two humans and one AI companion, the floor visits every actor
  once in initiative order and returns to the first, in 100% of test runs.
- **SC-002**: 0 character-scope commits by a non-active player succeed in turn mode.
- **SC-003**: The active player ends a turn in one action; the DM passes, takes or returns the
  floor in one action.
- **SC-004**: 0 double advances: across every test, each turn ends exactly once.
- **SC-005**: Under an AI seat, an absent active human never holds the floor longer than the
  absence wait plus the grace window plus one job poll.
- **SC-006**: Every AI DM pass and override has its present set in the same batch, and the
  replay check reproduces each decision from the log.
- **SC-007**: A player can tell from the header alone whose turn it is and who is next.

## Assumptions

- The present set comes from TASK-0051's `PresenceReader` (one server process; TASK-0136 holds
  the revisit).
- A committed action still ends the turn when it resolves, as today. End turn is a second way,
  not a replacement.
- Bonus actions, reactions and readied actions are out of scope. The floor is one turn per
  combatant. Lending the floor to one actor out of order was option Q3-C and was not chosen.
- No new event type is needed: a floor change is a `table-mode.changed` row plus engine
  events, and the marker purpose `floor` is already catalogued (decision-0024).
- The stall and absence waits are fixed constants with injectable overrides, as the companion
  react window is (spec 036). A per-session setting is not in scope.

## AC mapping

| Card AC | Requirements | Stories |
|---|---|---|
| #1 Only the active player commits | FR-001, FR-002 | US 1 |
| #2 Others comment and suggest | FR-003, FR-004 | US 1 |
| #3 End turn passes in initiative order, human or AI | FR-005, FR-006, FR-007, FR-011, FR-012 | US 2 |
| #4 Every viewer sees whose turn it is | FR-019, FR-020, FR-021, FR-022 | US 5 |
| #5 DM passes or reclaims at any time | FR-008, FR-009, FR-010, FR-021 | US 3 |
| #6 Tests with two humans and one AI companion | FR-023, FR-024, FR-025 | US 2 |
| TASK-0049 Q5 AI DM override of a stalled sign-off | FR-015, FR-016, FR-017, FR-018, FR-025 | US 4 |
| decision-0024 "no wait on an absent player" (inherited) | FR-013, FR-014, FR-017, FR-018 | US 4 |

## Operator rulings (2026-10-27)

Recorded on TASK-0050 (card at `c3c86da`). The operator's words: "TASK-0050: I accept the
recommended defaults FT-1 to FT-5 and Q1 to Q6, including the frozen-contract amendments to
029, 031 and 044 and the one jobs migration." Every item settles on its recommended default:

| Item | Ruling |
|---|---|
| FT-1 | A: new proposal kind `floor` `{ op: end \| take \| return, turn: { round, combatantId }, reason }`, planned atomically (`turn.advance`, settling, `table-mode.changed`). Settling becomes one pure rule shared with resolve. After spec 048 the counts are: proposal kinds 14 to 15, DM kinds 12 to 13, `GATE_REQUEST_KINDS` 18 to 19. |
| FT-2 | `end` for the active actor or the DM; `take`/`return` for the seated human DM; policy `ask` under a human seat, `auto` under an AI seat; new refusal codes `FLOOR_NOT_HELD`, `TURN_MOVED`, `NOT_TURN_MODE`. |
| FT-3 | A: a code-only `floor` job kind (`check: absence \| stall`, `notBefore`), serialised per session with `turn` and `companion`, re-armed by reconcile; one migration. |
| FT-4 | A `turn-floor` fixture row in 029 `fixtures.md`; the replay check covers AI DM overrides. |
| FT-5 | An `ai:dm` `action.commit` with `override: "stall"` plans `[presence.recorded(signoff), action.committed(dm)]`; amends spec 044's gate-api text. |
| Q1 | A: inline header controls and a turn-order strip; no confirmation, no modal. |
| Q2 | A: no new stance; a comment labelled as a suggestion. |
| Q3 | A: the AI DM passes only; it never takes or returns the floor. |
| Q4 | A: the AI DM passes only an absent human, 30 s after the 5 s grace. If the idle-present case shows up in play, the orchestrator cards a revisit (decision-0020). |
| Q5 | A: 120 s with no stance change, quorum unmet, no objection: `ai:dm` commits; an objection blocks it. |
| Q6 | A: `plan.md` is written after PR #73 merged. |

No ruling conflicts with what PR #73 landed. 048 adds the `scene-presence` kind (hence the
counts above) and a "left the order" skip in resolve's turn advance, which `plan.md` folds into
this spec's FR-012 guard.

The sections below keep the options as they were put to the operator.

## Open Questions (as put to the operator; all ruled above)

### FT-1 — A new proposal kind for the floor (`specs/029-proposal-gate/contracts/proposals.md`)

Ending a turn and passing or reclaiming the floor need one request the gate plans atomically.

| Option | Change | Implications |
|---|---|---|
| **A (recommended)** | New proposal kind `floor`: `{ kind: "floor", op: "end" \| "take" \| "return", turn: { round, combatantId }, reason }`. `end` by the active actor ends their turn; `end` by the DM is Pass. `take` and `return` are DM only. The gate plans `end` as engine `turn.advance` + settling + `table-mode.changed`. `DmProposalKindSchema` gains `floor`. `GATE_REQUEST_KINDS` grows from 17 to 18. | One kind, one planner path, atomic. The `send` frame shape is unchanged (its `eventType` names the kind). Settling moves into the pure planner, shared with resolve (plan item). |
| B | No new kind. A player ends a turn by declaring and committing an "End turn" action, and the DM composes `mechanics` `turn.advance` plus a `table-mode` row from the client. | No contract change. Every end costs a model turn; the DM path is two requests, not atomic, and skips settling. Not recommended. |
| C | New kind `floor`, but the gate only appends a request marker; the DM worker runs a `turn` job (new trigger `floor`) that runs only the turn-advance group. | Settling stays in resolve unchanged. Needs a new event type for the enqueuer and a 031 trigger; adds a job-poll of latency to every handoff. |

### FT-2 — Policy, permission and refusal codes (`policy-and-authority.md`, `gate-api.md`)

- **Recommended**: `floor` permission: `end` for the active actor (human or companion) and the
  DM; `take`/`return` for the seated human DM (and `ai:dm` only under Q3-B). Default policy
  `ask` (human seat), `auto` under an AI seat, like `table-mode`. New refusal codes
  `FLOOR_NOT_HELD` (end by a non-active proposer), `TURN_MOVED` (the request's `turn` is
  stale), `NOT_TURN_MODE` (no turn mode or no active encounter; or reuse the engine's
  `NO_ACTIVE_ENCOUNTER`). Amend the rows table with the `floor` batch.
- Alternative: reuse `COMMIT_NOT_ALLOWED` and `CONFLICT` for the refusals. No code-list change,
  but the client cannot tell "not your turn" from "someone else just moved it".

### FT-3 — The AI DM's waits as jobs (`specs/031-dm-runtime/contracts/turn-jobs.md`)

The absence wait and the stall window need a durable timer. The `jobs` table has a
`jobs_kind_valid` CHECK, so a new kind needs a migration.

| Option | Change | Implications |
|---|---|---|
| **A (recommended)** | New job kind `floor` (code only, no model call), payload `{ v: 1, sessionId, check: "absence" \| "stall", actionId?, notBefore }`, one queued per session per check, serialised with `turn`/`companion` per session. Queued by the enqueuer when the floor lands on a human, when a party action opens with two or more humans, and on each stance change (moves `notBefore`); and by the presence tracker when an active human goes absent past grace. Reconcile re-arms. One migration (the CHECK and a partial unique index). The enqueuer also queues the FR-007 follow-up jobs on a `floor` batch. | Durable, testable with injected clocks, no model cost. Amends turn-jobs.md (kinds table, enqueue table, reconcile). |
| B | A `turn` job with a new trigger `stall`, which short-circuits before the Director. | No new kind or migration, but a turn job holds the per-session turn slot and `jobs_turn_queued_key` allows one queued turn, so a stall check could block or merge with a real beat. |
| C | In-memory timers in the server process (like the presence tracker). | Simplest. A restart loses the wait until reconcile re-arms it; reconcile still needs the 031 amendment. |

### FT-4 — The fixture and the replay check (`specs/029-proposal-gate/contracts/fixtures.md`)

- **Recommended**: add a `turn-floor` fixture row (two humans, one companion, one monster: End
  turn, commit and resolve, DM take and return, an AI DM absence pass with its `floor` marker,
  an AI DM stall override with its `signoff` marker). The replay check for an `ai:dm` `dm`
  commit with a `signoff` marker in its batch also checks the stall rule against that marker's
  present set.
- Alternative: no new fixture; test from ad-hoc streams. Rejected by the author: the play
  route's fixture route needs one for AC #4.

### FT-5 — A `signoff` marker on the AI DM's stall override (spec 044 amendment of `gate-api.md`)

Spec 044 says a `dm` commit writes no marker. The stall override reads presence, so
decision-0024 §5 requires a marker.

- **Recommended**: an `ai:dm` `action.commit` carrying `override: "stall"` plans `[presence.recorded
  (signoff), action.committed (dm)]`, with `present` from `PlanContext`. Every other `dm` commit
  is unchanged. The field is optional and additive on the `action.commit` proposal.
- Alternative: the stall job calls `gate.recordPresence({ purpose: "signoff", actionId })`
  first, then commits. No proposal change, but two batches: the marker and the commit are not
  atomic, unlike spec 044's group commits.

### Q1 — Where the floor controls live (UI interaction model)

No modals; slide-out panels or inline controls only.

| Option | Answer | Implications |
|---|---|---|
| **A (recommended)** | Inline in the table header beside the mode badge: End turn for the active player; Pass, Take floor, Return floor for the DM. An initiative order strip sits under the header in turn mode (names in order, active marked, next flagged, "you" marked). No confirmation. | Always visible; one click; works at phone width by wrapping. |
| B | Floor controls and the order inside a "Turn order" slide-out panel opened from the badge. | Less header clutter; one extra click per handoff. |
| C | End turn in the composer row; DM controls in the DM approvals slide-out. | Close to where the player types; DM controls hidden behind a panel. |

### Q2 — Suggestions (AC #2)

- **A (recommended)**: no new stance. A suggestion is an `action.comment` with stance `comment`
  and text. The play route labels the input "Suggest an alternative" for a non-active player on
  the active player's card in turn mode.
- B: a new stance `suggest` on `action.commented`. Amends frozen spec 028's event schema for a
  label. Not recommended.

### Q3 — Does the AI DM take and return the floor? (AC #5)

- **A (recommended)**: no. The AI DM passes only. It narrates without holding the floor; an
  `ai:dm` active actor already means "a monster's turn" to resolve, so a held floor under the AI
  DM would read as an NPC turn.
- B: yes, with a distinct held-floor flag on the table mode. Amends spec 028's `TableModeSchema`.
- C: A, plus a DM "lend the floor" op (`floor` op `lend`, target actor) for readied actions and
  reactions out of order. Larger scope; card it if play shows the need.

### Q4 — When does the AI DM pass a human's turn?

- **A (recommended)**: only when the active human is absent (past the 5 s grace) for 30 s more.
  A present human is never passed by the AI DM.
- B: A, plus a long idle timeout (for example 5 min) for a present human. Covers an idle but
  connected player; risks passing a player who is thinking.
- C: never automatic; only a human DM or the player ends the turn. Leaves the absent-player
  stall that decision-0024 forbids.

If A is chosen and the idle-present case shows up in play, the orchestrator cards a revisit
(decision-0020).

### Q5 — When does the AI DM override a stalled sign-off? (TASK-0049 Q5)

- **A (recommended)**: after 120 s with no stance change, when the present quorum is unmet and
  no quorum member objects: silence counts as consent, and `ai:dm` commits. An objection is a
  table disagreement; the AI DM does not settle it by fiat. The declarer can withdraw, players
  can change stance, and a human DM can commit over it.
- B: the same window, and the AI DM also commits over an objection (decision-0016's "Always"
  row taken literally).
- C: the AI DM never commits; it only narrates a nudge. Leaves the stall Q5 asked to end.

### Q6 — Sequencing with spec 048 (PR #73)

- **A (recommended)**: author `plan.md` after PR #73 merges, so FR-012's guard and 048's
  skip-advance guard become one rule in `resolve.ts`.
- B: plan now against `main`, and add a reconcile task for `resolve.ts` and `settle.ts` when #73
  merges.

**Migrations**: one under FT-3 A (the jobs kind CHECK and a partial unique index); none under
B or C. **New runtime dependencies**: none.
