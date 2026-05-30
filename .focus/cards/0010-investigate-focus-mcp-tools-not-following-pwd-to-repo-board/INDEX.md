---
schema_version: 2
id: 10
uuid: 019df5e7-52d1-7ebc-963d-26db71580ccf
title: 'Investigate: focus MCP tools not following pwd to repo board'
type: card
status: archived
priority: p2
project: the-stacks
created: 2026-05-05
---

# Investigate: focus MCP tools not following pwd to repo board

## Symptom

When working from `~/projects/the-stacks/` (which has its own
`.focus/` board), the focus MCP tools (`focus_focus_edit_body`,
`focus_focus_new`) write to / read from the *original* board at
`~/agents/annie/.focus/` (now archived as
`~/agents/annie/.focus.migrated-to-repo/`), not the repo's board.

The focus *CLI* (`focus board`, `focus new`, `focus done`, etc.)
correctly resolves the nearest `.focus/` walking up from `pwd`.
The MCP tools appear to be pinned to a config-time path.

## Repro

1. `cd ~/projects/the-stacks` (repo with its own `.focus/`)
2. Call `focus_focus_new` MCP — card lands in
   `~/agents/annie/.focus/cards/`
3. Call `focus new "..."` CLI — card lands in
   `~/projects/the-stacks/.focus/cards/`

Same for `focus_focus_edit_body`: looks up the card by id in the
old board and reports "card not found" when the card lives in the
repo board.

## Likely cause

The focus MCP server is probably launched once at orchestrator
boot with a fixed working directory (annie's config dir) and
doesn't re-resolve the board location per call. Either:

- the MCP needs to accept a board-path argument per call, or
- the harness needs to relaunch the MCP when pwd changes, or
- the MCP needs to do its own pwd-walk like the CLI does

## Workaround

Use the `focus` CLI directly. Or write to `INDEX.md` files
directly via filesystem tools.

## Steps

1. Confirm the bug is in coda-lite's MCP wiring vs the focus
   project itself (read both repos)
2. File issue at the right repo
3. If trivial fix, propose patch

## Done when

- Bug filed at `evanstern/coda-lite` or `evanstern/focus`
  (whichever owns it)
- Workaround documented somewhere annie can find it (this card
  + a wiki page after)

## Notes

Surfaced 2026-05-05 during cards #4 and #8. p2 because workaround
is fine for now and Iris may already know about it.
