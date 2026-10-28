# Live run: a human DM carries out the scene-start suggestion (script mode)

The "Clean pass 2" section (last) supersedes the two earlier runs below for steps 4 to 8b, the
shots and T032. Those runs are kept as the record of how the script gap and the reconcile
contamination were found. Clean pass 2 also stops before narration (see its last section).

---

# Earlier run 1 - STOPPED at step 8c

Date: 2026-10-28. Branch `task-0159-human-dm-scene-change`. Stack `stacks-task-0159`, app
`http://localhost:3159`, script `greyhollow-human-dm` (boot line `DM script mode:
greyhollow-human-dm (9 calls, 1 dice)`). Browser: Brave (Playwright). No provider key, no paid
call. Test accounts exist only on this local stack. Passwords were generated at random and live
only in an untracked scratchpad file. No password appears here.

Status: steps 3 to 8b passed. Step 8c did NOT complete: the AI DM did not narrate the player turn.
Phase 5 stopped there (the brief says STOP on a blocked turn). Steps 9 to 11, the shots (T031)
and the second scene change (T032) were not run. See "Open question".

## Session

`a757700e-7040-40da-8047-2a0fe6e02759`. Operator `op0159` (the seated human DM). Player
`pl0159` on seat `tamsin`.

## Steps 3 to 8 (passed)

| Step | Result |
| --- | --- |
| 3 accounts | Operator through `create-operator.js` in the app container. Player through an invitation (`/auth/invitations`, `/auth/invitations/redeem`). |
| 4 `start-human-dm.mjs` | `dm.seat` sent over the WebSocket (seq 1 `dm.seat.changed`, `after.kind` human), then `POST /dm/sessions/<id>/start` returned 202. |
| 5 scene-start turn | Job `a9a537b9-400c-4a47-8a17-2cb92cd175ef`, `succeeded`, `completed`, calls `dm.director`, `dm.narrate`, `dm.audit`. Seq 3 is the `scene` proposal (`ai:dm`, policy `suggest`, `after.sceneId` `greyhollow-ford`), pending. Header read "No scene yet". |
| 6 panel | "Change scene" showed "Suggestions" with "Use: Start the scene: The Bell at Greyhollow Ford". Form filled: Scene id `greyhollow-ford`, title "The Bell at Greyhollow Ford", summary, location "Greyhollow Ford", reason "Scene start: The Bell at Greyhollow Ford". |
| 7 Apply | Summary edited (" (edited by the DM)" appended), Apply clicked. Header showed "The Bell at Greyhollow Ford" and "Greyhollow Ford". Pending proposals fell from 12 to 11. |
| 8 debug rows | `scene.changed` seq 15 and `proposal.rejected` seq 16, both by the operator (`06f9840d-...`). Then `presence.recorded` seq 17. |
| 8 approval turn | Job `92dcaae7-883d-4f87-b21b-b2676cdbe387`, trigger `approval` (triggerSeq 16), `succeeded`, outcome `empty-beat`, `checkpoint.beat` `[]` (set; the no-scene baseline is null), calls `[]` (no model call). |

The first Apply happened during UI exploration, before any shot was taken. The run therefore has
no seeded-panel or applied-table shots (T031 not done).

## Step 8b (passed)

Approve clicked in the slide-out on the 10 non-narration scene-start suggestions: 3 combatant
adds, 3 party members, 2 trackers, 2 scene-presence removals. Events seq 18 to 47 (each a
`combatant.added` / `party.member.changed` / `tracker.changed` / `scene-presence.changed` by
`ai:dm`, then `proposal.approved` by the operator, then `presence.recorded`). The narration
suggestion "Narrate the beat" was left pending (the brief lists no narration).
Each approval enqueued an `approval` turn. All 10 (job ids `8ecc9713`, `1a3970f0`, `396a3cd7`,
`cd1da9df`, `bd1d33f7`, `5e3c0f4e`, `a1996eaa`, `356088cf`, `7c6b0aec`, `dc536b93`) are
`succeeded`, `empty-beat`, `checkpoint.beat` `[]`, calls `[]`.

## Step 8c (blocked)

1. `declare.mjs` (player `pl0159`): `declared act-search`, `committed act-search` (seq 48, 49).
2. Commit turn: job `45d451eb-71f8-492c-b8d7-69d1599b32ec`, trigger `commit`, `succeeded`,
   `completed`, `checkpoint.beat` `["act-search"]`, calls `dm.director`, `dm.interpret`
   (scripted calls 4 and 5). It wrote seq 51: a `mechanics` proposal, policy `ask`, kind
   `check.roll` (perception, DC 13, `1d20`), pending. With a human DM seated, nothing rolls until
   the DM approves it.
3. Approved the roll in the slide-out. Seq 52 `dice.rolled`, seq 53 `check.resolved`, seq 54
   `proposal.approved` (the d20 of 9, the script's one die, was consumed).
4. Approval turn: job `8cda11bd-baa5-4d90-96ed-15e09e4294df`, trigger `approval` (triggerSeq 54),
   `failed`, `stopped at director: gateway`. Its one call was `dm.director`, outcome `error`,
   `error_kind` `config`. The log line: `dm.turn.failed ... node director, kind gateway, errorKind
   config, purpose dm.director`. Seq 56 is a pending `talk` proposal "DM runtime failure notice".
   `checkpoint.beat` `["act-search"]`. No `dm.narrate`, no `dm.audit`, no narration.

`dm_model_calls` for the session (in order): `dm.director`, `dm.narrate`, `dm.audit` (scene
start), `dm.director`, `dm.interpret` (commit turn), `dm.director` (error, approval turn).

## Open question

The shipped script `greyhollow-human-dm` is `scene-start` (director, narrate, audit), then
`human-dm-approval` (director, interpret, narrate, audit), then two `dm.chronicle`. It assumes
one player turn runs director, interpret, narrate, audit in sequence, as the AI-seat script
`greyhollow-live` does (the AI seat applies the roll itself). With a human DM seated, the roll
proposal pauses the turn after `dm.interpret`. The DM's approval then starts a second `approval`
turn, which calls `dm.director` again before `dm.narrate`. The script's next call is `dm.narrate`,
so the gateway refuses the call (`config`) and the turn fails. The human-DM live flow needs the
approval turn to find `dm.director` next (a second director call before narrate and audit), or
the roll policy for the check to be auto-applied. This is a script or server-source decision, so
this run did not change either. The orchestrator decides: amend `human-dm-approval.json` (and the
DB test case (c), which does not exercise the roll pause) or accept the narration step as
unproven live. The step 9 baseline, the shots and T032 wait on that ruling and on a script
restart.

## Rerun after the script fix (commit `a202e04f`): stopped at step 8c, stack contaminated

Fix: `human-dm-approval.json` and `greyhollow-human-dm.json` gained a second `dm.director` call
after `dm.interpret` (`DM script mode: greyhollow-human-dm (10 calls, 1 dice)`). Restart 1
(`up -d --build --force-recreate --no-deps --wait app`) followed the commit.

Fresh session `3c331d8b-9ad7-4068-ad39-db038b07d31c` (`shoot-live.mjs`). Passed: scene-start
turn, "No scene yet", seeded panel fields (shots taken BEFORE Apply), Apply, applied header, the
debug page, step 8b (10 approvals). Shots: `scene-panel-seeded`, `scene-applied` (4 variants
each), `debug-approval-turn-1280-light`. No modal in any shot.

Step 8c failed again, for a different reason. The commit turn `d0e016d1` failed at
`dm.interpret` (`unscripted call`, error kind `config`). Cause: restart 1 booted with
session `a757700e` (the first run) still holding a committed `act-search` with no
`action.resolved`. `reconcileTurnJobs` enqueues a `reconcile` turn for every such session at
every boot. That job (`f2af2b93`) ran `dm.director` and `dm.interpret` and consumed the one
`dm.interpret` entry before the fresh session reached it. The script queue is per purpose, FIFO.

Restarts 2 and 3 (`up -d --force-recreate --no-deps --wait app`, no build) did not help:
both dirty sessions (`a757700e`, `3c331d8b`) reconcile at each boot and burn the script first.
`action.withdraw` is refused (`ACTION_NOT_OPEN`: the action is committed). Approving the
reconcile's roll on `3c331d8b` produced an `approval` turn that called `dm.director` then
`dm.interpret` and failed there (queue spent).

Result: no narrated turn is possible on this stack while any session holds a committed,
unresolved action. Steps 9 to 11 and T032 were not run.

## Open question (second)

The stack needs a clean database, or a ruling to hand-resolve the two dirty sessions. Suggested:
the orchestrator runs `pnpm env:down`, `pnpm env:up` and the two migrations, then restarts the
app once. After that, the rerun must not leave a committed action unresolved at any restart: run
the narrated flow once, with a restart only before the baseline (the baseline session commits
no action, so it leaves nothing to reconcile). Then `shoot-live.mjs` runs unchanged, but it
creates the accounts' sessions only; the accounts must be recreated (`setup-0159.mjs` style).
The `check.roll` pause and a second reconcile pass are a product property, not a defect here.


---

# Clean pass 1 (superseded by clean pass 2 below) - narrated turn fails at step 8c

Date: 2026-10-28. Fresh volumes (orchestrator `env:down`/`env:up`), both databases migrated, app
booted once: `DM script mode: greyhollow-human-dm (10 calls, 1 dice)`, no `ai_usage` line and no
users before my first command. No app restart during this pass. New accounts `op0159` (operator) and
`pl0159` (player), created by an untracked scratchpad script. Passwords only in the untracked
creds file. Run by `shoot-live.mjs` (Brave, Playwright). Session
`67af18db-10fa-4483-828b-d5ff91c24cf6`.

| Step | Result |
| --- | --- |
| 4 start | `dm.seat` then start (202). |
| 5 scene-start turn | Job `9a70b7b3`, `succeeded`, `completed`, calls `dm.director`, `dm.narrate`, `dm.audit`; chronicle job `d0c999ea` succeeded. The harness line "header: No scene yet" printed FAIL: a timing race in the script's immediate visibility check (the exploration run read the header as "No scene yet"). The seeded-panel and applied shots below show the header state. |
| 6 panel | Scene id `greyhollow-ford`, title, location, summary and reason seeded. Shots taken BEFORE Apply. |
| 7 Apply | Summary edited, Apply clicked, header showed the scene title and location. |
| 8 rows | `scene.changed` seq 15 and `proposal.rejected` seq 16, both by the operator (`ca6d0cf6-...`). |
| 8 approval turn | Job `9fa8bd51-5a04-4912-9958-ec656ecce329` (triggerSeq 16): `empty-beat`, `checkpoint.beat` `[]` (set), calls none. All 11 approval turns of this pass are `empty-beat` with beat `[]` and no calls. |
| 8b | 10 suggestions approved (combatants, party, trackers, presence). Narration left pending. |
| 8c commit turn | Job `58bc8dfc-ea67-449f-bb7c-bcf5a8971396`, `completed`, `checkpoint.beat` `["act-search"]`, calls `dm.director`, `dm.interpret`. It paused on a `check.roll` proposal (seq 51, policy `ask`). |
| 8c roll approved | seq 52 `dice.rolled`, seq 53 `check.resolved`, seq 54 `proposal.approved`. |
| 8c resumed turn | Job `e014b0b1-8ec6-4886-9086-34440673d4ef`, trigger `approval`, **failed**, `stopped at interpret: gateway`. Calls in order: `dm.director` (ok), `dm.interpret` (error, kind `config`, `unscripted call`). Seq 56: "DM runtime failure notice" talk proposal. No narrate, no audit, no narration. |

## Resumed-turn call order (settles open question 2)

After the roll approval the resumed turn calls `dm.director` and then `dm.interpret` again. It
does not skip interpret. The script holds one `dm.interpret` entry, used by the commit turn, so
the second interpret is unscripted. The narrate and audit entries are untouched. The script needs
the sequence director, interpret, director, interpret, narrate, audit across the two turns (one more
`dm.interpret` entry after the second director), or the resumed turn must reuse the interpret
result (a server change, not made). Per the coordinator's rule, this pass stops here: the script
was not amended.

## T032 (second scene change, same session)

On the same session: "Change scene", "Use: Current scene", location set to
"Greyhollow Ford, the ferry-house", reason set, Apply. Row: `scene.changed` seq 57 by the operator,
`after.sceneId` `greyhollow-ford` (same id as seq 15), `before.location` "Greyhollow Ford",
`after.location` "Greyhollow Ford, the ferry-house". The header showed the new location.

## Step 10 (player view)

The player's table has no "Change scene" button (PASS). Shot `player-no-control-1280-light.png`.

## Shots (`evidence/shots/`, retaken on this session)

`scene-panel-seeded-<1280|390>-<light|dark>.png`, `scene-applied-<1280|390>-<light|dark>.png`,
`debug-approval-turn-1280-light.png`, `scene-panel-current-1280-light.png`,
`player-no-control-1280-light.png`. No modal in any shot (the harness checks `dialog[open]` and
`[aria-modal=true]`: 0 in every one).

## Not done in this pass

Step 9 (Dismiss-only baseline), step 11 and T033, and T029 (the narrated turn). They wait on the
ruling for the second interpret entry and a stack reset: the failed resumed turn leaves this
session's `act-search` unresolved, so the next boot's reconcile would use up the script again.


---

# Clean pass 2 (current) - script `greyhollow-human-dm`, 11 calls

Date: 2026-10-28. Fresh volumes, app rebuilt from `7fb95e11`, booted once:
`DM script mode: greyhollow-human-dm (11 calls, 1 dice)`. No `ai_usage` line and no users before my
first command. No app restart in this pass. Accounts `op0159` and `pl0159` recreated (creds file
overwritten, untracked). `shoot-live.mjs` (Brave); its step 5 check now waits for the header.
Session `6cb00938-08a0-4b78-8f78-959b8d9e7aaf`. All shots were retaken on this session.

| Step | Job | Result |
| --- | --- | --- |
| 5 scene-start | `45ac2fe1` | `succeeded`, `completed`, calls `dm.director`, `dm.narrate`, `dm.audit`. Chronicle `5b3ab730` succeeded. Header "No scene yet". |
| 6 to 7 | - | Seeded panel (Scene id `greyhollow-ford`, title, location, summary, reason), shots before Apply, Apply, header showed title and location. |
| 8 rows | - | `scene.changed` seq 15, `proposal.rejected` seq 16, both by the operator `b47880bb-...`. |
| 8 approval turn | `7fb204d0` (triggerSeq 16) | `succeeded`, `empty-beat`, `checkpoint.beat` `[]` (set), no calls. |
| 8b | 10 approval turns (`9a282ea3`, `288d7f93`, `cce0c442`, `c9c7fea8`, `3a991255`, `4523d7b5`, `0b9d5b76`, `66140570`, `9d5d7553`, `0ac5764c`) | each `empty-beat`, beat `[]`, no calls. 10 suggestions approved, seq 18 to 47; narration suggestion left pending. |
| 8c commit turn | `7530b6d2` | `completed`, beat `["act-search"]`, calls `dm.director`, `dm.interpret`. Paused on a `check.roll` proposal (seq 51, `ask`). |
| 8c roll approved | - | seq 52 `dice.rolled`, 53 `check.resolved`, 54 `proposal.approved`. |
| 8c resumed turn | `d5b5d97e` (triggerSeq 54) | `succeeded`, `completed`, beat `["act-search"]`, calls in order `dm.director`, `dm.interpret`, both ok. No `dm.narrate`, no `dm.audit`, no narration. It wrote a second `check.roll` proposal (seq 56, same check: perception, DC 13) and paused again. |

No call was unscripted and no failure notice appeared. The resumed turn re-interprets the
unresolved action (TASK-0168) and proposes the same roll again, so it does not reach narrate.
Approving the second roll would start a third turn that calls `dm.director`: the script's three
director entries are spent (scene-start, commit, resumed), so that call would be unscripted. I did
not approve it, and did not amend the script. The narrated turn is therefore not shown.

T032: "Use: Current scene", location "Greyhollow Ford, the ferry-house", Apply. `scene.changed`
seq 57 by the operator, `after.sceneId` `greyhollow-ford` (same as seq 15). The header showed the
new location.

Step 10: the player's table has no "Change scene" button (PASS).

Shots (`evidence/shots/`, this session): `scene-panel-seeded-*`, `scene-applied-*` (1280 and 390,
light and dark), `debug-approval-turn-1280-light`, `scene-panel-current-1280-light`,
`player-no-control-1280-light`. No modal in any shot (0 `dialog[open]` or `aria-modal` in every one).

Not done: the narrated turn (T029 stays open), the step 9 baseline (T030), step 11 and T033. The
app was not restarted, per the rule to stop on a blocked turn.

## Open question (third)

Two ways to let the resumed turn narrate, both a ruling: (a) script one more director, interpret,
director chain (or `dm.interpret` returning a reading the roll gate treats as already rolled), or
(b) fix re-interpret (TASK-0168) so the resumed turn reuses the resolved check. The check result
(seq 53) already exists when the resumed turn re-interprets, and the loop proposes it again.
