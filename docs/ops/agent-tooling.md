# Agent tooling in Paperclip runs (INF-30)

The Paperclip runtime image (Debian 13, uid 1000 `node`, read-only `/usr/local`) ships node, pnpm,
python3, curl, git, gh — but not `backlog`, `uv`, `specify`, or `docker`, and has no
`/var/run/docker.sock`.

## 1. Interim: user-space bootstrap
`scripts/agent-bootstrap.sh` — idempotent, no root, installs into `$HOME/.local/bin`:
`backlog.md@1.57.4` (npm `--prefix`), `uv 0.13.10` (astral installer), `specify-cli` from
`github/spec-kit@v0.12.5`. Then `export PATH="$HOME/.local/bin:$PATH"`. Pins mirror
`deploy/runner/Dockerfile`; bump both together (backlog bumps need a CTO ruling). Docker is not covered.

## 2. Permanent: runner image
`deploy/runner/Dockerfile` (INF-20/INF-23) now also pins `uv`. Built by
`.github/workflows/runner-image.yml` (PR: build + toolchain smoke test; push to `main`: publishes
`ghcr.io/evanstern/the-stacks-runner:latest`). Anyone who can merge to `main` triggers a rebuild
(workflow_dispatch also works); *adopting* the image in the Paperclip runner is a host-level change
that only Evan can make. The image is Debian 12 (bookworm) while Paperclip's runtime is Debian 13:
acceptable because the image only needs to provide the same CLIs, not the same OS release; revisit
if a binary needs a newer glibc. PR CI performs the image's first real build.

## 3. Docker daemon access — options (vm-104 runs a privileged DinD sidecar with its own netns)
| Option | How | Security | Fit |
|---|---|---|---|
| Host socket mount | `-v /var/run/docker.sock` into runner | Root-equivalent on the host for any agent; sees/kills every container | Simplest; worst blast radius |
| Rootless DinD sidecar (`deploy/runner/docker-compose.yml`) | `docker:dind-rootless` sharing runner's netns, `DOCKER_HOST=tcp://localhost:2375` | Daemon isolated from host containers; classic dind needs `privileged`, rootless needs unprivileged user-namespace kernel support and has slower/limited networking | Good isolation; published ports are reached at the `DOCKER_HOST` hostname (see below) |
| Remote `DOCKER_HOST` (e.g. ssh to a dedicated VM) | `DOCKER_HOST=ssh://…` + key | Blast radius = that VM; needs a credential in the runner; must NOT be vm-104 (hosted dev) | Strong isolation, extra infra; `ssh://` is not supported by `scripts/env.mjs` (spec 127) |

**Recommendation:** rootless DinD sidecar, falling back to non-rootless dind (`privileged`, loopback-only,
no TLS) if the host kernel lacks rootless support. Never the host socket.

**As deployed on vm-104:** the agent Docker is a privileged DinD sidecar with its own network namespace,
reached as `DOCKER_HOST=tcp://dind:2376` with TLS (operator decision, infinitynode.media TASK-101). It
does not share the runner's netns, so `127.0.0.1` probes do not reach published ports. Published ports
are reached at the `DOCKER_HOST` hostname (`dind`). `scripts/env.mjs` derives that host (spec 127): it
connect-probes ports there, writes `TEST_DATABASE_URL` with it, and publishes `db`/`test-db` on `0.0.0.0`
inside the sidecar's namespace only. On a local daemon nothing changes.
