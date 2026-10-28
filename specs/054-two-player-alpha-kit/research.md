# Research: Two-player alpha kit

Survey of `origin/main` at cc5e39b, plus TASK-0158 at `e20030d`. Operator rulings Q1-Q6
(2026-10-28) are in `spec.md`.

## R1. The human-seat rule lives in one place

- **Decision**: change `crossCheckSeed` in `apps/server/src/dm/seed/load.ts` from "exactly one
  human" to "at least one human". Keep the issue text stable in shape:
  `at least one character must have seat "human", found 0`.
- **Rationale**: the start route (`apps/server/src/routes/dm.ts`) already requires a user id for
  every human character and refuses extras. The resolve scene-start opening
  (`apps/server/src/dm/nodes/resolve.ts`, `directorOpening`) already writes one `party` row per
  character with a `player` controller per seat. The job input schema (`apps/server/src/dm/jobs.ts`)
  already takes a record of seats. Only the loader blocks a second human.
- **Alternatives**: a fixed cap, or a per-seed flag (Q2 B and C, rejected by the ruling).

## R2. Existing single-human callers stay valid

- **Decision**: leave greyhollow-ford, its scripts, fixtures and playtest scenarios unchanged.
  Leave `apps/server/src/playtest/scenario.ts` unchanged.
- **Rationale**: greyhollow-ford keeps exactly one human, so every "the seed's human" lookup still
  finds one. `scenario.ts` uses `find` for the first human; it is only called on greyhollow-ford.
- **Note for the orchestrator**: the playtest harness seats one scripted user
  (`harness.ts` sends `seats: { [seat.characterId]: seat.userId }`), so it cannot start the duo
  seed. TASK-0053 seats several humans; if it needs the harness to do so, that is a card, not
  this task.

## R3. One user in two seats

- **Decision**: the start route refuses a seat map where one user id holds two or more human
  seats. It is a 400 `ValidationError` with one issue per repeated seat after the first, path
  `seats.<characterId>`, message `A user can hold only one seat.`
- **Rationale**: a player-controller per user is how the play route resolves "my character"; two
  characters for one user would make the seat view ambiguous. The refusal happens before any
  enqueue, so it writes nothing.
- **Effect on TASK-0158**: `specs/053-env-fake-dm-script/evidence/start-scene.mjs` seats the
  operator on every human of `greyhollow-ford`. That seed has one human, so the evidence script
  still works.

## R4. Listing seeds

- **Decision**: add `listSeeds(dir = DEFAULT_SEED_DIR)` in `load.ts`: read every `*.json` file in
  the directory, `loadSeed` each by basename, sort by `seedId`. A seed that fails to load is
  skipped and logged once as `dm.seeds.load-failed` with its issues, like the debug seed route
  does. `GET /dm/seeds` (operator only) maps each seed to `{ seedId, title, humans, companions }`.
- **Rationale**: the Start scene slide-out needs the seed list and each seed's human seats before
  a scene exists. `GET /dm/sessions/:id/seed` only answers after start. Names and titles already
  reach players through the `scene` and `party` events, so the listing exposes no DM-only text.
- **Alternatives**: a hard-coded seed id in the web app (no seat names before start; rejected);
  returning the whole seed (leaks DM-only paths; rejected).

## R5. Who the operator can seat

- **Decision**: the Start scene slide-out offers, per human seat, the humans present at the table
  from the presence frame the live table already receives (`source.presence`,
  `{ userId, displayName }`). The operator is one of them.
- **Rationale**: no user-listing endpoint exists and none is needed. Presence is the live answer
  to "who is at this table" (decision-0024).
- **Consequence for the runbook**: every human opens the table link before the operator starts
  the scene.

## R6. Scripted DM for the live run

- **Decision**: try `DM_FAKE_SCRIPT=greyhollow-live` first. The duo seed keeps greyhollow-ford's
  beat ids (`ferry-house`, `the-keeper`, `reed-camp`), and the script's first three calls
  (director, narrate, audit) are the scene start. Add `apps/server/dm-scripts/greyhollow-duo-live.json`
  only if the opening fails on the duo seed (for example an audit claim about the party).
- **Rationale**: no provider spend; the TASK-0158 quickstart already proves this path.

## R7. The redeem form sits inside the sign-in card

- **Decision**: `apps/web/app/sign-in.tsx` gains a "Have an invitation?" button that swaps the
  card's form for the redeem form, and a "Back to sign in" button. On 201 the form calls
  `revalidator.revalidate()`, exactly as sign-in does, because redeem already set the cookie.
- **Rationale**: the root loader renders `<SignIn/>` for every signed-out route, so this needs no
  gate change and no new route (Q3 A). The token never enters a URL.
- **Error mapping** (from `apps/server/src/routes/auth.ts`): 400 with a `token` issue → "This
  invitation is invalid, expired, or already redeemed."; 409 → "That username is already
  taken."; 400 with other issues → the issue messages; anything else → "Something went wrong.
  Try again."

## R8. Invite section on Settings

- **Decision**: an operator-only section below the theme choice. A number field for expiry days
  (default 7, 1 to 30), a "Create invitation" button, then the token in a read-only field with a
  Copy button and the expiry date. A note says the token shows once. The token lives only in
  component state; leaving the page drops it.
- **Rationale**: Q4 A. `POST /auth/invitations` already returns the token once.

## R9. Two-human behaviour check

- **Decision**: two test files on the duo seed.
  - `duo-views.test.ts` (no database): build the actor snapshot from duo projections and render
    the `seat` view for each human and the `dm` view; render the player-facing interpret and
    narrate prompts; assert both humans appear as players and neither is labelled a companion.
  - `duo.integration.test.ts` (database): run scene start through the real queue with the
    `scene-start.json` script (as `scene.integration.test.ts` does) and two user ids; assert
    two `player` controllers and one `ai-companion`. Then a party-scope action with both humans
    present needs both approvals (`signoffState` via the gate), and in turn mode the floor
    passes an absent human's turn (as `floor-jobs.integration.test.ts` does).
- **Rationale**: these are the four surfaces the spec's assumption names. A failure is written
  to `evidence/two-human-check.md` for the orchestrator to card, unless it blocks the seed.

## R10. Browser automation

- **Decision**: the live phase uses Playwright with Brave as the executable, the way
  `specs/053-env-fake-dm-script/evidence/shoot-live.mjs` does, with two browser contexts (one
  per account). Test passwords are generated at run time and stored only in the session
  scratchpad.
