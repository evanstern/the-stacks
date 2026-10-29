# Live run: Start scene state (T025, T026)

**Date**: 2026-10-28. **Stack**: `stacks-task-0167` (app :3167), branch `task-0167-start-scene-queued`
at a22d2a60. **Mode**: script mode, `DM_FAKE_SCRIPT=greyhollow-human-dm` (boot log:
`DM script mode: greyhollow-human-dm (10 calls, 1 dice)`). No provider key was used. **Browser**:
Brave, driven by `evidence/shoot-live.mjs` (playwright-core, headed).

Accounts: the operator (created in the app container) and one player (`tamsin-player`, through an
invitation). Passwords were generated randomly and kept in an untracked creds file outside the repo.
The app container was recreated before each part, because each scene start spends the script's
first three calls (director, narrate, audit).

## T025: human DM, pending (`shoot-live.mjs pending`)

Session `56c55b39-ed0f-44d4-80ed-057b1b325f17`, started by
`specs/055-human-dm-scene-change/evidence/start-human-dm.mjs` (operator seated as the human DM).

| Check | Result |
|---|---|
| Play URL as the operator: no "Start scene" button | PASS |
| Status note "Scene start waiting for the DM." | PASS |
| Reload: no button, note shown | PASS |
| Second `POST /dm/sessions/:id/start` | PASS: HTTP 409 `{"error":{"kind":"conflict","message":"A scene start is waiting for the DM."}}` |
| `GET /dm/sessions/:id/start` before Apply | PASS: `{"state":"pending"}` |
| Change scene → Apply: header shows "The Bell at Greyhollow Ford", no note, no button | PASS |
| `GET …/start` after Apply | PASS: `{"state":"started"}` |
| No modal in any shot | PASS (0 dialogs) |

## T025: human DM, Dismiss (`shoot-live.mjs dismiss`)

Session `6b5a45e7-36ed-46c6-946d-be88c715f9b6`.

| Check | Result |
|---|---|
| Pending note shown before Dismiss | PASS |
| Pending proposals → Dismiss on the scene suggestion → Close: "Start scene" back | PASS: after 4859 ms (OQ-2 (a): within the 5 s poll) |
| Pending note gone | PASS |
| `GET …/start` after Dismiss | PASS: `{"state":"none"}` (OQ-3 (a)) |

## T026: AI DM, queued (`shoot-live.mjs ai`)

"Start a new table", then the Start scene slide-out: seed `greyhollow-ford`, the operator on the
human seat (seat options list only present users, and only the operator was at the table).

| Check | Result |
|---|---|
| "Scene start queued." right after the 202 | PASS in all four variant runs |
| No "Start scene" button right after the 202 | PASS |
| Then the scene title, no note, no button | PASS |
| No modal | PASS |

Sessions, one per kept shot: 1280-light `ba332e70-b3d6-40f2-9a4e-24b0fdc62d01`, 1280-dark
`ade7b71c-d3f2-414c-9cfb-da9d98bbf4a4`, 390-light `25f1b76e-0711-4526-a477-88089f752434`, 390-dark
`bf1d89e8-415d-4e51-89da-cf237244548a`.

In script mode the scene-start job ends within about a second. The first attempt shot all four
variants after the note appeared, and the job had committed the scene before the later shots. Those
shots were discarded. The script now sets the variant before pressing Start and shoots the instant
the note appears, one variant per run. The 1280-light variant was rerun three more times; each
run overwrote the shot, and the last one was kept. Every kept `header-queued-*` shot was inspected by eye: each shows
"No scene yet" and "Scene start queued.", with no "Start scene" button.

## Shots (`evidence/shots/`)

- `header-pending-{1280,390}-{light,dark}.png`: the pending header (T025).
- `header-queued-{1280,390}-{light,dark}.png`: the queued header (T026).
- `header-started-1280-light.png`: after Apply (T025).
- `header-dismissed-1280-light.png`: "Start scene" back after Dismiss (T025).
- `header-ai-started-1280-light.png`: the AI-DM scene committed (T026).

## Teardown

The `DM_FAKE_SCRIPT` line was removed from the worktree `.env` and the app container recreated; the
boot log no longer shows script mode. The stack is left up.
