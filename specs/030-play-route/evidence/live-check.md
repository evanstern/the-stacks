# Live check (quickstart section 3) — TASK-0047 Phase 5

Date: 2026-10-26. Stack: `pnpm env:up` in `.worktrees/task-0047` (app :3047). The stack came up
unmigrated (TASK-0098); the server migrations were applied by hand to the app database
(`localhost:15047`). Two throwaway accounts (operator, player) were created in that database;
their credentials live only in an untracked scratch file.

Table: a copy of the `free-mode-action` fixture seeded by `seed-live.mjs` (player user id mapped
to the real player, `ai:dm` mapped to the real operator). Two separate Brave browser contexts,
one signed in as each account, driven by `shoot.mjs --mode live` (Brave launched by
`executablePath`). Run at 1280 and 390 px, light and dark (four runs, each on the same table).

| Step | Result (each run) |
|---|---|
| Player sends talk | Text appears in the player window and the operator window after the server records it |
| Player declares an action | Card appears in both windows |
| Operator comments on the card | Comment appears in both windows |
| Player commits | "Committed" appears in the operator window; player window shows the committed card |
| Seeded ledger | Ledger panel opens on the seeded table (roll and check rows from the fixture) |

All four runs passed: talk, declare, comment and commit visible to both viewers.

Reload rebuild and reconnect were checked in Phase 6 (below).

## DM approval panel click-through (fixture `free-mode-action?as=dm`, Brave)

| Action | Result |
|---|---|
| Open "Pending proposals (2)" | Two proposals listed |
| Approve (first proposal) | List drops to 1; trigger reads "Pending proposals (1)" |
| Reject (second proposal) | Reason input appears |
| Confirm reject (reason "not now") | List drops to 0; trigger reads "Pending proposals (0)" |


Screenshots: `shots/` (fixtures: 16 PNGs; live: 8 PNGs), light and dark, 1280 and 390 px.

## Phase 6 — proposals live against TASK-0045's gate (Brave, 2026-10-26)

Stack: `pnpm env:up` in `.worktrees/task-0047`; app and test databases migrated by hand
(TASK-0098). Table seeded by `seed-live.mjs dm-approvals`: the real operator is the seated human
DM, the real player is Ana. The seed raised one `ask` narration proposal through `gate.submit` as
`ai:dm`. Two Brave contexts (operator, player), driven by a scratch script.

| Check | Result |
|---|---|
| DM-only delivery | Operator panel lists 4 pending (scene, tracker, table-mode, narration); the player has no Pending proposals control and no proposal text on the page |
| Approve narration | Narration appears in the player's transcript; operator list drops to 3 |
| Reject table-mode with reason "not now" | List drops to 2 |
| Approve a `suggest` proposal | Notice: "a suggestion applies nothing; the DM acts on it directly (PROPOSAL_NOT_APPROVABLE)" |
| Reload rebuild | Both windows rebuilt from replay: narration present, operator list 2, player list absent |
| Stop/start app (`docker restart`) | After the restart a player message reached the operator once (no duplicate); pending list still 2 |
| Four `shoot.mjs --mode live` runs (1280/390, light/dark) | Talk, declare, comment, commit visible to both; player has no approvals control; operator approval panel captured |
