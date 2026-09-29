# Quickstart: validate the ingestion pipeline

Run from `.worktrees/task-0024`. Real exports are read in place from
`/Volumes/evan/dnd-sourcebooks` and are never copied into the repo (constitution VIII).

## 1. Automated suites

```sh
pnpm env:up        # this worktree's stack; confirm ports and project name with `pnpm env:status`
pnpm --filter @the-stacks/server db:migrate   # applies 0003 (jobs)
REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test
pnpm ci:check
```

Expected: the new unit suites (zip, collect, markdown, chunk, config) and DB suites (jobs,
worker, uploads route) pass with 0 skipped DB suites.

## 2. Sign in as the operator

```sh
OPERATOR_PASSWORD=pw pnpm --filter @the-stacks/server auth:create-operator
curl -s -c /tmp/t24.cookies -H 'content-type: application/json' \
  -d '{"username":"operator","password":"pw"}' http://localhost:3024/auth/sign-in
```

To embed during the run without a paid provider, set in `.env` before `env:up`:
`AI_PROVIDERS={"fake":{"kind":"fake","baseUrl":"fake"}}` and
`AI_PURPOSES={"embedding":{"provider":"fake","model":"fake-embed","op":"embed"}}`.
The merge-condition run uses this `fake` provider (operator ruling 2026-09-29); a paid run
is out of scope.

## 3. Merge condition (runbook, TASK-0024)

Upload each export in its delivered form. For the directory forms (PHB, LMoP), zip the
directory of per-chapter zips into a scratch file outside the repo first:

```sh
S=/Volumes/evan/dnd-sourcebooks; T=$(mktemp -d)
(cd "$S" && zip -0 -r "$T/phb.zip" players-handbook-zip)
(cd "$S" && zip -0 -r "$T/lmop.zip" lost-mines-of-phandelver-zip)
# multipart/form-data (operator ruling 2026-09-29): `book` field first, then the file part.
up() { curl -s -b /tmp/t24.cookies -o /dev/stderr -w '%{http_code}\n' \
  -F "book=$1" -F "file=@$2" http://localhost:3024/library/uploads; }
up "Players Handbook"  "$T/phb.zip"
up "Lost Mine"         "$T/lmop.zip"
up "Dungeon Masters Guide" "$S/dmg-zip.zip"
up "Monster Manual"    "$S/monster_manual.zip"
up "Xanathars"         "$S/xanathars-guide-to-everything.zip"
up "Single Page"       <one extracted chapter .html, in $T>
up "Markdown Sample"   <any .md file, e.g. README.md>
```

Upload one at a time; wait for each job to reach a terminal state before the next.

**Peak RSS during the MM upload** (proves AC #7): the app's Node process is PID 1 in the
container. Sample its RSS every 0.5 s for exactly the duration of the MM `curl`:

```sh
P=stacks-task-0024
( while :; do docker compose -p $P exec -T app awk '/VmRSS/{print $2}' /proc/1/status; sleep 0.5; done ) > "$T/rss.txt" &
up "Monster Manual" "$S/monster_manual.zip"; kill %1
sort -n "$T/rss.txt" | sed -n '1p;$p'    # baseline (min) and peak (max), kB
```

The worker is nudged when the upload returns, so parsing starts after sampling stops.
Pass (SC-002): peak minus baseline is below 64 MB (half of the 128 MB upload).

**Job status and chunk count**:

```sh
curl -s -b /tmp/t24.cookies http://localhost:3024/library/jobs | jq '.jobs[] | {book,status,error,chunks:.result.chunkCount,pages:.result.pages,embedding:.result.embedding}'
```

Record per book in the PR body: HTTP result, job status, chunk count, and the MM peak RSS.
Record `UPLOAD_MAX_BYTES` (default 1 GiB) and where it is documented (`.env.example`,
`docs/wiki/configuration.md`). XGtE failing is recorded and carded, not a blocker, unless
the worker crashes (the app keeps serving `/health` and later jobs still run).

Delete `$T` afterwards.

## 4. Restart mid-ingest (spot check)

Upload MM, wait for `stage` = `store`, then `docker compose -p stacks-task-0024 restart app`.
Within ~62 s of the last heartbeat the job returns to `running` with `attempts` = 2 and
finishes `succeeded` with the same chunk count as before.

## 5. Teardown

```sh
pnpm env:down
pnpm env:prune --check   # exits 0
```
