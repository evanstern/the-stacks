# Feature Specification: Two-player alpha kit

**Feature Branch**: `task-0163-two-player-alpha-kit`

**Created**: 2026-10-28

**Status**: Ready for planning — open questions Q1-Q6 resolved 2026-10-28

**Input**: Board task TASK-0163, "Two-player alpha kit: two human seats, player sign-up,
scene-start runbook". Outcome: the operator and one other developer play one scene together
on hosted dev (vm-104) as a bug-tolerant alpha, with an AI DM. This kit also serves TASK-0053
(the M3 demo), which seats several humans at one table.

## What exists today (survey of `origin/main` at cc5e39b)

**Seed.** `apps/server/seeds/greyhollow-ford.json` is the only shipped seed. It seats one
human (`tamsin`) and two AI companions (`odo`, `kestrel`). The seed loader's cross-check
(`crossCheckSeed` in `apps/server/src/dm/seed/load.ts`) refuses any seed whose human count is
not exactly one, and `apps/server/test/dm/seed.test.ts` asserts that refusal. Scene start
itself already handles several humans: `POST /dm/sessions/:sessionId/start` requires a user id
for every human character and refuses extras, and the resolve node's scene-start opening
(`apps/server/src/dm/nodes/resolve.ts`) writes one `party` row per character with a `player`
controller per seat. The playtest harness (`apps/server/src/playtest/scenario.ts`) requires the
scenario seat to be the seed's single human, and about thirty test files and fixtures load
greyhollow-ford.

**Sign-up.** The server issues and redeems invitations. The routes mount under `/auth`:
`POST /auth/invitations` (operator only, optional `{ expiresInDays }`, returns the raw token
once with `expiresAt`, default expiry 7 days) and `POST /auth/invitations/redeem`
(`{ token, username, displayName, password }`). Redeem creates a `player` account, is
single-use under concurrency, and sets the session cookie, so a redeemed player is signed in.
The web app has no surface for either call. The root loader (`apps/web/app/root.tsx`) renders
the sign-in card for every route while signed out, so a signed-out route cannot be reached at
all. The only other account path is `dist/cli/create-operator.js`, which makes an operator and
refuses once an operator exists.

**Runbook.** `docs/ops/dev-vm-104.md` covers deploy, the first operator, rollback, backup,
restore, inspect, secrets, exposure and destroy. It does not cover invitations, sessions or
scene start. A session is created by the Table page (`/play`, "Start a new table" mints a
random UUID and opens `/play/<uuid>`); no server call creates it. A scene starts only through
the operator API `POST /dm/sessions/:sessionId/start` with `{ seedId, seats }`, where `seats`
maps each human character id to a user id. No UI calls it. No operator surface lists user ids:
a user sees only their own id (`GET /auth/me`), and the presence frame carries the
`{ userId, displayName }` of every human connected to a table.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A seed seats two humans (Priority: P1)

The operator picks a shipped scene that has at least two human seats. Each seat goes to a
different person. The AI DM runs the rest of the party and the world.

**Why this priority**: without it no table can seat two humans, so every other story is moot.

**Independent Test**: load the seed through the seed loader and start a scene with two seated
user ids on a local stack; the party shows two player-controlled characters.

**Acceptance Scenarios**:

1. **Given** the two-human seed, **When** the seed loader loads it, **Then** it loads with no
   issues and reports two human characters.
2. **Given** a session with no scene, **When** the operator starts the two-human seed with a
   user id for each human seat, **Then** the party lists both characters as player-controlled
   by those two users.
3. **Given** the two-human seed, **When** the start request omits one human seat, **Then** the
   start is refused naming the missing seat (existing behaviour, kept).
4. **Given** greyhollow-ford, **When** it loads, **Then** it still loads and its playtest
   scenarios still pass (no regression).

### User Story 2 - A second person signs up from an invitation (Priority: P1)

The operator issues an invitation and hands the token to the other developer out of band. The
developer opens the web app, chooses to redeem an invitation, enters the token, a username, a
display name and a password, and lands signed in as a player.

**Why this priority**: the second human needs an account before any seat can be filled.

**Independent Test**: on a local stack, issue an invitation as the operator, redeem it in the
web app while signed out, and confirm the new account is a signed-in player.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor with a valid token, **When** they submit the redeem form,
   **Then** a player account exists and the visitor is signed in.
2. **Given** an unknown, expired or already-redeemed token, **When** the visitor submits,
   **Then** one undifferentiated message appears inline and no account is created.
3. **Given** a taken username, **When** the visitor submits, **Then** an inline message says
   the username is taken, and the token stays unredeemed.
4. **Given** any state of the flow, **Then** no modal opens (slide-out panels or inline forms
   only).

### User Story 3 - The operator starts a two-human scene on hosted dev (Priority: P2)

The operator follows `docs/ops/dev-vm-104.md` to issue an invitation, create a session and
start a scene with a seat per human.

**Why this priority**: the runbook turns the parts into a repeatable session; it depends on
stories 1 and 2.

**Independent Test**: a reader follows the runbook section on a local stack end to end and
reaches a started scene with two human seats.

**Acceptance Scenarios**:

1. **Given** the runbook, **When** the operator follows it, **Then** every step names the exact
   action or command and its expected result.
2. **Given** both humans at the table, **When** the operator starts the scene, **Then** each
   human sees their own character as theirs and the AI DM narrates the opening.

### User Story 4 - The alpha run is recorded (Priority: P3)

The operator and one other developer run the runbook once on hosted dev with two accounts. The
result (commit, session id, what worked, every bug found) is recorded on TASK-0163.

**Independent Test**: the card carries a dated result note naming the deployed commit and the
session id.

**Acceptance Scenarios**:

1. **Given** the kit merged and deployed, **When** the run ends, **Then** the card records the
   result and each bug found is carded or named as an open question.

### Edge Cases

- A human seat's user leaves the table before scene start: the start still succeeds; floor
  passing (TASK-0050) handles an absent human afterward.
- The same user is put in both seats: the start request must refuse it (new rule, see Q2).
- A signed-in user opens the redeem surface: it is not shown to signed-in users.
- The invitation token is pasted with whitespace: it is trimmed before submit.
- The token must never travel in a URL query string, so a server log never records it.

## Requirements *(mandatory)*

### Functional Requirements

| FR | Requirement | Card AC |
|----|-------------|---------|
| FR-001 | The repo MUST ship a seed with at least two human seats that loads through `loadSeed`. | #1 |
| FR-002 | The seed loader MUST accept a seed with more than one human seat and still refuse a seed with none. | #1 |
| FR-003 | A test MUST load the multi-human seed and assert its human seats; a test MUST start a scene on it with two user ids and assert two player-controlled party rows. | #1 |
| FR-004 | A scene-start request MUST refuse one user id in two seats. | #1 |
| FR-005 | Greyhollow-ford, its playtest scenarios and its fixtures MUST keep passing unchanged. | #1 |
| FR-006 | A signed-out visitor MUST be able to redeem an operator-issued invitation in the web app, ending as a signed-in `player`. | #2 |
| FR-007 | The redeem surface MUST show the existing undifferentiated invalid-token message and the username-taken message inline. | #2 |
| FR-008 | The redeem surface MUST use no modal; the no-dialog test MUST stay green. | #2 |
| FR-009 | A test MUST cover the redeem surface (render while signed out, success, both failures). | #2 |
| FR-010 | The operator MUST have a documented way to issue an invitation on hosted dev without putting a password or token on a command line or in a URL. | #3 |
| FR-011 | The operator MUST have a documented way to learn each seated human's user id and start a scene with a seat per human. | #3 |
| FR-012 | `docs/ops/dev-vm-104.md` MUST gain a section that covers issuing an invitation, redeeming it, creating a session, and starting a scene with a seat per human, in procedural prose. | #3 |
| FR-013 | The runbook MUST be run once on hosted dev with two accounts, after the operator's go on the exact commands, and the result MUST be recorded on TASK-0163. | #4 |

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): every new capability MUST be reachable through the HTTP API
  a human's browser also uses. Redeem is `POST /auth/invitations/redeem`; issue is
  `POST /auth/invitations`; start is `POST /dm/sessions/:sessionId/start`. Any new web surface
  is a thin caller of those routes, so an agent drives the same interface.
- **CR-002** (II. Content contract): the new seed's characters MUST carry identity, portrayal
  and hooks, complete enough to play from alone, and pass the existing seed schema.
- **CR-004** (VI. 5e engine boundary): the new seed's numbers MUST come from the engine and SRD
  ids the loader cross-checks; no model computes a number.
- **CR-005** (VIII. Operator-owned content): the new seed MUST be original or SRD-derived, like
  greyhollow-ford, under the same license block.

### Key Entities

- **Scene seed**: a JSON scene. Each character has `seat: "human" | "companion"`. A human seat
  needs a user id at scene start.
- **Invitation**: a single-use, expiring bearer token issued by the operator. Redeeming it
  creates a `player` account.
- **Seat map**: the start request's `seats`, human character id to user id.

## Success Criteria *(mandatory)*

- **SC-001**: two people, each on their own account, control two different characters in one
  scene on hosted dev.
- **SC-002**: a second person goes from holding a token to signed in as a player in under two
  minutes, with no operator shell access.
- **SC-003**: the operator goes from a deployed dev to a started two-human scene by following
  the runbook alone, with no step that needs reading source code.
- **SC-004**: no existing seed, playtest or test regresses.

## Assumptions

- The invitation contract stays as it is: single-use, 7-day default expiry, redeem creates a
  `player` and signs them in. These are settled by `specs/005-session-auth/contracts/http-auth.md` and
  are not reopened here.
- Only the operator starts a scene (existing `requireOperator` on the start route).
- The operator plays one of the human seats with the operator account. A seated operator gets a
  player viewer on `/play` (TASK-0118), so this needs no change.
- Scene-start resolve already writes one player controller per human seat; the plan phase
  verifies that DM prompts, the actor snapshot, sign-off and floor passing behave with two
  humans, and cards any defect it finds rather than widening this task.
- TASK-0158 (`DM_FAKE_SCRIPT`, PR #78) may be named in the runbook as the scripted local
  rehearsal path; this task depends on none of its code.

## Open questions

Each question changes a seed or wire contract, an auth rule, or behaviour a player or operator
sees. Each has a recommended default.

**Resolved 2026-10-28: all six defaults accepted.** The operator ruled in the M3 sweep chat,
recorded on TASK-0163 (commit 5e42d55). Verbatim, cut at 300 characters by the relay:

> "TASK-0163: I accept the recommended defaults Q1 to Q6, including the greyhollow-ford-duo
> seed, the at-least-one-human seed rule, the inline redeem toggle on the sign-in card, the
> Settings invite section, the Start scene slide-out with the new GET /dm/seeds route, and the
> two of us playing AC #4 on d"

The cut falls inside Q6. The orchestrator reads it as all six defaults accepted. Each question
below carries its resolution.

### Q1. Which seed seats the humans, and which characters are human?

- **A.** Add a new seed `greyhollow-ford-duo.json`: a copy of greyhollow-ford with `tamsin`
  and `kestrel` human and `odo` an AI companion. Greyhollow-ford and its ~30 tests, fixtures
  and playtest scenarios stay untouched.
- **B.** Change greyhollow-ford itself to two human seats. This breaks the playtest scenario
  rule (one human), the M2 demo fixtures and every test that starts it with one seat.
- **C.** A new seed with three human seats and no companion, aimed at TASK-0053.
- **Default: A.** It is additive, keeps the M2 record reproducible, and keeps one AI companion
  so the alpha exercises mixed human and AI play. TASK-0053 can add a third seat later or reuse
  the rule from Q2 with its own seed.
- **Resolved 2026-10-28:** A (operator ruling above).

### Q2. What human-seat rule does the seed loader enforce?

- **A.** At least one human, no maximum; the start route keeps requiring every human seat
  filled, and gains a refusal for one user in two seats.
- **B.** Between one and a fixed maximum (for example four).
- **C.** Keep "exactly one" and add a per-seed override flag.
- **Default: A.** The cap has no current reason; the start route already enforces a full seat
  map. The duplicate-user refusal is new start-route behaviour (a wire-visible 400).
- **Resolved 2026-10-28:** A (operator ruling above).

### Q3. Where does a signed-out person redeem an invitation?

The root gate renders the sign-in card for every route while signed out.

- **A.** On the sign-in card: an inline "Have an invitation?" toggle swaps the card's form to
  the redeem form in place (token, username, display name, password). No new route, no gate
  change.
- **B.** A new `/join` route exempted from the root gate.
- **C.** B plus a shareable link that carries the token in the URL fragment (`/join#<token>`),
  which the browser never sends to the server.
- **Default: A.** It is the smallest change, adds no gate exemption, and keeps the token out of
  every URL. C is a later convenience if the operator wants a one-click link.
- **Resolved 2026-10-28:** A (operator ruling above).

### Q4. How does the operator issue an invitation on hosted dev?

- **A.** An operator-only "Invite a player" inline section on the Settings page: one button,
  optional expiry, shows the token once with a copy control.
- **B.** The runbook has the operator run a `fetch("/auth/invitations", { method: "POST" })`
  in the browser console of a signed-in tab.
- **C.** A new container CLI, `dist/cli/issue-invitation.js`, run with `docker compose exec`
  on vm-104 like `create-operator.js`.
- **Default: A.** It needs no shell on vm-104 (each vm-104 command needs the operator's go), no
  credential on a command line, and it calls the same HTTP route an agent uses. C would put a
  vm-104 command in every invitation.
- **Resolved 2026-10-28:** A (operator ruling above).

### Q5. How does the operator start a scene with a seat per human?

The start route needs each human's user id, and no operator surface lists user ids.

- **A.** An operator-only "Start scene" slide-out on `/play/:sessionId`, shown while the
  session has no scene. It offers the shipped seeds and, per human seat, a select of the humans
  currently present at the table (from the presence frame the table already receives). Needs a
  new operator route `GET /dm/seeds` returning each seed's id, title and human characters.
- **B.** Settings shows "Your account id" to every user. The player sends it to the operator,
  who runs the start call as a browser-console `fetch`.
- **C.** A container CLI `dist/cli/start-scene.js` run on vm-104, with user ids looked up by
  username.
- **Default: A.** Presence already answers "who is at this table", so no user-listing endpoint
  is needed, and the operator never handles raw ids. `GET /dm/seeds` is a new, read-only,
  operator-only wire contract and needs the operator's ruling.
- **Resolved 2026-10-28:** A (operator ruling above).

### Q6. Who runs the AC #4 alpha run, and on what DM?

The hosted dev host name carries no test-environment label, so an agent may not sign in or
enter credentials there. A real AI DM on dev spends provider money through the key in
`/home/stacks/dev/.env`.

- **A.** The operator and the other developer play in their own browsers. The orchestrator runs
  only the read-only and backup commands listed below, after the operator's go, then records
  the result the operator reports.
- **B.** As A, but dev runs the fake DM through TASK-0158's `DM_FAKE_SCRIPT` (needs a dev
  `.env` edit and a redeploy, so no provider spend).
- **Default: A**, with a provider-backed DM as the card outcome says, and the operator confirms
  the spend. The debug page's cost slide-out records the run's cost on the card.
- **Resolved 2026-10-28:** A (operator ruling above).

## AC #4 — exact hosted-dev commands (each still needs the operator's go)

Under the defaults (Q4-A, Q5-A, Q6-A) the run needs no vm-104 write beyond one named backup.
The orchestrator runs each command only after the operator's go on that exact command.

1. From a tailnet machine, confirm the deploy:
   `curl -s --max-time 60 https://vm-104.tailb3c1b6.ts.net:8443/health`.
   Expect `status` `ok` and `commit` equal to the TASK-0163 merge commit.
2. Only when step 1 shows an older commit:
   `gh workflow run deploy-dev.yml`, then `gh run watch`, then repeat step 1.
3. On vm-104, as `stacks`, from the checkout: `node scripts/deploy-dev.mjs status`.
4. On vm-104, as `stacks`, from the checkout, before play:
   `node scripts/deploy-dev.mjs backup --name pre-task-0163-alpha`.
5. The operator and the developer play in their browsers (no command): the operator issues an
   invitation, the developer redeems it, both open one `/play/<uuid>` link, the operator starts
   `greyhollow-ford-duo` with one seat each, and they play one scene.
6. After play, the operator reports the session id and the debug page's job outcomes and cost
   slide-out. The orchestrator records on TASK-0163: date, commit, session id, seed, both usernames'
   roles (not passwords), outcome, cost, and each bug found.

If Q4-C or Q5-C is chosen instead, the run adds
`docker compose -p stacks-dev -f docker-compose.yml -f deploy/dev/compose.dev.yml --env-file /home/stacks/dev/.env exec app node dist/cli/<issue-invitation|start-scene>.js`
with its arguments, each needing its own go. If Q6-B is chosen, the run adds a hand edit of
`/home/stacks/dev/.env` and a redeploy.

## Clarification

`speckit-clarify` was not run. The open questions went to the operator through the sweep
orchestrator, and the operator ruled on 2026-10-28 (see "Open questions").
