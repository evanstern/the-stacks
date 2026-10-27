# Quickstart: validate suggest proposals without an Approve control

## Prerequisites

- Worktree `.worktrees/task-0100`, `pnpm install --frozen-lockfile`.

## Unit and markup tests

1. Run `pnpm --filter @the-stacks/web test`.
2. Expect `proposals.test.mjs` to report P3 `policy: "suggest"`, P4 and P5 `policy: "ask"`.
3. Expect `proposal-list.test.tsx` to show P3's row with "Suggestion" and Dismiss and no Approve.
4. Expect `table-view.test.tsx` to count two Approve controls and one Dismiss for the DM on `dm-approvals`.
5. Run `pnpm ci:check`. Expect green.

## Fixture route (Brave)

1. Run `pnpm env:up` and start the app.
2. Sign in as an operator. Open `play/fixtures/dm-approvals`, viewer DM, last step.
3. Open the approvals slide-out. Expect the scene proposal marked "Suggestion" with Dismiss and no Approve.
4. Click Dismiss. Expect the row to leave the list at once.

## Live route (Brave)

1. Seed a session with a human DM seat and a pending `suggest` proposal (for example from `dm-approvals`).
2. Open `play/:sessionId` as the seated DM and open the approvals slide-out.
3. Click Dismiss on the suggestion. Expect one `proposal.rejected` row with `reason: null`, and the row to leave the list.
4. Expect no `<dialog>` in the DOM and no horizontal overflow at 390 px.
