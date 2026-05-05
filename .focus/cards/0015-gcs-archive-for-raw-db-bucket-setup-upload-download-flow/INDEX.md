---
schema_version: 2
id: 15
uuid: 019dfa24-3949-74f8-b56d-2ba0a7c4bcc2
title: 'GCS archive for raw.db: bucket setup + upload/download flow'
type: card
status: backlog
priority: p2
project: the-stacks
created: 2026-05-05
epic: 1
---

# GCS archive for raw.db: bucket setup + upload/download flow

`raw.db` is the source-of-truth ledger but doesn't fit on Evan's
dev VM and shouldn't have to. It needs a cold-archive home that
isn't either of our local machines.

**Decision (2026-05-05):** GCS bucket as dumb file store. sqlite
runs on local disk (refresh host or ephemeral VM); raw.db gets
uploaded after pull, downloaded on demand for re-embed
experiments.

**Blocked by:** #5 (need pull to actually produce a raw.db before
this is useful). Not a hard blocker — we can set up the bucket in
parallel.

## Setup

- Create GCS bucket: `gs://the-stacks-corpus` (or similar).
  Standard storage class. Single region (us-central1 fine).
- Object lifecycle: keep last 3 versions of raw.db; auto-delete
  older versions after 90 days.
- IAM: Evan has full access. A service-account key for
  GitHub Actions (scoped: object create + object read on this
  bucket only) for #16's automated refresh.

## Flow

```
# Refresh (rare):
the-stacks pull --markets-limit 10 --db /tmp/raw.db
gsutil cp /tmp/raw.db gs://the-stacks-corpus/raw-vN.db
sha256sum /tmp/raw.db | awk '{print $1}' | gsutil cp - \
  gs://the-stacks-corpus/raw-vN.db.sha256

# Re-embed experiment (occasional):
gsutil cp gs://the-stacks-corpus/raw-vN.db /tmp/raw.db
the-stacks embed --raw /tmp/raw.db --db /tmp/stacks-X.db --strategy ...

# Pulling locally for ad-hoc SQL:
gsutil cp gs://the-stacks-corpus/raw-latest.db /tmp/raw.db
sqlite3 /tmp/raw.db "SELECT ..."
```

`raw-latest.db` is a symlink/alias to the newest versioned file.

## Subcommand: `the-stacks pull-raw`

For convenience, wrap the gsutil download:

```
the-stacks pull-raw \
  --bucket gs://the-stacks-corpus \
  --version latest \
  --out /tmp/raw.db
```

Verifies sha256, reports version + capture date.

## Done when

- GCS bucket exists with documented IAM
- `gsutil cp` flow works for upload + download (manual test)
- `the-stacks pull-raw` subcommand works against a real version
- Version naming scheme documented
  (`raw-v1.db` / `raw-v2.db` / `raw-latest.db`)
- Setup steps documented in `docs/publishing-corpus.md` so
  anyone (including future me) can re-create the bucket from
  scratch
- Lifecycle policy + IAM committed as terraform or a setup
  script (probably overkill — a documented `gsutil`/`gcloud`
  recipe is fine for v0)

## Open questions

- **Bucket name conflict?** `the-stacks-corpus` may be taken.
  Pick during implementation.
- **Public-readable bucket?** Probably yes for raw.db
  (the data is already public on Polymarket's API). Means
  no auth needed for `the-stacks pull-raw` from any machine.
  Saves a service-account dance.
- **Service account secret for GH Actions** — gets stored as a
  GH Actions secret, not committed.

## Cost

- Storage: ~$0.13/mo per 6.5 GB raw.db. Three versions =
  ~$0.40/mo.
- Egress: ~$0.12/GB out. Rare downloads = pennies/month.

## Notes

Filed 2026-05-05. The "where does raw.db live" question got
locked when Evan flagged that this dev VM can't host it. GCS as
a dumb file store, sqlite always on local disk, bucket as cold
archive. Story A in the GCP options memo.
