# Live check — TASK-0117 Phase 6 (Brave, 2026-10-27)

Commit under test: Phase 5 plus the merge of `origin/main` (38e6545) plus the three fixes below.
Stack: `pnpm env:up` in `.worktrees/task-0117` (app :3117, db :15117). Both databases were migrated
by hand (TASK-0098). The app container was recreated with a compose override kept outside the repo:
`AI_PROVIDERS` holds one provider of kind `fake`; `AI_PURPOSES` routes the seven `dm.*` purposes and
`embedding` to it; `AI_PRICES` is `{}`; the key variable is blanked. No real key reached the process.
Values are not recorded here.

Accounts: an operator (`pnpm auth:create-operator` path, inside the container) and a player
(operator-issued invitation, redeemed). Random passwords, stored only in an untracked creds file
outside the repo. The browser is Brave, launched by `executablePath` through playwright-core loaded
from outside the repo.

Table: `seed-live.mjs free-mode-action` (a 041 variant of the 030 script) copies the fixture into a
fresh session and maps its scene id to `greyhollow-ford`, so `GET /dm/sessions/:id/seed` loads a real
seed. The operator is the mapped DM actor; the player is Ana's user.

## Contract drift

`origin/main` merged cleanly. `specs/037-debug-api/contracts/debug-api.md` has no change in the merge,
and the four reads and `POST /turn` behaved as the page expects. No drift. `pnpm ci:check` passes with
`REQUIRE_DATABASE=1` after the merge and after the fixes.

## Turn outcome

`scene-start` through `/dm/sessions/:id/start` was tried first. With the env-configured fake provider
every call returns an empty body, so the director fails twice (`invalid-output`, attempts with 0
chars). That fake provider cannot be scripted from the environment. So no narration, plays or
submissions exist in this run, and "events written by a job" highlighting could not be exercised:
a failed turn writes no events (0 rows highlighted, as expected). Every turn in this run is a failed
turn. The strip and card show the failure; Retry queues a new turn that fails the same way. The Seed
shot at 390 px caught a running retry turn ("stage assemble", heartbeat 0 s ago).

## Checks (script output, 96 PASS, 0 FAIL, four runs: 1280/390 px, light/dark)

| Check | Result |
|---|---|
| Debug link on `/play/:id` (operator) | href `/play/<id>/debug`, `target=_blank` |
| Polling advances the log (AC #2) | Player talk appeared as a new row about 0.5 s later, no reload |
| Polling adds the job (AC #2) | Player commit added a job card about 1.8 s later |
| Failed turn card | Seven sections, director "not run" placeholders, failure with both attempts |
| Retry POST (AC #9) | `POST /dm/sessions/:id/turn` returned 202; "Queued job <id>" shown; a new failed job followed |
| Click row pins state; back to live | "pinned at seq 6", then cleared |
| One panel at a time | Opening Journal over Ledger leaves one `role=dialog` |
| Escape closes a panel | Seed, Ledger, Journal and Cost each close on Escape |
| Follow-bottom | Viewer at bottom; six retries added jobs; gap to bottom 0 |
| Scroll-into-view on selection | Selected card inside the viewport |
| Combobox keyboard | Typing opens (`aria-expanded=true`); ArrowDown plus Enter adds a chip; Escape collapses |
| Seed "DM only" marks | 29 marks on the live seed, after the fix below (0 before it) |
| Player at the debug URL | OperatorOnly message; 0 requests to `/dm/` |

## Defects found and fixed

1. Seed "DM only" matcher. The server sends JSON Pointers (`/beats/0/summary`); the panel compared
   dotted paths (`beats[0].summary`), so a live seed showed zero marks. `seed-panel.tsx` now converts
   pointers (`pointerToPath`). `panels.test.tsx` uses the pointer syntax and has a new array case.
2. Unbounded desktop columns. The page scrolled as a whole, so inner column scrollers never scrolled.
   The board is `xl:h-dvh` now.
3. Follow-bottom never acted. The jobs column section was the scroller, not the timeline box that
   holds the follow logic. The section is a flex column (`max-h-[60dvh]` under xl) and the box is
   `flex-1`, so the box scrolls on every width.

## Shots (`shots/`, `<name>-<width>-<scheme>.png`, 44 files)

`debug-idle`, `debug-after-turn`, `debug-turn-card-expanded`, `debug-pinned`, `debug-after-retry`,
`debug-filtered`, `debug-panel-seed`, `debug-panel-ledger`, `debug-panel-journal`,
`debug-panel-cost`, `debug-player-operator-only`; widths 1280 and 390; schemes light and dark
(cookie `stacks-theme`). No modal: panels are slide-out sheets.

Known limits: the Seed panel at 390 px shows a horizontal scrollbar for long unbroken text. The
operator's own events show the user id as the actor name (the fixture maps the DM actor to a user id,
so `actorLabel` has no party name for it).

## Quickstart steps 4 to 9

4 pass (link, new tab). 5 pass for the strip, timeline and log within 3 s (the turn is instant, so a
long running state was seen only once). 6 pass for pin and back to live; job-to-row highlight is
unexercised (no events written). 7 pass. 8 this script. 9 pass.
