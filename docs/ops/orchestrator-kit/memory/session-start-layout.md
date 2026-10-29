---
name: session-start-layout
description: "At each session start, open CLAUDE.md in the Files pane and ~/.claude/blank.html in the browser pane."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 678f2fb2-39fe-4e96-8813-292389fa42ea
  modified: 2026-10-18T19:03:17.037Z
---

At the start of every session in this project, in the first turn:

1. Open the Files pane: `show_pane` with pane "file" and path `CLAUDE.md`.
2. Open the browser pane: `preview_start` with url `/Users/evanstern/.claude/blank.html`.

Do this alongside the turn's first real tool call. Do not spend a message on it alone.

**Why:** The operator wants Files left of the chat and a browser right of it, equally spaced, without re-applying it by hand. The app has no saved-layout setting. The Files pane cannot open a bare folder, and the browser pane cannot open without a page, so CLAUDE.md and a blank page stand in (tested 2026-10-18).

**How to apply:** Pane placement and width cannot be set from a tool; the operator arranges those. If a pane call fails because the session is not open in a window, skip it silently. Related: [[browser-is-brave]].
