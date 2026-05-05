---
schema_version: 2
id: 13
uuid: 019df60d-7b63-7181-80d8-e8fa4208f87d
title: Publish stacks.db as GitHub release artifact + the-stacks fetch-corpus subcommand
type: card
status: backlog
priority: p1
project: the-stacks
created: 2026-05-05
epic: 1
---

# Publish stacks.db as release artifact + fetch-corpus subcommand

A reader cloning the repo shouldn't have to run #5 + #11 themselves
to get to a working demo. They should be able to:

```
go install github.com/evanstern/the-stacks/cmd/the-stacks@latest
the-stacks fetch-corpus
the-stacks ask "..."
```

`fetch-corpus` downloads the latest pre-built `stacks.db` from a
GitHub Release on the repo. ~300 MB for the top-10 corpus, fits
comfortably under GH Release's 2 GB per-file limit.

**Blocked by:** #5 (pull) and #11 (embed) — need a real `stacks.db`
to publish before this means anything.

## Shape

### `the-stacks fetch-corpus`

- Hits GitHub Releases API for `evanstern/the-stacks`
- Finds the latest release tagged `corpus-vN`
- Downloads `stacks.db.gz` (gzipped to ~150 MB)
- Verifies sha256 against the release's `stacks.db.sha256` asset
- Decompresses to `./stacks.db` (or `--out <path>`)
- Reports the corpus version, market count, trade count, build date

### Release publishing flow

- We (Annie + Evan) refresh the corpus periodically:
  1. Run `the-stacks pull --markets-limit 10 --db ./corpus/raw.db`
     (locally or on free-tier e2-micro). `raw.db` is large
     (~1-2 GB) and **not shipped** — it's the source-of-truth
     ledger we compute against.
  2. Run `the-stacks embed --raw ./corpus/raw.db --db ./stacks.db`
     to produce the small chunks+vectors+denormalized-context DB.
  3. `gzip -k stacks.db && sha256sum stacks.db > stacks.db.sha256`
  4. `gh release create corpus-vN stacks.db.gz stacks.db.sha256
     --notes "..."`
- Document this flow as `docs/publishing-corpus.md` (or a
  Makefile target)
- `raw.db` stays on the refresh host. If we need to re-embed
  with a different chunk strategy, we already have it locally.

## Why this matters

Without this, the README is technically runnable but practically
gatekept. A recruiter glances at "first run pull + embed (~30 min,
~10 GB transient disk)" and bounces. With `fetch-corpus`, demo to
working query is ~30 seconds.

Also relevant: the published artifact is the *demo's anchor*. The
asciinema recording shows queries against the published `stacks.db`,
so anyone can reproduce the recorded demo exactly.

## Done when

- `the-stacks fetch-corpus` subcommand works end-to-end against a
  real release
- One real release exists with a working `stacks.db.gz` for top-10
  corpus
- README's quickstart leads with `fetch-corpus`, not pull+embed
- Publishing flow documented (`docs/publishing-corpus.md` or
  Makefile)
- sha256 verification is enforced (won't load a tampered db)

## Open questions

- **Release tag scheme.** `corpus-v1`, `corpus-v2`...? Or
  date-stamped (`corpus-2026-05-05`)? Probably semver with a
  changelog noting market list + capture date.
- **Default behavior if release missing.** Friendly error pointing
  at `the-stacks pull` + `the-stacks embed` as the manual path.

## Notes

Filed 2026-05-05 from corpus sizing exercise. The local-first
ethos doesn't conflict with shipping a precomputed artifact —
local-first means *runnable locally*, not *every byte computed
locally*. fetch-corpus IS the local-first runtime; pull+embed
is a refresh tool.
