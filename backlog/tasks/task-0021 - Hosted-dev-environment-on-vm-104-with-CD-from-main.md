---
id: TASK-0021
title: Hosted dev environment on vm-104 with CD from main
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 17:42'
labels:
  - infra
milestone: m-1
dependencies:
  - TASK-0020
documentation:
  - backlog/docs/doc-0002 - Runtime-environments-—-rulings.md
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement doc-0002 CD and Exposure sections (decision-0006, ratified 2026-09-28). The dev environment on vm-104 is the always-on main app and runs main HEAD after green CI. Tailnet-only exposure; the Cloudflare tunnel is out of scope. Blocked on the four operator prerequisites in doc-0002 (disk, service user, runner registration, tailscaled repair), which need sudo on vm-104.

Spec: specs/016-hosted-dev-cd
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 vm-104 runs the stacks-dev compose project with persistent data
- [ ] #2 A push to main that passes CI deploys to dev automatically, runs migrations, and waits for /health to report the new commit
- [ ] #3 A failed deploy leaves the previous version serving and fails the job visibly
- [ ] #4 A scheduled drift check fails when dev's commit differs from main HEAD
- [ ] #5 dev is reachable over HTTPS on the tailnet and from nowhere else
- [ ] #6 A runbook documents deploy, rollback, and restore on vm-104
- [x] #7 The doc-0002 operator prerequisites are verified on vm-104: at least 40 GiB free, a stacks user in the docker group, a runner registered to evanstern/the-stacks, and working tailnet SSH
- [ ] #8 Spec phase: Foundational — pure deploy logic and workflow invariants
- [ ] #9 Spec phase: User Story 1 — main is always running on dev (P1) 🎯 MVP
- [ ] #10 Spec phase: User Story 2 — a bad deploy never takes dev down (P1)
- [ ] #11 Spec phase: User Story 3 — drift is caught (P2)
- [ ] #12 Spec phase: User Story 4 — only the tailnet reaches dev (P2)
- [ ] #13 Spec phase: User Story 5 — the ops runbook (P3)
- [ ] #14 Spec phase: Polish, re-ground, and the merge condition
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
vm-104 prerequisites, 2026-09-28 (done by orchestrator under a temporary NOPASSWD sudoers entry, since removed and verified: sudo prompts again).
1. Disk: DONE. docker builder prune freed 41.9 GB of unused build cache (0 active). 41 GiB free, 79% used. No images, containers, or volumes of other users touched.
2. Service user: DONE. stacks (uid 1004) in docker group; docker ps works as stacks; evan's authorized_keys copied.
3. Runner: DONE. actions-runner v2.337.0 in /home/stacks/actions-runner, registered to evanstern/the-stacks as vm-104, labels self-hosted,Linux,X64,vm-104. systemd unit actions.runner.evanstern-the-stacks.vm-104 active; GitHub reports it online.
4. Tailscale: NOT DONE, needs operator. Correction to doc-0002: tailscaled is not broken. The host unit is masked on purpose; Tailscale runs in the docker container 'tailscale' (tailscale/tailscale:stable, host network, state in /home/evan/config/tailscale). The socket lives inside that container, which is why the host CLI failed. The container reports 'Logged out', so vm-104 has left the tailnet; that is why tailnet SSH times out. Re-login needs an interactive auth URL or auth key.

4. Tailscale: DONE 2026-09-28. Operator re-authenticated the tailscale container. Verified from the Mac: ssh evan@vm-104.tailb3c1b6.ts.net and ssh stacks@vm-104.tailb3c1b6.ts.net both connect; stacks is in the docker group. All four prerequisites verified.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
(spec authoring; standing escalation sign-off 2026-09-28; ~182k tokens). Open operator questions (plan.md 'Operator checkpoints'): tailnet HTTPS on 8443 (Traefik holds 443); drift cadence hourly :17 with 30-min grace; merge on pre-merge manual deploy/rollback proof with run URLs recorded post-merge; tailnet HTTPS certs may need enabling. Phase 1 (local, pure logic) dispatched; nothing touches vm-104 before operator answers.

Operator rulings 2026-09-29 (plan checkpoint): (1) tailnet HTTPS on 8443 — https://vm-104.tailb3c1b6.ts.net:8443; (2) pre-merge hand-run deploy + forced-unhealthy rollback proof on vm-104 suffices to merge; real CD run URLs recorded post-merge; (3) vm-104 checkpoint commands (init-secrets, tailscale serve, first deploy, forced-unhealthy run) are run by the orchestrator, each announced to the operator with an explicit go before running; implementers never run them; (4) drift check hourly at :17 with 30-min grace.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phase 1 Foundational; 16 unit + 5 workflow-invariant tests, 3 todo pending T005/T012)

Phase grouping (orchestrator call): local code tasks T004-T006, T009-T010, T012-T013, T017-T018 in one sonnet dispatch; vm-104 steps T007/T008/T011/T014/T015/T016/T019 run by the orchestrator under operator ruling (3).

Checkpoint 1 (T007) 2026-09-29: operator go given; orchestrator ran init-secrets from origin/task-0021-hosted-dev-cd@9c14e42 via git archive | ssh. Result: /home/stacks/dev/.env mode 600 owner stacks (13 keys, template values; no AI provider key placed). Bootstrap copy at /home/stacks/dev/bootstrap.

Correction to the checkpoint-1 note: '13 keys' counted comment lines. Active keys: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, DATABASE_URL, DB_PORT, APP_PORT, STACKS_ENV; AI_* lines are commented out.

T008 part 1, 2026-09-29: first dev deploy run by the operator (command announced by the orchestrator; the orchestrator's own ssh was blocked by the permission classifier). Proof clone /home/stacks/dev/proof @ 7b2450909e852d19e7c9ebebcae37d589cd1cad5 (git bundle; stacks has no GitHub creds). deploy --allow-stale -> exit 0; migrations applied; 'dev is serving 7b24509...'; /health {status:ok, database.reachable:true, commit:7b2450909e852d19e7c9ebebcae37d589cd1cad5}. Log: /home/stacks/dev/t008-deploy1.log. Remaining in T008: persistence check (create invitation, redeploy, confirm survives).

T008 part 2, 2026-09-29 (operator go): sentinel row in t008_persist -> redeploy same commit (exit 0, 'dev is serving 7b24509...') -> row read back 'T008 sentinel' -> table dropped. AC #1 persistence proven. Log /home/stacks/dev/t008-deploy2.log. Operator added Bash(ssh stacks@vm-104.tailb3c1b6.ts.net:*) to .claude/settings.json (uncommitted local edit in root).

T011 2026-09-29 (operator go): throwaway local commit 8967b87 (never pushed) deployed with --force-unhealthy -> exit 1, last line 'dev is serving 7b2450909e852d19e7c9ebebcae37d589cd1cad5', /health ok on 7b24509. AC #3 proven. Observation for review: the rollback re-created the previous app container (uptime 3s after), so a failed deploy costs a brief restart window rather than zero downtime — consistent with research R6's swap-then-rollback design. Log /home/stacks/dev/t011-rollback.log.

T014 2026-09-29 (operator go): drift at serving commit 7b24509 -> ok, exit 0; at older 4d168d3 (2h, past 30-min grace) -> 'drift: expected 4d168d3, observed 7b24509', exit 1. Clone restored to 7b24509. AC #4 proven.
T015 2026-09-29: operator ran checkpoint 2 personally: tailscale serve --bg --https=8443 -> 127.0.0.1:3000 (tailnet only). First TLS handshake waited ~30s for Tailscale cert issuance (SetDNS/ACME); a 15s curl timed out before it finished.
T016 2026-09-29: from the Mac over tailnet, https://vm-104.tailb3c1b6.ts.net:8443/health -> 200, cert verify 0, commit 7b24509. LAN (vm-104.local.infinity-node.win) ports 3000/5432/8443 closed; tailnet IP :3000 closed (loopback bind). AC #5 proven.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
