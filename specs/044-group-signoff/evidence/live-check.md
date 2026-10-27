# Live check — TASK-0049 Phase 4 (Brave, 2026-10-27)

Stack: `stacks-task-0049` (app :3049), rebuilt from the Phase 4 tree. Accounts: one operator and two
players (Ana, Cleo), random passwords kept in an untracked creds file outside the repo. Browser: Brave,
launched by `executablePath` through playwright-core loaded from outside the repo.

Each run seeds three sessions from the `group-signoff` fixture with `seed-signoff.mjs`, then
`shoot-signoff.mjs` drives them in two browser contexts (Ana, Cleo):

| Shot | State |
|---|---|
| `signoff-waiting` | Cleo's view: Ana Approved, Cleo (You) Waiting with Approve and Object on her own row |
| `signoff-objection` | Ana's view: Cleo Objects; the card shows "Waiting for a commit" |
| `signoff-committed` | Cleo clicked Approve live; the gate committed as group ("Committed by You") |
| `signoff-away` | Only Ana connected: Cleo shows Away |

Each shot exists at 1280 and 390 px, light and dark (16 files in `shots/`). The script printed 28 PASS and
0 FAIL per run: rows and states match, own-row buttons read Approve and Object, no `<dialog>` in the DOM,
no horizontal overflow at 390 px, and the live Approve produced a committed card.

Notes:
- The env fake provider returns empty bodies, so the DM turn after a commit fails (TASK-0158). Sign-off
  happens before the DM turn, so it is unaffected.
- A closed (committed) card shows no sign-off rows (tasks.md T025: null for closed actions).
- Fix found by the shots: the comment verb read "objectd". It now reads "objected".
