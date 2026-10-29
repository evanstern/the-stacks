---
name: host-model-id-form
description: "This host uses built-in Claude model IDs (bare API IDs); the 9router cc/...[1m] forms were removed 2026-10-18."
metadata:
  node_type: memory
  type: user
  originSessionId: ef02d669-8e87-4d11-a616-d2f9f14c21d7
  modified: 2026-10-18T18:55:09.955Z
---

On 2026-10-18 the operator removed the 9router settings from `~/.claude/settings.json`
(`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, and the `ANTHROPIC_DEFAULT_*_MODEL` cc/ forms).
Claude Code now uses the built-in Anthropic models directly. `.claude/model-tiers.json` pins bare
API IDs: haiku `claude-haiku-5-5`, sonnet `claude-sonnet-5-5`, opus `claude-opus-5-5`
(fallback `claude-fable-5-1`). Backup of the old settings: none kept in the repo.

**Why:** desktop-app sessions bypassed the router but inherited the router-only cc/ IDs, so
every tier dispatch failed with model_not_found. See [[desktop-session-tier-dispatch]].

**How to apply:** write bare API IDs in tier config and agent `model:`. The app's own
answering provider (AI_PROVIDERS in the stack .env) still uses 9router; that is app config,
separate from Claude Code.
