# Research: playtest harness, auditor agent, milestone demo

Every decision below is settled from an existing artifact or the code at `392d46c`. No
external research was needed; no `NEEDS CLARIFICATION` remained after the spec.

## R1. Run in-process, not through the HTTP server

- **Decision**: `runPlaytest` builds the gate, gateway, DM worker and enqueuer in the CLI's own
  process and drains the worker between moves.
- **Rationale**: the scene test (`test/dm/scene.integration.test.ts`) already proves this wiring
  plays the whole scene. In-process draining is deterministic; a server's polling worker is
  not. The interfaces used (`gate.handle`, the `scene-start` job) are the same ones the
  WebSocket gateway and the `/dm` route use, so constitution I holds.
- **Alternatives**: drive a running server over HTTP and WebSocket. Rejected: needs sign-in
  credentials, makes timing nondeterministic, and adds nothing the demo itself does not prove.

## R2. Own database per run (`<base>_playtest`)

- **Decision**: recreate and migrate `<base>_playtest` per CLI run; refuse non-loopback hosts
  and concurrent connections (the bench's `_load` rules).
- **Rationale**: `claimDmJob` claims any session's DM job in its database. On a worktree stack
  the app container runs a DM worker with the stack's own AI config; it would steal the
  harness's jobs.
- **Alternatives**: a per-run session id on the shared database. Rejected for that reason. The
  Vitest suite still uses the test database (CI runs no app worker), matching the DM suites.

## R3. CI fixtures: reuse the full-scene DM script unchanged

- **Decision**: the CI scenario plays `test/dm/scripts/greyhollow-ford-full.json` through the
  unchanged `loadDmScript` / `createScriptedDm`. Its four human moves and action ids
  (`act-search`, `act-persuade`, `act-advance`, `act-strike`) are the scenario's moves.
- **Rationale**: fake-gateway-script.md: "binding for TASK-0048: its harness's CI case reuses
  this format and loader unchanged"; the script names those action ids in its interpret
  readings.
- **Alternatives**: a new DM script. Rejected: duplicates a fixture the scene test already
  keeps honest.

## R4. Auditor responses in CI live outside the DM script

- **Decision**: a separate auditor script (`playtests/fixtures/greyhollow-ford.audit.json`)
  queued with `scriptChatFor("playtest.audit", ...)` on the same strict `FakeProvider`, and a
  `playtest.audit` purpose added to a copy of the scripted `aiConfig`.
- **Rationale**: `DmScriptSchema.calls[].purpose` is `z.enum(DM_PURPOSES)`; adding a purpose
  there would change the binding format. `FakeProvider` queues are per purpose, so the two
  scripts never consume each other's responses.

## R5. Purpose name and tier

- **Decision**: `playtest.audit`, op `chat`, default `maxTokens` 700, suggested tier strong,
  preferably another family than `dm.narrate`.
- **Rationale**: decision-0007 and A7: every call names a purpose; model choice is config. A
  name outside `dm.*` keeps `missingDmPurposes` and `DM_PURPOSES` unchanged and states that the
  auditor is not part of the DM runtime. `dm.audit` is a cheap per-attempt check inside the
  turn; the playtest auditor is the out-of-band judge, a few calls per scene, so a strong
  model costs little and an independent family reduces shared blind spots.

## R6. Segments: one per narration

- **Decision**: a segment is one `narration` row by `ai:dm` plus every row after the previous
  narration. One auditor call per segment.
- **Rationale**: the DM runtime ships one narration per turn after resolve; the rows between two
  narrations are exactly that turn's mechanics, companion talk and acts. Bounded prompts, and
  each finding cites rows in one turn.
- **Alternatives**: one call over the whole transcript. Rejected: unbounded input and vague
  citations.

## R7. Code checks reuse the DM runtime's renderers

- **Decision**: rebuild each segment's expected dice lines from its ledger rows with
  `collectFacts` + `renderRollLine` / `renderChangeLine` (`dm/facts.ts`), and compare them with
  the narration's dice-line block (the text after the first blank line). Life-state words come
  from `dm/audit-words.ts`.
- **Rationale**: the narration's dice lines were rendered from the turn's facts; rebuilding them
  from the log is an independent path to the same text. Agreement proves the shipped lines match
  the log; disagreement is a `ledger-contradiction`.
- **Alternatives**: parse numbers out of the dice lines. Rejected: brittle, and the renderer is
  the contract.

## R8. Dice in provider mode

- **Decision**: `scenarioRng(faces, seed)`: the scenario's scripted faces first, then
  `seededRng(seed)`; the seed comes from `--seed` or is drawn and recorded in the manifest.
- **Rationale**: with real models the number of draws varies, so a fixed list can run out
  (`ScriptedDiceError`). Scripted faces let an operator force an opening roll; the recorded seed
  keeps the rest reproducible for a given model output. Decision-0021 idea 6 ("injected RNG") is
  met either way.

## R9. Cost guard

- **Decision**: provider mode needs `--mode provider` and `--spend-ceiling-usd`; refuses under
  `CI`; refuses an unpriced model; prints a per-purpose estimate; wraps the gateway so every
  call after the ceiling yields `{ type: "error", kind: "cancelled" }`.
- **Rationale**: the runbook's paid-run checkpoint (provider, model list, estimate before the
  first run). A `costUsd: null` record (unpriced) would make the ceiling unenforceable, so
  pricing is mandatory in provider mode. A cancelled error is a kind every node already
  handles; the turn fails or falls back, and the harness stops `budget-stopped`.
- **Alternatives**: a token ceiling only. Rejected: the operator decides in dollars.

## R10. No workflow edit

- **Decision**: the CI case is a Vitest database suite in `pnpm test`.
- **Rationale**: `ci:check` is the exact local mirror of CI (ci-pipeline note); the DM suites,
  the load bench's commit tier and the retrieval gate all ride `pnpm test`. A separate workflow
  step would drift from `ci:check`.

## R11. Demo seating and scene start

- **Decision**: the operator signs in and takes Tamsin's seat with their own user id; the DM
  seat stays AI. The scene starts with `POST /dm/sessions/<uuid>/start` from the operator's
  browser console (same-origin cookie).
- **Rationale**: `viewerFor` gives the DM view only to a human DM seat, so the operator sees the
  player view and no DM-only rows. The start route is operator-only and already the
  agent-operable interface. The web app has no start control (Open Question 3).

## R12. Evidence placement

- **Decision**: CI-mode evidence in `specs/032-playtest-harness/evidence/ci-playtest/` (PR
  evidence, like `specs/031-dm-runtime/evidence/`); the demo record at `docs/design/m2-demo.md`
  with attachments in `docs/design/m2-demo/` (milestone evidence TASK-0055 cites).
- **Rationale**: the runbook asks for the record committed with the report attached; TASK-0055
  AC #1 cites transcripts and ledgers, so they must be tracked, not in `.playtests/`.
