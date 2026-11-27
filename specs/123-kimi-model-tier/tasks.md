# Tasks: Kimi model tier

- [x] T001 Verify contextWindow against 9router `/v1/models`.
- [x] T002 Add `kimi` tier to `.claude/model-tiers.json`.
- [x] T003 Run `tiers.mjs --root .`; commit `.claude/agents/kimi-implementer.md`; `--check` exits 0.
- [ ] T004 One-off dispatch from a harness that honours `kimi/` routing; record `Dispatch: tier=kimi pinned=kimi/kimi-for-coding served=<receipt>` on TASK-0360.
- [ ] T005 Confirm `tiers.mjs --check` in INF-9 `gates.yml` once merged.
