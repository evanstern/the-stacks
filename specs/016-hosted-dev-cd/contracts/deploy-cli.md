# Contract — `scripts/deploy-dev.mjs`

Runs on vm-104 as `stacks`, from a checkout of the repo. Non-interactive. Human-readable
lines on stdout; exit codes are the machine contract. Never prints a secret. Every compose
call is `docker compose -p stacks-dev -f docker-compose.yml -f deploy/dev/compose.dev.yml
--env-file $DEV_ENV_FILE`. `DEV_ENV_FILE` defaults to `/home/stacks/dev/.env`.

| Command | Does | Exit |
|---|---|---|
| `deploy <sha> [--allow-stale] [--force-unhealthy]` | research R6 steps 1–10 | 0 deployed or skipped · 1 failed (last line: `dev is serving <sha>` or `dev is not serving`) · 2 environment error (no Docker, no secrets file, checkout ≠ `<sha>`) |
| `drift` | research R7 | 0 `ok` or `pending` · 1 `drift` (names expected and observed) · 2 environment error |
| `backup [--name <label>]` | `pg_dump -Fc` to `/home/stacks/dev/backups/`; `--name` writes `manual-<label>.dump`, never auto-pruned | 0 · 1 · 2 |
| `restore <file>` | refuses without `--yes`; stops `app`, `pg_restore --clean --if-exists` into the running `db`, starts `app` at its current image, verifies `/health` | 0 · 1 · 2 |
| `status` | prints the running commit, `/health` body, image tags, newest backups | 0 · 2 |
| `init-secrets` | creates the secrets file (research R4); refuses if it exists. Needs only `scripts/deploy-dev.mjs`, `scripts/deploy-lib.mjs`, and `.env.example` — no Docker, no `node_modules` | 0 created · 1 exists · 2 |

## Guarantees

- No command runs `docker compose down`, and none passes `-v` or `--volumes`.
- No command touches a container, image, network, or volume outside project `stacks-dev`
  or without label `org.the-stacks.env=dev`.
- `deploy` changes nothing before step 7 except building images, starting an already-defined
  `db`, and writing a backup.
- A successful `deploy` means `/health` answered `status: "ok"` and `commit: <sha>`.

## Files it reads

| File | Purpose |
|---|---|
| `deploy/dev/compose.dev.yml` | dev override (research R3, R5) |
| `deploy/dev/compose.force-unhealthy.yml` | `--force-unhealthy` only (research R6) |
| `$DEV_ENV_FILE` | secrets and ports; read by compose, never by the script's output |
