---
id: TASK-0363
title: >-
  Stack probes honor DOCKER_HOST: reach worktree stacks on a remote Docker
  daemon (agent DinD sidecar)
status: Done
assignee: []
created_date: '2026-11-27T09:23:00Z'
updated_date: '2026-11-27T09:44:00Z'
labels:
  - tooling
  - agents
  - env
dependencies: []
priority: high
type: bug
ordinal: 346000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents in Paperclip run inside the paperclip container, whose Docker daemon is a separate DinD sidecar (DOCKER_HOST=tcp://dind:2376, TLS). Containers started there publish ports in the sidecar's network namespace. Measured 2026-11-27: a port published as 127.0.0.1:P:80 is NOT reachable from the agent at 127.0.0.1:P; a port published as P:80 IS reachable at http://dind:P.
So everything that assumes 'Docker publishes on this machine's loopback' breaks for agents:
- scripts/env.mjs portFree() tests binding on local 127.0.0.1. With a remote daemon that checks the wrong host: it gives false 'free' results, then compose fails.
- docker-compose.yml db and docker-compose.test.yml test-db publish on 127.0.0.1 only, so they are unreachable from the agent at any address.
- TEST_DATABASE_URL (written by env.mjs) and the 'up' banner use localhost.
- scripts/env.test.mjs fetches http://localhost:<appPort>/health.
- scripts/deploy-dev.mjs fetches http://127.0.0.1:<port>/health.
Constraint, unchanged: on a normal local daemon (no DOCKER_HOST, or a unix socket), behavior must stay byte-identical. In particular the db and test-db stay on 127.0.0.1 (docker-compose.yml's 'DELIBERATELY, not 0.0.0.0' comment: never publish a self-hoster's database to their LAN).

Spec: specs/127-docker-host-probes
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add one helper that derives the host where published ports are reachable: DOCKER_HOST tcp://H:port gives H (ssh://... is out of scope and errors clearly), unset or unix:// gives 127.0.0.1. Unit-test it in env-lib.test.mjs.
- [x] #2 Make the publish bind address configurable (for example STACKS_PUBLISH_ADDR, default 127.0.0.1) for the db, test-db and app ports. env.mjs sets it to 0.0.0.0 only when the daemon is remote; local behavior is unchanged.
- [x] #3 Make portFree() probe the derived host by connecting (a TCP connect test) when the daemon is remote, and keep the local bind test otherwise.
- [x] #4 Make TEST_DATABASE_URL, the env:up banner, env.test.mjs's health fetch and deploy-dev.mjs's health fetch use the derived host.
- [x] #5 Make pnpm ci:check green; existing env-lib tests pass unchanged.
- [x] #6 Verify in a Paperclip agent run (DinD) that env:up, a TEST_DATABASE_URL connection, the app /health, env:down and env:prune --check all succeed. Verify on a local daemon that the published addresses are still 127.0.0.1.
- [x] #7 Correct docs/ops/agent-tooling.md and deploy/runner/* comments that claim localhost probes work; re-pin any wiki notes whose sources change.
- [x] #8 Spec phase: Phase 1 — Derivation and wiring (FR-001..FR-004)
- [x] #9 Spec phase: Phase 2 — Gates and docs (FR-005, FR-007)
- [x] #10 Spec phase: Phase 3 — Verify in the agent environment (FR-006)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Tier escalation sonnet->opus: operator ruling 2026-11-27 "Use Opus" after the sonnet dispatch failed with model_not_found (claude-sonnet-5-5).

T007 verified by the orchestrator (infinitynode.media session), 2026-11-27, inside the paperclip container on vm-104 as user node, with DOCKER_HOST=tcp://dind:2376 (TLS, privileged DinD sidecar). Each run used a throwaway clone of this branch in /tmp, removed afterwards (no images, volumes or containers left):
- env:up exit 0; banner 'up — http://dind:8346 (app :8346, db :20346, test-db :30346)'.
- GET http://dind:8346/health -> status ok, database reachable, commit 78f64bb7. http://localhost:8346 fails, as expected.
- TEST_DATABASE_URL = postgres://***@dind:30346/stacks; a TCP connect to it succeeded.
- After 'pnpm turbo run build --filter=@the-stacks/server...', 'vitest run test/auth.integration.test.ts' with the .env loaded: 1 file, 15/15 tests passed against TEST_DATABASE_URL. (Without the build first, vitest cannot resolve @the-stacks/session-model; that is the normal turbo dependsOn, not this change.)
- env:down exit 0; env:prune --check 'no orphans.'
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-11-27T09:26:00Z

---

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5

---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Phase 1 — Derivation and wiring (FR-001..FR-004): 4/4 · Phase 2 — Gates and docs (FR-005, FR-007): 2/2 · Phase 3 — Verify in the agent environment (FR-006): 1/1). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
