# Feature Specification: Root-guard accepts non-ASCII board paths

**Feature Branch**: `task-0018-rootguard-nonascii`

**Created**: 2026-09-27

**Status**: Draft

**Input**: Board card TASK-0018 — "Fix root-guard false positive on non-ASCII staged paths".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Board-sync commits with non-ASCII titles go through (Priority: P1)

An operator or agent edits the board with the backlog CLI at the root checkout. A task,
decision, or milestone title contains an em-dash, an accented letter, or any other
non-ASCII character, so its file name does too. The board-sync commit must be allowed,
exactly as it is for an ASCII-named board file.

**Why this priority**: This is the defect. Board titles are free text, so ordinary use
reaches it, and today the only workaround is renaming the item to ASCII.

**Independent Test**: Stage a `backlog/` file whose name holds an em-dash at a root
checkout and ask the guard to judge `git commit`. It allows the commit.

**Acceptance Scenarios**:

1. **Given** only `backlog/milestones/m-0 - m0-—-skeleton.md` is staged at the root,
   **When** a plain `git commit -m …` is judged, **Then** it is allowed.
2. **Given** several staged `backlog/` files, some ASCII and some not, **When** the
   commit is judged, **Then** it is allowed.

---

### User Story 2 - Non-board paths stay blocked, whatever their name (Priority: P1)

The fix must not open a hole. A commit at the root that stages anything outside
`backlog/` is still refused, including when that path is non-ASCII, and including when
a non-ASCII name merely looks like it starts with `backlog/`.

**Why this priority**: The guard's whole value is refusing root commits. A fix that
widens the exception is worse than the defect.

**Independent Test**: Stage a non-ASCII file outside `backlog/` alongside a board file
and judge the commit. It is refused and the refusal names the outside path readably.

**Acceptance Scenarios**:

1. **Given** `docs/café.md` and a `backlog/` file are staged, **When** the commit is
   judged, **Then** it is refused with reason "staged path outside backlog/", and the
   message names `docs/café.md` as written, not as an escaped string.
2. **Given** a staged file named `backlog—x/a.md` (no slash after `backlog`), **When**
   the commit is judged, **Then** it is refused.
3. **Given** a staged file whose name contains a newline, **When** the commit is judged,
   **Then** the staged set is still read as the right list of paths, and the verdict
   follows from those paths.

---

### User Story 3 - The other two path checks are proven unaffected (Priority: P2)

The card asks for an audit of the explicit-pathspec branch and the pre-write check.
Both are audited here, and the result is recorded as tests, not as prose.

**Why this priority**: Closes the same class of bug everywhere it could live. It ships
no behavior change if the audit finds nothing.

**Independent Test**: Judge `git commit -- "backlog/é.md"` and write to a non-ASCII
path at the root. Each yields the same verdict as its ASCII twin.

**Acceptance Scenarios**:

1. **Given** an explicit pathspec `backlog/tâche.md`, **When** the commit is judged,
   **Then** it is allowed; `docs/tâche.md` is refused.
2. **Given** a write to a non-ASCII tracked path at the root, **When** the pre-write
   check judges it, **Then** it is blocked; the same write under `.worktrees/` is
   allowed.

### Edge Cases

- A staged path containing a double quote, a backslash, a tab, or a newline.
- A repository where the user's git config already sets `core.quotepath=false`.
- An empty staged set: still refused as "nothing staged".
- The git query fails: still refused as "staged set could not be read".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The guard MUST read the staged set in a form where every path appears
  exactly as stored, independent of the user's git quoting configuration.
- **FR-002**: The guard MUST allow a root board-sync commit when every staged path is
  under `backlog/`, whatever characters the path contains.
- **FR-003**: The guard MUST refuse a root commit when any staged path is outside
  `backlog/`, whatever characters that path contains.
- **FR-004**: A refusal MUST name the offending path as it is written on disk.
- **FR-005**: The explicit-pathspec check and the pre-write check MUST be audited for
  the same quoting assumption; any affected check MUST be fixed, and each MUST be
  covered by a non-ASCII test either way.
- **FR-006**: A regression test MUST cover a non-ASCII `backlog/` path in the allowed
  direction and a non-ASCII non-`backlog/` path in the blocked direction.
- **FR-007**: The guard MUST keep its existing failure posture: fail-open on internal
  errors, fail-closed within the board-sync exception.
- **FR-008**: The guard MUST keep zero third-party dependencies.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): Agents MUST be able to commit board changes at the
  root through the same backlog CLI path a human uses, with no rename workaround.

CR-002 through CR-005 do not apply: this feature creates no content entity, draws on no
library claims, touches no game mechanics, and ships no rulebook content.

### Key Entities

- **Staged set**: the list of paths a commit would record. The unit the guard judges.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A board-sync commit staging a non-ASCII `backlog/` file succeeds at the
  real root checkout on the first attempt, with no rename.
- **SC-002**: 100% of the non-board scenarios above are refused, including all
  non-ASCII variants.
- **SC-003**: Every existing guard verdict for ASCII paths is unchanged.
- **SC-004**: The fix is demonstrated against a real commit at the root checkout, not
  only in tests.

## Assumptions

- The guard's test lives beside it as a stdlib test file, run by
  `node --test .claude/hooks/`, because the project linter excludes `.claude/`.
- The audit result for User Story 3 is expected to be "unaffected": the pathspec check
  compares the command's own tokens, and the pre-write check reads only an exit code.
  The tests confirm this rather than the prose.
- The guard is planted from the pdlc plugin. Upstreaming the fix to pdlc is out of scope
  here; the plan records it as a follow-up.
