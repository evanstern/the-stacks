# M2 demo — runbook and record

**Status**: Template — filled at the M2 demo, TASK-0048 Phase 6.

Milestone M2 (`docs/design/milestones.md`): one human player plus AI companions play a scene —
exploration, a social beat and a fight — to its end. The engine rolls every die; the narration
never contradicts the ledger; the playtest auditor's report is attached.

**Roles.** The orchestrator drives the stack, the CLI and the record. The operator plays the
human seat in Brave, approves every paid run, and signs each `accepted` or `false-positive`
resolution. No implementer dispatch runs the demo.

Source contract: `specs/032-playtest-harness/contracts/demo-runbook.md`. Run every command
from the task worktree (`.worktrees/task-0048`). Attachments go in `docs/design/m2-demo/`.
Leave every result slot in the record empty until the step that produces it has run.

## A. Preconditions

1. Confirm `pnpm ci:check` is green on the task branch, with the DB suites run under
   `REQUIRE_DATABASE=1`.
2. Run `pnpm env:up` in the task worktree.
3. Run `pnpm env:status` and note `APP_PORT` and the database URL.
   `pnpm env:up` prints the ports (app, db, test-db) and writes `TEST_DATABASE_URL` (test-db port)
   into the worktree `.env`. The app database URL is that value with the db port in place of the
   test-db port. Source `.env` first (`set -a && . ./.env && set +a`).
4. If the stack's databases are unmigrated (TASK-0098), run
   `pnpm --filter @the-stacks/server db:migrate` against the app URL and the test URL.
5. Confirm an operator account exists. On a fresh stack, the operator runs
   `pnpm --filter @the-stacks/server auth:create-operator` and types the password.

Dry check (no provider): `pnpm playtest estimate` exits 4 and names the purposes missing from
`AI_PURPOSES` plus any model with no `AI_PRICES` entry. Exit 0 appears only after section B.

## B. Checkpoint: provider configuration (operator)

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

## C. The paid scripted playtest

1. Run `pnpm playtest run --mode provider --spend-ceiling-usd <ceiling>`. On the host, the CLI rewrites `host.docker.internal` in `AI_PROVIDERS` base URLs to `localhost` and logs each rewrite. Set `PLAYTEST_HOST_NETWORK=0` to disable it.
2. Copy its run directory to `docs/design/m2-demo/provider-playtest/`.
3. Note its outcome, verdict and spend for the record.
4. On outcome `failed` or `timed-out`, stop and report to the operator before the demo.

## D. The demo (operator plays in Brave)

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

## E. Audit the demo session

1. Run `pnpm playtest audit --session <session id> --db-url <app database URL> --auditor provider --spend-ceiling-usd <ceiling> --out docs/design/m2-demo/demo-session`.
2. Read `report.md` for both run directories.

## F. Write the record

1. Fill the record template below in `docs/design/m2-demo.md`.
2. Add one failure-table row for each finding and each DM-runtime audit flag in both reports.
3. Resolve each row as `fixed`, `carded`, `accepted` or `false-positive`.
4. For `fixed`, cite the commit. For `carded`, create the card with the `backlog` CLI in the
   worktree and cite its id.
5. For `accepted` or `false-positive`, write the operator's reason and get the operator's
   sign-off in the record.
6. Card each failed demo criterion. That card blocks M2 close (runbook).
7. Commit the record and `docs/design/m2-demo/` on the task branch.

---

# Record template

Copy the block below into the record section of this file at the demo (Phase 6). Replace each
`<slot>`. Leave a slot empty if its step did not run; never invent a result.

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

---

# M2 demo record — The Bell at Greyhollow Ford

**Status**: DRAFT — every result slot is filled from the run artifacts; the resolutions are the
orchestrator's **proposals** and wait for the operator's sign-off (section "Sign-off").

**Date**: 2026-10-26 · **Commit**: app built at `53a78fa` (stack `5620ad9`); audit run at `2b9b1f1` · **Stack**: worktree task-0048 (`stacks-task-0048`, :3048) · **Browser**: Brave
**Human seat**: the operator as Tamsin Vale · **DM seat**: AI · **Companions**: Brother Odo, Kestrel (AI)
**Models**: director, adjudicate, playtest.audit → claude/`cc/claude-opus-5`; interpret, narrate, companion → claude/`cc/claude-sonnet-5`; dm.audit, chronicle → claude/`cc/claude-haiku-4-5-20251001`; embedding → ollama/`bge-m3`. maxTokens: director 1500, adjudicate 1500, interpret 2500, companion 800, chronicle 1000, narrate 1500, dm.audit 300, playtest.audit 700.
**Paid-run approval**: TASK-0048 card — scripted playtest ceiling $22 ("Approved: spend ceiling $22 for the M2 demo's paid scripted playtest (section C). The $6 demo-session audit ceiling stands."); demo audit ceiling $6.

## Milestone criteria

| Criterion | Evidence | Met |
|---|---|---|
| One human plus AI companions play to the scene's end | demo-session/transcript.jsonl rows 1 (scene start) … 330 (`scene.changed` after=null: "Clapper recovered, Pell returned, goblin camp abandoned, and the line caught — the ferry hauls across with the party aboard before full dark") | yes |
| Exploration, a social beat and a fight | exploration: ferry-house search and stealth (first roll row 22) through row 36; social: Odo's parley (row 35) and the talk with Wenna (first named row 42) before the fight; fight: `encounter.started` row 115 … `encounter.ended` row 300 (5 rounds, goblin-3 dead, the rest fled) | yes |
| The engine rolls every die | demo-session/ledger.json (32 rolls, every one an engine `dice.rolled`); report check `dice-lines` passes | yes |
| The narration never contradicts the ledger | demo-session/report.md: 3 `ledger-contradiction` findings (F40, F49, F52) — proposed resolutions below (1 carded, 2 false-positive) | **pending operator sign-off** |
| The auditor's report is attached | demo-session/report.md, provider-playtest-stalled-5/report.md | yes |

## Runs

| Run | Session | Outcome | Verdict | Findings (fail/warn/note) | Spend |
|---|---|---|---|---|---|
| Scripted playtest (provider), run 5 | aa5fd84f-4484-4b96-a795-bfc3bc729ba1 | stalled (30-move cap; scripted seat out of script) | incomplete | 13/64/32 | $7.52 |
| Demo session | e8c848ec-11e9-442d-9bfa-8c26a0d84fcd | ended | incomplete | 11/24/23 | $2.87 (audit only) |

Earlier paid scripted runs 1, 2 and 4 (`provider-playtest-failed-1/`, `-failed-2/`, `-failed-4/`) failed on
defects since fixed: run 1 host networking (D4, `31f61f7`); runs 2 and 4 director invalid-output
(TASK-0102, #50). Run 3 refused to start (estimate above the $20 ceiling). Run 5's narration
defects were fixed by TASK-0106 (#51).

## Audit failures and resolutions

Every finding from both reports, one row each (generated from each `report.json`; details as the
auditor wrote them). DM-runtime audit flags appear as `dm-audit-flag` notes. The demo session's
own in-runtime fallbacks: 10 of 44 narrations (seq 26, 66, 126, 130, 162, 177, 181, 232, 268,
275) — causes: digits from model-written roll reasons (TASK-0111), invented wounds and hits
(TASK-0113), player-agency on world characters or involuntary reactions (TASK-0113, operator
ruling), fail-forward read as invented mechanics (finding 4).

| Run | Finding | Severity | Kind | Source | Rows | Doctrine | Detail | Proposed resolution |
|---|---|---|---|---|---|---|---|---|
| demo | F1 | warn | doctrine | auditor | 22, 23, 25 | fail-forward | The failed stealth check produces no new problem — the loft creaker neither reacts nor advances anything, leaving the scene stalled. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F2 | warn | doctrine | auditor | 25 | end-on-demand | The narration ends on a flat summary of the miss rather than anything that demands a response from the player. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F3 | warn | doctrine | auditor | 25 | blame-the-situation | "Tamsin Vale comes up short" pins the failure on the hero instead of on something the world did (a loose board, a shifting chain). | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F4 | note | dm-audit-flag | dm-audit | 25 | — | final: fallback; attempts: 3; issues: invented-mechanics, doctrine, player-agency | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F5 | warn | doctrine | auditor | 26, 33 | end-on-demand | Narration #33 closes with the direct prompt "What does Tamsin do with the loft gone quiet above her?" instead of ending on a world detail that demands response — the same closing-question habit already flagged in row #26. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F6 | fail | player-agency | auditor | 42 | hero-is-theirs | The closing line "What does Tamsin say to Wenna..." decides for the player that Tamsin speaks rather than acts, and names Wenna before the hero could know the name. | carded — TASK-0113 (closing line decides speech; names Wenna early) |
| demo | F7 | fail | player-agency | auditor | 58, 65 | hero-is-theirs | The player only asked Kestrel for a suggestion, but narration #65 decides that Tamsin Vale accepts and commits to the scouting plan. | carded — TASK-0113; operator finding 1 (a question asked as an action) |
| demo | F8 | warn | doctrine | auditor | 65 | end-on-demand | The turn closes on a flat summary line that gives the player nothing to respond to. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F9 | note | dm-audit-flag | dm-audit | 65 | — | final: fallback; attempts: 3; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F10 | warn | doctrine | auditor | 70, 74 | world-moves | The darkness tracker advanced to 3/4 but the narration shows no consequence of the failing light. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F11 | warn | doctrine | auditor | 74 | end-on-demand | The beat closes on stillness and an open prompt ('Nothing stirs nearby... What does Kestrel do now?') instead of something demanding a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F12 | note | dm-audit-flag | dm-audit | 74 | — | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F13 | warn | doctrine | auditor | 83 | end-on-demand | The narration closes with a bare prompt ("What does Tamsin do...") rather than a world event that demands a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F14 | note | dm-audit-flag | dm-audit | 83 | — | final: passed-after-regenerate; attempts: 2; issues: doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F15 | note | dm-audit-flag | dm-audit | 125 | — | final: fallback; attempts: 3; issues: ledger-mismatch | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F16 | warn | doctrine | auditor | 126, 129 | one-sense | After three rejected attempts the surviving narration is a mechanical stub with no vivid sensory detail of what Snag actually did. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F17 | warn | doctrine | auditor | 129 | end-on-demand | The narration closes on a bare turn-order announcement that demands nothing of the player. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F18 | note | dm-audit-flag | dm-audit | 129 | — | final: fallback; attempts: 3; issues: player-agency, invented-mechanics, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F19 | fail | player-agency | auditor | 137, 130 | hero-is-theirs | The narration still dictates Tamsin's reaction and perception — "before Tamsin can even mark its face" and "before she can flinch away" — the same agency problem flagged at row #130. | proposed accepted — involuntary perception ('before she can flinch'); operator ruling 2026-10-26 on TASK-0113 |
| demo | F20 | note | dm-audit-flag | dm-audit | 137 | — | final: passed-after-regenerate; attempts: 2; issues: ledger-mismatch | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F21 | note | dm-audit-flag | dm-audit | 140 | — | final: passed-after-regenerate; attempts: 2; issues: invented-mechanics, player-agency, other | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F22 | fail | invented-mechanics | auditor | 147, 148, 152 | numbers-from-state | The narration asserts Odo has "no second mercy left in him tonight", declaring a depleted healing resource that no ledger row tracks or spends. | carded — TASK-0113 (narration implies a spent healing resource no ledger row tracks) |
| demo | F23 | note | dm-audit-flag | dm-audit | 152 | — | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F24 | warn | doctrine | auditor | 157, 161 | fail-forward | The miss produces no new problem or pressure — the narration just restates the whiff and passes the turn, stalling the scene. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F25 | warn | doctrine | auditor | 161 | blame-the-situation | The failed roll is narrated as "Tamsin Vale misses" with no world cause (mud, pot-helm, firelight) given for it. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F26 | warn | doctrine | auditor | 161 | end-on-demand | The turn closes on bookkeeping ("Kestrel moves next") rather than on something that demands a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F27 | note | dm-audit-flag | dm-audit | 161 | — | final: fallback; attempts: 3; issues: player-agency, doctrine, invented-mechanics | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F28 | note | dm-audit-flag | dm-audit | 169 | — | final: passed-after-regenerate; attempts: 2; issues: doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F29 | note | dm-audit-flag | dm-audit | 176 | — | final: fallback; attempts: 3; issues: player-agency, doctrine, ledger-mismatch | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F30 | warn | doctrine | auditor | 180 | end-on-demand | The narration is a flat turn-order status line ('Snag makes a move. Goblin lookout moves next.') that neither shows what Snag did nor ends on anything demanding a player response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F31 | note | dm-audit-flag | dm-audit | 180 | — | final: fallback; attempts: 3; issues: player-agency, invented-mechanics, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F32 | fail | player-agency | auditor | 181, 184 | hero-is-theirs | After the row #181 flag that Pell is a party member only the player controls, the rewrite still narrates his action — 'Pell thrashes' — deciding a player character's move. | proposed false-positive — Pell is a world character, not a party member; auditor scope (TASK-0113 F7 note) |
| demo | F33 | note | dm-audit-flag | dm-audit | 184 | — | final: passed-after-regenerate; attempts: 2; issues: doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F34 | fail | player-agency | auditor | 187 | hero-is-theirs | The narration assigns the hero an inner state and inaction by calling Snag delighted at 'the big-feet's hesitation' and declaring Odo 'kneeling spent'. | carded — TASK-0113 (inner state assigned to the hero) |
| demo | F35 | note | dm-audit-flag | dm-audit | 187 | — | final: passed-after-regenerate; attempts: 2; issues: invented-mechanics, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F36 | note | dm-audit-flag | dm-audit | 220 | — | final: passed-after-regenerate; attempts: 2; issues: ledger-mismatch | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F37 | warn | doctrine | auditor | 225 | end-on-demand | The beat closes on a static prompt — "What does the party do while he weighs his dwindling odds?" — instead of something that demands a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F38 | warn | doctrine | auditor | 231 | end-on-demand | The turn ends on a bare schedule note ("Brother Odo moves next") with the goblin's action left as an empty "makes a move", so nothing concrete demands a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F39 | note | dm-audit-flag | dm-audit | 231 | — | final: fallback; attempts: 3; issues: player-agency, doctrine, invented-mechanics | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F40 | fail | ledger-contradiction | auditor | 248, 253 | numbers-from-state | The roll line calls Pell "her" but the narration calls Pell "he", contradicting the committed check description. | carded — TASK-0111 (model-written roll reason text: pronoun from the reason, not the narration) |
| demo | F41 | warn | doctrine | auditor | 253 | end-on-demand | The turn closes with the flat prompt "What does Kestrel do now?" instead of a pressure that demands a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F42 | warn | doctrine | auditor | 267 | end-on-demand | The turn closes on a bare turn-order note ("Snag moves next") instead of a concrete world event that demands the player's response, and never says what the pot-helmed goblin actually did. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F43 | note | dm-audit-flag | dm-audit | 267 | — | final: fallback; attempts: 3; issues: ledger-mismatch, invented-mechanics, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F44 | fail | invented-mechanics | auditor | 268, 271 | numbers-from-state | The narration again gives Snag a bleeding shoulder wound that row #268 already flagged as having no backing fact record. | carded — TASK-0113 (invented wound with no damage fact) |
| demo | F45 | warn | doctrine | auditor | 274 | end-on-demand | The turn closes on a flat procedural note ("Brother Odo moves next") with no concrete event from the goblin's action that demands a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F46 | note | dm-audit-flag | dm-audit | 274 | — | final: fallback; attempts: 3; issues: player-agency, doctrine, invented-mechanics | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F47 | warn | doctrine | auditor | 283, 275 | end-on-demand | The narration closes with the direct prompt "What does Tamsin do?" instead of a world beat demanding response — the same flaw the audit flag at #275 already called out. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F48 | note | dm-audit-flag | dm-audit | 299 | — | final: passed-after-regenerate; attempts: 2; issues: player-agency, invented-mechanics, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F49 | fail | ledger-contradiction | auditor | 300, 302 | numbers-from-state | Row #300 states Snag and both remaining goblins fled, but the narration has only Snag and the pot-helm goblin leaving while the fire-goblin's coals hiss untended, dropping one fleeing goblin from the scene. | proposed false-positive — rows 300-301 say all remaining goblins fled; the narration's two-fled-plus-abandoned-coals is consistent |
| demo | F50 | warn | doctrine | auditor | 302 | end-on-demand | The turn closes on a quiet, settled tableau and then asks "What does Tamsin do?", the exact pattern end-on-demand forbids. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F51 | note | dm-audit-flag | dm-audit | 302 | — | final: passed-after-regenerate; attempts: 2; issues: player-agency, invented-mechanics, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F52 | fail | ledger-contradiction | auditor | 303, 307 | — | The narration declares "No goblins left to fight for it now" and the camp abandoned, but the last recorded state has Snag and a pot-helmed goblin at the bloodied Tamsin's back with no row showing them killed, driven off or the clapper dropped. | proposed false-positive — auditor compares against pre-flight state; row 301 records no hostiles left |
| demo | F53 | warn | doctrine | auditor | 307 | end-on-demand | The turn closes on a quiet prompt, "What do you do about the rope?", instead of something in the world that demands a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F54 | note | dm-audit-flag | dm-audit | 307 | — | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F55 | fail | player-agency | auditor | 317 | hero-is-theirs | The phrase "before she can wave him off" assigns Tamsin an intent and a thwarted gesture the player never declared. | carded — TASK-0113 (thwarted intent assigned to the hero) |
| demo | F56 | warn | doctrine | auditor | 317 | end-on-demand | The beat closes on a settled, quiet tableau and a bare prompt ("What does Tamsin do with the rope?") rather than on something that demands a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| demo | F57 | note | dm-audit-flag | dm-audit | 317 | — | final: passed-after-regenerate; attempts: 3; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| demo | F58 | warn | doctrine | auditor | 326 | end-on-demand | Narration #326 closes on a slack prompt ("What does Tamsin do now that the line is caught?") instead of a world beat that demands a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F1 | warn | doctrine | auditor | 15, 16 | fail-forward | The resolved search produces nothing at all, stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F2 | warn | doctrine | auditor | 16 | end-on-demand | The turn ends on a flat non-event that demands no response from the player. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F3 | note | dm-audit-flag | dm-audit | 16 | — | final: fallback; attempts: 3; issues: ledger-mismatch, player-agency, doctrine, invented-mechanics | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F4 | warn | doctrine | auditor | 29, 32, 33 | fail-forward | The resolved action into the reeds produces "nothing changes" — a stalled scene with no new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F5 | warn | doctrine | auditor | 31, 33 | world-moves | The dark-falls tracker advanced to 3/4 but the narration shows no consequence of the world moving. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F6 | warn | doctrine | auditor | 33 | end-on-demand | The narration ends on a dead beat that gives the player nothing to respond to. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F7 | note | dm-audit-flag | dm-audit | 33 | — | final: fallback; attempts: 3; issues: player-agency, doctrine, ledger-mismatch | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F8 | warn | doctrine | auditor | 53 | end-on-demand | Narration #53 ends on a flat meta-summary ('The party enters a fight') rather than a concrete beat that demands a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F9 | warn | doctrine | auditor | 53 | fail-forward | 'Tamsin Vale acts, and nothing changes' stalls the scene instead of turning the failure into a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F10 | warn | doctrine | auditor | 53 | plain-prose | 'One action needs a clearer description' is out-of-fiction system commentary in place of prose. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F11 | warn | doctrine | auditor | 53 | world-not-hero | Four combatants and a triggered lookout sighting (rows 39-42, 51) are reduced to an abstract statement with no world detail or named threat. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F12 | note | dm-audit-flag | dm-audit | 53 | — | final: fallback; attempts: 3; issues: player-agency, doctrine, other | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F13 | warn | doctrine | auditor | 55, 58 | world-moves | The alert tracker filled to 3/3 at row #55, but the narration at row #58 shows no consequence of the camp being fully alerted. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F14 | warn | doctrine | auditor | 58 | end-on-demand | The narration is a two-word stub that names an action without showing anything concrete, so it leaves nothing for the player to respond to. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F15 | warn | doctrine | auditor | 58 | one-sense | The scene offers no vivid non-visual detail at all, only the bare assertion that Snag acts. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F16 | note | dm-audit-flag | dm-audit | 58 | — | final: fallback; attempts: 3; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F17 | fail | ledger-contradiction | auditor | 60, 61, 64 | — | The ledger resolves a melee jab by Goblin-3 at Tamsin, but the narration recasts it as a dagger thrown down from a lookout above in the reeds. | fixed — TASK-0106 (#51, bb5cbb7): rerun 20261026T192319Z had 0 leaks and 0 narration-caused contradictions |
| run 5 | F18 | note | dm-audit-flag | dm-audit | 64 | — | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F19 | warn | doctrine | auditor | 77, 80 | fail-forward | The attack resolved in the ledger but the narration says nothing changes, stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F20 | warn | doctrine | auditor | 80 | end-on-demand | The turn ends on a flat non-event that gives the player nothing to respond to. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F21 | warn | other | auditor | 80 | — | The second sentence is out-of-fiction meta-commentary about the player's phrasing rather than prose narration of the world. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F22 | note | dm-audit-flag | dm-audit | 80 | — | final: fallback; attempts: 3; issues: doctrine, player-agency, other, ledger-mismatch | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F23 | fail | ledger-contradiction | auditor | 85, 86, 88 | fail-forward | The ledger records a real shift — encounter ended, initiative dropped, the scene turned social — but the narration says "nothing changes," stalling a beat the state says moved. | fixed — TASK-0106 (#51, bb5cbb7): rerun 20261026T192319Z had 0 leaks and 0 narration-caused contradictions |
| run 5 | F24 | warn | doctrine | auditor | 88 | end-on-demand | The turn closes on the flat summary "The fight is over," offering nothing that demands a response from the player while Snag stands there listening. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F25 | note | dm-audit-flag | dm-audit | 88 | — | final: fallback; attempts: 1; issues: none | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F26 | warn | doctrine | auditor | 90, 95 | fail-forward | The miss is narrated as nothing changing, stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F27 | fail | hidden-info-leak | auditor | 93 | — | Odo publicly states the clapper wards off worse things than the party, revealing the DM-only fact that the bell's ring drives off the river-things the goblins fear. | fixed — TASK-0106 (#51, bb5cbb7): rerun 20261026T192319Z had 0 leaks and 0 narration-caused contradictions |
| run 5 | F28 | warn | doctrine | auditor | 95 | end-on-demand | The turn ends on a flat non-event plus a meta request rather than something demanding a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F29 | warn | doctrine | auditor | 95 | plain-prose | The narration breaks the fiction with an out-of-world instruction about action descriptions. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F30 | note | dm-audit-flag | dm-audit | 95 | — | final: fallback; attempts: 3; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F31 | warn | doctrine | auditor | 98, 101 | ask-when-unclear | If 'I press on toward the ferry before dark' was too vague, the narration should have asked one short in-fiction question rather than reporting that an action 'needs a clearer description'. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F32 | warn | doctrine | auditor | 100, 101 | fail-forward | The resolved action produces 'nothing changes', stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F33 | warn | doctrine | auditor | 101 | end-on-demand | The turn ends on a flat non-event plus a meta note, giving the player nothing that demands a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F34 | note | dm-audit-flag | dm-audit | 101 | — | final: fallback; attempts: 3; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F35 | warn | doctrine | auditor | 107, 108 | fail-forward | The resolved action produces a flat stall ('nothing changes') with no new problem for the scene. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F36 | warn | doctrine | auditor | 108 | end-on-demand | Narration closes on an out-of-fiction request for a clearer description instead of something in the world that demands a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F37 | note | dm-audit-flag | dm-audit | 108 | — | final: fallback; attempts: 3; issues: doctrine, player-agency, other | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F38 | warn | doctrine | auditor | 111, 113, 114 | fail-forward | The action resolved at #113 but narration #114 says nothing changes, stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F39 | warn | doctrine | auditor | 114 | end-on-demand | The turn ends on a flat non-event with nothing in the world demanding a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F40 | warn | doctrine | auditor | 114 | ask-when-unclear | It reports out-of-fiction that the action needs a clearer description instead of asking one short in-fiction question. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F41 | note | dm-audit-flag | dm-audit | 114 | — | final: fallback; attempts: 3; issues: doctrine, player-agency, other | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F42 | warn | doctrine | auditor | 117, 120 | fail-forward | The narration for Tamsin's push toward the ferry resolves as "nothing changes," stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F43 | warn | doctrine | auditor | 120 | ask-when-unclear | Instead of asking one short in-fiction question about the unclear intent, it emits a meta notice that "one action needs a clearer description." | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F44 | warn | doctrine | auditor | 120 | end-on-demand | The turn ends on a flat non-event that demands no response from the player. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F45 | note | dm-audit-flag | dm-audit | 120 | — | final: fallback; attempts: 3; issues: doctrine, player-agency | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F46 | fail | hidden-info-leak | auditor | 127 | one-clue | Odo publicly states the bell's ring works as a warding charm against goblins, revealing the dm-only reason the goblins want it. | fixed — TASK-0106 (#51, bb5cbb7): rerun 20261026T192319Z had 0 leaks and 0 narration-caused contradictions |
| run 5 | F47 | warn | other | auditor | 134, 135, 136 | npc-voice | Kestrel names "Pell" and "Snag" as known figures though no public row ever introduces those names, only an unnamed boy and older figure. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F48 | warn | doctrine | auditor | 139, 140 | fail-forward | The resolved action produces "nothing changes", stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F49 | fail | invented-mechanics | auditor | 140 | plain-prose | The narration breaks fiction with an out-of-world system complaint about needing "a clearer description" instead of plain prose. | fixed — TASK-0106 (#51, bb5cbb7): rerun 20261026T192319Z had 0 leaks and 0 narration-caused contradictions |
| run 5 | F50 | note | dm-audit-flag | dm-audit | 140 | — | final: fallback; attempts: 3; issues: doctrine, player-agency | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F51 | warn | doctrine | auditor | 146, 147 | fail-forward | The resolved action is narrated as "nothing changes", stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F52 | warn | doctrine | auditor | 147 | end-on-demand | The turn closes on out-of-fiction meta-commentary about needing "a clearer description" rather than a world beat demanding response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F53 | note | dm-audit-flag | dm-audit | 147 | — | final: fallback; attempts: 3; issues: ledger-mismatch, doctrine, player-agency | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F54 | fail | hidden-info-leak | auditor | 153 | one-clue | Snag's demand openly states the goblins' hidden motive — that the bell's sound and the river-things are what they want handled — revealing dm-only information in public prose. | fixed — TASK-0106 (#51, bb5cbb7): rerun 20261026T192319Z had 0 leaks and 0 narration-caused contradictions |
| run 5 | F55 | note | dm-audit-flag | dm-audit | 153 | — | final: passed-after-regenerate; attempts: 2; issues: doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F56 | fail | hidden-info-leak | auditor | 158 | one-clue | Odo states Snag's terms outright — a ringing ward and bearing the river-things' burden — exposing the dm-only motive behind the silenced bell in one beat. | fixed — TASK-0106 (#51, bb5cbb7): rerun 20261026T192319Z had 0 leaks and 0 narration-caused contradictions |
| run 5 | F57 | warn | doctrine | auditor | 160 | fail-forward | The narration resolves the action with nothing happening, stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F58 | warn | doctrine | auditor | 160 | end-on-demand | The turn ends on a flat non-event and a request for clarification rather than something demanding a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F59 | warn | doctrine | auditor | 160 | ask-when-unclear | Unclear intent should prompt one short in-fiction question, not a meta note that an action needs a clearer description. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F60 | warn | doctrine | auditor | 160 | hero-is-theirs | The narration asserts Tamsin acted and achieved nothing, overriding the player's declared move to press on toward the ferry. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F61 | note | dm-audit-flag | dm-audit | 160 | — | final: fallback; attempts: 3; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F62 | warn | doctrine | auditor | 168 | plain-prose | Narration #168 is bare mechanical output restating the check description and dice math instead of prose describing what happened in the scene. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F63 | warn | doctrine | auditor | 168 | end-on-demand | The turn ends on a success label and a dice line rather than on a world-state that demands a response, and it even hedges about what Snag may still press for instead of showing it. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F64 | note | dm-audit-flag | dm-audit | 168 | — | final: fallback; attempts: 3; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F65 | warn | doctrine | auditor | 171, 173, 174 | fail-forward | The declared and resolved action at #171-#173 is narrated at #174 as producing no change, stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F66 | warn | doctrine | auditor | 174 | end-on-demand | The turn ends on an inert meta-statement that nothing changed rather than on something demanding a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F67 | warn | doctrine | auditor | 174 | ask-when-unclear | Instead of one short in-fiction question, #174 emits a vague out-of-world request that 'one action needs a clearer description'. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F68 | note | dm-audit-flag | dm-audit | 174 | — | final: fallback; attempts: 3; issues: doctrine, player-agency | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F69 | note | dm-audit-flag | dm-audit | 184 | — | final: passed-after-regenerate; attempts: 3; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F70 | warn | doctrine | auditor | 185, 189 | companion-opinions | Odo's reply is dressed as a rebuttal but restates Kestrel's point that Snag wants Wenna's own voice, so no real disagreement occurs. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F71 | warn | doctrine | auditor | 195 | fail-forward | The narration resolves both committed actions with nothing happening, stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F72 | warn | doctrine | auditor | 195 | end-on-demand | The turn ends on an out-of-world request for a clearer description rather than on something in the scene that demands a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F73 | note | dm-audit-flag | dm-audit | 195 | — | final: fallback; attempts: 3; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F74 | warn | doctrine | auditor | 204 | one-clue | The single tracking success delivers two separate revelations in one beat — that Wenna climbed up into the loft and that she carried off the strongbox key — instead of at most one real clue. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F75 | warn | doctrine | auditor | 210 | end-on-demand | The beat closes on a static non-answer ("She hasn't said yes. She hasn't said no.") rather than anything pressing the player to respond. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F76 | fail | ledger-contradiction | auditor | 211, 212, 215 | numbers-from-state | The ledger names the acting hero Kestrel, but the narration calls her Tamsin. | fixed — TASK-0106 (#51, bb5cbb7): rerun 20261026T192319Z had 0 leaks and 0 narration-caused contradictions |
| run 5 | F77 | fail | ledger-contradiction | auditor | 211, 215 | — | Row 211 has Odo hurrying along the bank, while the narration places him above at the cut-rope tower. | false-positive — playtest-auditor lag (operator ruling: F4-class; TASK-0106 classification) |
| run 5 | F78 | warn | doctrine | auditor | 214, 215 | fail-forward | The resolved action yields nothing new and no fresh problem, leaving the scene stalled at the same chain, pole and empty housing. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F79 | warn | doctrine | auditor | 215 | end-on-demand | It closes on a vague 'something seems to be waiting' rather than a concrete event demanding a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F80 | note | dm-audit-flag | dm-audit | 215 | — | final: passed-after-regenerate; attempts: 3; issues: ledger-mismatch, player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F81 | fail | ledger-contradiction | auditor | 219, 216, 222 | — | The journal states Odo had fallen silent and would not answer, yet Odo speaks at length in the same scene. | fixed — TASK-0106 (#51, bb5cbb7): rerun 20261026T192319Z had 0 leaks and 0 narration-caused contradictions |
| run 5 | F82 | fail | player-agency | auditor | 225 | hero-is-theirs | The narration moves Tamsin's body for her — "Tamsin's hand finds the chain" — deciding the hero's action instead of leaving it to the player. | carded — TASK-0113 |
| run 5 | F83 | note | dm-audit-flag | dm-audit | 225 | — | final: passed-after-regenerate; attempts: 2; issues: invented-mechanics, player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F84 | fail | hidden-info-leak | auditor | 234 | one-clue | The narration puts the stolen clapper-bell openly on Snag's hip, handing the player the hidden truth that the reed-camp goblins took the bell's clapper instead of revealing it slowly. | fixed — TASK-0106 (#51, bb5cbb7): rerun 20261026T192319Z had 0 leaks and 0 narration-caused contradictions |
| run 5 | F85 | note | dm-audit-flag | dm-audit | 234 | — | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F86 | note | dm-audit-flag | dm-audit | 242 | — | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F87 | fail | hidden-info-leak | auditor | 247 | one-clue | Odo states the dm-only truth outright — that the goblin wants the bell as a ward against the river-things — before any clue has been uncovered in play. | fixed — TASK-0106 (#51, bb5cbb7): rerun 20261026T192319Z had 0 leaks and 0 narration-caused contradictions |
| run 5 | F88 | warn | doctrine | auditor | 251 | one-clue | The beat reveals two real clues at once: that Snag's bell wards off the 'deep ones' and that a named human boy with a red-rag spear is at the goblin camp. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F89 | note | dm-audit-flag | dm-audit | 251 | — | final: passed-after-regenerate; attempts: 3; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F90 | warn | doctrine | auditor | 253, 256 | world-not-hero | The declared push toward the ferry before dark gets no world reaction — no reeds, no dusk, no ferry — only an abstract report that the hero "acts". | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F91 | warn | doctrine | auditor | 255, 256 | fail-forward | The resolved action is narrated as "nothing changes", stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F92 | warn | doctrine | auditor | 256 | end-on-demand | The turn ends on a flat non-event that demands no response from the player. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F93 | note | dm-audit-flag | dm-audit | 256 | — | final: fallback; attempts: 3; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F94 | warn | doctrine | auditor | 259, 261, 262 | fail-forward | The committed action resolves into "nothing changes," stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F95 | warn | doctrine | auditor | 262 | end-on-demand | The turn ends on a meta-request for a clearer description rather than on something in the world demanding a response. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F96 | warn | doctrine | auditor | 262 | plain-prose | "One action needs a clearer description" is out-of-fiction procedural commentary inserted into the narration instead of prose. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F97 | note | dm-audit-flag | dm-audit | 262 | — | final: fallback; attempts: 3; issues: player-agency, doctrine, other | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F98 | note | dm-audit-flag | dm-audit | 270 | — | final: fallback; attempts: 3; issues: doctrine, player-agency | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F99 | note | dm-audit-flag | dm-audit | 278 | — | final: passed-after-regenerate; attempts: 2; issues: doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F100 | warn | doctrine | auditor | 282, 283 | fail-forward | The resolved action produces explicitly nothing, stalling the scene instead of creating a new problem. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F101 | warn | doctrine | auditor | 283 | end-on-demand | The turn ends on a flat non-event that demands no response from the player. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F102 | warn | doctrine | auditor | 283 | world-not-hero | The narration reports only that the hero acted, never what the world — Snag, the reeds, the falling dark — did to the attempt. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F103 | note | dm-audit-flag | dm-audit | 283 | — | final: fallback; attempts: 3; issues: player-agency, doctrine, invented-mechanics | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F104 | note | dm-audit-flag | dm-audit | 292 | — | final: fallback; attempts: 3; issues: player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |
| run 5 | F105 | warn | doctrine | auditor | 296, 299 | ask-when-unclear | The declared intent was vague, so the DM should have asked one short question instead of resolving it into a null result. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F106 | warn | doctrine | auditor | 298, 299 | fail-forward | The resolution narrates "nothing changes" — a stalled scene with no new problem created. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F107 | warn | doctrine | auditor | 299 | end-on-demand | The turn closes on a meta note about description quality rather than anything the player must respond to. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F108 | warn | doctrine | auditor | 299 | plain-prose | "One action needs a clearer description" is procedural commentary intruding into the story prose. | proposed accepted — advisory warn (doctrine research: research-how-a-dm-decide) |
| run 5 | F109 | note | dm-audit-flag | dm-audit | 299 | — | final: fallback; attempts: 3; issues: invented-mechanics, player-agency, doctrine | proposed accepted — advisory note (doctrine research: research-how-a-dm-decide) |

## Operator findings during play

| # | Finding | Resolution |
|---|---|---|
| 1 | No out-of-character "ask the DM" channel: clarifying questions must be declared as Tamsin's actions (spends a move, may advance clocks). Talk never triggers a DM turn. | proposed carded (m-3; card at sign-off) |
| 2 | No progress indication between Commit and the DM's narration (≈30–60 s per turn); the table looks stalled. | proposed carded (m-3; card at sign-off; overlaps the debug view, TASK-0116/0117) |
| 3 | Comment/Approve/Object stay disabled until the comment box has text. | proposed accepted (operator: "My mistake, I had to type first") |
| 4 | dm.audit flags fail-forward narration of a failed check as invented-mechanics (seq 26). | carded — TASK-0113 |
| 5 | A companion's uncommitted action stalls the table; human reactions never re-run the companion. | carded — TASK-0114 (operator ruling: workaround in the demo, card in m-3) |
| 6 | Dice lines render inline in narration prose; they should be visually distinct (code-block style). Seen in scene-end.png. | proposed carded (m-3; card at sign-off) |
| 7 | Operator account: `create-operator` targeted the test DB (TEST_DATABASE_URL precedence) and echoed the password. | recorded on TASK-0098 and TASK-0103 |
| 8 | The play page treated the seated operator as the DM viewer (Action disabled). | fixed — `53a78fa` (operator ruling "Fix the view"); residue TASK-0118 |

## Fight statistics (TASK-0055 evidence)

**Demo session**: rounds 5; turns 12 players, 14 npcs; attack rolls 4 players, 5 npcs; hits 2 players,
3 npcs; damage dealt 15 players, 15 npcs; damage taken 15 players, 15 npcs; reduced to zero none;
death-save rolls 0; ended by flight ("goblin-3 dead, Snag and both remaining goblins have fled into
the reeds"); narrations in turn mode 27.

**Run 5**: rounds 1; turns 2 players, 2 npcs; attack rolls 0 players, 1 npcs; hits 0; damage 0;
reduced to zero none; death-save rolls 0; ended by bargain ("Odo's parley holds… drop initiative").

## Retries and incidents

- No manual turn retry; no failed job in the demo session (47 turn, 20 companion, 20 chronicle jobs succeeded).
- Session `2811b339-bb03-4593-b3fd-0a969a5d2027` abandoned after scene start (operator viewer bug, fixed `53a78fa`); the stack was rebuilt and the demo restarted as `e8c848ec`.
- Companion stalls (finding 5) at seq 35 and later: worked around by the operator committing Tamsin's next action.
- A break of a few hours mid-scene at seq 77; the session resumed with no loss.
- TASK-0110 (an action that ends the encounter resolves `refused`): **not hit in the live demo** — no `action.resolved` with outcome `refused` in session e8c848ec; the fight ended after Kestrel's stand (row 296, `no-effect`) with `encounter.ended` at row 300.

## Attachments

- `m2-demo/provider-playtest-stalled-5/` — run.json, transcript.jsonl, transcript.md, ledger.json, jobs.json, usage.json, report.json, report.md
- `m2-demo/demo-session/` — run.json, transcript.jsonl, transcript.md, ledger.json, jobs.json, report.json, report.md
- `m2-demo/provider-playtest-failed-1/`, `-failed-2/`, `-failed-4/` — earlier failed runs
- `m2-demo/scene-end.png` — the table at the scene's end, light mode (operator's Brave screenshot)

## Sign-off

Operator: _pending_ — the `accepted` and `false-positive` rows above, the carded proposals for
findings 1, 2 and 6, and the "narration never contradicts the ledger" criterion.
