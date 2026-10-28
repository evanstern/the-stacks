# Live run: spec 053 on stack `stacks-task-0158`

Commit under test: bf37d5d (branch `task-0158-env-fake-dm-script`). App: http://localhost:3158.
Browser: Brave (Playwright `executablePath`). No provider key, no paid call. Credentials are in an
untracked file outside the repo and appear nowhere below.

## Steps and results

| Step | Command (abridged) | Result |
|---|---|---|
| T019 root and worktree `.env` lack the key | `grep -c '^DM_FAKE_SCRIPT=' .env <root>/.env` | `0` and `0` |
| 1 stack up | `pnpm env:up` (already up) | app, db, test-db healthy |
| 2 migrate | `docker build --target build -t stacks-task-0158-migrate .` then `docker run --rm --network stacks-task-0158_default --env-file .env -e TEST_DATABASE_URL= -w /app/apps/server stacks-task-0158-migrate node --experimental-strip-types scripts/migrate.ts` | `Migrations applied.`; `relation "jobs" does not exist` gone after restart. Test DB: `pnpm --filter @the-stacks/server db:migrate` printed `Migrations applied.` |
| 3 set value | `printf '\nDM_FAKE_SCRIPT=greyhollow-live\n' >> .env` | one line present. A first attempt with `echo` fused onto the `AI_PRICES=` line (no trailing newline): boot crashed `AI_PRICES must be valid JSON`. |
| 4 recreate | `docker compose -p stacks-task-0158 up -d --force-recreate --wait app` | healthy |
| 5 boot log | `docker compose -p stacks-task-0158 logs app \| grep "DM script mode"` | `DM script mode: greyhollow-live (9 calls, 1 dice)` |
| 6 operator | `docker exec -e OPERATOR_PASSWORD=*** ... create-operator.js` | `Operator account created: operator` |
| 7 start scene | `node evidence/start-scene.mjs <creds>` | HTTP 202; session printed, play and debug URLs |
| 8 narration | play page | scripted opening narration shown (shots) |
| 9 debug | debug page | turn job `succeeded`, `shipped`, 4 calls; selecting it highlights 5 event rows |
| 10 declare | `node evidence/declare.mjs <creds> <sessionId>` | `declared act-search`, `committed act-search`. The Node global WebSocket with a `headers: { cookie }` option connected. No helper fix needed. |

Session A events (seq 13 to 23): `narration` (opening), `action.declared`, `action.committed`,
`dice.rolled`, `check.resolved` (total 14 vs DC 13, success), `action.resolved` (applied),
`tracker.changed`, `narration` ("Tamsin crouches beside the cut bell rope ... 1d20 -> 14 = 14 vs DC 13:
success"), `journal.entry.added`.

Session A jobs: turn, chronicle, turn, chronicle, all `succeeded`, attempts 1.

## T020: nothing left the process

`select count(*) total, count(*) filter (where provider='scripted') scripted, count(*) filter (where cost_usd is not null) priced from dm_model_calls;`

```
 total | scripted | priced
    10 |       10 |      0
```

All 10 rows name provider `scripted`, model `scripted-chat`, cost null. Of the 10, 9 are the script's calls
(session A: 3 + chronicle + director, interpret, narrate, audit + chronicle) and 1 is the deliberately
spent call in T023. The app log shows no provider request (script mode replaces the AI config with the
scripted one: no provider adapter exists in the process).

## T021: chronicle and unscripted calls

Session A (both turns): both `dm.chronicle` rows have outcome `ok`; every call outcome `ok`. The app log
and the jobs rows hold no "unscripted call" for any purpose during the live run. A chronicle job shows
`succeeded` even when its call fails, so the check used `dm_model_calls.outcome`.

## T023: spent script and unset

- Spent script: a new scene start (session C) after the 9 calls were consumed gave job `failed`
  ("stopped at director: gateway"), a `dm_model_calls` row with outcome `error`, error_kind `config`,
  provider `scripted`, and `unscripted call for dm.director` in the job result. A bare `POST /dm/sessions/<id>/turn`
  on a finished session queues a no-op turn with no model calls; it does not consume the script.
- Restart: recreating the app reset the queues (`DM script mode:` line again); session B then narrated.
- Unset: deleting the `.env` line and recreating the app booted healthy with zero `script mode` lines.
  The line was then restored and the app recreated: `DM script mode: greyhollow-live (9 calls, 1 dice)`.
  The stack is left up in script mode.

## Screenshots (`evidence/shots/`)

Each at 1280 and 390 px, light and dark (`<name>-<width>-<scheme>.png`). Every shot passed the
no-modal check (0 dialogs) and the no-horizontal-overflow check.

- `play-opening-*`: play page after the scene-start narration (fresh session B, before any action).
- `play-after-*`: play page after the `act-search` turn (session A): the committed card, outcome applied,
  and the narration with `1d20 -> 14 = 14 vs DC 13: success`.
- `debug-*`: debug page with the `act-search` turn job selected; 5 event rows highlighted.

Driver: `evidence/shoot-live.mjs`.

## Corrections made

- quickstart step 2: replaced "take the user, password and database from `.env`" with the credential-free
  docker build and run (ruling on the card, bf37d5d); host-side test DB migrate kept.
- quickstart step 3: `printf '\n...\n'` instead of an append that can fuse onto the last line.
- quickstart steps 4, 5, 6, 9, 10, 11: `stacks-<env>` project names with the `task-0158` example, boot-log
  counts (9 calls), a working operator-create command, `succeeded` instead of `done`, helper arguments.
- Helpers `start-scene.mjs` and `declare.mjs`: unchanged; both ran as written.
