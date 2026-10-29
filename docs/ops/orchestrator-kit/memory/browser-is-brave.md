---
name: browser-is-brave
description: "Screenshots and browser automation (Playwright etc.) use Brave, not Chrome."
metadata:
  node_type: memory
  type: feedback
  originSessionId: a48ac8bd-6925-4f5f-a483-92f341655764
  modified: 2026-09-30T01:35:17.590Z
---

Use Brave Browser (`/Applications/Brave Browser.app`) for screenshots and browser automation, never Chrome.

**Why:** Operator instruction, 2026-09-29, given during the TASK-0028 design rounds.

**How to apply:** Point Playwright at the Brave executable (`executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"` via `chromium.launch`), or run Brave headless: `--headless --screenshot=<out.png> --window-size=W,H <url>`. Pass the same instruction to any dispatched implementer that verifies UI.
