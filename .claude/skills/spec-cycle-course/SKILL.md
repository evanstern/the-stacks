---
name: "spec-cycle-course"
description: "Produce the Principle VIII learning artifact that closes a spec cycle: a feature-scoped, self-contained interactive HTML course under docs/courses/<feature>/, authored in the-stacks skilled-developer register and seeded from the feature's spec artifacts + teaching-commented source. Use after /speckit-converge reports converged, or whenever asked to 'make the course', 'build the feature course', or 'do the Principle VIII artifact' for a spec. Wraps the global /codebase-to-course skill with this repo's conventions."
compatibility: "Requires spec-kit project structure (specs/<feature>/) and the global codebase-to-course skill."
metadata:
  author: "the-stacks"
  source: "constitution Principle VIII (The Work Must Teach)"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

`$ARGUMENTS` names the feature slug (e.g. `NNN-feature-name`). If empty, infer it from
the active spec under `specs/` (the most recently converged one) and confirm before proceeding.

## What this is

The constitution's **Principle VIII (The Work Must Teach)** requires every spec cycle to
close with a learning artifact: *"the work is not done when it runs, it is done when the
operator can understand it without reading it."* This skill produces that artifact — a
six(ish)-module interactive course committed to `docs/courses/<feature>/` and linked from
the feature's `evidence.md`.

This skill does NOT re-implement HTML authoring. It pins **the-stacks conventions** and then
delegates the heavy page-building to the global `codebase-to-course` skill. Think of it as
the recipe; `codebase-to-course` is the oven.

## Preconditions (check first)

- `/speckit-converge` has reported **converged** for this feature. A course over unbuilt
  work teaches fiction. If not converged, say so and stop.
- The **teaching-comment pass** exists on the feature's source (Principle VIII code register —
  file headers with spec/contract pointers, why-comments on doctrine/invariants/real bugs).
  The course quotes this source verbatim, so it must already teach. If missing, flag it —
  the comment pass is a prerequisite, not something to fake in the course.

## The workflow

### 1. Gather the seed corpus
Pull the feature's own artifacts — do not summarize from memory:
- `specs/<feature>/spec.md`, `plan.md`, `tasks.md`, `contracts/*`, and especially
  **`evidence.md`** (the live-validation run: real ids, real timings, the real bug ledger).
- The feature's **source files** with their teaching comments intact — these are the
  verbatim snippet source. Never paraphrase a snippet; copy it and cite `file:line`.

### 2. Set the register (course-wide AUDIENCE OVERRIDE)
The-stacks courses target a **skilled, time-poor developer** — NOT a non-technical operator.
This overrides `codebase-to-course`'s default audience. Encode this in every brief:
- No CS-fundamentals tooltips (no "what is a function"). DO tooltip **domain terms on first
  use**: `accept-then-async`, `seam`, `deterministic id`, `idempotent`, `pgvector`,
  `ON CONFLICT DO NOTHING`, and the like — one crisp sentence each, with the governing
  Principle/FR in parentheses.
- Crisp developer metaphors only — one strong, load-bearing metaphor per module is the bar.
  Earn every animation.

### 3. Write the briefs FIRST — one per module
This is the load-bearing step and the-stacks' signature. Before any HTML, author
`docs/courses/<feature>/briefs/NN-slug.md`, each a complete content plan for one module.
**Start from `templates/brief.md`** (beside this skill) — copy it per module and fill it in.
It fixes the required sections so you don't have to re-derive them:
- **Write-to target** (`modules/NN-slug.html`, one `<section class="module">`) and whether
  it's the centerpiece.
- **AUDIENCE OVERRIDE** repeated verbatim (the skilled-developer register + this module's
  domain-term tooltips).
- **Teaching Arc**: metaphor · opening hook · key insight · "why should I care?".
- **Canonical vocabulary** (the ordered states/events/steps, used identically everywhere).
- **Screens** (numbered beats).
- **Code Snippets** — verbatim, `file:line`-cited, marked *do not modify*.
- **Interactive Elements** — checkboxed: group-chat animation, data-flow animation,
  Code↔English translations, quiz (with answers), callouts, glossary tooltips.
- **Connections**: previous/next module, accent color, recurring actor names, and the real
  ids/timings from `evidence.md` to reuse.

Get the briefs right and the HTML is mechanical. A module arc that has worked well:
boot/flow → architecture map → the async centerpiece → queue/state → auth & typed errors →
bug ledger (the real bugs from live validation, taught as spot-the-bug). Adapt it to what
the feature actually delivered — the arc is a starting point, not a mold.

### 4. Invoke the global skill to render
Run **`/codebase-to-course`** seeded with the briefs + spec artifacts + source. Its job:
produce `modules/NN-slug.html`, `main.js`, `styles.css`, `_base.html`, `_footer.html` —
self-contained, scroll-navigated, animated, quizzed, Code↔English. The briefs ARE its
per-module spec; hold it to them (verbatim snippets, mandatory animations, the register).

### 5. Assemble
Provide a `build.sh` that concatenates the parts into the final page:
`cat _base.html modules/*.html _footer.html > index.html`. Run it. Open `index.html` to
confirm it's self-contained and renders offline (no build step, no server — a static file
the operator double-clicks).

### 6. Close the loop (mandatory — the cycle is incomplete without it)
- **Pass the course gate**: `node scripts/check-courses.mjs` must report the new course
  dir OK (it runs the praxis codebase-to-course gate: self-containment, chrome version
  stamp, quiz/translation-block structure). A failing course is not done — fix it before
  linking. CI runs the same gate from a pinned praxis checkout; only the pre-gate
  007/008/009 courses are baselined as warnings.
- **Link from evidence**: add the course under a "Feature course" entry in
  `specs/<feature>/evidence.md`, noting it's the skilled-developer register, seeded from the
  feature's spec artifacts via `/codebase-to-course`.
- **Commit** to the repo with a message that records the register, the seed, and the module
  list. Co-author the model that rendered it.
- A spec cycle without its linked, committed learning artifact is **not done** (constitution
  Development Workflow closure step) — and machine-checked: `check-spec-artifacts.mjs`
  fails CI when a fully-checked tasks.md lacks the course.

## Guardrails

- **Verbatim or nothing.** Every snippet is copied from the (already-teaching) source and
  cited. If a snippet needs a comment to teach, fix the *source* comment, then re-copy.
- **Real data only.** Ids, timings, distances, and the bug ledger come from `evidence.md`'s
  live run — never invented. If a value would appear on screen, it must be traceable to the
  real run, not fabricated for effect.
- **Self-contained.** Open-the-file-and-it-works. Keep external dependencies to a minimum
  (web fonts via `<link>` are acceptable); no bundler, no server, no data fetches.
- **Respect the repo constraints.** No proprietary game data, no hardcoded model ids in any
  quoted snippet (Principles I / VII) — if the source honors them, the course inherits it.
