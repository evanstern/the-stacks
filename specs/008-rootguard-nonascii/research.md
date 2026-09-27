# Research: Root-guard accepts non-ASCII board paths

## R1 — How to read the staged set unambiguously

- **Decision**: `git diff --cached --name-only -z`, split on `\0`, drop the trailing
  empty element.
- **Rationale**: With `-z`, git emits paths verbatim and NUL-terminated. It ignores
  `core.quotepath`, and it also handles paths containing newlines, tabs, quotes, or
  backslashes, which `-c core.quotepath=false` alone does not (git still C-quotes
  paths holding `"`, `\`, or control characters with quotepath off).
- **Alternatives considered**:
  - `-c core.quotepath=false`: fixes non-ASCII only. Rejected: leaves newline and quote
    paths ambiguous, and a newline path would be split into two bogus entries.
  - Unquote git's C-style output in JS: more code for the same result. Rejected.

## R2 — Is the explicit-pathspec branch affected?

- **Decision**: not affected. No code change; covered by tests.
- **Rationale**: `boardPathspecOk` judges tokens taken from the command line via
  `shell-scan`, never from git output. The shell has already removed quoting, so a
  non-ASCII token reaches it verbatim. Absolute tokens resolve through `realpath`,
  which returns filesystem bytes as UTF-8 strings.

## R3 — Is the pre-write check affected?

- **Decision**: not affected. No code change; covered by tests.
- **Rationale**: pre-write compares `realpath` results as strings and consumes only
  the exit code of `git check-ignore -q`, never its stdout. No quoted git output is
  parsed anywhere on that path.

## R4 — How to test without the stdin contract

- **Decision**: unit tests call the exported `classifyBoardSyncCommit` against a
  throwaway repository built with `git init` in `os.tmpdir()`. One end-to-end test
  spawns the hook with a JSON payload on stdin to cover the pre-write path.
- **Rationale**: the hook already exports `classifyBoardSyncCommit` and
  `boardPathspecOk` "for unit testing". A real temp repository exercises the real git
  output, which is the thing that was wrong.
