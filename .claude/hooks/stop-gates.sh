#!/usr/bin/env bash
# stop-gates.sh — thin shim for the repo's Claude Code Stop hook; all logic
# lives in scripts/stop-gates.mjs (stdin JSON, stop_hook_active, exit 0 allow /
# 2 block).
#
# Stop hooks run in a minimal, non-login shell whose PATH may not include node
# (nvm/volta/Homebrew installs live in the user's shell rc, which isn't sourced
# here). Resolve node the way the user's own shell would rather than hardcoding
# a path; if it's genuinely unavailable, no-op instead of failing — this gate
# must never block Stop over a missing runtime. (Pattern copied from the
# spec-bridge plugin's gate.sh.)
node_bin="$(command -v node 2>/dev/null)"
if [ -z "$node_bin" ]; then
  node_bin="$(${SHELL:-/bin/sh} -lc 'command -v node' 2>/dev/null)"
fi
if [ -z "$node_bin" ]; then
  exit 0
fi
exec "$node_bin" "${CLAUDE_PROJECT_DIR:-.}/scripts/stop-gates.mjs"
