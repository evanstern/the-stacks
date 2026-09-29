# Quickstart: AI Gateway

1. Run the tests (no keys needed): `pnpm --filter @the-stacks/server test -- ai.`
2. Optional live smoke test: set `ANTHROPIC_API_KEY`, `EMBEDDINGS_BASE_URL`, `EMBEDDINGS_API_KEY`,
   `AI_PURPOSES`, and `AI_PRICES` in `.env` (see `.env.example`), then start the server; startup
   logs the configured purposes. No route uses the gateway until TASK-0027.
