# Contract: `pnpm ci:check`

- **Prerequisites**: dependencies installed (`pnpm install --frozen-lockfile`);
  a reachable Postgres with migrations applied; `DATABASE_URL` and `TEST_DATABASE_URL`
  set.
- **Behavior**: runs the check set in order; stops at the first failure.
- **Exit code**: 0 when every check passes; nonzero otherwise.
- **Extension point**: append `&& pnpm <new-suite>` to `ci:check` and define
  `<new-suite>` as its own script. No other file changes.
- **CI**: `.github/workflows/ci.yml` runs exactly this command, after provisioning.
