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
that only Evan can make. Gap to flag: the Paperclip runtime is Debian 13/trixie while
`deploy/runner` is `node:22-bookworm`; the docker apt repo line and PATH/HOME layout must match
whichever base Paperclip actually runs. Also still unverified by a real build (PR CI does it).

## 3. Docker daemon access — options (nothing enabled; Evan decides)
| Option | How | Security | Fit |
|---|---|---|---|
| Host socket mount | `-v /var/run/docker.sock` into runner | Root-equivalent on the host for any agent; sees/kills every container | Simplest; worst blast radius |
| Rootless DinD sidecar (`deploy/runner/docker-compose.yml`) | `docker:dind-rootless` sharing runner's netns, `DOCKER_HOST=tcp://localhost:2375` | Daemon isolated from host containers; classic dind needs `privileged`, rootless needs user-ns/unprivileged-userns kernel support and has slower/limited networking | Good isolation; keeps 127.0.0.1 port probes in `scripts/env.mjs` working |
| Remote `DOCKER_HOST` (e.g. ssh to a dedicated VM) | `DOCKER_HOST=ssh://…` + key | Blast radius = that VM; needs a credential in the runner; must NOT be vm-104 (hosted dev) | Strong isolation, extra infra; ports live on another host so localhost probes break |

**Recommendation:** rootless DinD sidecar, falling back to non-rootless dind (`privileged`, loopback-only,
no TLS) if the host kernel lacks rootless support. Never the host socket.
