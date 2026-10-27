# Contract: the M2 demo runbook and the demo record

Files: `docs/design/m2-demo.md` (runbook section plus record template, Phase 5; filled at the
demo, Phase 6), `docs/design/m2-demo/` (attachments, Phase 6). FR-025 to FR-028. Milestone M2:
"one human player plus AI companions play a scene — exploration, a social beat and a fight — to
its end. The engine rolls every die; the narration never contradicts the ledger; the playtest
auditor's report is attached."

**Roles.** The orchestrator drives the stack, the CLI and the record. The operator plays the
human seat, approves every paid run, and signs each `accepted` or `false-positive` resolution.
No implementer dispatch runs the demo.

## Runbook (the text Phase 5 writes into `docs/design/m2-demo.md`)

### A. Preconditions

1. Confirm `pnpm ci:check` is green on the task branch, with the DB suites run under
   `REQUIRE_DATABASE=1`.
2. Run `pnpm env:up` in the task worktree.
3. Run `pnpm env:status` and note `APP_PORT` and the database URL.
4. If the stack's databases are unmigrated (TASK-0098), run
   `pnpm --filter @the-stacks/server db:migrate` against the app URL and the test URL.
5. Confirm an operator account exists. On a fresh stack, the operator runs
   `pnpm --filter @the-stacks/server auth:create-operator` and types the password.

### B. Checkpoint: provider configuration (operator)

1. The operator puts `AI_PROVIDERS`, `AI_PURPOSES` (seven `dm.*` purposes plus
   `playtest.audit`), `AI_PRICES` and the key variables in the root checkout's `.env`.
2. The orchestrator runs `pnpm playtest estimate`.
3. The orchestrator shows the operator the provider names, the model per purpose, and the
   estimate.
4. The operator names a spend ceiling for the scripted playtest and one for each audit.
5. The orchestrator records the approval, the models and the ceilings on TASK-0048 with
   `backlog task edit TASK-0048 --append-notes` from the worktree.
6. Run `pnpm env:down` and `pnpm env:up` so the app container reads the new `.env`.
7. Confirm the app's boot log shows no "unconfigured purposes" warning.

### C. The paid scripted playtest

1. Run `pnpm playtest run --mode provider --spend-ceiling-usd <ceiling>`.
2. Copy its run directory to `docs/design/m2-demo/provider-playtest/`.
3. Note its outcome, verdict and spend for the record.
4. On outcome `failed` or `timed-out`, stop and report to the operator before the demo.

### D. The demo (operator plays in Brave)

1. The orchestrator generates a session id: `uuidgen | tr 'A-Z' 'a-z'`.
2. The operator signs in at `http://localhost:<APP_PORT>` in Brave.
3. The operator opens `http://localhost:<APP_PORT>/play/<session id>`.
4. The operator runs, in Brave's console on that page:
   `const me = await (await fetch('/auth/me')).json()`.
5. The operator runs, in the same console:
   `await fetch('/dm/sessions/<session id>/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seedId: 'greyhollow-ford', seats: { tamsin: me.user.id } }) })`.
   (`/auth/me` returns `{ user: { id, displayName, role } }`.)
6. Confirm the response is `202` and the opening narration appears.
7. The operator plays Tamsin through the ferry-house, the talk with Wenna and the fight at the
   reed camp, until the scene ends.
8. The orchestrator watches `GET /dm/sessions/<session id>/turns` for failed jobs and audit
   flags. The orchestrator does not type at the table.
9. On a failed turn, the operator may retry with `POST /dm/sessions/<session id>/turn`. Record
   each retry.
10. The orchestrator takes one Brave screenshot of the table at the scene's end, in light mode,
    and saves it to `docs/design/m2-demo/scene-end.png`.

### E. Audit the demo session

1. Run `pnpm playtest audit --session <session id> --db-url <app database URL> --auditor provider --spend-ceiling-usd <ceiling> --out docs/design/m2-demo/demo-session`.
2. Read `report.md` for both run directories.

### F. Write the record

1. Fill the record template below in `docs/design/m2-demo.md`.
2. Add one failure-table row for each finding and each DM-runtime audit flag in both reports.
3. Resolve each row as `fixed`, `carded`, `accepted` or `false-positive`.
4. For `fixed`, cite the commit. For `carded`, create the card with the `backlog` CLI in the
   worktree and cite its id.
5. For `accepted` or `false-positive`, write the operator's reason and get the operator's
   sign-off in the record.
6. Card each failed demo criterion. That card blocks M2 close (runbook).
7. Commit the record and `docs/design/m2-demo/` on the task branch.

## Record template

```markdown
# M2 demo record — The Bell at Greyhollow Ford

**Date**: <YYYY-MM-DD> · **Commit**: <sha> · **Stack**: worktree task-0048 · **Browser**: Brave
**Human seat**: the operator as Tamsin Vale · **DM seat**: AI · **Companions**: Brother Odo, Kestrel (AI)
**Models**: <purpose → provider/model, from run.json; names only>
**Paid-run approval**: <card note reference, ceilings>

## Milestone criteria

| Criterion | Evidence | Met |
|---|---|---|
| One human plus AI companions play to the scene's end | demo-session/transcript.jsonl rows <seq of scene start> … <seq of scene end> | yes/no |
| Exploration, a social beat and a fight | rows <seqs> | yes/no |
| The engine rolls every die | demo-session/ledger.json; every roll row from the engine; report check `dice-lines` | yes/no |
| The narration never contradicts the ledger | demo-session/report.md: zero `ledger-contradiction` findings, or each one resolved below | yes/no |
| The auditor's report is attached | demo-session/report.md, provider-playtest/report.md | yes/no |

## Runs

| Run | Session | Outcome | Verdict | Findings (fail/warn/note) | Spend |
|---|---|---|---|---|---|
| Scripted playtest (provider) | <uuid> | <outcome> | <verdict> | <n/n/n> | <$> |
| Demo session | <uuid> | ended | <verdict> | <n/n/n> | <$ audit only> |

## Audit failures and resolutions

Every finding and DM-runtime audit flag from both reports, one row each.

| Run | Finding | Severity | Kind | Source | Rows | Doctrine | Detail | Resolution | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| demo | F1 | fail | ledger-contradiction | check | 41, 42 | — | … | fixed / carded / accepted / false-positive | commit / TASK-x / operator reason |

## Fight statistics (TASK-0055 evidence)

<copied from both reports' fight sections; no judgment on the parked rules here>

## Retries and incidents

<each manual turn retry, failed job, or stop, with its time and job id>

## Attachments

- `m2-demo/provider-playtest/` — run.json, transcript.jsonl, transcript.md, ledger.json, jobs.json, usage.json, report.json, report.md
- `m2-demo/demo-session/` — the same set (no usage.json for the play itself)
- `m2-demo/scene-end.png`

## Sign-off

Operator: <name, date> — the `accepted` and `false-positive` rows above.
```

## Wiki

The re-ground phase adds `docs/wiki/m2-demo.md` beside `m0-demo` (how the demo is run, where
the record lives) and `docs/wiki/playtest-harness.md` (the harness, the auditor, the modes).
