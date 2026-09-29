# Feature Specification: Hosted dev environment on vm-104 with CD from main

**Feature Branch**: `task-0021-hosted-dev-cd`

**Created**: 2026-09-29

**Status**: Draft

**Input**: Board card TASK-0021 — "Hosted dev environment on vm-104 with CD from main" —
implementing `backlog/docs/doc-0002` (Runtime environments — rulings, decision-0006,
ratified 2026-09-28), sections "CD to `dev` (vm-104)" and "Exposure". The card's
implementation notes supersede doc-0002's "repair `tailscaled`" text: Tailscale on vm-104
runs in the Docker container `tailscale` (host network), and the host unit is masked on
purpose. AC #7 (operator prerequisites) is already verified on the card.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Main is always running somewhere real (Priority: P1)

The operator merges a pull request to `main`. CI passes. Without anyone touching vm-104,
the hosted `dev` environment is rebuilt from that exact commit, its database schema is
brought up to date, and within minutes `dev` answers on its health endpoint with the new
commit. The operator's playtest data in `dev` is still there afterwards.

**Why this priority**: `dev` is the always-on `main` app (doc-0002). Every later M1 check
that runs "against dev" (TASK-0030) and the M1 walkthrough (TASK-0031) need it. Without an
automatic deploy, `dev` drifts from `main` the day after it is set up.

**Independent Test**: Push a commit to `main`. Watch the deploy job start after CI
succeeds. Confirm `dev`'s health report names that commit and that data created before
the deploy is still present. (AC #1, AC #2)

**Acceptance Scenarios**:

1. **Given** vm-104 with no `stacks-dev` stack, **When** the first deploy runs, **Then**
   the `stacks-dev` stack starts, the schema is migrated, and `dev` reports healthy with
   the deployed commit.
2. **Given** a running `dev` holding data, **When** a later commit deploys, **Then** the
   data survives the deploy unchanged.
3. **Given** a push to `main` whose CI run succeeds, **When** CI finishes, **Then** a
   deploy of that commit starts on vm-104 with no human action.
4. **Given** a pull request, or a push to any branch other than `main`, or a CI run that
   failed, **When** CI finishes, **Then** no deploy runs.
5. **Given** a deploy in progress, **When** it completes, **Then** it succeeds only after
   `dev`'s health report shows status ok AND names the commit being deployed.

---

### User Story 2 - A bad deploy never takes dev down (Priority: P1)

A commit reaches `main` that builds but cannot become healthy on vm-104 — a bad
configuration, a crash on start, an unreachable dependency. The deploy job fails, loudly,
in the Actions UI. `dev` keeps answering with the previous commit.

**Why this priority**: an always-on environment that a bad merge can knock out is worse
than no environment — people stop trusting it. This is a merge condition for the task.

**Independent Test**: Trigger a deploy that is deliberately made unhealthy. Confirm the job
fails and that `dev`'s health report still names the previous commit afterwards. (AC #3)

**Acceptance Scenarios**:

1. **Given** `dev` serving commit A, **When** a deploy of commit B fails to build,
   **Then** `dev` keeps serving A and the job fails.
2. **Given** `dev` serving commit A, **When** commit B's migrations fail, **Then** `dev`
   keeps serving A and the job fails.
3. **Given** `dev` serving commit A, **When** commit B starts but never reports healthy
   with its own commit within the deadline, **Then** `dev` is returned to A, reports
   healthy with A, and the job fails.
4. **Given** a failed deploy, **When** the operator opens the run, **Then** the failure
   names the step that failed and states which commit `dev` is now serving.

---

### User Story 3 - Drift is caught, not discovered (Priority: P2)

Something breaks the chain: the runner went offline, a deploy failed and nobody noticed, or
someone changed `dev` by hand. On a fixed schedule, a check compares the commit `dev`
reports to `main` HEAD and fails when they differ, so the drift shows up as a red run
rather than as a surprise during a playtest.

**Why this priority**: the deploy covers the happy path; the drift check covers every path
the deploy cannot see. Useful, but `dev` still works without it.

**Independent Test**: With `dev` deliberately behind `main` (or not running), run the drift
check on demand and see it fail with both commits named. With `dev` current, see it pass.
(AC #4)

**Acceptance Scenarios**:

1. **Given** `dev` reports the same commit as `main` HEAD, **When** the drift check runs,
   **Then** it passes.
2. **Given** `dev` reports a different commit, or does not answer, **When** the drift check
   runs, **Then** it fails and names both the expected and the observed commit.
3. **Given** a deploy is in flight for `main` HEAD, **When** the drift check runs,
   **Then** the result is not a false alarm caused by the in-flight deploy (see Edge Cases).

---

### User Story 4 - Only the tailnet can reach dev (Priority: P2)

A player on the operator's tailnet opens `dev` in a browser at an HTTPS address on the
tailnet hostname and gets the app with a valid certificate. Someone on vm-104's LAN, or on
the public internet, cannot reach the app or its database at all.

**Why this priority**: tailnet-only exposure is the ratified posture (doc-0002, Exposure).
A public path needs its own decision (the Cloudflare tunnel, out of scope).

**Independent Test**: From a tailnet device, load `dev` over HTTPS. From a non-tailnet path
(the LAN address of vm-104), try the app and database ports and see the connections
refused. (AC #5)

**Acceptance Scenarios**:

1. **Given** a device on the tailnet, **When** it requests `dev`'s tailnet HTTPS address,
   **Then** it gets the app over a trusted certificate.
2. **Given** a device on vm-104's LAN but not using the tailnet, **When** it connects to
   vm-104 on the app port or the database port, **Then** the connection is refused.
3. **Given** the public internet, **When** anyone tries to reach `dev`, **Then** no route
   exists.

---

### User Story 5 - The operator can deploy, roll back, and restore by the book (Priority: P3)

The operator, or an agent working on the operator's behalf, needs to redeploy a commit,
roll `dev` back to a known-good commit, take a backup of `dev`'s data, or restore one. A
runbook in the repo says exactly how, step by step, with no step that exists only in
someone's memory. (AC #6)

**Why this priority**: needed the first time something goes wrong, not before. It is cheap
to write while the design is fresh.

**Independent Test**: Follow the runbook's rollback procedure once against `dev` and end
with `dev` reporting the chosen commit. Follow its backup procedure once and end with a
backup file on vm-104.

**Acceptance Scenarios**:

1. **Given** the runbook, **When** the operator follows "Deploy", **Then** `dev` runs the
   requested `main` commit.
2. **Given** the runbook, **When** the operator follows "Rollback", **Then** `dev` runs the
   chosen earlier commit and the drift check reports the deliberate drift.
3. **Given** the runbook, **When** the operator follows "Backup" and then "Restore",
   **Then** `dev`'s data matches the backup.

---

### Edge Cases

- **Two merges in quick succession.** Deploys MUST run one at a time. A deploy for a
  commit that is no longer `main` HEAD when it starts MUST skip rather than roll `dev`
  backwards.
- **CI for an older commit finishes after CI for a newer one.** Same rule: never deploy a
  commit older than `main` HEAD.
- **The runner is offline when CI succeeds.** The deploy waits in the queue. If it never
  runs, the drift check fails.
- **The very first deploy fails.** There is no previous version to return to. The job
  fails and says so; `dev` is simply not up yet.
- **A migration succeeds, then the new app is unhealthy.** `dev` returns to the previous
  app version on the migrated schema. Migrations MUST therefore stay backward-compatible
  with the previous app for one release (additive only). See Assumptions.
- **Drift check during a deploy.** The check MAY report drift while a deploy is in flight.
  It MUST NOT run concurrently with a deploy; it waits for any in-flight deploy first.
- **Disk pressure on vm-104.** Old `dev` images MUST be pruned so repeated deploys do not
  fill the disk; images, containers, and volumes owned by other projects on vm-104 MUST
  never be touched.
- **Other stacks on vm-104.** vm-104 already runs unrelated compose projects (including one
  named `the-stacks-prod`). `dev` MUST use its own project name and MUST NOT collide with
  their ports, networks, or volumes.
- **Secret missing on the runner.** A deploy that cannot find `dev`'s environment file
  MUST fail before touching the running stack.

## Requirements *(mandatory)*

### Functional Requirements

**Environment (AC #1)**

- **FR-001**: vm-104 MUST run `dev` as the compose project `stacks-dev`, with the app on
  host port 3000 and the database on loopback port 5432 (doc-0002 Environments table).
- **FR-002**: `dev`'s database MUST live in a persistent named volume. No routine deploy,
  rollback, or runbook procedure other than an explicit, operator-confirmed "destroy"
  MAY remove it.
- **FR-003**: Every `dev` container MUST carry the `org.the-stacks.env=dev`,
  `org.the-stacks.worktree`, and `org.the-stacks.commit` labels, so `env status` style
  tooling and the drift check can identify it.

**Deploy (AC #2)**

- **FR-004**: A deploy MUST start automatically when, and only when, the CI workflow
  completes successfully for a push to `main`.
- **FR-005**: A deploy MUST NOT run for pull requests, for other branches, or for failed
  or cancelled CI runs. Deploy code from a pull request MUST never execute on vm-104.
- **FR-006**: A deploy MUST build the exact commit CI validated, apply pending database
  migrations, start the new version, and succeed only after `/health` reports status
  `ok` and the deployed commit.
- **FR-007**: Deploys MUST be serialized. A deploy whose commit is no longer `main` HEAD
  MUST exit without changing `dev`.
- **FR-008**: The operator MUST be able to start a deploy of `main` HEAD on demand, without
  a new push.

**Failure and rollback (AC #3)**

- **FR-009**: If the build or the migrations fail, the running `dev` version MUST be left
  untouched.
- **FR-010**: If the new version does not report healthy with its own commit within a
  fixed deadline, the deploy MUST return `dev` to the previously running version, confirm
  it healthy, and then fail.
- **FR-011**: A failed deploy MUST fail the job visibly and state which commit `dev` is
  serving afterwards.
- **FR-012**: The deploy MUST provide an operator-only way to force the new version to be
  unhealthy, so the rollback path can be proven on demand without pushing a broken commit
  to `main`.

**Drift (AC #4)**

- **FR-013**: A scheduled check MUST compare `dev`'s reported commit to `main` HEAD and
  fail when they differ or when `dev` does not answer. It MUST also be runnable on demand.

**Exposure (AC #5)**

- **FR-014**: `dev` MUST be served over HTTPS on vm-104's tailnet hostname, with a
  certificate trusted by tailnet devices.
- **FR-015**: Neither the app port nor the database port MAY be reachable from any
  interface other than vm-104's loopback. The tailnet path is the only way in.
- **FR-016**: Exposure MUST NOT use a public tunnel or public funnel.

**Operations (AC #6)**

- **FR-017**: A runbook MUST document, for vm-104: deploy, rollback to a named commit,
  backup of `dev`'s database, restore from a backup, where `dev`'s secrets live, and how
  to inspect state.
- **FR-018**: `dev`'s secrets (database password, and later any model provider key) MUST
  live only on vm-104, readable only by the runner's user. They MUST NOT appear in the
  repository, in workflow logs, or in any implementer's context.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST be able to drive every operation in this
  feature — deploy, force-fail, drift check, rollback — through the same interfaces the
  operator uses: the GitHub Actions workflows (dispatch and run logs) and the runbook's
  commands. No step MAY require a GUI-only action after the one-time operator checkpoints.
- **CR-002** (IX. Self-hostable): `docker compose up` from a clean clone MUST keep working
  unchanged for a self-hoster. Everything specific to vm-104 MUST live in files a
  self-hoster never has to use.
- **CR-003** (VIII. Operator-owned content): `dev`'s data volume MAY hold operator-imported
  books. Backups MUST stay on vm-104 (or wherever the operator moves them) and MUST NOT be
  committed or uploaded as workflow artifacts.

### Key Entities

- **Dev environment**: the `stacks-dev` compose project on vm-104 — an app container, a
  database container, and a named data volume.
- **Deploy**: one run of the deploy workflow for one commit; outcome is success, skipped
  (stale commit), or failed with a stated serving commit.
- **Release image**: the app image built for one commit and tagged with it, so a previous
  commit can be started again without rebuilding.
- **Dev secrets file**: the environment file on vm-104 holding `dev`'s credentials, outside
  the repository checkout.
- **Drift report**: expected commit (`main` HEAD), observed commit (`dev`'s `/health`), and
  a pass/fail verdict.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A push to `main` with green CI reaches `dev` with no human action, and `dev`
  reports the new commit within 15 minutes of CI finishing.
- **SC-002**: In a deliberately failed deploy, `dev` reports the previous commit as healthy
  when the job ends, and the job is marked failed. Proven once, with the run recorded.
- **SC-003**: Data created in `dev` before a deploy is present after 100% of deploys.
- **SC-004**: When `dev` lags `main`, the next scheduled drift check fails; the maximum
  time drift goes unreported equals the schedule interval.
- **SC-005**: From a non-tailnet network path, 0 of the app and database ports accept a
  connection; from the tailnet, `dev` loads over HTTPS with no certificate warning.
- **SC-006**: An operator who has never deployed `dev` can roll it back to a named commit
  using only the runbook.

## Assumptions

- The AC #7 prerequisites hold: at least 40 GiB free, the `stacks` user in the `docker`
  group, the self-hosted runner `vm-104` registered to `evanstern/the-stacks`, and working
  tailnet SSH. Verified on the card on 2026-09-28.
- The repository is private and only the operator has write access, so an on-demand deploy
  triggered from `main` is trusted input.
- Migrations are forward-only and additive, so the previous app version runs correctly on
  a migrated schema for one release. A destructive migration needs its own plan.
- A short interruption (seconds) while `dev` is swapped to a new version, or back after a
  failure, is acceptable. Zero-downtime deploys are out of scope.
- The tailnet has HTTPS certificates enabled, or the operator enables them at the
  checkpoint that configures `tailscale serve`.
- The Cloudflare tunnel, public access, and any `dev` authentication beyond the app's own
  session auth are out of scope (doc-0002, Exposure "Later").
- Off-host backup shipping is out of scope; the runbook covers taking and restoring a
  backup on vm-104.
