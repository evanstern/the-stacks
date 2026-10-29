---
name: desktop-session-tier-dispatch
description: Tier dispatch failed in desktop sessions while cc/ router IDs were set; fixed 2026-10-18. A new session is required after tier or settings changes.
metadata:
  node_type: memory
  type: project
  originSessionId: ef02d669-8e87-4d11-a616-d2f9f14c21d7
  modified: 2026-10-18T18:55:13.856Z
---

2026-10-18: a desktop-app session called api.anthropic.com but inherited the router-only
`cc/...` model defaults from `~/.claude/settings.json`. sonnet-implementer and `model: "sonnet"`
both failed with model_not_found. Fix: the router settings were removed and tiers repinned to
bare IDs (see [[host-model-id-form]]).

**Why:** settings env and the agent registry load at session start, so a running session keeps
the old values after the fix.

**How to apply:** after editing `~/.claude/settings.json` or `.claude/model-tiers.json`, start a
new session before dispatching. If a dispatch fails with model_not_found, check
`echo $ANTHROPIC_BASE_URL` and the `ANTHROPIC_DEFAULT_*_MODEL` env first.
