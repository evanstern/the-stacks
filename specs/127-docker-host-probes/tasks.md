# Tasks — spec 127

## Phase 1 — Derivation and wiring (FR-001..FR-004)

- [x] T001 `publishedHost` and `publishAddress` in env-lib.mjs, with unit tests
- [x] T002 env.mjs: portFree branch, TEST_DATABASE_URL, STACKS_PUBLISH_ADDR, banner
- [x] T003 Compose db and test-db publish on `${STACKS_PUBLISH_ADDR:-127.0.0.1}`
- [x] T004 env.test.mjs and deploy-dev.mjs health fetches use the derived host

## Phase 2 — Gates and docs (FR-005, FR-007)

- [ ] T005 `pnpm ci:check` green; `docker compose config` on a local daemon still shows 127.0.0.1
- [ ] T006 Fix docs/ops/agent-tooling.md and the deploy/runner comments; re-pin the wiki

## Phase 3 — Verify in the agent environment (FR-006)

- [ ] T007 Paperclip agent run: env:up, TEST_DATABASE_URL connect, /health, env:down, env:prune --check
