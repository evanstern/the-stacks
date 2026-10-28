# Feature Specification: Env-reachable scripted fake DM provider

**Feature Branch**: `task-0158-env-fake-dm-script`

**Created**: 2026-10-27

**Status**: Ready for plan — Q1 to Q8 resolved 2026-10-28

**Input**: TASK-0158 "Env-reachable scripted fake DM provider for live UI checks". A worktree
stack can run a full fake-gateway turn (director through narration), driven by a DM script
chosen in the app's environment, so live UI checks show a happy-path turn. No provider key and
no paid run.

**Board task**: TASK-0158. **Evidence**: TASK-0117 Phase 6
(`specs/041-debug-page/evidence/live-check.md`, commit b4d0378).

## Why the live check failed (root cause)

The TASK-0117 live check set `AI_PROVIDERS` to one provider of kind `fake` and routed the
seven `dm.*` purposes to it. The running app builds its gateway in
`apps/server/src/index.ts` with `createGateway({ config: aiConfig, sink: logSink })` and no
`adapters` override. The gateway's default registry maps kind `fake` to
`() => new FakeProvider()` (`apps/server/src/ai/gateway.ts`, `DEFAULT_ADAPTERS`). That
provider has empty queues and `strict = false`. An unscripted, non-strict chat call yields one
`done` event and no `text` (`apps/server/src/ai/adapters/fake.ts`). The director therefore
received a 0-character body, failed JSON parsing twice, and the turn failed `invalid-output`.

Scripting exists only in process: `loadDmScript` + `createScriptedDm`
(`apps/server/src/dm/script/load.ts`) build a strict provider with per-purpose queues, and
tests or the playtest harness inject it through `createGateway({ adapters })`. Nothing in
the environment reaches that path. Two further gaps sit behind it:

1. **Files.** The runtime image ships `apps/server/dist` and `apps/server/seeds`, but not
   `apps/server/test/`, so the shipped scripts (`apps/server/test/dm/scripts/*.json`) do not
   exist inside the app container.
2. **Bound values.** A script carries fixed values a live table does not share. Its
   `dm.interpret` readings name fixed action ids (for example `act-search`), and the interpret
   node fails `invalid-output` ("interpret readings do not match the beat") unless they equal
   the beat's action ids. The play composer mints `act-<uuid>` ids
   (`apps/web/app/play/frames.ts`). A script's `dice` feed a scripted RNG in tests; the running
   gate draws `seededRng(randomInt(...))` (`apps/server/src/gate/gate.ts`), so a narration
   scripted for a success can sit beside a failed roll.

The scene-start turn has neither gap: `scene-start.json` scripts director, narrate and audit,
names no action id and draws no dice.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One env value replays a DM script (Priority: P1)

An operator sets one env value on a worktree stack, naming a DM script. The running app's DM
calls are answered from that script, in the existing script format, with no provider key.

**Why this priority**: This is card AC #1. Every live UI check of a DM turn depends on it.

**Independent Test**: A test boots the app's AI wiring from an env map holding only the new
value, runs a scene-start through the DM worker, and finds a narration event and a `done`
job. A second case leaves the value unset and finds today's behaviour unchanged.

**Acceptance Scenarios**:

1. **Given** a worktree stack whose env names the scene-start script, **When** the operator
   starts the scene, **Then** the director, narrate and audit calls are answered from the
   script and the log holds the scripted narration.
2. **Given** the value names a script that does not exist or fails `DmScriptSchema`, **When**
   the app boots, **Then** boot fails with a message that names the value and the reason.
3. **Given** the value is unset, **When** the app boots, **Then** the AI config and gateway are
   exactly what they are today.
4. **Given** the value is set on a stack that is not a worktree stack (the guard in Q5),
   **When** the app boots, **Then** boot is refused.
5. **Given** the script's queue for a purpose is empty, **When** the DM calls that purpose,
   **Then** the behaviour chosen in Q4 holds and the debug page shows it.

---

### User Story 2 - Quickstart: a narrated turn on a worktree stack, no key (Priority: P1)

An operator follows a documented quickstart. It brings up a worktree stack, sets the one value,
creates a table, starts the scene and sees a narrated turn on the play page and on the debug
page, with job-to-event highlighting.

**Why this priority**: This is card AC #2. It unblocks the TASK-0117 merge condition
(screenshots during a live fake-gateway turn).

**Independent Test**: Run the quickstart on a fresh worktree stack with no provider key in its
env. The play page shows the scripted narration. The debug page shows a `done` turn job whose
written events highlight in the log.

**Acceptance Scenarios**:

1. **Given** a fresh worktree stack and no key, **When** the operator follows the quickstart,
   **Then** a narrated turn appears and no request leaves the app process for a model provider.
2. **Given** the quickstart's player-action step (scope set by Q6), **When** it runs, **Then**
   the interpret, resolve and narrate stages complete and the narration is consistent with the
   recorded roll (Q7).

### Edge Cases

- The script lacks a purpose the flow calls (for example `dm.chronicle` after a resolve that
  closes a beat). That job fails as in Q4; the quickstart names which scripts cover which flow.
- Two sessions on one stack share one replay queue unless Q8 chooses per-session queues.
- The root checkout's `.env` wins over a worktree's `.env` for any key it holds
  (`specs/010-worktree-stacks/contracts/env-cli.md`, spec 022). The value must be set in the
  worktree `.env`, and the root `.env` must not hold it.
- The root `.env` may hold real `AI_PROVIDERS`, `AI_PURPOSES` and a key. In script mode no call
  may reach them (Q3).
- A retry after the script is spent behaves as Q4 says, not as a silent empty body.

## Requirements *(mandatory)*

### Functional Requirements

| FR | Requirement | Card AC |
|---|---|---|
| FR-001 | The app reads one env value that names a DM script (form set by Q1, name set by Q2). | AC #1 |
| FR-002 | When the value is set, the app loads the script with the unchanged `loadDmScript` and builds its provider with `createScriptedDm`, then passes it to the gateway as the `fake` adapter. | AC #1 |
| FR-003 | When the value is set, the DM purposes route to the scripted provider regardless of `AI_PURPOSES` (purpose scope set by Q3). | AC #1 |
| FR-004 | A missing, unreadable or schema-invalid script fails boot with a message naming the value. | AC #1 |
| FR-005 | When the value is unset, AI config, gateway and gate RNG behaviour are unchanged. | AC #1 |
| FR-006 | The value is refused on any stack the guard in Q5 does not allow. | AC #1 |
| FR-007 | An empty purpose queue yields the behaviour chosen in Q4, never an empty body. | AC #1 |
| FR-008 | Script dice feed the gate RNG as Q7 decides. | AC #1 |
| FR-009 | A test proves FR-001 to FR-007: a scripted scene-start through the DM worker, the unset case, a bad-script boot failure and a guard refusal. | AC #1 |
| FR-010 | At least one shipped live script produces a narrated turn on a fresh session from the `greyhollow-ford` seed. | AC #2 |
| FR-011 | A quickstart documents the steps from `pnpm env:up` to a narrated turn on the play and debug pages, with no key. It names the value, where to set it, and how to restart the app. | AC #2 |
| FR-012 | The boot log prints one line naming the active script, and the usage ledger records its calls with provider `scripted` and cost unknown (null). | AC #1, AC #2 |
| FR-013 | No frozen contract changes: `DmScriptSchema`, the fake-gateway script contract (spec 031), `ws-protocol` frames, the proposal-gate and proposal-seam contracts. | AC #1 |

### Key Entities

- **DM script**: the existing v1 document (`DmScriptSchema`). Unchanged by this feature.
- **Script mode**: the app state when the env value is set: a strict scripted provider answers
  the DM purposes, and the gate RNG follows Q7.

## Success Criteria *(mandatory)*

- **SC-001**: On a fresh worktree stack with no key, an operator reaches a narrated turn by
  following the quickstart, in under 10 minutes after the stack is healthy.
- **SC-002**: In script mode, zero requests leave the app for any model provider.
- **SC-003**: The TASK-0117 live-check script can capture a `done` turn job with at least one
  highlighted event row.
- **SC-004**: With the value unset, every existing test passes unchanged.

## Assumptions

- The quickstart lives in this spec dir (`quickstart.md`), with a pointer from the wiki notes.
- The live check uses the `greyhollow-ford` seed and a session seeded as in
  `specs/041-debug-page/evidence/seed-live.mjs`, or a successor that the plan names.
- `pnpm env:up` already copies a worktree `.env` key the root `.env` lacks (layer 3), so a new
  key needs no env CLI change.
- `speckit-clarify` was skipped: the ambiguities below change env and operator-visible
  contracts, so they go to the operator as open questions.

## Open questions

**Resolved 2026-10-28.** The operator ruled in chat: "TASK-0158: I accept the recommended
defaults Q1 to Q8, including the DM_FAKE_SCRIPT name, the shipped dm-scripts directory, the
whole-config replacement and the STACKS_ENV boot guard." The ruling is recorded on the card.
Each question below keeps its options for the record; the **Recommended** option is the ruling.

| Q | Ruling |
|---|---|
| Q1 | A — a script name, resolved in the shipped `apps/server/dm-scripts/` directory |
| Q2 | A — `DM_FAKE_SCRIPT` |
| Q3 | A — replace the whole AI config with the scripted config |
| Q4 | A — fail loudly; restart the app container to reload |
| Q5 | A — boot refuses when `STACKS_ENV` is unset, `default`, `main` or `dev` |
| Q6 | A — scene-start, plus an optional scripted declare with the script's fixed action id |
| Q7 | A — script dice first, then `seededRng(0)` |
| Q8 | A — one process-wide queue |

### Q1 — Value form: script name or file path?

The runtime image lacks `apps/server/test/`, so a repo path to today's scripts does not resolve
inside the container.

- **A. Name, from a shipped directory.** The value is a name (`[a-z0-9-]+`). The app resolves
  `<name>.json` in a new `apps/server/dm-scripts/` directory, which the Dockerfile copies like
  `apps/server/seeds`. Live scripts live there.
- **B. Path.** The value is a container path. The operator bind-mounts the file with a compose
  override. That needs more than one env value and a file outside the repo.
- **C. Inline JSON.** The value holds the script itself. It is long and hard to edit.

**Recommended: A.** It keeps "one env value" true, matches how seeds ship, and fails cleanly on
an unknown name (FR-004). Shipping a few JSON files in the image costs nothing behind the Q5
guard.

### Q2 — Env var name

- **A. `DM_FAKE_SCRIPT`.**
- **B. `AI_FAKE_DM_SCRIPT`**, grouped with the `AI_*` keys.
- **C. `STACKS_DM_SCRIPT`**, grouped with the stack keys.

**Recommended: A.** It names the subsystem (DM) and the mode (fake). The `AI_*` keys are
shared config inherited from the root `.env`; this value must stay per-worktree, so a distinct
prefix keeps it out of that group.

### Q3 — Purpose scope in script mode

The root `.env` may route `embedding` and `answering` to a real provider with a key. Adjudicate
calls retrieval, which embeds the question through the retrieval embed purpose.

- **A. Replace the whole AI config** with `createScriptedDm`'s config: seven `dm.*` purposes
  plus `embedding` (hash vectors). `answering` becomes unconfigured, so `/library/ask` returns
  its config error. Ingestion embeds with hash vectors.
- **B. Override the seven `dm.*` purposes only.** Embedding, answering and ingestion keep their
  real routes, and retrieval during adjudicate may make a paid embed call.
- **C. Override `dm.*` and the retrieval embed purpose**, and keep `answering` real.

**Recommended: A.** The card's hard limit is no key and no paid run. Only A guarantees no call
leaves the process. The cost is that the library's ask page fails in script mode, which a live
UI check of the table does not need. Hash vectors do not match stored real vectors; hybrid
retrieval still has its keyword half.

### Q4 — The script runs out

- **A. Fail loudly.** The provider stays strict. The next call for an empty purpose yields a
  `config` error "unscripted call for <purpose>", and the turn fails visibly on the debug page.
  Restart the app container to reload the script.
- **B. Loop.** Each purpose queue refills from the script when it empties.
- **C. Fail loudly, plus an operator reload route** (for example `POST /dm/script/reload`).

**Recommended: A.** It is the contract's semantic 5 (strict) unchanged, and it never serves a
response written for a different turn. Looping desyncs scripts that pair calls (a regenerate
script's second narration, an audit verdict). A reload route is new operator surface for a dev
convenience that a container restart already gives.

### Q5 — Production guard

Every container runs `NODE_ENV=production` (Dockerfile), so `NODE_ENV` cannot guard. Each stack
sets `STACKS_ENV`: `task-<n>` or a sanitized name for worktrees, `main` for `env:main`, `dev`
on vm-104, `default` for a plain `docker compose up`.

- **A. Allowlist by `STACKS_ENV`.** Boot refuses when the value is set and `STACKS_ENV` is
  unset, `default`, `main` or `dev`.
- **B. A second opt-in key** (for example `ALLOW_FAKE_DM=1`). It breaks "one env value".
- **C. Strip the value at deploy.** `deploy-lib` drops it from the vm-104 env. It guards only
  vm-104, not a self-hoster.

**Recommended: A.** It needs no second value. It refuses the hosted `dev` stack, the local main
stack and a self-hoster's plain compose stack. A worktree stack is the only place the card needs.
A future real production env name joins the deny list.

### Q6 — Player-action turns and action ids

Interpret readings must name the beat's action ids, and the composer mints random ones.

- **A. Quickstart scope = scene-start, plus a scripted declare.** The narrated turn is the
  scene-start turn. A second, optional step declares and commits an action with the script's
  fixed id (`act-search`) through a small evidence helper that sends the gate request over the
  WebSocket, then the `exploration-check` script answers it. Composer-typed actions stay out
  of scope.
- **B. Action-id binding in script mode.** The scripted provider rewrites placeholder ids (for
  example `"$beat.0"`) to the beat's ids, read from the prompt. This changes the script
  contract and couples the fake to the prompt's text.
- **C. Scene-start only.** No player-action turn in this task.

**Recommended: A.** Scene-start alone meets AC #2 and SC-003. The scripted declare adds a
player-action turn without touching the script contract or the DM runtime. If the operator
wants composer-typed turns later, that is B on its own card.

### Q7 — Dice in script mode

- **A. Script dice first, then a fixed seed.** In script mode the gate's RNG serves the
  script's `dice` in order, then continues from `seededRng(0)`, as the playtest harness's
  `scenarioRng` does. One process-wide RNG.
- **B. Ignore script dice.** The gate keeps its random RNG. A scripted success narration can
  sit beside a failed roll.

**Recommended: A.** It makes a live turn match its script, as the tests do, and reuses
`scenarioRng`. It changes gate RNG only in script mode, which the Q5 guard confines to worktree
stacks.

### Q8 — Queue scope

- **A. One process-wide queue** (as `createScriptedDm` builds it).
- **B. One queue per session**, so each new table starts the script fresh.

**Recommended: A.** It reuses the loader unchanged. A live check runs one table. Q4's restart
resets it. Per-session queues need a provider keyed by session, which the gateway does not pass.
