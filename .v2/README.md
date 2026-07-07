# `.v2/` — retired v2 material (staging area, pending deletion)

This folder is a **holding pen** for artifacts from the retired v2 application. Nothing
here describes running code. It exists so the v3-only tree at the repository root reads
cleanly, while the v2 knowledge stays browsable for now. **It may be deleted later.**

## Why v2 is gone

v2 was retired on 2026-07-06 and removed from the working tree — see
[`docs/adr/0001-retire-v2-before-parity.md`](../docs/adr/0001-retire-v2-before-parity.md).
The full v2 **code** was never moved here; it lives only in git history (the last full v2
state is the parent of merge `cd9ed68` on `main`):

```bash
git checkout cd9ed68^ -- apps docker-compose.yml   # ...etc, to inspect old v2 code
```

## What's here

| Path | What it is |
|---|---|
| `courses/inside-the-stacks-v2/` | The interactive course for the retired v2 app |
| `wiki/` | 11 historical v2 architecture wiki pages (ETL, upload intake, layer/API boundaries, RAG retrieval, corpus/chat/queue architecture, etc.) |
| `grounding/02-v2-inventory.md` | The v2 inventory doc (what v2 built; what carried forward). Doc 02 of the grounding set, moved out of `docs/grounding/` |
| `specs/001-…` through `specs/006-…` | The v2-era feature specs (queue, API architecture/boundary, upload intake, error mapping, chat facade), which predate the v2→v3 split |

## A note on links

Cross-references **inside** these files (e.g. `[[wikilinks]]` and `specs/…` mentions) are
frozen as a historical record and are **not** maintained. They point at the layout that
existed when v2 was live. Do not treat them as live paths.
