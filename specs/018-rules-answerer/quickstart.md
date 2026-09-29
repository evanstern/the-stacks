# Quickstart: Rules answerer

Validation guide. Contracts: [ask-sse.md](contracts/ask-sse.md), [answer.md](contracts/answer.md).

## 1. Automated (the gate)

```sh
cd .worktrees/task-0027
pnpm env:up                         # this worktree's stack; writes .env with DATABASE_URL
REQUIRE_DATABASE=1 pnpm ci:check    # ask.integration + other DB suites: 0 skipped
```

Expect `cite.test.ts`, `answer.test.ts`, and `ask.integration.test.ts` green. The integration
suite seeds books with `storeParsedBook` directly. It never enqueues ingestion jobs, because
the worktree app's ingest worker can claim them (TASK-0033).

## 2. Manual smoke (optional, fake provider, no network)

1. Set in the worktree `.env`:
   ```
   AI_PROVIDERS={"t":{"kind":"fake","baseUrl":"http://unused"}}
   AI_PURPOSES={"answering":{"provider":"t","model":"m"},"embedding":{"provider":"t","model":"e","op":"embed"}}
   RETRIEVAL_MODE=fts
   ```
2. Restart the app. Sign in as the operator. Upload a small Markdown file as book `Smoke`.
3. Ask something the file does not mention:
   ```sh
   curl -N -b "session=<token>" -H 'content-type: application/json' \
     -d '{"question":"zzqx unrelated"}' http://localhost:<APP_PORT>/library/ask
   ```
   Expect one `event: refusal` with `"reason":"nothing_relevant"`.
4. Ask with a word the file contains. The unscripted fake chat returns no text, so expect
   `event: refusal` with `"reason":"unverified"`. That proves retrieval, relevance, and the
   model call are wired.
5. As a player: expect HTTP 403 JSON. Without a cookie: 401.

## 3. Cleanup

```sh
pnpm env:down
pnpm env:prune --check    # exits 0
```
