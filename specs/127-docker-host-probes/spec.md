# Spec 127 — Stack probes honor DOCKER_HOST (TASK-0363)

## Problem

Paperclip agents run inside the `paperclip` container on vm-104. Their Docker daemon is a separate
privileged DinD sidecar, reached as `DOCKER_HOST=tcp://dind:2376` with TLS. A container started
there publishes its ports in the **sidecar's** network namespace. Measured on 2026-11-27:

| Published as | From the agent | Result |
|---|---|---|
| `127.0.0.1:P:80` | `127.0.0.1:P` | unreachable |
| `P:80` | `dind:P` | 200 |

The worktree-stack tooling assumes that Docker publishes on this machine's loopback, so on a remote
daemon:

- `scripts/env.mjs` `portFree()` tests a local `127.0.0.1` bind. That checks the wrong host. It
  reports "free" falsely, and then compose fails, or never notices a real clash.
- The `db` (`docker-compose.yml`) and `test-db` (`docker-compose.test.yml`) ports publish on
  `127.0.0.1` only. From the agent they are unreachable at any address.
- `TEST_DATABASE_URL` and the `env:up` banner say `localhost`.
- `scripts/env.test.mjs` and `scripts/deploy-dev.mjs` fetch `/health` on localhost.

`env:up`, `env:down` and `env:prune --check` still pass, because they check health through
`docker`. Anything that connects to a published port from the agent's shell fails: integration
tests against `TEST_DATABASE_URL`, and the e2e health fetch.

## Requirements

- **FR-001 Published-port host.** Add a pure `publishedHost(dockerHost)` to `env-lib.mjs`:
  - Unset, empty, or `unix://…` gives `127.0.0.1`.
  - `tcp://H:port` or `tcp://H` gives `H`, with IPv6 brackets stripped.
  - `ssh://…` and anything else throw a clear error. Out of scope.
- **FR-002 Bind address.** Publish the `app`, `db` and `test-db` ports on
  `${STACKS_PUBLISH_ADDR:-127.0.0.1}`. env.mjs sets `STACKS_PUBLISH_ADDR=0.0.0.0` only when
  `publishedHost` is not loopback. Otherwise it leaves the variable unset, so compose falls back to
  `127.0.0.1` and local behavior is byte-identical. Self-hosters running plain `docker compose up`
  are unaffected.
  - `app` today publishes on all interfaces (`"${APP_PORT}:${APP_PORT}"`). It keeps that default.
    Only `db` and `test-db` gain the variable.
- **FR-003 Port probe.** On a remote daemon, `portFree(port)` is a TCP connect to
  `publishedHost:port`: refused means free, connected means taken, with a short timeout. A local
  daemon keeps the bind test.
- **FR-004 Addresses.** `TEST_DATABASE_URL`, the `env:up` banner, the `env.test.mjs` health fetch
  and the `deploy-dev.mjs` health fetch all use `publishedHost`.
- **FR-005 Tests.** Unit-test `publishedHost` and the bind-address decision in `env-lib.test.mjs`.
  The existing tests pass unchanged. `pnpm ci:check` is green.
- **FR-006 Verify.**
  - On a local daemon: `docker compose config` still shows `127.0.0.1` for `db` and `test-db`.
  - In a Paperclip agent run: `env:up`, a `TEST_DATABASE_URL` connection, `/health`, `env:down`
    and `env:prune --check` all succeed.
- **FR-007 Docs.** Correct `docs/ops/agent-tooling.md` and the `deploy/runner/*` comments that
  claim localhost probes work (they assumed a rootless sidecar sharing the netns, which was not
  the choice made). Re-pin any `docs/wiki/` notes whose sources change.

## Security note

`0.0.0.0` inside the DinD sidecar binds that sidecar's interfaces only. Its networks are an internal
one shared with paperclip, and an egress-only bridge that nothing publishes from. It is never the
vm-104 host or the LAN. On a normal local daemon nothing changes.
