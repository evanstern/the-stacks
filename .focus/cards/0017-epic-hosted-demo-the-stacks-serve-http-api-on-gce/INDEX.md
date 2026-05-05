---
schema_version: 2
id: 17
uuid: 019dfa24-396f-72c5-bae0-eae781bf47fa
title: 'EPIC: Hosted demo (the-stacks serve HTTP API on GCE)'
type: epic
status: backlog
priority: p2
project: the-stacks
created: 2026-05-05
---

# EPIC: Hosted demo (the-stacks serve HTTP API on GCE)

The portfolio-facing live demo. A recruiter clicks a link and
hits a real running instance of The Stacks, no install. Distinct
from M3 (MCP plugin) — different deployment surface, same query
engine underneath.

**This is its own epic, not part of M1/M2/M3.** Can run parallel
to M2 / M3 once M1 lands.

## Why separate from M3

MCP is intrinsically a local-binary protocol — JSON-RPC over
stdio, designed for an agent to spawn the server as a child
process. The MCP plugin needs to run on the agent's machine.
The hosted demo is HTTP-shaped and runs in the cloud. They
share the underlying query engine but expose it differently.

Both deployments use the same `stacks.db` (same Ollama embeddings,
no Vertex split per Evan's call 2026-05-05).

## Architecture

```
        Browser
           |
        HTTPS
           |
    +------v------+
    |   GCE VM    |
    |  (e2-medium)|
    | the-stacks  |
    | serve +     |
    | ollama      |
    | + stacks.db |
    +-------------+
           |
       (cron)
           |
    +------v------+
    | GCS bucket  |
    | raw.db      |
    +-------------+
```

`the-stacks serve` is a new subcommand exposing:
- `GET /` — minimal HTML form for queries
- `GET /api/ask?q=...&mode=rag|wiki|hybrid` — JSON response
- `GET /api/markets` — list available markets in the corpus
- `GET /api/health` — db loaded, Ollama up

The VM polls the latest GH release on a cron, downloads new
`stacks.db` when corpus refreshes, atomic-swaps it.

## Sub-cards (to file as M1 lands and we get closer)

- **the-stacks serve subcommand** — HTTP server with the query
  endpoints
- **Provision GCE VM** — terraform or documented gcloud recipe
  for an e2-medium with persistent disk + Ollama
- **systemd unit + auto-update from releases** — keep it running,
  pull new corpus monthly
- **Static HTML/JS frontend** — minimal, no framework. Form
  posts a query, response renders.
- **Domain + HTTPS** — point a subdomain at the VM
  (the-stacks.evanstern.dev?), Let's Encrypt for cert
- **README "Try it live →" link** — once it's stable

## Cost

- e2-medium VM: ~$25/mo
- Persistent disk (10 GB): ~$0.40/mo
- Egress: trivial for personal-volume queries
- Domain: existing
- **All-in: ~$25-30/mo**

## Done when (epic-level)

- A recruiter can hit a public URL and run a query against the
  current corpus
- README has a working "Try it live" link
- The hosted demo stays fresh automatically when the corpus
  refreshes (#16)
- Up-time and basic monitoring are reasonable (not 99.9%
  enterprise-grade, but not "down for a week without me
  noticing" either)

## Open questions

- **Cloud Run vs GCE.** Cloud Run scales to zero (~$0/mo idle)
  but cold starts hurt and Ollama-in-Cloud-Run is fiddly.
  Decided GCE for stability + Ollama-friendly. Revisit if cost
  becomes a concern.
- **Whether to use a frontend at all.** A `curl`-able JSON API
  with a README screenshot might be enough for portfolio
  purposes. Decide when we get there.

## Notes

Filed 2026-05-05. Surfaced from a hosting discussion that
revealed Evan needs to demo this to people without local install,
and that the dev VM doesn't have GPU resources for embed.

Important: this epic does NOT replace M3 (the MCP plugin). They
are siblings. The MCP plugin runs locally inside an agent;
this epic is the public-facing HTTP demo.
