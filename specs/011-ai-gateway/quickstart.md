# Quickstart: AI Gateway

1. Run the tests (no keys, no network): `pnpm --filter @the-stacks/server test -- ai.`
2. Optional live smoke test: declare providers and purposes in `.env` (see the commented
   example in `.env.example` — one hosted OpenAI-compatible provider and one local
   Ollama-style provider), set the key variable each provider names, then start the server.
   Startup logs the configured purposes and their providers. No route uses the gateway until
   TASK-0027.
