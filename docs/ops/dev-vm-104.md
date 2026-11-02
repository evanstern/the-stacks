# Dev environment on vm-104

This is the runbook for the hosted `dev` environment (spec 016). It runs
under Docker Compose on vm-104, as user `stacks`.

## What runs where

Dev runs as Docker Compose project `stacks-dev`. The app publishes on
`127.0.0.1:3000`. The database publishes on `127.0.0.1:5432`. Data lives in
the `stacks-dev_db-data` volume. Secrets live in `/home/stacks/dev/.env`,
mode `0600`. Backups live in `/home/stacks/dev/backups/`. The public URL is
`https://vm-104.tailb3c1b6.ts.net:8443`.

## Deploy

Merge a pull request to `main`. CI runs first. Deploy runs only after CI
succeeds.

Trigger a deploy by hand: run `gh workflow run deploy-dev.yml`.

Watch the run: run `gh run watch`.

Check the result: run `curl -s https://vm-104.tailb3c1b6.ts.net:8443/health`.
Confirm `status` is `ok`. Confirm `commit` matches the deployed commit.

## Create the first operator

Do this once, after the first deploy. Dev ships with no account.

Run this on vm-104, as `stacks`, from the checkout:
`docker compose -p stacks-dev -f docker-compose.yml -f
deploy/dev/compose.dev.yml --env-file /home/stacks/dev/.env exec app node
dist/cli/create-operator.js`.

Type the password at the `Operator password:` prompt. Never put it on the
command line.

Expect `Operator account created: operator`.

Choose another username: add `-e OPERATOR_USERNAME=<name>` after `exec`.

A second run refuses. It exits 1 and changes nothing.

Sign in at the public URL with that username and password.

## Run a two-player table

Do this to seat two humans on hosted dev. It needs the operator account from the previous section.

The scene opening needs a model key. Add one under `Secrets` before you start a scene.

1. Sign in at the public URL as the operator.
2. Open Settings.
3. Under `Invite a player`, leave `Expires in (days)` at 7, or set it from 1 to 30.
4. Press `Create invitation`. The page shows a token and an expiry date.
5. Send the token to the player by a private channel. The token shows once.
6. Ask the player to open the public URL signed out and press `Have an invitation?`.
7. Ask the player to fill `Invitation token`, `Username`, `Display name` and `Password`.
8. Ask the player to press `Create account`. The player lands signed in, with no operator links.
9. Open Table and press `Start a new table`.
10. Copy the `/play/<uuid>` link from the address bar.
11. Send the link to the player. Ask the player to open it.
12. Check the presence strip. It shows both display names.
13. Press `Start scene`. A slide-out opens.
14. Choose `Greyhollow Ford (two players) (greyhollow-ford-duo)` in `Seed`.
15. Choose a user for `Tamsin Vale`. Choose a different user for `Kestrel`.
16. Check the note `AI companions: Brother Odo.`
17. Press `Start`. The slide-out closes. The header shows `Scene start queued.` With a human DM, the header then shows `Scene start waiting for the DM.` until the DM carries out the suggestion.
18. Wait a few seconds. The opening narration appears for both humans.
19. Check that each human's speaker selector offers only their own character. The table shows no chip for Brother Odo. The AI DM voices him.

The server refuses three requests:

- `GET /dm/seeds` as the player returns 403.
- A start with one user on both seats returns 400. The first issue reads `A user can hold only one seat.`
- A second start on the same session returns 409 with `The session already has a scene.`

If the opening does not arrive, open `/play/<uuid>/debug` as the operator. Find the scene-start turn job. Read its status and error.

A missing model key fails the scene-start turn job. Add the key under `Secrets`, then redeploy.

Rehearse this run locally first. Follow `specs/054-two-player-alpha-kit/quickstart.md` and `specs/053-env-fake-dm-script/quickstart.md`.

### Seat three players

Do this to seat a third human. It lists only the differences from the steps above.

1. Repeat steps 3 to 8 for the second player. Create a second invitation.
2. Ask every human to open the table link. Check the presence strip. It shows three names.
3. In step 14, choose `Greyhollow Ford (three players) (greyhollow-ford-trio)` in `Seed`.
4. Choose a different user for `Tamsin Vale`, `Brother Odo` and `Kestrel`.
5. Check that no `AI companions:` note shows.
6. Check that each human's speaker selector offers only their own character.

### Seat a human DM

Do this as the operator to give the DM seat to a human. Every person opens the table link first.

1. Ask every person to open the table link.
2. Check the presence strip. It shows every name.
3. Press `DM seat` in the header. A slide-out opens.
4. Choose a person in `Seat a human DM`.
5. Press `Seat as DM`. The slide-out closes.
6. Press `Start scene`. Do not put the DM on a character seat.
7. Expect `Scene start waiting for the DM.` in the header.

To seat a human DM during a scene, do this.

1. Press `DM seat`.
2. Type a reason in `Reason (optional)`, or leave it blank for the default.
3. Choose the new person in `Seat a human DM`.
4. Press `Seat as DM`. To hand the seat from one account to another, choose the other account.

To return the seat to the AI DM, do this.

1. Press `DM seat`.
2. Read the line `Pending proposals stay pending under the AI DM: <n>. Decide them first.`, if it shows.
3. Ask the human DM to decide each pending proposal first.
4. Press `Return the seat to the AI DM`.

To run the assisted table, do this.

1. Seat three players as in `Seat three players`, using `greyhollow-ford-trio`.
2. Create a fourth account for the human DM.
3. Press `DM seat`. Choose the fourth account in `Seat a human DM`.
4. Press `Seat as DM`.
5. Check that the fourth account holds no character seat.

The server and table refuse two actions.

- A player sees no `DM seat` button.
- A start with the DM on a character seat shows `The DM cannot hold a character seat.`

## Rollback to a named commit

Run `gh workflow run deploy-dev.yml -f commit=<sha>`. This deploys that
commit and skips the staleness check.

Expect the drift check to report drift until the next deploy. This is
expected. It clears at the next deploy to `main` HEAD.

## Backup

Run `node scripts/deploy-dev.mjs backup` for a routine backup. It names the
file by timestamp and the running commit.

Run `node scripts/deploy-dev.mjs backup --name <label>` for a named backup.
A named backup is never auto-pruned.

Every deploy also backs up the database before it migrates.

## Restore

Choose a backup file from `/home/stacks/dev/backups/`.

Run `node scripts/deploy-dev.mjs restore <file> --yes`. This stops the app.
It restores the database. It restarts the app. It then verifies `/health`.

## Inspect

Run `node scripts/deploy-dev.mjs status`. This prints the running commit,
the health body, the image tags, and the newest backups.

Run this for container state:
`docker compose -p stacks-dev -f docker-compose.yml -f
deploy/dev/compose.dev.yml --env-file /home/stacks/dev/.env ps`.

Run the same command with `logs` in place of `ps` for logs.

## Secrets

Open `/home/stacks/dev/.env` on vm-104, as `stacks`.

Add a model key by hand. For example, add `HOSTED_API_KEY=<value>`.

Save the file.

Redeploy to pick up the change: run `gh workflow run deploy-dev.yml`.

Never print this file. Never commit this file.

## Model budget

Set `maxTokens` to 4000 for every `dm.*` purpose in `AI_PURPOSES`.

Hidden thinking on routed models counts against `maxTokens`. A low cap lets thinking spend the whole budget before any JSON.

In alpha run 3, `dm.interpret` at 1200 failed 8 times in combat. Each failed call returned exactly 1200 tokens and no JSON.

The cap is a ceiling, not a spend. A call pays only for the tokens it uses.

The code default and `.env.example` use the same value.

## Exposure

Run this once to expose dev on the tailnet:
`docker exec tailscale tailscale serve --bg --https=8443 http://127.0.0.1:3000`.

Check the config: run `docker exec tailscale tailscale serve status`.

Undo the exposure: run `docker exec tailscale tailscale serve --https=8443 off`.

The app publishes only on `127.0.0.1`. The LAN cannot reach it.

## Destroy

Use this section only with the operator's approval.

Back up first: run `node scripts/deploy-dev.mjs backup --name pre-destroy`.

Run `docker compose -p stacks-dev -f docker-compose.yml -f
deploy/dev/compose.dev.yml --env-file /home/stacks/dev/.env down -v`.

This is the only command in dev that removes the data volume. No other verb
or workflow runs it.

## Failure triage

A deploy that exits 0 succeeded. `dev` now serves the new commit.

A deploy that exits 1 failed. Read the last line. `dev is serving <sha>`
means the previous commit is still serving. `dev is not serving` means no
commit serves now. `first deploy failed; dev is not serving` means the
same, on the very first deploy.

A deploy that exits 2 hit an environment error. Common causes: Docker is
unreachable, the secrets file is missing, or the checkout is not at the
requested commit. Fix the cause and retry.

A drift check that exits 0 found `dev` at `main` HEAD, or found it behind
by less than 30 minutes. Neither needs action.

A drift check that exits 1 found `dev` behind `main` HEAD by more than 30
minutes, or found `dev` unreachable. Investigate the last deploy run.
