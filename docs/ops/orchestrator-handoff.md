# Orchestrator handoff — 2026-10-28

The operator is switching Claude Desktop providers. Every session from the earlier environment is lost:
the orchestrator, the M3 sweep, and the playtest feedback session. This document is the single
entry point for resuming in a new environment. Read it top to bottom once.

Everything the old sessions held only in app storage is copied into `docs/ops/orchestrator-kit/`.

## 1. How we work

Three kinds of actor, each with one job:

- **Orchestrator (the main session).** It talks with the operator. It starts sweep and side sessions,
  relays rulings, and summarizes reports in plain language. It does not implement.
- **Sweep sessions.** One per milestone run. Each executes a runbook (`pdlc:sweep`): it claims a board
  task, dispatches a spec author and phase implementers, gates every phase, opens the PR, merges on
  green, cleans up, and re-grounds the wiki. Each hands off to a fresh session at about 70% context
  by writing a handoff section.
- **Implementer agents.** A sweep dispatches them per phase. Specs go to `opus-implementer`. Phases
  go to `sonnet-implementer`, or `haiku-implementer` for narrow mechanical work. Every dispatch gets a
  `Dispatch: tier=<t> pinned=<id> served=<id>` line on its card, with `served=` read from the transcript.

Side sessions cover work that is not part of a sweep, for example live playtest feedback or a design round.

### Operator rules for the orchestrator

- **Report in plain language.** Name the task, what changed, what it means, and what is waiting on the
  operator. Lead with what needs the operator.
- **Relaying words.** When relaying the operator's instructions, augment or interpret them if you are
  85% or more sure of the meaning. Otherwise ask first. (memory: `relay-operator-words`)
- **Rulings that change scope or a frozen contract** must come from the operator in the receiving
  session's own chat. A sweep refuses relayed rulings of that kind. Give the operator the exact line to type there.
- **Merge on green.** Sweep PRs merge as merge commits once CI is green and every Dispatch line is
  recorded. The grant excludes frozen-contract rulings, player-facing open questions, paid runs,
  vm-104 changes, and keys. (memory: `merge-on-green-grant`)
- **Paid runs** need the operator's spending ceiling on the card, in their words.
- **vm-104** changes need the operator's go on each exact command. (memory: `vm-104-command-consent`)
- **No "for now".** Defer known-wanted work only with ordered cards. A maybe gets a revisit card with
  a trigger. (memory: `no-unplanned-for-now`)
- **UI:** no modals. Use slide-outs or dropdowns. Browser automation uses Brave.
- **Never** read, print, or handle passwords, API keys, or tokens.

## 2. First steps in the new environment

Do these in order before dispatching anything.

1. **Resolve the host's model ID form.** A new provider may reject the bare IDs in
   `.claude/model-tiers.json` (`claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`). Check the
   `ANTHROPIC_DEFAULT_*_MODEL` env values for a hint. Prove the form with one cheap dispatch.
2. If the form differs, edit `.claude/model-tiers.json` on a branch. Regenerate with
   `node ~/.claude/plugins/cache/praxisflux/pdlc/<version>/scripts/tiers.mjs --root .`. Then
   **restart the session**: the agent registry loads at session start. (memory: `desktop-session-tier-dispatch`)
3. **Check the plugin versions.** Gate commands in the kit name praxisflux `0.68.0` paths under
   `~/.claude/plugins/cache/praxisflux/`. Update the paths if the installed version differs.
4. **Check the tools:** `backlog --version`, `gh auth status`, `docker ps`, `pnpm --version`, and Tailscale
   reaching `https://vm-104.tailb3c1b6.ts.net:8443/health`.
5. **Restore memory.** The project memory lives in
   `~/.claude/projects/-Users-evanstern-projects-the-stacks/memory/`. If that folder is empty in the new
   environment, copy `docs/ops/orchestrator-kit/memory/*.md` into it.
6. **Restore `.claude/launch.json`.** It is untracked and excluded through `.git/info/exclude`. Its content is in section 7.
7. Run `pnpm env:prune --check`. A nonzero exit blocks until the orphan is removed.
8. Start the orchestrator session with the prompt in section 8.

## 3. State at handoff (2026-10-28, `main` at `b0b7ebcd` before this PR)

- **Root checkout:** `main`, clean, level with origin.
- **Open PRs:** none. The latest merged sweep PRs are #84 TASK-0167, #85 TASK-0165, and #86 TASK-0176.
- **Milestone M3 (The Table):** 30 of 68 tasks done. M1 has 16 of 19 done. M4 to M9 are carded and not started.
- **The M3 sweep is paused** by the operator: "Before we start on another slice of M-3 I'd like to
  pause -- after the next PR merges." That was after #86.
- **Runbook:** `docs/design/m3-table-sweep-runbook.md`. Its Execution log is current through TASK-0176.
  Pause note: `orchestrator-kit/notes/m3-sweep-pause-2026-10-28.md`.

### Resume order (operator-ruled)

1. **TASK-0177:** the operator seats a human DM from the web. Not started.
2. **TASK-0163, AC #4:** the live two-account alpha run on hosted dev. The card is In Progress. The
   kit merged in #79: the `greyhollow-ford-duo` seed, invitation sign-up, and the Start scene slide-out.
3. **TASK-0053:** the M3 demo, with three humans (seed `greyhollow-ford-trio`, TASK-0176). The card
   holds a $50 ceiling in the operator's words. A human-review checkpoint comes before it runs, and
   the operator recruits the players.

Other m-3 work the operator has raised from playtesting, all To Do: TASK-0169 (roll lines name the
check), TASK-0170 (a check's outcome is fixed before the roll), TASK-0171 (scene-start introductions),
TASK-0172 and TASK-0173 (knowledge ledger, NPC learning), TASK-0175 (`/play` lists your tables),
TASK-0164 (party slide-out), TASK-0133 (roll line before the prose). TASK-0129 (Ask the DM) is a
design round the operator runs, outside the sweep.

### Playtest in progress

The operator was playing the two-browser alpha (both seats, one normal and one private Brave window).
Run 1 is logged with eight findings, all carded. Run 2 has its checklist and no findings yet. The
log is `docs/playtests/2026-10-28-two-browser-alpha.md`. Cards TASK-0169 and TASK-0171 to TASK-0173
already cite that path. When run 2 ends, append a summary to TASK-0163 as a note. The sweep owns
ticking TASK-0163's AC #4.

### Leftovers to check (do not delete without the operator)

- `.worktrees/env-main` (detached): the local `env:main` stack used for previews.
- `.claude/worktrees/{agitated-goldberg-bff213, compassionate-blackwell-19dd08, frosty-kilby-f718dc, unruffled-mclean-a7ace5}`:
  app-made worktrees from older sessions. `unruffled-mclean-a7ace5` is on `review-pr46`.
- TASK-0103 (reset-password CLI) is To Do with no milestone. Until it lands, reset a hosted-dev
  password with the operator in the loop, and never on the command line.

## 4. Infrastructure

- **Hosted dev:** vm-104, `https://vm-104.tailb3c1b6.ts.net:8443`, container `stacks-dev-app-1`, env file
  `/home/stacks/dev/.env`. It deploys `main` after CI. Runbook: `docs/ops/dev-vm-104.md`.
- **App model provider:** 9router on vm-103, `http://9router.local.infinity-node.win/v1`, backed by a
  Claude OAuth login. A 401 from the app means that login was revoked: re-authenticate 9router. This is
  app config, separate from Claude Code's provider.
- **Local stacks:** one compose stack per worktree (`pnpm env:up` / `pnpm env:down`). Fresh stacks come
  up unmigrated (TASK-0098). Migrate inside the stack's network as the TASK-0158 quickstart documents,
  never by building a URL from `.env` passwords.
- **Keyless live checks:** set `DM_FAKE_SCRIPT=<script>` in a worktree `.env` for the scripted DM
  (TASK-0158). Append with `printf '\n...\n'`, because the file has no final newline.

## 5. Known traps

- **Root guard:** commit with `git -C <literal worktree path>`. Stage and commit in separate calls.
  Never `cd` or use `$vars` in the path. (memories: `root-guard-*`)
- **Backlog:** use the CLI only. Board commits go direct to `main`; push them right away, or other
  sessions see ghost tasks. MCP backlog tools edit the root's card copy, so use the CLI inside a worktree
  for branch cards.
- **`backlog task edit --dep`** replaces the whole list. Pass every dependency.
- **`tools/link.py`** overwrites `spec.md` with a stub. Never run it on an authored spec.
- **Never commit `.specify/feature.json`.**
- **Decision ids** are assigned per checkout. Copy in the ids held on open branches before `backlog decision create`.
- **Do not `source` the whole `.env`**: its JSON AI config breaks the retrieval bench. Export only `TEST_DATABASE_URL`.
- **Known flakes:** WebSocket gateway tests, and DB scene tests under full-suite load (TASK-0154). Re-run once and report.
- **macOS has no `timeout`** command.
- **A button in the next-step box can be tapped by accident.** Confirm surprising answers with the operator.

## 6. Kit index (`docs/ops/orchestrator-kit/`)

| Path | What it is |
|---|---|
| `dispatch-rules.md` | Rules pasted into every implementer brief. Fix the scratchpad path before use. |
| `tools/claim.sh` | Claims a task: worktree, card flip, spec stub. It calls `link.py` by an old scratchpad path, so fix that first. |
| `tools/seed.py` | Adds a spec's phase ACs to its card from the spec-bridge state. |
| `tools/link.py` | Writes a spec stub and the `Spec:` marker. New claims only. |
| `tools/mkcards.py` | One-off: created the decision-0025 cards. Reference only. |
| `notes/m3-sweep-pause-2026-10-28.md` | The sweep's own pause note. |
| `notes/m3-sweep-handoff-*.md`, `m3-sweep-session2-state.md` | Earlier sweep handoffs, for history and rulings. |
| `notes/m3-sweep-lane0-decisions.md` | Lane 0 rulings. |
| `notes/dispatch-ledger.md` | Session-1 dispatch ledger. |
| `notes/pr46-adversarial-review.md` | PR #46 review notes. |
| `memory/` | A copy of the project's Claude memory files. |

## 7. `.claude/launch.json` (untracked)

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "main-stack", "url": "http://localhost:3000" },
    { "name": "task-0046-stack", "url": "http://localhost:3046" },
    { "name": "task-0047-stack", "url": "http://localhost:3047" },
    { "name": "task-0048-stack", "url": "http://localhost:3048" },
    { "name": "hosted-dev", "url": "https://vm-104.tailb3c1b6.ts.net:8443" }
  ]
}
```

## 8. Starter prompts

### Orchestrator (paste into the first session)

> You are the orchestrator for the-stacks. Read `docs/ops/orchestrator-handoff.md` and follow
> section 2 before anything else. Then report the board state and what waits on me. Do not implement:
> start sweep and side sessions, relay my rulings, and summarize their reports in plain language.

### M3 sweep (the orchestrator starts it when the operator says to resume)

> Resume the M3 sweep (`pdlc:sweep`) from `docs/design/m3-table-sweep-runbook.md`. Read
> `docs/ops/orchestrator-handoff.md` sections 1, 3 and 5, and
> `docs/ops/orchestrator-kit/notes/m3-sweep-pause-2026-10-28.md`. Copy
> `docs/ops/orchestrator-kit/tools/` and `dispatch-rules.md` into your scratchpad and fix their paths.
> Follow the resume order: TASK-0177, then TASK-0163 AC #4, then TASK-0053. Record a Dispatch line per
> dispatch. Merge on green under the operator's grant. Write a handoff section at about 70% context.

### Playtest feedback (when the operator plays)

> Be my live playtest partner on hosted dev. Log findings in
> `docs/playtests/2026-10-28-two-browser-alpha.md` (run 2 onward), via a branch, or in your
> scratchpad if the root guard blocks it. Classify each finding, check the board for an existing card,
> and propose new cards. Create them with the `backlog` CLI only after I agree, then push to `main`.
> Do not change code, deploy, or run vm-104 commands without my go on the exact command.
