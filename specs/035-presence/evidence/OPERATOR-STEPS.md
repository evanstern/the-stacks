# Operator steps: the presence merge condition (Brave)

The operator takes these two screenshots. Ruling 2026-10-27.

## Stack

- App: http://localhost:3051 (this worktree's stack, built from the merge of origin/main (PR #63, PR #64); the Withdraw control does not change these steps).
- The app database on :15051 is migrated through 0006_fearless_jamie_braddock. It holds no accounts yet.

## Create the accounts (once)

The database has no users. Create one operator, then redeem one invitation. No password is
written in this file. Use the environment variables shown.

1. Create the operator. The command reads the password from `OPERATOR_PASSWORD`.
   `cd <this worktree> && U="$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's/@db:5432/@localhost:15051/')" && DATABASE_URL="$U" TEST_DATABASE_URL="$U" OPERATOR_USERNAME=op OPERATOR_PASSWORD='<choose one>' pnpm --filter @the-stacks/server auth:create-operator`
   Reason: Both URLs point at the app DB: `node --env-file` reloads TEST_DATABASE_URL from .env, and create-operator prefers it (TASK-0098/TASK-0103), so it would otherwise write to the test DB.
   Source: `apps/server/src/cli/create-operator.ts`.
2. Open http://localhost:3051 in Brave window A. Sign in as the operator through the sign-in page.
3. Open the Brave DevTools console on that page. Run this to issue one invitation.
   `await (await fetch('/auth/invitations', {method:'POST', credentials:'same-origin'})).json()`
   Copy the `token`.
4. Open Brave window B. Use a second Brave profile or a private window. Open http://localhost:3051.
5. In window B's DevTools console, redeem the token. Choose a password.
   `await (await fetch('/auth/invitations/redeem', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({token:'<token>', username:'ben', displayName:'Ben', password:'<choose one>'})})).json()`
   Redeeming signs window B in as Ben. Routes are in `apps/server/src/routes/auth.ts`.

## Show join and leave

1. In window A, open http://localhost:3051/play. Click "Start a table". Copy the table URL.
2. Window A's header strip shows one chip: the operator (Observer) and the AI DM chip.
3. In window B, open the copied table URL.
4. Within 2 s, both windows show both users. Take a screenshot of each window.
   Save window A as `specs/035-presence/evidence/join-a.png`.
5. Close window B's tab.
6. Within 10 s, window A's strip no longer lists Ben. Take a screenshot of window A.
   Save it as `specs/035-presence/evidence/leave-a.png`.

Both users show as Observer: neither holds a party seat. That is the operator-ruled behaviour.
