# Worktree operating model

The Stacks repository uses a bare shared Git store under `.bare/` and one or more developer worktrees beside it. Treat `.bare/` as Git plumbing only. Do not put tracked project docs there, and do not develop directly in `main` as if it were the canonical repo root.

## Layout

- `.bare/` holds the shared repository data.
- `main/` is the deploy-only worktree for the primary branch.
- Additional worktrees are the normal place for feature work, fixes, and verification.
- `.omo/` stays at the repo root beside the worktrees, not inside `.bare/`.

## Compose strategy

Compose identity and teardown are per-worktree. Use the worktree you are standing in, and make sure any helper or skill you use targets that exact stack.

- Keep the local web contract on host port `5173`.
- Keep production separate on its own host port, currently `8423`.
- Do not assume `docker compose down` in one worktree is safe for another worktree.
- Use a worktree-aware helper or runbook step to stop the correct stack for the current checkout.

## Environment bootstrap

Generate each worktree’s local env file from `.env.example`.

- Start from the example file in the current worktree.
- Fill in worktree-local overrides there.
- Do not copy production secrets or production defaults into local worktree env files.
- Keep `.env.production.example` for production-only bootstrap.

## Practical rules

- Keep app changes in worktrees, not in `.bare/`.
- Keep local and production compose paths separate.
- Preserve the documented `5173` local web port contract.
- If you add a new helper or skill for lifecycle management, link it from `main/README.md` and `main/AGENTS.md`.
