# the-stacks

## Quickstart

Requires Docker with Compose. Nothing else — no Node, no pnpm, no Postgres on the host.

```sh
git clone <repo> && cd the-stacks
cp .env.example .env          # then edit: set a real POSTGRES_PASSWORD
docker compose up -d
```

Check progress with `docker compose ps` — both services reach `healthy` within a couple
of minutes on a cold start (image build included).

See `.env.example` for every variable the stack reads.
