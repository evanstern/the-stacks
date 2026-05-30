---
schema_version: 2
id: 16
uuid: 019dfa24-395c-7aa5-91c1-8e0b75d5a33b
title: 'GitHub Action: scheduled corpus refresh (pull -> embed -> upload -> release)'
type: card
status: archived
priority: p2
project: the-stacks
created: 2026-05-05
epic: 1
---

# GitHub Action: scheduled corpus refresh

Automate the full refresh flow as a GitHub Actions workflow that
runs monthly (or on manual trigger). Removes us from the loop —
the corpus stays fresh without anyone running commands.

**Blocked by:** #5 (pull), #11 (embed), #13 (release publish),
#15 (GCS bucket).

## Workflow shape

`.github/workflows/refresh-corpus.yml`:

```yaml
on:
  schedule:
    - cron: '0 4 1 * *'    # monthly, 04:00 UTC on the 1st
  workflow_dispatch:        # manual trigger

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup-go (1.25)
      - install ollama, pull nomic-embed-text
      - build the-stacks
      - the-stacks pull --markets-limit 10 --db /tmp/raw.db
      - upload raw.db to gs://the-stacks-corpus/raw-vN.db
      - the-stacks embed --raw /tmp/raw.db --db /tmp/stacks.db
      - gzip stacks.db, sha256
      - gh release create corpus-vN with the artifacts
      - upload step summary with stats (markets, trades, embed time)
```

Resource shape (free GH Actions runner): 4 vCPU, 16 GB RAM, 14 GB
disk. Top-10 fits comfortably (raw.db ~6.5 GB, stacks.db ~300 MB,
plenty of headroom).

## Auth

- Push to GH releases: built-in `GITHUB_TOKEN`
- Push to GCS bucket: GH Actions secret holding the
  service-account JSON (#15 sets this up)

## Done when

- Workflow runs cleanly on `workflow_dispatch`
- Workflow produces a real `corpus-vN` release with valid
  `stacks.db.gz`
- raw.db uploads to GCS bucket with sha256 sidecar
- Step summary reports market/trade counts + embed time
- Schedule is enabled (monthly trigger)
- README links to "Latest corpus refresh: <link to release>"

## Open questions

- **Ollama install on GH runner** — there's an action for this
  (`ai-action/setup-ollama` or similar). Pin a specific version
  for reproducibility.
- **Embed time on the runner CPU** — measured 15 min for top-10
  on local CPU. Should be similar on GH's 4-core runners. Within
  the 6-hour job timeout easily.
- **Failure handling** — if pull fails partway through, raw.db is
  partial. Don't upload partials. Use a sentinel file or
  manifest for "pull complete."

## Notes

Filed 2026-05-05. Removes the "Annie + Evan refresh by hand"
language from #13. Self-documenting (the workflow file IS the
publishing flow). Free under GH Actions free tier (2000
min/month for private repos; unlimited for public, which we are).
