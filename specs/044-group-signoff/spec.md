# Feature Specification: Group sign-off for party-scope actions

**Feature Branch**: `task-0049-group-signoff`

**Created**: 2026-10-27

**Status**: Ruled — the operator accepted every recommended default on 2026-10-27 (see
"Operator rulings" below). `plan.md` and `tasks.md` follow from these rulings. The frozen
contract amendments FT-1 to FT-4 land in this task's PR.

**Input**: Board card TASK-0049. "A party-scope action (for example 'we take the left
tunnel' or 'we long rest') commits only after the party signs off, in any table mode. Each
player approves or objects. The DM may commit or override at any time."

**Board task**: TASK-0049 (milestone m-3; depends on TASK-0048; consumes TASK-0051's
present-player set).

**Grounding**: `docs/wiki/proposal-gate.md`, `docs/wiki/play-route.md`,
`docs/wiki/session-model.md`, `docs/wiki/presence.md`; decision-0015 (the proposal gate),
decision-0016 (commit-authority table, party-scope row), decision-0024 (D16, presence);
`specs/029-proposal-gate/contracts/` (FROZEN: `policy-and-authority.md`, `gate-api.md`,
`proposals.md`, `fixtures.md`); `specs/030-play-route/contracts/proposal-seam.md` (FROZEN);
`specs/035-presence/`. Code read at `origin/main` adb4527:
`packages/session-model/src/gate/authority.ts`, `src/events/actions.ts`,
`src/projections/actions.ts`, `apps/web/app/play/components/{composer,action-card}.tsx`.

**Clarify step**: `speckit-clarify` was not run. The ambiguities were not questions for the
spec author; they were one-way doors on frozen contracts, so they went to the operator as
rulings (below).

## Background

### What already exists

The building blocks for sign-off are already in the log and the client. Nothing in this
feature needs a new event type or a new WebSocket frame.

| Need | Already present | Where |
|---|---|---|
| Scope of an action | `action.declared` carries `scope: "character" \| "party"`; the composer has a scope radio | `events/actions.ts`, `composer.tsx` |
| Approve / object | `action.commented` carries `stance: "comment" \| "approve" \| "object"`; the action card has Approve and Object buttons | `events/actions.ts`, `action-card.tsx` |
| Per-actor stance history | The `actions` projection keeps every comment with `actor`, `stance`, `seq` | `projections/actions.ts` |
| A group commit | `action.committed` carries `authority: "group"` | `events/actions.ts` |
| A refusal for the multi-human case | `commitAuthority` refuses `GROUP_SIGNOFF_REQUIRED` when the party has more than one human | `gate/authority.ts` |
| Who is present | `PresenceReader.presentUsers(sessionId)`; the gate holds the reader | `apps/server/src/presence/` |
| A logged present set | `presence.recorded` v1 with `purpose: "signoff"` and `actionId` is catalogued and reserved for this task | `events/presence.ts`, decision-0024 §4 |
| DM authority | `commitAuthority` returns `dm` for the seated human DM and for `ai:dm` before any scope check | `gate/authority.ts` |
| DM override by withdrawal | `action.withdraw` is permitted to the seated human DM | `proposals.md` (TASK-0114 amendment) |

### The gap

1. **No quorum.** With two or more human players in the party, no player can ever commit a
   party-scope action: `commitAuthority` always refuses `GROUP_SIGNOFF_REQUIRED`. The frozen
   contract defers the rule to this task in these words: "TASK-0049 defines the quorum."
2. **No presence in the decision.** `commitAuthority` is pure over projections. The present
   set is connection state, not a projection, so the rule cannot read it today.
3. **No sign-off view.** The action card lists comments in log order. It does not say which
   players still owe an answer, and it shows no commit path for a multi-human party action.
4. **Objections are advisory.** `policy-and-authority.md` step 4 says "Objections recorded as
   `object` comments are advisory in M2." With several humans an objection must hold the
   action open.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The party agrees, and the action commits (Priority: P1)

Ana, Bram and Cleo each control a party character and are all at the table. Ana declares a
party-scope action, "We take the left tunnel". Bram approves. Cleo approves. The action
commits with group authority and the DM's turn starts. The log records who was present when
the commit was decided.

**Why this priority**: This is the card's outcome (AC #2). Without it a party of two or more
humans can never commit a party action except through the DM.

**Independent Test**: A database test with two human seats on the task's own stack. Player
one declares a party action, player two approves, and the log ends with an
`action.committed` row of authority `group` and a `presence.recorded` row of purpose
`signoff` naming both players, in one batch.

**Acceptance Scenarios**:

1. **Given** a party of two present human players and an open party-scope action declared by
   player one, **When** player two approves, **Then** the action commits with authority
   `group` and the commit batch holds a `signoff` marker naming both players.
2. **Given** a party of three present human players, **When** only one of the two
   non-declarers has approved, **Then** the action stays open and nothing commits.
3. **Given** a party of three human players where one is absent, **When** both present
   players have signed off, **Then** the action commits; the absent player is not counted.
4. **Given** a committed party action, **When** the log is replayed, **Then** the pure
   commit-authority rule, fed the present set from the commit batch's `signoff` marker,
   returns `group`.

---

### User Story 2 - A player objects, and the table sees it (Priority: P1)

Bram does not want the left tunnel. He objects with the reason "We have no light." Everyone
at the table sees the objection on the action card. The action does not commit while his
latest stance is an objection. If Bram later approves, the objection no longer holds.

**Why this priority**: AC #3. Sign-off without a visible veto is a vote nobody can lose.

**Independent Test**: Two human seats. Player one declares, player two objects, then player
one tries to commit. The commit is refused with `GROUP_SIGNOFF_REQUIRED`, the refusal names
player two as objecting, and every subscriber received the public `action.commented` row
with stance `object`.

**Acceptance Scenarios**:

1. **Given** an open party action, **When** a present party player objects, **Then** every
   viewer's projection shows that player's stance as `object` with its text.
2. **Given** a player whose latest stance is `object`, **When** any party player tries to
   commit, **Then** the gate refuses `GROUP_SIGNOFF_REQUIRED` and writes nothing.
3. **Given** a player who objected and then approved, **When** the remaining present players
   have approved, **Then** the action commits.
4. **Given** an open party action, **When** an AI companion objects, **Then** the objection
   is shown but does not block the commit (companions are advisory; `proposals.md`).

---

### User Story 3 - The DM commits or overrides at any time (Priority: P1)

The table has argued about the tunnel for ten minutes. The DM (a seated human, or the AI DM
when no human holds the seat) commits the action over Bram's objection, or withdraws it. The
sign-off state does not constrain the DM.

**Why this priority**: AC #4. decision-0016's "Always" row: the DM may commit or override.

**Independent Test**: Two human seats plus a seated human DM. Player two objects. The DM
commits; the action commits with authority `dm`. In a second case the AI DM commits through
`gate.submit` as `ai:dm`, also `dm`. In a third case the seated DM withdraws the action.

**Acceptance Scenarios**:

1. **Given** an open party action with an outstanding objection, **When** the seated human DM
   commits it, **Then** it commits with authority `dm` and no `signoff` marker is written.
2. **Given** an AI seat, **When** `ai:dm` submits `action.commit` for an open party action
   with no approvals, **Then** it commits with authority `dm`.
3. **Given** an open party action, **When** the seated human DM withdraws it, **Then** it
   moves to `withdrawn` and no approval can commit it afterwards.

---

### User Story 4 - The play route shows who has signed off (Priority: P2)

On each open party-scope action card, a player sees one row per present party player: the
name, and "approved", "objects" or "waiting". The viewer's own row carries Approve and Object
controls. The DM sees the same rows plus the existing commit control. No modal opens; the
rows sit inside the card.

**Why this priority**: AC #5. The gate works without it, but players cannot tell why their
action has not committed.

**Independent Test**: The operator-only fixture route renders a new `group-signoff` fixture
with two players, one approved and one waiting. Component tests assert the rows and that
Approve sends an `action.comment` request with stance `approve`.

**Acceptance Scenarios**:

1. **Given** an open party action and two present players, one approved, **When** either
   player views the card, **Then** it shows one "approved" row and one "waiting" row.
2. **Given** the viewer is a present party player, **When** they press Approve or Object,
   **Then** the client sends an `action.comment` gate request with that stance.
3. **Given** an absent party player, **When** the card renders, **Then** that player's row is
   marked absent and not counted.
4. **Given** a character-scope action, **When** the card renders, **Then** no sign-off rows
   appear and the existing commit control is unchanged.

### Edge Cases

- **A player leaves before answering.** They drop out of the quorum after the 5 s grace
  window (decision-0024 §7). Their leaving appends nothing, so nothing is re-evaluated by
  itself. The remaining players commit explicitly (Open Question Q3, option C).
- **A player joins the party after others approved.** They join the quorum. The action waits
  for them.
- **Only the declarer is present.** The quorum is the declarer alone. The action commits on
  the declarer's own explicit commit, exactly as with one human today.
- **The declarer objects to their own action.** Their latest stance is `object`; the action
  is blocked until they approve, withdraw it, or the DM acts.
- **A player approves twice.** The latest stance counts once. Duplicate approvals are harmless.
- **Concurrent final approvals.** Two players approve at once. The gate's `expectedLastSeq`
  guard serialises them: the second attempt re-reads, finds the action committed, and its
  comment is refused `ACTION_NOT_OPEN` (or, under option Q3-B, simply lands).
- **The seated human DM also controls a party character.** The DM path wins: their commit is
  `dm`. As a player they appear in the sign-off rows like anyone else.
- **An operator observer, not in the party.** Not counted, shown as observer in the presence
  strip only (decision-0024 §6).
- **Turn mode.** Party scope ignores the active actor, in any mode (decision-0016).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (AC #1): The gate MUST classify every declared action as `party` or `character`
  scope from the `scope` the declarer sets, and MUST refuse a party-scope declaration from a
  proposer who controls no party member (existing rule). The classification is the `scope`
  field of `action.declared`; a group commit also records `authority: "group"` on
  `action.committed`. See Q1.
- **FR-002** (AC #2): The quorum for a party-scope action MUST be the set of human players
  who control at least one party member and are present when the commit is decided. AI
  companions and non-party users MUST NOT count.
- **FR-003** (AC #2): A party-scope action MUST commit with authority `group` only when every
  member of the quorum has a latest stance of `approve`. The declarer's declaration counts as
  their approval unless they later object (Q2).
- **FR-004** (AC #2): A `group` commit MUST append a `presence.recorded` row with purpose
  `signoff`, the action's `actionId`, and the present set the decision read, in the same
  batch as the `action.committed` row (decision-0024 §4 and Consequences).
- **FR-005** (AC #2): The commit MUST happen when the approval that completes the quorum
  lands, and a present party player MUST also be able to commit explicitly once the quorum is
  met (Q3, recommended option C).
- **FR-006** (AC #3): Any party player MUST be able to object to an open party-scope action.
  The objection MUST be a public `action.commented` row with stance `object` and optional
  text. While any quorum member's latest stance is `object`, a non-DM commit MUST refuse
  `GROUP_SIGNOFF_REQUIRED`.
- **FR-007** (AC #3): A `GROUP_SIGNOFF_REQUIRED` refusal MUST name, in `details`, the quorum
  members still waiting and those objecting, so the client can show why.
- **FR-008** (AC #4): The seated human DM and `ai:dm` MUST be able to commit an open
  party-scope action at any time, whatever the sign-off state, with authority `dm`. The
  seated human DM MUST be able to withdraw it (existing rule). A `dm` commit writes no
  `signoff` marker.
- **FR-009** (AC #5): The play route MUST show, on every open party-scope action card, one
  row per party player with their sign-off state (`approved`, `objects`, `waiting`, or
  `absent`), and Approve and Object controls on the viewer's own row. The rows MUST be
  derived by one pure function from the projection and the live present set.
- **FR-010** (AC #5): The UI MUST NOT use a modal. Sign-off rows live inside the action card.
- **FR-011** (AC #6): Gate tests MUST cover approval, objection and DM override with at least
  two human players: pure unit tests over projections, and a database integration test with
  two human seats through `createGate` on the task's own stack (runbook merge condition).
- **FR-012**: Every input to the sign-off decision MUST be readable from the log after the
  fact: stances from `action.commented` rows, the present set from the `signoff` marker in
  the commit batch (Constitution IV; the SC-006 replay check, Q FT-3).
- **FR-013**: Character-scope commit authority (turn mode, free mode) MUST NOT change.
- **FR-014**: The single-human case MUST NOT change behaviour: one human player in the party
  still commits a party action with authority `group` on an explicit commit, and an approval
  in a one-human party never auto-commits.
- **FR-015**: The human who commits, or whose approval completes the quorum, MUST count as
  present, whatever the presence reader says: acting at the table is presence. The
  `signoff` marker MUST record the reader's present set plus that human, sorted and unique.
- **FR-016**: An explicit commit by a quorum member MUST count as that member's approval.
- **FR-017**: Auto-commit MUST fire only on an `approve` from a party human, in a party with
  more than one human, when the quorum is met after that approval. A companion's comment,
  a `comment` stance and an `object` stance never commit.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST be able to approve, object and commit
  through the same gate requests a human sends (`action.comment`, `action.commit`). AI
  companions use the same comment request; their stances are advisory.
- **CR-002** (IV. Event-sourced play): Sign-off state MUST be a projection of the log plus
  the logged present set. No sign-off state lives only in server memory. A refusal appends
  nothing.
- **CR-003** (IV. Server authority): The server MUST decide the quorum. The client's rows
  are a display; the gate re-derives and enforces.
- **CR-004** (VI. 5e engine boundary): Not applicable to the decision itself; a committed
  party action reaches mechanics only through the DM pipeline, unchanged.

### Key Entities

- **Party-scope action**: an `action.declared` with `scope: "party"`, open while `declared`
  or `discussed`.
- **Stance**: a party player's latest `action.commented` stance on an action (`approve`,
  `object`; `comment` does not change it).
- **Quorum**: the present human players who control a party member, at decision time.
- **Sign-off marker**: the `presence.recorded` row with purpose `signoff` and the action id,
  written in the commit batch.
- **Sign-off row**: the client's per-player view: name, state, and controls for the viewer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With two present human players, a party action commits on the second player's
  approval with no further step, in 100% of test runs.
- **SC-002**: With any present quorum member objecting, 0 non-DM commits succeed.
- **SC-003**: The DM commits a party action in one action, whatever the sign-off state.
- **SC-004**: Every `group` commit with more than one human in the party has a `signoff`
  marker in its batch, and the replay check reproduces `group` for every such commit in every
  fixture.
- **SC-005**: A player can tell from the action card alone who has not yet answered.

## Assumptions

- The present set comes from TASK-0051's `PresenceReader` (merged, decision-0024). One server
  process (TASK-0136 carries the revisit).
- Sign-off reuses the proposal gate (decision-0015). It is a policy, not a new mechanism: no
  new event type, no new gate request kind, no new WebSocket frame.
- The AI DM's *capability* to commit is in scope (FR-008). When the Director *chooses* to
  override a stalled sign-off is out of scope: it folds into TASK-0050 (ruling Q5).

## Overlap with siblings

- **TASK-0099** (spec 043, in flight): touches `apps/server/src/ws/gateway.ts`,
  `session/events.ts` and 029's `ws-delivery.md` / `write-boundary.md`. This feature touches
  none of them. Shared ground: the `proposal-gate` wiki note (both review it) and the
  `apps/server/src/gate/` hotspot (this feature edits `gate.ts`; 0099 edits the gate's
  import-graph test helper only). Expect one reconcile merge on the wiki note.
- **TASK-0100, TASK-0050** follow in `gate/`, `packages/session-model/src/gate/` and
  `apps/web/app/play/`. The planner context added under FT-2 (a present set handed to the
  planner) is the seam TASK-0050's `floor` purpose will reuse; its shape should be ruled once.

## Operator rulings (2026-10-27)

Recorded on TASK-0049. The operator's words: "I accept the defaults on the TASK-0099 and
TASK-0049 cards, including the frozen-contract amendments to spec 029 and spec 006." Every
question below settles on its recommended default:

| Item | Ruling |
|---|---|
| FT-1 | A: `commitAuthority` takes an optional present set; step 4 of `policy-and-authority.md` is rewritten. |
| FT-2 | A: `planProposal` takes an optional context `{ present? }`; the `gate-api.md` rows table and §3 step 2 are amended. |
| FT-3 | The SC-006 replay check reads `present` from the `signoff` marker; `fixtures.md` gains a `group-signoff` fixture row. |
| FT-4 | `GROUP_SIGNOFF_REQUIRED` carries `details: { waiting, objecting }`. |
| Q1 | A: the declarer sets `scope`; the gate checks party membership; the DM fixes a wrong scope by withdrawing. |
| Q2 | A: declaring counts as the declarer's approval. |
| Q3 | C: auto-commit on the completing approval, plus an explicit commit once the quorum is met. |
| Q4 | The additive sign-off props on the action card are confirmed. |
| Q5 | Out of scope here. The AI DM's policy for overriding a stalled sign-off folds into TASK-0050 (the orchestrator notes it on TASK-0050's card). |

The sections below keep the options as they were put to the operator.

## Open Questions (as put to the operator; all ruled above)

Items marked **FT** change frozen contract text. Items marked **Q** are design choices; each
has a recommended default. No new event type and no ws-protocol frame change is needed under
any recommended option.

### FT-1 — Commit authority gains the quorum (`policy-and-authority.md` step 4)

Today step 4 says "*humans* has more than one member → `GROUP_SIGNOFF_REQUIRED`. TASK-0049
defines the quorum." That sentence, and "Objections … are advisory in M2", become false.

| Option | Change | Implications |
|---|---|---|
| **A (recommended)** | `commitAuthority(p, committer, actionId, present?)`: an optional present set. With more than one human, return `group` when every present party human's latest stance is `approve` (declarer implicit, Q2), else `GROUP_SIGNOFF_REQUIRED`. Without `present`, today's behaviour. Rewrite step 4 and the objections sentence. | One rule, still pure, used by gate, client and replay check alike. Signature change is additive. |
| B | Leave `commitAuthority` untouched. Add a pure `signoffStatus(p, actionId, present)`; the gate consults it when `commitAuthority` returns `GROUP_SIGNOFF_REQUIRED`. | `commitAuthority`'s text stays true, but the gate's commit path no longer matches `gate-api.md`'s "`commitAuthority`" check column, and there are two rules for one decision. |

### FT-2 — The planner and its rows (`gate-api.md` §1 and §3)

The rows table says `action.comment` plans "one `action.commented`" and `action.commit` plans
"one `action.committed`". A `group` commit now plans `[presence.recorded(signoff),
action.committed]`, and (under Q3 A or C) an approval that completes the quorum plans
`[action.commented, presence.recorded(signoff), action.committed]`. The planner is pure and
has no present set today.

| Option | Change | Implications |
|---|---|---|
| **A (recommended)** | `planProposal` gains an optional context argument `{ present?: readonly string[] }`. The server gate fills it from `PresenceReader.presentUsers` at plan time. Amend the two rows in the table and §3's algorithm step 2. | Planner stays pure and total; TASK-0050's `floor` reuses the same context. |
| B | The server gate post-processes the planner's rows, appending the marker and commit itself. | Planner untouched, but the gate grows decision logic outside the pure core, against spec 029's split. |

### FT-3 — The SC-006 replay check (`policy-and-authority.md`, `fixtures.md` check 4)

"For every `action.committed` event in every fixture, `commitAuthority` … returns `ok: true`
and the event's recorded authority." A multi-human `group` commit fails that check unless the
check feeds the present set.

- **Recommended**: amend the check: for a `group` commit, pass the `present` of the
  `signoff` marker in the same batch. Add a `group-signoff` fixture (two players: declare,
  object, approve, commit; plus a DM override) as a new row in `fixtures.md`.
- Alternative: keep multi-human commits out of the session-model fixtures. Rejected by the
  author: the play route's fixture route needs one for AC #5, and the replay check would no
  longer cover the case it exists for.

### FT-4 — Refusal details (`gate-api.md` §2)

`GateRefusal.details` exists but no code fills it for `GROUP_SIGNOFF_REQUIRED`. FR-007 adds
`details: { waiting: string[], objecting: string[] }`. Additive; recommended as written.
Confirm it is acceptable without a code-list change.

### Q1 — How an action is classified (AC #1)

decision-0016 names party scope but not who decides it.

| Option | Answer | Implications |
|---|---|---|
| **A (recommended)** | The declarer chooses `scope` at declaration (the existing field and composer radio); the gate validates party membership. The seated DM corrects a wrong scope by withdrawing the action. | No contract change. Recorded on `action.declared` today. |
| B | The gate infers scope from the text (a model call). | A model decides who may commit: against Constitution IV's typed-proposal rule and decision-0015. Not recommended. |
| C | A plus a DM rescope request writing a new `action.rescoped` event. | New event type and gate request kind: a one-way door. Cardable later if play shows a need. |

### Q2 — Does the declarer count as approving?

- **A (recommended)**: yes. Declaring is an implicit `approve`; a later `object` from the
  declarer overrides it. Two players: one approval commits.
- B: no. The declarer also presses Approve. One extra click per action, and a lone declarer's
  action never auto-commits.

### Q3 — What triggers the commit?

| Option | Answer | Implications |
|---|---|---|
| A | Auto only: the approval that completes the quorum commits. | Stalls when the last holdout leaves the table: nothing re-triggers. |
| B | Explicit only: once the quorum is met, any present party player presses Commit. | `action.comment` rows stay one row; one extra step every time. |
| **C (recommended)** | Both: auto on the completing approval, and explicit commit once the quorum is met. | Covers the absent-holdout case. Both paths plan through the same rule. |

### Q4 — Play-route component props (`proposal-seam.md`, "What the gated phase must not change")

That clause binds 030's gated phase. This feature adds a sign-off field to the action card's
view model and props. **Recommended**: treat it as additive and outside that clause; record
it in this spec. Confirm.

### Q5 — When does the AI DM override a stalled sign-off?

FR-008 gives the AI DM the capability. Nothing in the DM runtime decides to use it.
**Recommended**: TASK-0050 (floor passing; the Director's first wait on a human) owns the
Director's policy for stalled sign-off; add it to TASK-0050's card. If the operator prefers a
separate card, the orchestrator creates it (decision-0020).
