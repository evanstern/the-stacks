# the-stacks runner image

Spec and rulings: Paperclip INF-20 `runner-environment-spec`, INF-23 `runner-image-rulings`.

Contents: Node 22, pnpm 11.10.0 (corepack), backlog.md 1.57.4, specify-cli v0.12.5,
Docker CLI + compose v2 (daemon in the dind sidecar), praxisflux v1.0.2 clone at `/opt/praxisflux`.

Workspace provision command: `pnpm install --frozen-lockfile`.
Run `provision-plugins` during provisioning so plugins land in the live `CLAUDE_CONFIG_DIR`.

Smoke test (fresh worktree): `pnpm install`, `backlog task list --plain`,
`backlog task view TASK-0359 --plain`, `pnpm env:up` / `env:down`, `pnpm env:prune --check`,
`pnpm ci:check`, and `/pdlc:*` skills resolving in a real agent run.

Unverified: this definition has not been built (no Docker on the authoring runner).
