#!/usr/bin/env sh
# Idempotent: installs the praxisflux plugins into the LIVE Claude config dir.
# Paperclip runs Claude with a per-run CLAUDE_CONFIG_DIR, so image-time installs
# into ~/.claude may be invisible. Run this as part of provisioning (CTO ruling R4).
set -eu
: "${PRAXISFLUX_HOME:=/opt/praxisflux}"
claude plugin marketplace add "$PRAXISFLUX_HOME" || true
for p in pdlc spec-bridge grounding-wiki team-review; do
  claude plugin install "$p@praxisflux" || true
done
