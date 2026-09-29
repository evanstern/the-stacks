# Contract — GitHub Actions workflows for dev

## `.github/workflows/deploy-dev.yml`

| Aspect | Value |
|---|---|
| Triggers | `workflow_run` (workflows `[CI]`, types `[completed]`, branches `[main]`); `workflow_dispatch` |
| Dispatch inputs | `commit` (string, optional; default `main` HEAD; implies `--allow-stale`), `force_unhealthy` (boolean, default false) |
| Job guard | `workflow_dispatch`, or `workflow_run.conclusion == 'success' && workflow_run.event == 'push' && workflow_run.head_branch == 'main'` |
| Runner | `runs-on: [self-hosted, vm-104]` |
| Concurrency | group `deploy-dev`, `cancel-in-progress: false` |
| Permissions | `contents: read` |
| Timeout | 30 minutes |
| Steps | `actions/checkout@v4` at the target sha → `node scripts/deploy-dev.mjs deploy <sha> [flags]` |
| Secrets | none; the job uses only `GITHUB_TOKEN` |

## `.github/workflows/drift-dev.yml`

| Aspect | Value |
|---|---|
| Triggers | `schedule: '17 * * * *'`; `workflow_dispatch` |
| Runner | `runs-on: [self-hosted, vm-104]` |
| Concurrency | group `drift-dev`, `cancel-in-progress: true` |
| Permissions | `contents: read` |
| Steps | `actions/checkout@v4` (`ref: main`) → `node scripts/deploy-dev.mjs drift` |

## `.github/workflows/ci.yml`

Unchanged. It stays on `ubuntu-latest` and never names `self-hosted`.

## Invariants (asserted by `scripts/deploy-lib.test.mjs`)

- No workflow that runs on `self-hosted` has a `pull_request` or `pull_request_target`
  trigger.
- `deploy-dev.yml` carries the exact job guard above.
- `ci.yml` contains no `self-hosted`.
