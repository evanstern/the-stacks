# Feature Specification: Three-human seed for the M3 demo

**Feature Branch**: `task-0176-trio-seed`

**Created**: 2026-10-28

**Status**: Draft. Open questions OQ-1 to OQ-6 await the operator's ruling.

**Input**: TASK-0176, "Three-human seed for the M3 demo". Outcome: a shipped seed seats three
humans (`tamsin`, `odo` and `kestrel` all human seats), so the TASK-0053 demo can run three human
players under the AI DM. Why: TASK-0053 AC #1 needs three humans with the AI DM, and no shipped
seed seats three. Operator ruling 2026-10-28 in chat, answering "How should the demo get its three
human players?": "Card a trio seed". Model it on greyhollow-ford-duo (TASK-0163, spec 054).

`speckit-clarify` was skipped. The code settles what the loader, the start route and the slide-out
already accept. The open calls are player-facing (seed name, Odo's portrayal, what the AI DM is
told, the runbook's shape) and go to the operator as OQ-1 to OQ-6.

## Background: what exists today (survey of `origin/main` at e1c2b547)

### Seeds

- `apps/server/seeds/greyhollow-ford.json` seats one human (`tamsin`); `odo` and `kestrel` are
  AI companions.
- `apps/server/seeds/greyhollow-ford-duo.json` (spec 054) is a copy with `kestrel` human: its
  `seedId` and `title` differ, `kestrel.seat` is `human`, and `kestrel.portrayal.voice` and
  `.want` read `Chosen by the player.`. Every beat, NPC, encounter, tracker and the opening are
  unchanged. No beat, encounter or opening names `odo`; only the character entries and the
  `relationships` hooks (`odo` ↔ `kestrel`, `tamsin` → `odo`) do.
- `crossCheckSeed` (`apps/server/src/dm/seed/load.ts`) requires at least one human seat, with no
  maximum (spec 054 Q2). A seed with every character human already loads: `seed.test.ts` asserts
  it on a mutated copy.
- `listSeeds()` loads every `*.json` in `apps/server/seeds/` sorted by `seedId`. Two tests pin the
  exact list: `apps/server/test/dm/seed.test.ts` ("lists the shipped seeds sorted by id") and
  `apps/server/test/dm/routes.integration.test.ts` (`GET /dm/seeds`). A third seed changes both.
- The Dockerfile copies `apps/server/seeds/` whole, so a new seed ships with no image change.

### Scene start with three humans

- `POST /dm/sessions/:sessionId/start` requires a user id for every human seat, refuses extras,
  and refuses one user in two seats (spec 054 `contracts/scene-start-seats.md`). Nothing caps the
  seat count.
- The resolve node's scene-start opening (`apps/server/src/dm/nodes/resolve.ts`) writes one
  `party` row per character: a `player` controller from `seats` for a human seat, an
  `ai-companion` controller for a companion seat. With no companion it writes three `player` rows.

### What changes when Odo stops being an AI companion

Each claim below names its code. None needs a source change for a seed with no companion.

- **Companion jobs.** A companion job is queued in three places, and each needs an
  `ai:companion:<id>` actor or a Director companion list:
  - `enqueue.ts` rule 3 (`reactTargets`) queues a `react` job only for an open action whose actor
    starts with `ai:companion:`. No such actor exists.
  - `enqueue.ts` rule 4 and resolve's `nextJob` queue a companion `turn` job only when the turn-mode
    active actor starts with `ai:companion:`. `activeActorFor` gives a `player` controller's user,
    never a companion actor, so it never fires.
  - resolve's `nextJob` queues a companion `prompt` job only from `director.companionPrompts`.
    `legalizeDirector` (`apps/server/src/dm/nodes/director.ts`) keeps only ids in
    `aiCompanionIds(projections)`, which is empty. A Director hold naming any companion is
    overridden to `resolve` with "a named companion is not an AI companion in the party".
- **AI DM prompts.** The Director prompt (`apps/server/src/dm/prompts/director.ts`) adds an
  "AI companions in the party" section from `aiCompanions`; `section()`
  (`prompts/common.ts`) drops a section with no entries, so the trio prompt has none. The actor
  snapshot's fiction view (`snapshot/render.ts`, `fictionLine`) labels each party member
  `party, human player` or `party, AI companion` from its controller, so all three read
  `human player`. The narrate prompt's rule ("The party members are player characters, AI
  companions included") is generic. The companion prompt (`prompts/companion.ts`) never runs.
- **Presence assumptions.** Group sign-off (`signoffState`, TASK-0049) and floor passing
  (TASK-0050) count present human players, with no fixed number. `duo.integration.test.ts` proves
  both for two humans; nothing proves three.
- **Playtest harness and auditor.** `loadScenario` (`apps/server/src/playtest/scenario.ts`)
  requires the scenario seat to be the seed's first human, so a harness scenario seats one human.
  The TASK-0053 demo is a live session, audited with `pnpm playtest audit --session <id>`. That
  path (`cli.ts` `cmdAudit`) exports the session, renders a public player view
  (`renderTranscript` with no viewer user id), loads the seed by its `sceneId`, and runs the
  auditor. The auditor (`auditor/prompt.ts`, `checks.ts`, `stats.ts`) is seat-agnostic: it puts
  companion talk "on trial" and counts all party combatants as `players`. With no companion, no
  talk row is a companion row. The `--auditor provider` preflight reads the default
  `greyhollow-ford` scenario for its estimate only; the trio seed does not affect it.
- **Seed tests that assume a companion.** `seed.test.ts` and `routes.integration.test.ts` pin the
  seed list (above). `duo.integration.test.ts`, `duo-views.test.ts` and
  `snapshot-fixtures.ts` (`greyhollowDuo`) name the duo seed only; a new seed leaves them
  unchanged.
- **Fake DM script.** `apps/server/dm-scripts/greyhollow-live.json` scripts scene start
  (Director with `companionPrompts: []`, narrate, audit), one `act-search` check by Tamsin, and two
  chronicle calls. It names no companion and no seed id. The spec 054 live run used it on the duo
  seed unchanged. It fits a trio scene start.

### The Start scene slide-out

`apps/web/app/play/components/start-scene-panel.tsx` (`StartSceneForm`) renders one select per
entry of `seed.humans`, with no cap, and the note `AI companions: …` only when
`seed.companions.length > 0`. `seatMapIssues` (`apps/web/app/play/start-scene.ts`) flags every
empty seat and every repeated user. The panel therefore already offers three seats for a seed
with three humans. No test proves it: `start-scene-panel.test.tsx` stubs a two-human and a
one-human seed.

### The hosted-dev runbook

`docs/ops/dev-vm-104.md` "Run a two-player table" covers one invitation, steps 14-16 name
`Greyhollow Ford (two players) (greyhollow-ford-duo)`, Tamsin and Kestrel, and the note
`AI companions: Brother Odo.`; step 19 says the table shows no chip for Brother Odo. Nothing names
a three-human seed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A shipped seed seats three humans (Priority: P1)

The operator picks a shipped scene with three human seats. Tamsin, Odo and Kestrel each go to a
different person. The AI DM runs the world and the NPCs, and no character is an AI companion.

**Why this priority**: card AC #1. TASK-0053 AC #1 cannot run without it.

**Independent Test**: load the trio seed through `loadSeed` and assert three humans and no
companion; start a scene on it with three user ids on a local stack and assert three
player-controlled party rows.

**Acceptance Scenarios**:

1. **Given** the trio seed, **When** `loadSeed` loads it, **Then** it loads with no issue, its
   humans are `tamsin`, `odo`, `kestrel` in seed order, and it has no companion.
2. **Given** a session with no scene, **When** the operator starts the trio seed with three
   distinct user ids, **Then** the start returns 202 and the party lists three `player`
   controllers for those users and no `ai-companion`.
3. **Given** the trio seed, **When** the start omits one seat or repeats one user, **Then** it is
   refused (existing rules, kept).
4. **Given** a trio scene, **When** the AI DM runs turns, **Then** no companion job is queued and
   the Director prompt has no AI-companion section.
5. **Given** all three humans present, **When** one declares a party action, **Then** it commits
   only after all three approve; with one absent, the other two approvals commit it.
6. **Given** greyhollow-ford and greyhollow-ford-duo, **When** they load, **Then** they and their
   tests are unchanged.

### User Story 2 - The Start scene slide-out offers three seats (Priority: P1)

The operator opens Start scene on a table with three humans present, chooses the trio seed, and
sees one select per character, no AI-companion note, and Start disabled until three different
humans are chosen.

**Why this priority**: card AC #2. It is how the demo starts the scene.

**Independent Test**: render `StartSceneForm` with the trio summary and three present users;
assert three seat selects, no `AI companions` note, and the Start state for empty, repeated and
full maps.

**Acceptance Scenarios**:

1. **Given** the trio seed chosen, **When** the form renders, **Then** it shows selects for
   Tamsin Vale, Brother Odo and Kestrel, each listing the present humans.
2. **Given** the trio seed, **Then** no `AI companions:` note shows.
3. **Given** two seats filled, or one user in two seats, **Then** Start is disabled.
4. **Given** three distinct users, **Then** Start is enabled and posts all three seats.
5. **Given** any state, **Then** no modal opens (slide-out only).

### User Story 3 - The runbook names the trio seed (Priority: P2)

The operator follows `docs/ops/dev-vm-104.md` to seat three humans on hosted dev.

**Why this priority**: card AC #3. The demo runs on vm-104 from the runbook.

**Independent Test**: a reader follows the runbook's three-player steps on a local stack and
reaches a started trio scene.

**Acceptance Scenarios**:

1. **Given** the runbook, **When** the operator seats three players, **Then** the steps name the
   trio seed by its slide-out label, two invitations, and the three seats.

### Edge Cases

- Only two humans are present when the operator opens the slide-out: Start stays disabled, as
  each select lists only present users. The operator waits for the third.
- One human leaves after scene start: sign-off and floor passing treat the seat as absent
  (TASK-0049, TASK-0050), as for the duo.
- The Director model emits a hold or a companion prompt naming `odo`: `legalizeDirector`
  overrides it (no AI companion), and the override is logged on the turn job.
- The operator holds a seat with the operator account: a seated operator views as a player
  (TASK-0118), unchanged.
- The human-DM run of TASK-0053 needs a fourth account for the DM; that is outside this card
  (see Findings).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repo MUST ship `apps/server/seeds/<trio id>.json` (OQ-1) with `tamsin`, `odo`
  and `kestrel` all seat `human` and no companion, otherwise a copy of greyhollow-ford-duo.
  *(Card AC #1.)*
- **FR-002**: The trio seed MUST load through `loadSeed` with no loader, schema or cross-check
  change. *(Card AC #1.)*
- **FR-003**: Odo's portrayal MUST follow OQ-2. Every other field of every character MUST match
  greyhollow-ford-duo.
- **FR-004**: A test MUST load the trio seed and assert its humans `["tamsin", "odo", "kestrel"]`
  and companions `[]`. *(Card AC #1.)*
- **FR-005**: The seed-list tests MUST list `greyhollow-ford`, `greyhollow-ford-duo` and the trio
  id, sorted by id; `GET /dm/seeds` MUST return the trio's three humans and empty companions.
- **FR-006**: A DB test MUST start the trio seed with three distinct users and assert three
  `player` party rows and no failed job; MUST assert all-three sign-off and an absent-player
  commit; MUST assert the floor passes an absent human's turn to the next actor. *(Card AC #1.)*
- **FR-007**: A test with no database MUST assert, on a trio snapshot, that the fiction view names
  all three as `human player`, the Director prompt has no "AI companions in the party" section,
  and `legalizeDirector` overrides a hold or companion prompt naming `odo`. *(OQ-3, OQ-5.)*
- **FR-008**: A web test MUST render the Start scene form for the trio summary and assert three
  seat selects, no AI-companion note, Start disabled for a partial or repeated map and enabled for
  three distinct users. *(Card AC #2.)*
- **FR-009**: The Start scene slide-out MUST open no modal; `no-dialog.test.mjs` stays green.
  *(Card AC #2.)*
- **FR-010**: `docs/ops/dev-vm-104.md` MUST name the trio seed's slide-out label for a
  three-player table, in procedural prose, shaped per OQ-6. *(Card AC #3.)*
- **FR-011**: greyhollow-ford and greyhollow-ford-duo MUST stay byte-identical, and their tests
  unchanged except the two seed-list assertions (FR-005). *(OQ-4.)*
- **FR-012**: The change MUST add no runtime dependency, migration, wire field, gate request kind,
  event type, prompt version or frozen-contract change.
- **FR-013**: The local live check MUST seat three accounts in three Brave contexts and start the
  trio scene in script mode with the shipped `greyhollow-live` script; no provider spend.

### Card acceptance criteria map

| Card AC | Requirements | Proof |
|---|---|---|
| #1 A shipped seed seats three humans, loads through loadSeed, and has a test | FR-001 to FR-007, FR-011, FR-012 | `seed.test.ts`, `trio-views.test.ts`, `routes.integration.test.ts`, `trio.integration.test.ts`, the mutation guard |
| #2 The Start scene slide-out offers three human seats for it, with no modal, and a test | FR-005, FR-008, FR-009, FR-013 | `start-scene-panel.test.tsx`, `no-dialog.test.mjs`, the Brave live check with three accounts |
| #3 docs/ops/dev-vm-104.md names the seed for a three-player table | FR-010 | the runbook diff, walked in the live check |

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): the trio seed is reached through the existing
  `GET /dm/seeds` and `POST /dm/sessions/:sessionId/start`. No new surface.
- **CR-002** (II. Content contract): every trio character keeps identity, portrayal and hooks and
  passes `SceneSeedSchema`.
- **CR-004** (VI. 5e engine boundary): the trio reuses the duo's engine-checked numbers and SRD
  ids, cross-checked by the loader.
- **CR-005** (VIII. Operator-owned content): the trio is the original greyhollow-ford content
  under its existing license block.

### Key Entities

- **Scene seed**: a JSON scene; each character has `seat: "human" | "companion"`.
- **Trio seed**: greyhollow-ford-duo with `odo.seat` `human` and a new `seedId` and `title`.
- **Seed summary** (`GET /dm/seeds`, unchanged shape): `seedId`, `title`, `humans`, `companions`.

## Open questions

Each question changes what a player or the operator sees or reads, or what the AI DM is told. The
recommended option is (a). The plan and tasks are written against every (a); a different ruling
amends them before Phase 1 dispatches.

### OQ-1 — Seed id and title

- **(a) Recommended.** `seedId` `greyhollow-ford-trio`, `title` `Greyhollow Ford (three players)`.
  The slide-out label reads `Greyhollow Ford (three players) (greyhollow-ford-trio)`.
  Consequences: matches the duo's naming. Sorts after the duo, so the slide-out's default seed
  stays `greyhollow-ford`.
- **(b)** `greyhollow-ford-party`, `Greyhollow Ford (full party)`.
  Consequences: names the intent (every party member human), not the count. Sorts before the duo.
- **(c)** `greyhollow-ford-table`, `Greyhollow Ford (the M3 table)`.
  Consequences: ties a shipped seed's name to a milestone that will close.

Ruling:

### OQ-2 — Odo's portrayal

- **(a) Recommended.** Set `odo.portrayal.voice` and `.want` to `Chosen by the player.`, as spec
  054 did for Kestrel. Keep `detail`, `appearance`, `identity` and `hooks`.
  Consequences: the AI DM never voices Odo's speech or wants; the player chooses them. The
  relationship hooks (`odo` ↔ `kestrel`) still give the narrator a thread.
- **(b)** Keep Odo's authored voice and want ("Warm, slow, fond of proverbs…"; "To end fights
  without killing…") as a suggestion for his player.
  Consequences: the narrate and interpret prompts see a voice for a human character, which
  invites the narrator to speak for a player (doctrine: never decide what a party member says).
- **(c)** Clear Odo's hooks too, leaving a blank character.
  Consequences: thins the content contract (CR-002); the narrator loses the Kestrel thread.

Ruling:

### OQ-3 — Does Odo keep any companion behaviour?

- **(a) Recommended.** None. Odo is a plain human seat. No companion job ever runs at a trio
  table (Background, "Companion jobs"); a trio test pins it.
  Consequences: no source change. An absent Odo player is handled as any absent human (sign-off
  and floor). TASK-0053 then tests three humans and zero companions, which is what its AC #1 says.
- **(b)** Odo falls back to an AI companion while his player is absent.
  Consequences: a new controller switch in the gate, the projection and the play route; a frozen
  029 contract change. A new card, far larger than this one.
- **(c)** Keep one AI companion beside the three humans (a fourth character).
  Consequences: new content (a new character, its combatant and numbers) and a larger fight; the
  seed is no longer the greyhollow party.

Ruling:

### OQ-4 — Does the trio seed replace or sit beside the duo seed?

- **(a) Recommended.** Beside it. A third file; greyhollow-ford and greyhollow-ford-duo are
  untouched.
  Consequences: the TASK-0163 alpha run (next in order, `greyhollow-ford-duo`) keeps its runbook
  and seed. Two seed-list tests gain one entry.
- **(b)** Replace the duo with the trio.
  Consequences: breaks the TASK-0163 AC #4 runbook steps and `duo.integration.test.ts`,
  `duo-views.test.ts` and `greyhollowDuo`, before that alpha has run.
- **(c)** One seed with a per-start seat override (the start request says which characters are
  human).
  Consequences: changes the start route's contract and the seed schema; spec 054 Q1 rejected a
  per-seed override.

Ruling:

### OQ-5 — What the AI DM is told

- **(a) Recommended.** Nothing new. The snapshot already labels every party member `human player`
  from its controller, and the Director's "AI companions in the party" section drops out when
  empty. A trio test pins both.
  Consequences: no prompt version bump, no capture churn.
- **(b)** Add a Director doctrine line: "This table has no AI companions; never hold a beat for
  one."
  Consequences: bumps the Director prompt version and its capture tests; the code legality rule
  already overrides such a hold.
- **(c)** Add a line to the narrate prompt naming the three players.
  Consequences: bumps the narrate prompt; the snapshot already names them.

Ruling:

### OQ-6 — Shape of the runbook change

- **(a) Recommended.** Add a subsection `Seat three players` at the end of "Run a two-player
  table". It lists only the differences: repeat steps 3-8 for a second player; every human opens
  the link; choose `Greyhollow Ford (three players) (greyhollow-ford-trio)`; choose a different
  user for Tamsin Vale, Brother Odo and Kestrel; no AI-companion note shows; each human's speaker
  selector offers only their own character.
  Consequences: one section to maintain; the duo steps stay exactly as TASK-0163 will run them.
- **(b)** A full parallel section `Run a three-player table`.
  Consequences: about 19 repeated steps that drift apart over time.
- **(c)** Rename the section `Run a table with two or three players` and branch steps 14-19.
  Consequences: edits the steps TASK-0163's alpha run is about to follow, and changes
  `hosted-dev`'s section anchor.

Ruling:

## Findings outside this card (for the orchestrator)

- **F-1 — The human-DM demo run has no hosted-dev way to seat the DM.** TASK-0053 AC #2 needs a
  human DM. A DM seat is the `dm.seat` gate request (`apps/server/src/gate/gate.ts`); no web
  control sends it (`git grep "dm.seat" apps/web` is empty), and `docs/ops/dev-vm-104.md` has no
  step for it. Only the evidence script `specs/055-human-dm-scene-change/evidence/start-human-dm.mjs`
  sends it, and an agent may not sign in on vm-104. With three human players, the human DM is a
  fourth account. This card does not fix it; it needs a card or a ruling before the demo's run 2.
- **F-2 — The playtest harness seats one human.** `loadScenario` matches the seed's first human,
  so the trio seed cannot drive a harness scenario. The demo audits a live session
  (`audit --session`), which is seat-agnostic, so this blocks nothing. Named for the record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Three people, each on their own account, control the three party characters of one
  scene, with zero AI companions.
- **SC-002**: The operator starts a three-human scene from the slide-out in at most five
  selections (seed plus three seats plus Start).
- **SC-003**: Zero companion jobs are queued in a trio scene.
- **SC-004**: Zero modals in the flow.
- **SC-005**: No existing seed, playtest or test regresses; only two seed-list assertions change.

## Assumptions

- The loader's at-least-one rule, the seat-map rules and `GET /dm/seeds` stay as spec 054 set
  them. The trio adds data and tests, not rules.
- Only the operator starts a scene. The operator may hold one of the three seats.
- The demo audits with `pnpm playtest audit --session`, not a harness scenario (F-2).
- The live check uses `DM_FAKE_SCRIPT=greyhollow-live`; no new DM script is needed.
