<!-- pdlc:grounding BEGIN v1.0.1 — planted by pdlc:bootstrap; refreshed wholesale on update. Keep project-specific edits OUTSIDE this block. -->
# the-stacks — praxis development lifecycle (PDLC)

This project is developed with the **praxisflux** plugin suite. This block is the always-on
grounding: it names the loop, each plugin's role, and the rules that hold between them. The
procedures live in the plugins' skills (lazy-loaded); this block makes the rules apply even
when no skill has triggered.

## The loop

Ground the codebase → plan as specs → build → re-ground → teach/render:

```
grounding-wiki (docs/wiki) ──corpus──▶ codebase-to-course (docs/course)
        │
        └─grounding─▶ spec/plan ──▶ build ──▶ wiki-update (re-ground) ──▶ …
```

## Plugin roles (entry skills)

- **grounding-wiki** — the code-grounded corpus in `docs/wiki/`: per-concept notes pinned to
  the commit they were verified against. Build once with `/grounding-wiki:wiki-build`; after
  merging changes that touch files any note lists as sources, run `/grounding-wiki:wiki-update`.
- **codebase-to-course** — interactive single-page HTML course in `docs/course/`, for
  non-technical readers. Reads `docs/wiki/` as its primary input when present.
- **build** — implements a SPEC handed off through `.handoff/` (`/build:implement`) and
  returns findings to the producer.
- **research** — drop-anywhere cited-fact vaults (`research:research-vault` → `analyze-vault`
  → `vault-artifact`) for grounding external topics.
- **spec-bridge** — the kanban view over Spec Kit specs (see the Spec Kit block below, if
  opted in).
- **pdlc** — the lifecycle's own verbs: `pdlc:bootstrap` (re)stamps this grounding after
  plugin upgrades; `/pdlc:sweep` orchestrates a set of board tasks through the whole loop —
  an authored, operator-signed-off runbook, then spec → PR → merge → re-ground per task,
  parallel lanes with serial merges; `/pdlc:design-rounds` handles the task a sweep cannot
  start — work whose deliverable is not knowable until an operator has seen options and
  picked one (UI and visual design, competing layouts), running comparable rounds against a
  long-running worktree and ending with a decision record plus a spec written against the
  choice; `/pdlc:refactor-triage` closes the loop after a sweep — evaluate the merged work
  for debt and drift, triage every finding with the operator, and card accepted items back
  onto the board as sweepable tasks; `/pdlc:pr-review-sweep` works a PR review — triage each
  comment, card the fixes and deferrals, sweep the fixes, and reply on the threads.

## Rules that always hold

- **Artifact-grounded action:** never do anything without leaving a durable paper trail
  and/or gating against real physical evidence in the project — a file, a git commit, a
  task/issue. Artifacts that survive for human review are the only currency of state and
  decision: a choice living only in a chat turn, or a commitment left as prose where its
  durable home is the tracker, did not happen. Decisions are derived FROM artifacts and
  produce NEW artifacts; a question an existing artifact or principle already answers is
  resolved from it, not re-asked as a preference.
- **One TASK, one PR:** a TASK is a top-level deliverable and maps 1:1 to a pull request —
  one task, one branch, one PR. An EPIC (whatever the task system calls it) groups
  deliverable TASKs and gets no PR of its own; a SUBTASK is internal work breakdown and
  never gets its own PR: subtasks land as commits on the parent TASK's single branch and
  merge together in that TASK's one PR. A PR exists only where it carries a stated reason
  for a human to approve (a policy ratified, a posture changed, a contract made binding) —
  never a diff for its own sake; work too small to give a reviewer a real decision merges
  into the deliverable it serves.
- **Gates:** a status can never exceed the artifacts that prove it. Enforcement is
  per-plugin: spec-bridge, educate, research, reorient, and team-review ship Stop hooks;
  grounding-wiki's freshness gate runs as check scripts and CI, not a hook. When a gate
  blocks, produce the missing artifact — don't argue with the gate or edit derived state
  by hand.
- **Handoffs:** plugins compose only through files + gates, never by calling each other.
  Payloads ride the gitignored `.handoff/` transport; evidence lives in tracked state.
- **Grounding freshness:** `docs/wiki/` is load-bearing, not decoration. Changes that touch
  pinned sources aren't done until the wiki is re-pinned (`/grounding-wiki:wiki-update`).
- **Corpus loading:** when a grounded corpus is present (`docs/wiki/` or similar), load its
  `INDEX.md` first and route; load notes just-in-time — never bulk-load the corpus.
  Whole-corpus orientation reads `CAPSULES.md` when it exists; without one, INDEX plus
  just-in-time notes.

## Model tiers — who does what work

**Implementation work is dispatched to an implementer agent at the task's tier — your own
hands do not do it.** That obligation is on you, right now, however this work reached you:
through `pdlc:sweep`, through a handoff document, or as a direct request from the operator.
If you are holding a spec, a task id, or a handoff and are about to edit the files it names,
the next action is a dispatch, not an edit. **The posture: thinking is Opus/Fable-tier,
execution is Sonnet/Haiku-tier.** You plan, gate, and judge at the top of the ladder; the
work of implementing a written spec runs at the cheapest tier that can hold it. An escalation
tier exists for tasks whose judgment calls the spec does not already settle — reaching for it
is an operator checkpoint, not an implementer's own call.

**There is no "this one is knowledge-shaped" exemption — it was considered and refused.**
Doctrine, prose and docs edits are dispatched like everything else: on 2026-07-30
`docs/design/sweep-cost-levers-runbook.md` dispatched TASK-86/87/88 — all pure prose edits to
a SKILL.md — to an opus implementer rather than inline, logging each one's token count. "Knowledge-shaped" is not a boundary: any lane
can be argued into it after the fact, by the party that did the work, which is precisely how
the 2026-09-10 Lane 4 miss (`docs/design/lane-4-dispatch-gap.md`) would be retroactively
legitimized. If inline is ever right it is an **operator checkpoint recorded before the
work** — structurally identical to a tier escalation, not a new category.

**Where the ladder lives: `.claude/model-tiers.json`.** That file — not this block — declares
the tiers, their model IDs, their scopes, and which one is the default. It is a plain tracked
file **outside every marker**: bumping a model ID or adding a tier is a one-line edit, no
drift, no `--force`, no re-plant. Model families rev on independent cadences and new ones
arrive unannounced, so the tier map is deliberately open — a tier this doctrine never
anticipated is a config key, not a code change.

```
.claude/model-tiers.json  →  pdlc/scripts/tiers.mjs  →  .claude/agents/*.md  →  harness
       (you edit)              (regenerates)              (generated — do not edit)
```

Regenerate after every config edit: `node <pdlc>/scripts/tiers.mjs --root .` (`--check` exits
nonzero when a definition is stale, which is what CI and a sweep's precondition gate run).

**Write the model ID in the form THIS host accepts.** There is no universal spelling. A
plain Claude Code install takes the bare API ID (`claude-sonnet-5`) or an alias (`sonnet`); a
host behind a routing proxy may require its own augmented form (e.g. `cc/claude-sonnet-5[1m]`),
and on such a host the bare ID and the alias are both **rejected**. Resolve your host's form
once — the `ANTHROPIC_DEFAULT_*_MODEL` env values are a strong hint, and a one-off dispatch
proves it — then write that form in the config. This is precisely why the ladder is host
config and not plugin doctrine: the right ID depends on where you are running.

**How a tier is pinned — two mechanisms, neither assumed.** The pin can reach the harness
through the agent definition's frontmatter (`.claude/agents/<tier>-implementer.md`,
`model: <id>`) or through the dispatch call's `model` parameter. **Both have been observed
failing, on different hosts:** on 2026-07-31 the dispatch-call parameter was silently ignored
and dispatches ran on the orchestrator's session model at ~2× the unit price
(`docs/design/board-cost-test-runbook.md`, TASK-74 row); on 2026-08-10 the reverse — the
frontmatter pin rejected an ID the dispatch parameter resolved fine. Prefer the frontmatter
pin, because it is durable across sessions where the parameter is per-call, and pass the
parameter too where it works. But **treat neither as proof.** The load-bearing rule is the
one below.

**Verify the served model; never infer it.** A green `--check` proves the file says Sonnet,
not that Sonnet ran. Confirm the model that actually served from the first dispatch's
transcript before launching siblings — a wrong pin caught after one agent is a rounding
error; caught after a lane of them, it is the whole lane's budget.

**Then record it on the board task, in this exact form — one line per dispatch:**

```
Dispatch: tier=<tier> pinned=<model-id> served=<model-id>
```

`served=` is the model the transcript shows, as a bare ID with no spaces; a placeholder
(`TBD`, `pending`) does not count, and neither does prose after the ID. This line is the only
residue that distinguishes a dispatched task from one implemented inline — the commits,
specs and ticks are identical — so a task's PR is **not merge-ready without it**, and
`spec-bridge`'s gate reports a claimed card that lacks one (opt in with
`"requireDispatchRecord": true` in `.spec-bridge.json`).

**Regenerating is not enough — the agent registry is read at session start.** A newly
generated definition is invisible to dispatch until the session restarts, and an edited one
keeps dispatching its *old* pin (observed 2026-08-10: a new tier reported "agent type not
found" while an existing tier dispatched with its pre-regeneration model). After a config
edit: regenerate, then **restart the session** before trusting any dispatch.

**Which one is authoritative.** This section is the **planted default** — posture and
mechanism, refreshed wholesale when you re-run `pdlc:bootstrap`. The agent definition's
`model:` is **authoritative at dispatch**: it is the model that actually runs. The config is
what you edit; the generated definition is what holds. Never hand-edit a generated definition
— the generator reports it as `drifted` and refuses to overwrite it without `--force`, so a
hand edit silently decouples the pin from the config until someone runs `--check`.

<!-- pdlc:peer:backlog BEGIN -->
## Backlog.md — the board (officially supported peer)

Backlog.md is this project's kanban; the board is the plan of record. Statuses flow
**To Do → In Progress → Done**.

- Start from `backlog task list --plain`; read a task with `backlog task view TASK-x --plain`.
- Record plans (`--plan`), progress (`--append-notes`), and tick acceptance criteria
  (`--check-ac <n>`) as they come true; finish with `--final-summary` and `-s Done`.
- **One task, one PR:** a top-level TASK gets one branch and one PR. Dotted-id subtasks
  (TASK-x.y) are internal breakdown — they ride the parent task's branch and merge in its
  PR, never their own.
- **Two-track landing:** board/bookkeeping commits (cards, status flips, notes, AC ticks)
  land direct on the default branch; deliverable work lands by PR. This is one-task-one-PR
  applied, not an exception to it — a PR exists only where it carries a stated reason for a
  human to approve, and a board card carries no such decision. Where main-push is
  unavailable (background jobs, protected `main`), the board track degrades to riding the
  next task branch or a wrap-up PR. **The claim flip is the exception: it is deliverable
  state.** "Direct to `main`" covers notes, AC ticks, labels, and new cards — never the
  status flip that claims a task, which belongs in the claim commit on the branch beside
  the spec dir and the link. Splitting it leaves the board and the spec dir describing
  different states in different checkouts, which is exactly what the bridge gate reports.
- **Never hand-edit** files under `backlog/` — always the `backlog` CLI, so metadata and
  relationships stay consistent.
<!-- pdlc:peer:backlog END -->

<!-- pdlc:peer:spec-kit BEGIN -->
## Spec Kit — specs drive the work (officially supported peer)

Features are specified with GitHub Spec Kit (`specify`) under `specs/NNN-<feature>/`
(spec.md, plan.md, tasks.md). The spec dir is the source of truth for its feature.

- Put a spec on the board with `spec-bridge:link`; after working a spec, run
  `spec-bridge:sync` to move the linked task, re-mirror phase criteria, and record progress.
- The bridge gate blocks a linked task's status from exceeding what the spec artifacts
  prove — produce the artifact, then sync.
- A spec's linked task is the deliverable: it lands as **one PR**. Spec phases and their
  mirrored criteria are internal breakdown, not PR boundaries.
<!-- pdlc:peer:spec-kit END -->
<!-- pdlc:grounding END -->

## GitHub writes go through the connector — never shell `git push` (D26, INF-37)

- **Push and open PRs only through the GitHub connector tools.** Every write to GitHub —
  pushing commits (including board-bookkeeping commits to `main`), creating branches,
  opening/updating PRs, PR replies, merges — uses the Paperclip GitHub connector tools
  (`push-files`, `create-or-update-file`, `delete-file`, `create-branch`,
  `create-pull-request`, `update-pull-request`, `merge-pull-request`).
- Local `git` is fine for status/diff/log, local commits and worktrees. **Never `git push`
  in any form** (incl. `--force`, `--set-upstream`); never `gh` CLI or raw API for writes
  (`gh pr create`, `gh pr merge`, …).
- If the connector lacks access or an operation, request it (`connections_search` /
  `connection_request`) and block — never fall back to the shell.
- Sub-agent dispatch briefs and runbooks must carry this rule; where they would say
  `git push` / `gh pr create|merge`, name the connector tools instead.
