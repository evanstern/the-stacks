# Data model — 016 hosted dev on vm-104

No database tables and no application state. The model is what `scripts/deploy-dev.mjs`
reads from `git`, `docker`, and `/health` on every call, plus three things on vm-104's disk.

## On vm-104 (persisted)

| Thing | Where | Owner / mode | Lifetime |
|---|---|---|---|
| Dev secrets file | `/home/stacks/dev/.env` | `stacks`, `0600` (dir `0700`) | created once by `init-secrets`; edited only by the operator |
| Dev data volume | Docker volume `stacks-dev_db-data` | Docker | forever; no deploy, rollback, or runbook verb removes it except "Destroy" |
| Backups | `/home/stacks/dev/backups/<utc>-<sha7>.dump` | `stacks`, `0600` | newest 10 kept by the deploy; operator backups are never auto-pruned when named `manual-*` |
| Release images | `stacks-dev-app:<sha>`, `stacks-dev-migrate:<sha>` | Docker, label `org.the-stacks.env=dev` | current + 2 previous kept |
| Runner checkout | `/home/stacks/actions-runner/_work/the-stacks/the-stacks` | runner | rewritten by every job |

## Deploy (one run)

| Field | Source |
|---|---|
| `sha` | `workflow_run.head_sha`, or the dispatch input `commit` |
| `mainHead` | `git ls-remote origin refs/heads/main` |
| `prev` | `org.the-stacks.commit` label of the running `stacks-dev` `app` container, or none |
| `forceUnhealthy` | dispatch input, default false |
| `outcome` | `deployed` · `skipped` (stale) · `failed` (+ `serving: <prev>` or `serving: none`) |

State transitions: `preflight → build → db-up → backup → migrate → swap → verify → prune`
on success. `verify` failure → `rollback → verify(prev)` → `failed`. Any failure before
`swap` → `failed` with `dev` untouched.

## Drift report

| Field | Source |
|---|---|
| `expected` | `main` HEAD sha from the checkout |
| `expectedAgeMin` | now minus HEAD's committer time |
| `observed` | `/health` `commit`, or `null` when unreachable |
| `verdict` | `ok` · `pending` (differs, age < 30 min) · `drift` (differs past grace, or unreachable) |
