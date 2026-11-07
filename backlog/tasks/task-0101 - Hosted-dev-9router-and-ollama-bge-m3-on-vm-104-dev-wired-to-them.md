---
id: TASK-0101
title: 'Hosted dev: 9router and ollama bge-m3 on vm-104, dev wired to them'
status: To Do
assignee: []
created_date: '2026-10-26 14:12'
updated_date: '2026-11-07 05:17'
labels:
  - hosted-dev
  - ai
  - ops
  - 'ws:platform'
milestone: m-10
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
- [x] #4 dev's AI_PROVIDERS, AI_PURPOSES and AI_PRICES name every purpose, and the server's boot log shows no unconfigured-purposes warning.
- [ ] #5 The hosted-dev wiki note and the ops runbook describe the AI setup.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-26, run on the operator's exact go: docker run -d --name stacks-ollama --restart unless-stopped --network stacks-dev_default -v stacks-ollama:/root/.ollama ollama/ollama:latest. The image resolved to digest sha256:dea72d1e22270fe095b68fdf756d2b489d615643c5a2eaebbc5f569181e322d8 (ollama 0.40.11). The container is up. Pinning that digest belongs in the deploy definition (AC #2). Next step: pull bge-m3.

2026-10-26, run on the operator's exact go: docker exec stacks-ollama ollama pull bge-m3. Result: bge-m3:latest (id 790764642607, 1.2 GB).
Read-only check: from inside stacks-dev-app-1, a POST to http://stacks-ollama:11434/v1/embeddings with model bge-m3 returns a 1024-dimension vector. That proves the reachability half of AC #1; dev's AI_PURPOSES still need the embedding entry. stacks-ollama uses about 1.37 GiB of memory with the model loaded.
Still open: the deploy definition with a pinned digest, 9router or CLIProxyAPI for chat, dev's .env AI settings, and the docs.

Finding 2026-10-26, from the operator's memory plus infinitynode.media and Open Brain: the realm's 9router is NOT on vm-104. It runs on the infinitynode misc VM (192.168.1.103, VM 103), from infinitynode.media TASK-54 (specs/019-9router-gateway) and TASK-55 (specs/020-tailnet-9router; tailnet sidecar). Image ghcr.io/decolua/9router:0.5.59, REQUIRE_API_KEY=true. Wiki: infinitynode.media docs/wiki/9router-gateway.md.
Read-only checks from vm-104:
- http://9router.local.infinity-node.win/v1/models (LAN, via Traefik) returns 401 'API key required' both from the host and from inside stacks-dev-app-1. It is reachable, and a key is needed.
- https://9router.<tailnet>.ts.net does not resolve from vm-104 or the dev container. The 9router wiki says the ts.net name resolves only inside the sidecar's namespace.
- 192.168.1.103:20128 gets no response; the port is not published.
Plan:
(1) The operator mints a 9router API key in the realm dashboard and adds NINEROUTER_API_KEY to /home/stacks/dev/.env themselves.
(2) The orchestrator lists the realm's models with that key, read-only, without printing the key.
(3) On the operator's exact go, append AI_PROVIDERS (claude at the LAN URL; ollama at http://stacks-ollama:11434/v1), AI_PURPOSES and AI_PRICES.
(4) On the operator's go, recreate the dev app and confirm the boot log shows no unconfigured purposes.
Caveat: the LAN path is plain HTTP, so the key crosses the LAN unencrypted. Decide whether that is acceptable or whether to add a vm-104 tailnet path. The 'Option: CLIProxyAPI on :8317' alternative is now moot unless the operator prefers it.

2026-10-26, run on the operator's go:
(1) The non-secret AI block was appended to /home/stacks/dev/.env. It sets AI_PROVIDERS (claude at http://9router.local.infinity-node.win/v1 with apiKeyEnv NINEROUTER_API_KEY; ollama at http://stacks-ollama:11434/v1), plus AI_PURPOSES (10 purposes, the same mapping as local, maxTokens raised) and AI_PRICES. The file keeps mode 600.
(2) Ran gh run rerun 40339203227 (Deploy dev), which succeeded and recreated stacks-dev-app-1 at 181fda16.
Verified from inside stacks-dev-app-1: 9router lists 4 models with the key, and the ollama embedding returns 1024 dims. The boot log shows only 'Server listening on port 3000', with no unconfigured-purposes warning. AC #4 is met.
Still open: AC #2 (move stacks-ollama into the repo's deploy definition, pinned by digest) and AC #3 (record the decision: realm 9router on vm-103 over LAN HTTP, not CLIProxyAPI; the HTTP-on-LAN caveat stands). AC #5 is the docs.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
