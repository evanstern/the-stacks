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

Not hand-checked in this run: reload rebuild and the stop/start-app reconnect path. The
reducer path behind both is covered by `reduce-frame.test.mjs` and `equivalence.test.tsx`.

## DM approval panel click-through (fixture `free-mode-action?as=dm`, Brave)

| Action | Result |
|---|---|
| Open "Pending proposals (2)" | Two proposals listed |
| Approve (first proposal) | List drops to 1; trigger reads "Pending proposals (1)" |
| Reject (second proposal) | Reason input appears |
| Confirm reject (reason "not now") | List drops to 0; trigger reads "Pending proposals (0)" |

The live Approve and Reject remain unwired until Phase 6 (TASK-0045).

Screenshots: `shots/` (fixtures: 16 PNGs; live: 8 PNGs), light and dark, 1280 and 390 px.
