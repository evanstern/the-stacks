---
name: vm-104-command-consent
description: "vm-104 changes need the operator's go on the exact named command; a generic \"go ahead\" is blocked by the permission classifier."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 739445a6-bb7e-46bd-ad2c-54627ef224d5
  modified: 2026-09-29T18:40:06.748Z
---

Every command that changes vm-104 (shared tailscale container, dev database writes, deploys, cleanup) must be announced with the exact command text. The operator's reply must be an explicit go for that command. A generic "go ahead" after unrelated work was blocked by the auto-mode classifier (2026-09-29, TASK-0021 T015). The same happened for an unannounced sentinel-row insert.

**Why:** vm-104 is shared infrastructure (Traefik, the tailscale container, other compose projects). The operator ruled that the orchestrator runs these commands only after a per-command go.

**How to apply:** Name one command per question and ask for a go that references it. Also offer the `! ssh ...` form so the operator can run it personally. The `stacks` user has no GitHub credentials. Ship code there as a `git bundle` over ssh, not a clone. See [[host-model-id-form]] for other host quirks.
