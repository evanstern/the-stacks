#!/usr/bin/env bash
# Interim, no-root, idempotent bootstrap of agent tooling into $HOME/.local (INF-30).
# Installs backlog.md, uv, specify (spec-kit). Docker is NOT installed here (needs a daemon;
# see docs/ops/agent-tooling.md). Permanent fix: deploy/runner/Dockerfile.
# Usage: scripts/agent-bootstrap.sh ; then: export PATH="$HOME/.local/bin:$PATH"
set -euo pipefail

BACKLOG_VERSION="${BACKLOG_VERSION:-1.57.4}"
UV_VERSION="${UV_VERSION:-0.13.10}"
SPEC_KIT_TAG="${SPEC_KIT_TAG:-v0.12.5}"   # keep in step with deploy/runner/Dockerfile
PREFIX="$HOME/.local"
export PATH="$PREFIX/bin:$PATH"
mkdir -p "$PREFIX/bin"

have_version() { command -v "$1" >/dev/null 2>&1 && "$1" --version 2>/dev/null | grep -q "$2"; }

if have_version backlog "$BACKLOG_VERSION"; then echo "backlog $BACKLOG_VERSION: present"
else npm install -g --prefix "$PREFIX" "backlog.md@${BACKLOG_VERSION}"; fi

if have_version uv "$UV_VERSION"; then echo "uv $UV_VERSION: present"
else curl -LsSf "https://astral.sh/uv/${UV_VERSION}/install.sh" | env UV_UNMANAGED_INSTALL="$PREFIX/bin" sh; fi

if command -v specify >/dev/null 2>&1 && uv tool list 2>/dev/null | grep -q "specify-cli.*${SPEC_KIT_TAG#v}"; then
  echo "specify $SPEC_KIT_TAG: present"
else
  UV_TOOL_BIN_DIR="$PREFIX/bin" uv tool install --force specify-cli --from "git+https://github.com/github/spec-kit.git@${SPEC_KIT_TAG}"
fi

echo "--- verify"
backlog --version
uv --version
specify --help >/dev/null && echo "specify ok"
echo "--- add to PATH:"
echo "export PATH=\"$PREFIX/bin:\$PATH\""
command -v docker >/dev/null 2>&1 || echo "NOTE: docker not available (needs daemon access; see docs/ops/agent-tooling.md)"
