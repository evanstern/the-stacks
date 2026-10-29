---
name: ui-no-modals
description: Operator UI rule — no modals; use slide-in/out panels or autocomplete dropdowns instead.
metadata:
  node_type: memory
  type: feedback
  originSessionId: a48ac8bd-6925-4f5f-a483-92f341655764
  modified: 2026-09-30T02:28:39.845Z
---

Never design or build modal dialogs for the-stacks UI. Use slide-in/out panels, inline expansion, or autocomplete dropdowns with good customization instead. Confirmations (e.g. delete) go inline or in a panel.

**Why:** Operator ruling 2026-09-29 (TASK-0028 design rounds): modals work badly on mobile and are painful to design UX around.

**How to apply:** Brief every UI mock or implementation dispatch with this rule; check specs and mocks for `<dialog>`/`showModal` before handing them over. Recorded in the TASK-0028 decision record.
