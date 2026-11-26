# Plan: praxisflux gates as required GitHub checks

- **D1**: New workflow `.github/workflows/gates.yml`, four independent jobs so each is its own required check. Existing `ci.yml` is untouched.
- **D2**: `gate-spec-bridge` and `gate-wiki-freshness` use `evanstern/praxisflux@v1.0.2` (composite action, `fetch-depth: 0`). Pinned to a release tag per the praxisflux consuming guide.
- **D3**: `gate-tiers` shallow-clones praxisflux at tag `v1.0.2` and runs `node pdlc/scripts/tiers.mjs --root . --check` (the package ships no tiers gate).
- **D4**: `gate-scope` runs the in-repo script against `origin/<base>...HEAD`; pure logic in `check-spec-scope-lib.mjs` with `node --test` coverage wired into `check:scripts`.
- **D5**: `.spec-bridge.json` carries only `requireDispatchRecord: true`.
- **D6**: Branch protection via the GitHub API if credentials allow; otherwise a question card to Evan.
