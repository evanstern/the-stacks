# Quickstart: DM calls survive a leading think block (TASK-0181)

## Local proof (implementers)

1. Run `pnpm install --frozen-lockfile` in a fresh worktree.
2. Run `pnpm --filter @the-stacks/server exec vitest run test/dm/call.test.ts`.
3. Expect the think-block cases (tasks.md T001) green.
4. Run `pnpm ci:check`. Expect green.

No database and no model call is needed.

## Probe (orchestrator, operator's go on each exact command)

Run on vm-104. The key stays inside the container; nothing prints it. `cc/claude-sonnet-5` is
the interpret model per the TASK-0101 mapping. If `/home/stacks/dev/.env` names another model
for `dm.interpret`, substitute it.

**P1. Raw stream with the app's own request shape** (one subscription-backed call):

```sh
docker exec stacks-dev-app-1 sh -c 'curl -sN http://9router.local.infinity-node.win/v1/chat/completions \
  -H "authorization: Bearer $NINEROUTER_API_KEY" -H "content-type: application/json" \
  -d "{\"model\":\"cc/claude-sonnet-5\",\"max_tokens\":1200,\"stream\":true,\"stream_options\":{\"include_usage\":true},\"messages\":[{\"role\":\"user\",\"content\":\"Reply with only this JSON object: {\\\"ok\\\":true}\"}]}"' \
  | head -c 20000
```

**P2. Same request with thinking off** (one call). Add `"reasoning_effort":"none"` to the body.
If P2 still shows a think block, the operator may repeat it once with
`"thinking":{"type":"disabled"}` instead.

**Record** in `specs/063-think-block/evidence/probe.md`, for P1 and P2:
- whether `<think>` arrives in `delta.content` or in another delta field;
- the visible text, `usage.completion_tokens` and `finish_reason`;
- the 9router version if the router reports one (`/v1/models` or response headers).

Then record the cause line on the card (AC #1). Pick the R7 source option with the operator.

## Hosted-dev check after deploy (tasks.md Phase 5)

1. Run `curl -s https://vm-104.tailb3c1b6.ts.net:8443/health`. Expect `commit` equal to the
   merge commit on `main`.
2. In Brave, open the session's `play/:sessionId/debug` page as the operator.
3. Commit one player action. Wait for the turn job to finish.
4. Open the Ledger slide-out. Every `dm_model_calls` row for that turn job shows
   `callAttempt: 1` and `outcome: ok`. No row shows `invalid-json`.
