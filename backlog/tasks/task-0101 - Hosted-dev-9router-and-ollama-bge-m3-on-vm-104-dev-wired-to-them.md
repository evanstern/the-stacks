---
id: TASK-0101
title: 'Hosted dev: 9router and ollama bge-m3 on vm-104, dev wired to them'
status: To Do
assignee: []
created_date: '2026-10-26 14:12'
updated_date: '2026-10-26 14:16'
labels:
  - hosted-dev
  - ai
  - ops
dependencies: []
priority: high
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: hosted dev on vm-104 mirrors the local AI setup. A 9router instance serves the chat purposes, and an ollama container serves bge-m3 for embeddings on the CPU. dev's AI_PROVIDERS, AI_PURPOSES and AI_PRICES point at both.

Why: the operator stated the preferred setup on 2026-10-26: local 9router plus ollama bge-m3 on the Mac, and the same pair on vm-104 for hosted dev. A read-only check that day found the following:
- vm-104 runs no 9router: no process, no container, and nothing on port 20128.
- dev's .env (/home/stacks/dev/.env) has no AI_PROVIDERS or AI_PURPOSES, so hosted dev has no AI provider.
- vm-104 does run a CLIProxyAPI container (cli-proxy-api, eceasy/cli-proxy-api:latest) with an OpenAI-compatible API on port 8317, key required. The operator may have meant this one.
- vm-104 has no ollama binary, container or image. It has 8 cores, about 4 GB of free RAM beside the prod stack, 27 GB of free disk and no GPU. bge-m3 is an embedding model of about 570M parameters and runs on the CPU.
The embedding column is fixed at 1024 (decision-0002), and bge-m3 is native 1024. Keep bge-m3 on both hosts so retrieval matches. Another embedding model would mean TASK-0035 plus re-embedding every book.

Every command that changes vm-104 needs the operator's go on its exact text. Subscription logins for 9router are the operator's own. Secrets go only into dev's .env, set by the operator.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Hosted dev's app container reaches an ollama service with bge-m3 pulled, and an embed call returns a 1024-dimension vector.
- [ ] #2 The ollama service lives in the repo's dev deploy definition, so it survives a redeploy and the drift check.
- [ ] #3 Either 9router runs on vm-104 and serves the dm.* and answering models, or the card records the operator's decision to use CLIProxyAPI on port 8317 instead.
- [ ] #4 dev's AI_PROVIDERS, AI_PURPOSES and AI_PRICES name every purpose, and the server's boot log shows no unconfigured-purposes warning.
- [ ] #5 The hosted-dev wiki note and the ops runbook describe the AI setup.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-26, run on the operator's exact go: docker run -d --name stacks-ollama --restart unless-stopped --network stacks-dev_default -v stacks-ollama:/root/.ollama ollama/ollama:latest. The image resolved to digest sha256:dea72d1e22270fe095b68fdf756d2b489d615643c5a2eaebbc5f569181e322d8 (ollama 0.40.11). The container is up. Pinning that digest belongs in the deploy definition (AC #2). Next step: pull bge-m3.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
