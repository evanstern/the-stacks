# Quickstart: exercising the proposal gate

## Unit level (no database)

```bash
pnpm --filter @the-stacks/session-model test     # schemas, policies, authority, planner, fixtures
pnpm --filter @the-stacks/server test -- write-boundary
```

## Database suites (the worktree's own stack)

```bash
pnpm env:up
pnpm --filter @the-stacks/server db:migrate      # TASK-0098: a fresh stack may come up unmigrated
REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test -- gate ws session events
pnpm env:down                                    # before removing the worktree
```

`REQUIRE_DATABASE=1` turns a loud skip into a failure, so a missing database cannot pass.
Read the stack's `TEST_DATABASE_URL` from `pnpm env:status` if the suite cannot reach it.

## From the DM runtime (TASK-0046)

```ts
const result = await gate.submit(sessionId, { kind: "ai", actor: "ai:dm" },
  mechanicsProposal({ type: "check.roll", combatantId: "ana", kind: "ability-check",
    ability: "dex", skill: "sleight-of-hand", expression: "1d20+5", mode: "normal", dc: 15,
    autoFail: null, reason: "Ana picks the vault lock" },
    { actionId: "act-lockpick", summary: "Ana: DC 15 lockpick" }));
// AI seat → { ok: true, outcome: "applied", … }; human seat → { outcome: "pending", proposalId }
```

## Over the WebSocket (TASK-0047)

```json
{ "type": "send", "sessionId": "…", "eventType": "proposal.approve",
  "payload": { "proposalId": "…" }, "payloadVersion": 1 }
```

A refusal arrives as `{ "type": "error", "kind": "validation", "message": "…", "code": "TARGET_DEAD" }`.
