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
