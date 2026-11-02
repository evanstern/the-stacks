---
name: playtest-run
description: Run a human playtest of the-stacks beside the operator, end to end. Verify the target is current, derive a tracked checklist, watch every DM turn through the debug routes, report cost against a ceiling, triage findings to board cards, and wrap with the auditor. Use this whenever the user says "run a playtest", "start alpha run N", "watch the playtest", "rehearse the alpha", "log this playtest finding", "preflight the alpha", or asks what a playtest turn did or cost, even if they do not say "skill".
---

# playtest-run

Run the playtest in the operator's own session. Do not create an agent. Do not add dependencies.
The operator plays. You prepare, watch, report, log and triage.

## Hard rules

1. Propose every vm-104 command as the exact command. Wait for the operator's go on that command. A generic "go ahead" does not count.
2. Start no paid model run without a ceiling. Record the ceiling on the card under test, in the operator's words.
3. Edit the board with the `backlog` CLI only. Never use the backlog MCP tools: they edit the root checkout's copy.
4. Commit board edits direct to main. Push them at once. Search for a covering card before you create one.
5. Keep the log in the shared notes folder during the run. Land it under `docs/playtests/` by PR at the end.
6. Build no UI with modals. Use slide-out panels. Automate Brave, not Chrome.
7. Never read, print or store a password or token. Keep local test credentials in a JSON file outside the repo.

## 1. Choose the target

Ask the operator for the target. Ask for the card under test and its ceiling.

Rehearse on a local stack before every hosted run (Section 3).

### Local stack

1. Run `pnpm env:up` in your worktree.
2. Migrate both databases by hand. Follow `specs/053-env-fake-dm-script/quickstart.md`, step 2.
3. For a scripted DM, append `DM_FAKE_SCRIPT=<name>` with `printf`. Names live in `apps/server/dm-scripts/`. Rebuild and recreate the app container (`docker compose -p stacks-<env> up -d --build --force-recreate --wait app`): the scripts are baked into the image.
4. Expect the boot line `DM script mode: <name>`.
5. Create the operator inside the app container with a generated password. Store it in the creds file as `{"operator": {"username", "password"}}`.
6. Run `node .claude/skills/playtest-run/scripts/local-table.mjs seed <creds> <port> [seedId] [character[,character]]`. It adds a second account and starts a scene. A second character seats `player2`. It prints the session id.
7. Drive scripted turns with `local-table.mjs talk` and `local-table.mjs act <creds> <port> <session> "<text>" <character> <actionId> [operator|player]`. Each scripted call is consumed in order: act in the order the script expects.

### Hosted dev (vm-104)

1. Read `docs/ops/dev-vm-104.md`. It holds the health, backup, deploy and two-player steps.
2. Propose each hosted command to the operator, one at a time, exactly as written. Wait for the go on each.
3. Ask the operator to sign in once in the browser pane. Never ask for the password in chat.
4. Read the debug routes from that page (Section 4).

## 2. Check freshness

Run `node .claude/skills/playtest-run/scripts/freshness.mjs --health <base-url> --since <date of the last run>`.

Read the verdict. If `STALE`, propose a deploy and a named backup (`node scripts/deploy-dev.mjs backup --name pre-<card>-alpha-<n>`). Wait for the go on each.

Copy the merged PRs and Done cards into the log header. They feed the checklist.

## 3. Rehearse

Run the full flow once on a local stack with `DM_FAKE_SCRIPT` before a hosted run. Post a few turns with `local-table.mjs talk`. Watch them, log one sample finding, run the triage search, and run the auditor at wrap. Do not create cards in a rehearsal. Print the would-be command instead. Commit the rehearsal log as evidence.

## 4. Derive the checklist

1. Start the log from `references/log-template.md`. Use the log format of `docs/playtests/2026-10-28-two-browser-alpha.md`.
2. Run `checklist.mjs derive --prev <last log> --cards <merged card ids> --under-test <TASK-n>:<ac numbers> [--scenario <checklist file>]`. Pass the runbook's checklist file as `--scenario` (Section 8).
3. Paste the table into the log. Each row keeps its id for ever.
4. Roll-forward: a row that was `pending`, `blocked` or `not reached` last run returns as `not reached` under the same id.
5. Update a row with `checklist.mjs set <log> <id> <pass|fail|blocked|not reached|pending> "<note>"`.
6. Give the operator the checklist in plain order. Tell them which rows need two windows.

## 5. Watch turns

Poll about every 15 seconds, and after each operator message. Never poll the `/dm` routes for a player: they are operator-only.

- **Local:** `node scripts/watch.mjs --state <state-file> --ceiling <usd> --base http://localhost:<port> --creds <creds> --session <id>`.
- **Hosted:** run `references/hosted-fetch.js` with `mcp__Claude_Browser__javascript_tool` in the signed-in page. Set `SESSION` first. Write the returned JSON to a file. Run `node scripts/watch.mjs --state <state-file> --ceiling <usd> --input <file>`.

The script reports each new finished turn: job kind and trigger, status, duration, attempts, model calls (not-ok, invalid-json, retries), cost and the narration text. It prints a running total.

Relay each report to the operator in two lines. Flag failed turns, `invalid-json`, retries and turns over 45 s. Check each narration against the deterministic rules in `apps/server/src/playtest/auditor/checks.ts` (prose digits, dice lines, life states, hidden information, dice language).

### Spend

The script totals `costUsd` from the calls ledger. It warns at 50% and 80% of the ceiling. At a warning, tell the operator at once. At 100%, stop and ask whether to raise the ceiling.

## 6. Log and triage findings

1. Add a row to the log table: `# | Time | Seat | Class | Observation | Existing card | Card`.
2. Classes: bug, rough edge, missing feature, rules/DM quality, positive.
3. Search the board: `node scripts/triage.mjs "<keywords>" --title "<new title>" --refs "<log path>"`. Try two or three keyword sets, and `backlog task list -l playtest --plain`.
4. A match covers the finding: append evidence with `backlog task edit TASK-n --append-notes "..."`. Write that card in the `Existing card` column.
5. No match: create a card with `backlog task create`. Reference the log. Write the new id in the `Card` column.
6. Record the choice in the log either way.
7. Push the board commit to main at once. Run the commit in its own Bash call, with the literal path.

## 7. Wrap

1. Run the auditor on the session: `pnpm playtest audit --session <id> --db-url <host-side db url> --auditor fake` (local stack; the host port is `DB_PORT` in `.env`, not the container's `db:5432`). Drop `--auditor fake` for the deterministic checks alone. On hosted dev, propose the command for the operator's go. Add `--spend-ceiling-usd` if it would call a paid model, and only with a recorded ceiling.
2. Write the run summary in the log: session id, commit, checklist counts (`checklist.mjs summary`), blockers, new cards, evidence added, spend against the ceiling, and the auditor verdict.
3. Add a note to the card under test: `backlog task edit <id> --append-notes`. Tick an AC only with evidence from the run.
4. Open a PR that lands the log under `docs/playtests/`. The operator approves it.
5. Leave `not reached` rows in the log. The next run rolls them forward.

## 8. Per-runbook scenario

Each sweep runbook ships a scenario: a seed, an optional `DM_FAKE_SCRIPT` setup script, and a checklist file. Convention: `docs/design/playtest-scenarios.md`.

1. Read the runbook's "Last step". It names the scenario's seed, script and checklist file.
2. Rehearse on a local stack first: seed with the scenario's seed, set its script, drive it with `talk` and `act`. Commit the rehearsal log under `docs/playtests/`.
3. For the real run, start the seed with no script unless the operator asks for one. Paid-model turns stay paid. Derive the checklist with `--scenario <checklist file>`.
4. Runbook A's scenario: seed `greyhollow-ford-reed-camp`, script `runbook-a-reed-camp`, checklist `docs/playtests/scenarios/runbook-a-reed-camp.md`.
