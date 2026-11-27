# Plan — spec 127

Constitution 3.0.0 check: Principle XII (self-hostable by default) holds. The default bind stays
`127.0.0.1`, and remote-daemon mode is opt-in through `DOCKER_HOST`. The other principles don't
apply (tooling only, no game state).

1. `env-lib.mjs`: add `publishedHost(dockerHost)` and `publishAddress(host)`. The second returns
   `undefined` for loopback and `0.0.0.0` otherwise. Both are pure, and env-lib keeps its no-I/O rule.
2. `env.mjs`:
   - `portFree` branches on loopback: keep the bind test, or use a connect test.
   - `writeEnvFile` builds `TEST_DATABASE_URL` from the host.
   - `composeEnv` adds `STACKS_PUBLISH_ADDR` when it is defined.
   - The banner uses the host.
3. Compose: `db` and `test-db` ports become `${STACKS_PUBLISH_ADDR:-127.0.0.1}:…`. Update the
   "DELIBERATELY" comment to explain that the default is unchanged.
4. `env.test.mjs` and `deploy-dev.mjs` use `publishedHost(process.env.DOCKER_HOST)`.
5. Tests in `env-lib.test.mjs`. `pnpm ci:check`.
6. Docs fixes. Re-pin the wiki.
7. Verify locally and in a Paperclip run (operator).
