#!/bin/bash
# codebase-to-course chrome v2 — inline translation engine (comments-on-top)
# Assembles the course from parts.
# Run from the course directory: bash build.sh
set -e

# Refresh chrome from the canonical plugin references when they're reachable:
# C2C_REFERENCES (explicit override) or CLAUDE_PLUGIN_ROOT (set while the
# plugin's skill is driving a session). Standalone runs — neither var set —
# build from the local copies unchanged. _base.html is per-course customized
# and build.sh is the running script, so neither is ever auto-refreshed.
REF="${C2C_REFERENCES:-${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/codebase-to-course/references}}"
if [ -n "$REF" ] && [ -f "$REF/main.js" ] && [ -f "$REF/styles.css" ]; then
  cp "$REF/styles.css" "$REF/main.js" "$REF/_footer.html" "$REF/validate.mjs" .
  echo "chrome refreshed from $REF"
fi

if command -v node >/dev/null 2>&1 && [ -f validate.mjs ]; then
  node validate.mjs --chrome-dir . modules/*.html
else
  echo "warn: node or validate.mjs missing — skipping translation-block validation" >&2
fi
cat _base.html modules/*.html _footer.html > index.html
echo "Built index.html — open it in your browser."
