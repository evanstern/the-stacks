# Quickstart — hosted dev on vm-104

Validation guide for the merge condition and each acceptance criterion. Commands run from the
operator's Mac with `gh` authenticated, unless a line says `ssh`. `DEV` is
`https://vm-104.tailb3c1b6.ts.net:8443`. Contracts: [deploy-cli](contracts/deploy-cli.md),
[workflows](contracts/workflows.md). Operator checkpoints: [plan.md](plan.md#operator-checkpoints).

## 0. One-time setup (operator checkpoints 1 and 2)

```bash
# checkpoint 1 — creates /home/stacks/dev/.env, prints the path only
git archive HEAD scripts/deploy-dev.mjs scripts/deploy-lib.mjs .env.example \
  | ssh stacks@vm-104.tailb3c1b6.ts.net 'mkdir -p /home/stacks/dev/bootstrap && tar -x -C /home/stacks/dev/bootstrap && cd /home/stacks/dev/bootstrap && node scripts/deploy-dev.mjs init-secrets'
# checkpoint 2 — tailnet HTTPS
ssh stacks@vm-104.tailb3c1b6.ts.net 'docker exec tailscale tailscale serve --bg --https=8443 http://127.0.0.1:3000'
```

## 1. A real deploy reaches dev (AC #1, #2 — merge condition part 1)

Announce first (checkpoint 3). Then merge to `main`, or:

```bash
gh workflow run deploy-dev.yml --ref main
gh run watch "$(gh run list -w deploy-dev.yml -L1 --json databaseId -q '.[0].databaseId')"
curl -s "$DEV/health"            # status "ok", commit == git rev-parse origin/main
```

Record the run URL. Persistence: create an account or an invitation, deploy again, confirm it
still exists.

## 2. A failed deploy leaves the prior version serving (AC #3 — merge condition part 2)

Announce first. Then:

```bash
gh workflow run deploy-dev.yml --ref main -f force_unhealthy=true
# the run FAILS; its last line reads "dev is serving <prev sha>"
curl -s "$DEV/health"            # status "ok", commit == the commit from step 1
```

Record the run URL.

## 3. Drift (AC #4)

```bash
gh workflow run drift-dev.yml --ref main        # passes when dev == main HEAD
gh workflow run deploy-dev.yml --ref main -f commit=<an older main sha>
gh workflow run drift-dev.yml --ref main        # fails once HEAD is older than 30 min
gh workflow run deploy-dev.yml --ref main       # restore dev to HEAD
```

## 4. Exposure (AC #5)

```bash
curl -sI "$DEV/health"                                  # 200 over a trusted cert (tailnet)
nc -vz -w3 vm-104.local.infinity-node.win 3000          # refused (LAN)
nc -vz -w3 vm-104.local.infinity-node.win 5432          # refused (LAN)
```

## 5. Runbook (AC #6)

Follow `docs/ops/dev-vm-104.md` → "Backup", then "Rollback" to a named commit, then "Deploy"
back to HEAD. Each ends with the state it promises.

## 6. Negative trigger check

Open any PR. Confirm `deploy-dev` does not run for it (`gh run list -w deploy-dev.yml`).
