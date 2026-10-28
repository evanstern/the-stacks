# Live run record: human DM roll resume (T019)

Date: 2026-10-28. Stack: `stacks-task-0168`. Browser: Brave (Playwright driver `evidence/live-resume.mjs`).
Result: run 3 at commit `6121ed4c` printed `ALL CHECKS PASSED`.

## Setup

- The operator appended `DM_FAKE_SCRIPT=greyhollow-human-dm` to the worktree `.env` in chat. The auto-mode classifier had denied that edit to the orchestrator.
- The first app recreate still booted the 11-call script. The app image was rebuilt. The boot log then read `DM script mode: greyhollow-human-dm (10 calls, 1 dice)`.
- Before runs 2 and 3 the stack was reset to fresh volumes: `env:down`, `env:up`, both databases migrated, app restarted.
- Test accounts were recreated for each fresh stack. Passwords were generated and kept outside the repo. None appear here.

## Run history

| Run | Result | Cause and fix |
| --- | --- | --- |
| 1 | Hung after the scene-start turn; killed | Unbounded Playwright click. The step-6 flow skipped the "Change scene" step. Fixed in `bb120cd6` (live script follows the 055 scene flow, bounded waits). |
| 2 | 1 FAIL: step 8 "no second check.roll" counted 3 | Selector fault. The selector matched the roll's dice line quoted inside the pending act-search narration card. The screenshot showed two narration cards and the event log held one `check.roll` proposal. Fixed in `6121ed4c` (roll cards counted by kind). |
| 3 | ALL CHECKS PASSED | Result below. |

## Run 3: steps

1. Step 6: scene panel seeded with `greyhollow-ford`. 10 suggestions approved; the opening narration stayed pending.
2. Step 7: player declared and committed `act-search`. The commit turn paused on one `check.roll` proposal, ended `completed`, and called `dm.director`, `dm.interpret`.
3. Step 8: the DM approved the roll. The resumed turn ended `succeeded/completed` with calls `dm.director`, `dm.narrate`, `dm.audit` and no `dm.interpret`. The approvals slide-out held 0 second `check.roll` proposals and one pending narration proposal for the search.
4. Step 9: the DM approved the narration. The DM table and the player table both showed the narration and the dice line. No runtime failure notice appeared. The next approval turn ended `succeeded/empty-beat` with no calls.
5. Step 10: the `action.resolved` row and `check.roll` count are recorded below.
6. No-modal check: 0 dialogs in every captured state.

## Run 3: jobs

| Job id | Kind | Trigger | Status | Outcome | Calls |
| --- | --- | --- | --- | --- | --- |
| 10ddb795-74d9-4efd-9af8-fa9881f36314 | turn | scene-start | succeeded | completed | dm.director, dm.narrate, dm.audit |
| ce368486-ff4c-4cc3-9548-a0d239053995 | chronicle | (none) | succeeded | completed | none |
| 693e714a-c703-4d28-a7f8-39eeac17d503 | turn | approval | succeeded | empty-beat | none |
| 9f078f10-5baa-4f73-900c-5add65857ff4 | turn | approval | succeeded | empty-beat | none |
| 05b08a12-2d69-4147-af80-e56fa408c273 | turn | approval | succeeded | empty-beat | none |
| fe9f3d25-02c8-4952-a0ed-a5e6162c7c90 | turn | approval | succeeded | empty-beat | none |
| 933fa399-adfb-40d5-9193-14abb9083ce6 | turn | approval | succeeded | empty-beat | none |
| d5a91383-e5ac-4210-b674-91a6ca23ac60 | turn | approval | succeeded | empty-beat | none |
| 2fb7d6c5-c41d-48c2-a372-975f45c1e35c | turn | approval | succeeded | empty-beat | none |
| a8018d3e-8dcc-49f6-b239-d39ae6d8419b | turn | approval | succeeded | empty-beat | none |
| 5c66f83d-c84c-4a6b-ade0-4de1888636bc | turn | approval | succeeded | empty-beat | none |
| 3b0f1dc8-0980-4eaa-aacf-64d817c9b3eb | turn | approval | succeeded | empty-beat | none |
| c5f150ab-aa91-4dbb-b3fe-1b660b36b0a0 | turn | approval | succeeded | empty-beat | none |
| 9fdc5d7d-ccee-4fca-bd17-c5728dbcaa8c | turn | commit | succeeded | completed | dm.director, dm.interpret |
| 4945b306-b55e-44fa-9108-cacc74135e31 | turn | approval (the roll) | succeeded | completed | dm.director, dm.narrate, dm.audit |
| 3edc4010-de54-444c-a2f7-8fa5ae61a905 | chronicle | (none) | succeeded | completed | none |
| e4e11a96-af8c-43b5-9564-347e591b5836 | turn | approval (the narration) | succeeded | empty-beat | none |

## Run 3: call list

Every call has status `ok`.

- `10ddb795` (scene-start): dm.director, dm.narrate, dm.audit.
- `9fdc5d7d` (commit): dm.director, dm.interpret.
- `4945b306` (roll approval, the resumed turn): dm.director, dm.narrate, dm.audit.

The log records 8 calls in total. The resumed turn made no `dm.interpret` call.

## Run 3: event rows

- `action.resolved` seq=56, actor `ai:dm`: `outcome: applied`, `actionId: act-search`, `batchIds: ["6a05f45c-09f0-4e6b-8712-addcb7a7a50d"]`, `refusalCode: null`.
- `check.roll` events by type: `{"proposal.created": 1}`. The count is 1, as the spec requires.

## Screenshots (`evidence/shots/`, all verified present)

- `roll-pending-1280-light.png`: approvals slide-out with the one `check.roll` (step 7).
- `narration-pending-1280-light.png`: the pending narration proposal (step 8).
- `narrated-1280-light.png`: narration and dice line, 1280 px, light.
- `narrated-1280-dark.png`: narration and dice line, 1280 px, dark.
- `narrated-390-light.png`: narration and dice line, 390 px, light.
- `narrated-390-dark.png`: narration and dice line, 390 px, dark.
