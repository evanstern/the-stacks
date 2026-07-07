---
name: "spec-cycle"
description: "Run a full spec cycle end-to-end — specify → clarify → plan → tasks → worktree pivot → implement → analyze/converge → course — pausing at operator review gates between steps. The operator reviews and re-orients; the skill drives. Use when asked to 'run a spec cycle', 'do the next spec', or given a feature description to take from grounding to converged. Orchestrates the speckit-* skills and /spec-cycle-course; it does not replace them."
compatibility: "Requires spec-kit project structure, the speckit-* skills, the spec-cycle-course skill, and the bare+worktrees git layout."
metadata:
  author: "the-stacks"
  source: "operator request 2026-07-07 (008 cycle retrospective): automate the cycle, review between steps"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

`$ARGUMENTS` is either a **feature description** (starts a new cycle) or a **feature
slug/number** like `008` (resumes an in-flight cycle). Empty: look at
`.specify/feature.json` and the artifact ladder (below) to propose what's next, and
confirm before doing anything.

## What this is

One command that drives an entire spec cycle through this repo's pinned workflow,
stopping at **review gates** where the operator approves, re-orients, or pauses. The
operator's job is judgment; this skill's job is everything between the judgments.

It composes existing machinery — the `speckit-*` skills (whose git hooks still run),
the constitution (v2.1.0, D1–D14 fixed), and `/spec-cycle-course` — and adds only:
ordering, gates, stage detection, and the worktree pivot. Never bypass a step's own
skill to "save time"; the skills carry the repo's conventions.

## The pipeline

| # | Step | Mechanism | Artifact | Then |
|---|---|---|---|---|
| 1 | Specify | `/speckit-specify` | spec.md + checklist | **GATE** |
| 2 | Clarify | `/speckit-clarify` — *only if* the spec left genuine ambiguities or the operator asks | clarifications in spec.md | GATE (if run) |
| 3 | Plan | `/speckit-plan` | plan.md, research.md, data-model.md, contracts/, quickstart.md | **GATE** |
| 4 | Tasks | `/speckit-tasks` | tasks.md | **GATE** |
| 5 | Worktree pivot | this skill (below) | feature worktree + isolated env | no gate — mechanical |
| 6 | Implement | `/speckit-implement`, phase by phase | code + green `pnpm verify` | **GATE at each story checkpoint** |
| 7 | Verify convergence | `/speckit-analyze` then `/speckit-converge` | analysis + converged report + evidence.md | **GATE** |
| 8 | Course | `/spec-cycle-course` (briefs-first) | docs/courses/<feature>/ linked from evidence | **GATE** |
| 9 | Merge ritual | operator's call | merge to main, worktree teardown | done |

## Gate protocol

At every gate:

1. Present a **compact digest**, visual-first (Principle VIII): what was produced, the
   3–7 decisions that matter, anything flagged or deferred, and what the next step will
   do. Tables over prose. Never dump artifacts — link them.
2. Ask via a structured question with exactly these options:
   - **Approve & continue** — proceed to the next step immediately.
   - **Re-orient** — operator describes changes; apply them to the just-produced
     artifact (re-running validation/checklists), commit, and re-present the gate.
   - **Pause here** — stop cleanly; state exactly how to resume (`/spec-cycle <slug>`).
3. Clarification questions that a step itself raises (e.g. specify's NEEDS
   CLARIFICATION markers) are asked **inside** that step as usual — gates are for
   reviewing outputs, not a replacement for the steps' own questions.

Never proceed past a gate without an explicit approval. Never re-litigate a decision
the operator made at an earlier gate unless they raise it.

## Stage detection (resume)

Resume by reading the artifact ladder in `specs/<feature>/`, newest missing rung wins:

```text
spec.md → plan.md → tasks.md → worktree exists? → tasks.md checkboxes done?
→ evidence.md converged? → docs/courses/<feature>/ linked?
```

Cross-check `git log` and `.specify/feature.json`. State the detected stage and get
confirmation at a gate before continuing — detection can be wrong; the operator isn't.

## The worktree pivot (step 5)

The constitution's operating model: `main/` is the deploy-oriented worktree;
development happens in sibling worktrees. The specify hook necessarily created the
feature branch in `main/` (docs-only work rides there through step 4). After the tasks
gate:

```bash
git switch main                                   # main/ back to main
git worktree add ../<branch> <branch>             # sibling checkout
cp main/.env ../<branch>/.env                     # then apply overrides:
#   COMPOSE_PROJECT_NAME=the-stacks-<NNN>
#   V3_WEB_PORT/V3_API_PORT/V3_ML_PORT/V3_POSTGRES_PORT: unique block (e.g. +NNN)
pnpm install --dir ../<branch>                    # node_modules are per-worktree
```

All subsequent work uses absolute paths under the feature worktree. Teardown at merge
(step 9) must remove the worktree's containers, networks, **and volumes** before
`git worktree remove` — zero residue is an acceptance criterion (doc 07). If a
worktree-tooling spec has landed by the time you read this, prefer its commands over
the manual block above.

## Implement-phase gating (step 6)

- Drive `/speckit-implement` through tasks.md **phase by phase**, in order.
- TDD is constitutional: failing test first, smallest pass, refactor green.
- Between phases at a **story checkpoint** (tasks.md marks them): run `pnpm verify`
  (plus DB-gated suites when the phase touched the schema/pipeline), commit, then GATE
  with a digest of what the story now demonstrably does — quote the story's
  independent-test criterion and how it was met.
- On a failure you cannot resolve within the phase's scope: stop at an early gate with
  the failure verbatim — never mark a checkpoint green on partial evidence
  (constitution: claims of completion need fresh verification).

## Guardrails

- The constitution supersedes this skill. D1–D14 stay fixed; reopening one is an ADR,
  surfaced at a gate, never silently done.
- Each step's own hooks (git commit, agent-context) still run — don't duplicate or
  suppress them.
- Commit cadence: the steps' hooks commit artifacts; during implement, commit per task
  or logical group with teaching-register messages.
- Scope discipline: re-orientation at a gate edits the current cycle's artifacts. New
  scope goes to doc 08 / a future spec, and say so.
- The cycle is incomplete without the Principle VIII course (step 8) — do not offer
  step 9 before it exists, is committed, and is linked from evidence.md.
