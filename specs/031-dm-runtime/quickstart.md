# Quickstart: exercising the DM runtime

## Pure suites (no database)

```bash
pnpm --filter @the-stacks/server test -- dm/seed dm/doctrine dm/script dm/facts dm/audit dm/pipeline
```

## Database suites (the worktree's own stack)

```bash
pnpm env:up
pnpm --filter @the-stacks/server db:migrate      # TASK-0098: a fresh stack may come up unmigrated
REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test -- dm library/jobs library/worker
pnpm env:down                                    # before removing the worktree
```

`REQUIRE_DATABASE=1` turns a loud skip into a failure. WebSocket gateway suites are known to
flake; re-run them, do not fix them in this task.

## The merge-condition run (one full turn, fake gateway, scripted dice)

```bash
pnpm env:up && pnpm --filter @the-stacks/server db:migrate
REQUIRE_DATABASE=1 DM_EVIDENCE_OUT=../../specs/031-dm-runtime/evidence/full-turn.json \
  pnpm --filter @the-stacks/server test -- dm/full-turn
pnpm env:down
```

The test starts the Greyhollow Ford scene, commits Tamsin's search, runs the turn job to
completion, and writes the evidence file: the turn's ledger rows (DM view), the narration,
and the audit record. The PR body quotes the ledger and the audit result.

## Driving a scene by hand (operator)

```bash
# 1. Start the scene (the human's character is "tamsin")
curl -X POST -b cookies.txt localhost:$APP_PORT/dm/sessions/$SID/start \
  -H 'content-type: application/json' \
  -d '{"seedId":"greyhollow-ford","seats":{"tamsin":"'$USER_ID'"}}'

# 2. Over the WebSocket, as the player: declare, then commit
{ "type":"send","sessionId":"…","eventType":"action.declare","payloadVersion":1,
  "payload":{"action":{"actionId":"act-search","characterId":"tamsin","scope":"character",
             "text":"I search the ferry-house for whoever cut the bell rope."}} }
{ "type":"send","sessionId":"…","eventType":"action.commit","payloadVersion":1,
  "payload":{"actionId":"act-search"} }

# 3. Inspect turn records (audit included)
curl -b cookies.txt localhost:$APP_PORT/dm/sessions/$SID/turns
```

Step 2 against a real provider needs `AI_PROVIDERS` and `AI_PURPOSES` with the seven `dm.*`
purposes in the root `.env`. That is an operator checkpoint (cost); implementers never set a
key.
