# Live run: a human DM carries out the scene-start suggestion (script mode) - STOPPED at step 8c

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
